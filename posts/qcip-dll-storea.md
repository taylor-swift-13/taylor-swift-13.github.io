内嵌双链表的链接字段位于业务对象内部。链表函数操作这些字段，业务代码却要通过它们找到宿主对象，访问 ID 等业务数据。`storeA` 的设计目的，是在通用链表规范中保留**每个节点与业务数据、内存资源之间的对应关系**，使结构操作的证明能够用于不同业务对象。

## 1. 只有链表结构还缺少什么

例子涉及两个 C 类型：

```c
typedef struct SysDoubleLinklistNode {
    struct SysDoubleLinklistNode *node_next;
    struct SysDoubleLinklistNode *node_prev;
} DoubleLinklistType;

struct IdNode {
    uint16 id;
    DoubleLinklistType link;
};
```

设宿主对象地址为 `p`，内嵌节点地址为 `x = &p->link`。链表中的指针指向 `x`，业务代码读取的字段却是 `p->id`。

如果规范只持有各节点的 `next/prev` 字段，就能描述链接关系并验证相关指针操作，但无法仅据此说明：`x` 来自哪个宿主对象、这个对象的 ID 是多少，以及能否读取它的 ID 字段。**能够沿链表找到节点，并不自动意味着具备访问宿主业务字段的依据。**

## 2. CONTAINER_OF 如何访问宿主字段

实际代码先遍历哈希桶中的双链表，再恢复宿主地址。下面完整保留内部查找函数；`manager->htable` 是哨兵数组，`hoffset` 用来选择桶，参数检查宏和初始化函数由平台提供。

```c
static struct IdNode *GetObj(struct IdManager *manager, uint16 id)
{
    NULL_PARAM_CHECK(manager);

    DoubleLinklistType *head = &manager->htable[id % manager->hoffset];
    DoubleLinklistType *node = NONE;
    struct IdNode *idnode = NONE;

    if (head->node_prev == NONE) {
        InitDoubleLinkList(head);
        return NONE;
    }

    DOUBLE_LINKLIST_FOR_EACH(node, head) {
        idnode =CONTAINER_OF(node, struct IdNode, link);
        if (idnode->id == id)
            break;
        idnode = NONE;
    }

    return idnode;
}
```

这里用到的两个宏为：

```c
#define DOUBLE_LINKLIST_FOR_EACH(item, head) \
    for (item = (head)->node_next; item != (head); item = item->node_next)

#define CONTAINER_OF(item, type, member) \
    ((type *)((char *)(item) - (unsigned long)(&((type *)0)->member)))
```

遍历宏沿 `node_next` 前进，并排除哨兵。`CONTAINER_OF` 则从成员地址减去该成员在结构体中的偏移，回推宿主地址。用 `offsetof` 记法说明它的计算过程：

```text
delta = offsetof(struct IdNode, link)
node = &p->link = p + delta
idnode = node - delta = p
```

转换成 `char *` 是为了按字节计算偏移。偏移由结构体布局决定，可能包含对齐填充。原宏的零地址表达式是依赖编译器支持的字段偏移写法。

接下来执行 `idnode->id` 时，代码已经从链表结构访问进入了业务字段访问。`CONTAINER_OF` 本身不会检查 `node` 是否确实来自一个有效的 `IdNode.link`，也不会提供读取 ID 字段所需的资源。这些条件需要由规范保证。

## 3. store_idnode 怎样支持这两步访问

当前验证中，`IdNodeAbs` 用 `idnode_addr` 记录宿主地址，用 `idnode_id` 记录 ID 值；`idnode_link node` 表示该宿主的 `link` 字段地址。业务资源定义为：

```coq
Definition store_idnode
  (link : addr) (node : IdNodeAbs) : Assertion :=
  let p := node.(idnode_addr) in
  “ p <> 0 /\ link = idnode_link node ” &&
  &(p # "IdNode" ->ₛ "id") # UShort |-> node.(idnode_id).
```

这个断言记录链表节点地址 `link` 与宿主地址 `p` 的关系，并拥有宿主的 ID 字段资源。它与 C 代码的对应关系是：

| C 代码 | 规范提供的依据 |
| --- | --- |
| `CONTAINER_OF(node, struct IdNode, link)` | `node = &p->link`，结合字段偏移计算，恢复宿主地址 `p` |
| `idnode->id` | 持有 `p->id` 字段，且其中存储逻辑记录中的 ID 值 |

`p <> 0` 和 `link = idnode_link node` 是纯条件；`UShort |-> node.(idnode_id)` 才提供实际字段的堆资源。因此，仅有“对象对应这个 ID”的纯命题，不足以支持 C 字段读取。

证明遍历代码时，需要展开或拆分链表谓词，暴露当前节点的这份断言，再分别证明地址计算和字段读取。**`CONTAINER_OF` 计算地址，`store_idnode` 描述地址对应的对象及可用资源。** 两者通过 `node = &p->link` 衔接。

## 4. 为什么把它抽象成 storeA

通用链表库不应写死 `IdNode` 的布局。其他业务可能使用不同宿主类型、不同数据字段和不同位置的内嵌节点，因此把业务部分抽象成一个参数：

```coq
storeA : addr -> A -> Assertion
```

`storeA x d` 描述节点地址 `x` 对应逻辑数据 `d` 所需的资源。`A` 允许业务选择逻辑数据类型，`Assertion` 则允许同时表达纯关系和字段所有权。

链表使用一个逻辑记录，把节点地址与数据配对：

```coq
Record DL_Node (A : Type) : Type :=
  Build_DL_Node {
    getData : A;
    getPtr : addr;
  }.
```

它属于规范，不要求 C 节点增加 `data` 字段。递归链表谓词对每个逻辑节点 `a`，按下面的结构组合资源：

```text
storeA (getPtr a) (getData a)
** 该节点的 prev 字段
** 该节点的 next 字段
** 剩余链表
```

这里 `**` 是分离合取，表示各部分使用互不重叠的堆资源。完整的 `store_dll storeA head nodes` 因而同时保留节点顺序、链接结构与逐节点业务资源。

在当前 ID 验证中，业务侧选择 `A = IdNodeAbs`、`storeA = store_idnode`。链表库统一验证结构操作，业务代码需要恢复宿主并读取 ID 时，再展开具体的 `store_idnode`。

删除规范体现了这个接口的收益。若 `nodes = prefix ++ [removed] ++ suffix` 且 `getPtr removed = x`，删除后返回：

```text
store_dll storeA head (prefix ++ suffix)
** store_self_linked x
** storeA x (getData removed)
```

剩余节点的业务资源继续封装在链表中，被摘除节点的链接字段和业务资源交还调用者。`store_self_linked x` 只拥有两个指回 `x` 的链接字段，业务资源由旁边的 `storeA x (getData removed)` 单独描述。插入是相反的方向：调用者提供新节点的链接字段和业务资源，将它们一起封装进链表谓词。

这样，节点地址与业务资源的对应关系被纳入链表谓词，减少了业务侧单独维护这份关联的工作。同一套结构证明可以用于不同的 `storeA` 实例。

## 5. storeA 的资源边界

链表谓词已经持有 `next/prev` 字段，业务实例不能再次包含它们的独占所有权。对于 `IdNode`，链表负责 `link.node_next/link.node_prev`，`store_idnode` 负责 `id` 字段。它们虽然位于同一个对象中，仍是不同的内存位置。

业务资源也可以放在链表断言之外。只关心链接结构时，可以取 `A = unit`、`storeA = fun _ _ => emp`，由调用者单独持有业务字段。因此，使用非空 `storeA` 的动机来自业务验证的需要，而非内嵌链表结构本身。

## 6. 插入调用中的内存权限

CRTOS 的 `InsertObj` 先根据 ID 选择哈希桶，再把节点插入桶中的链表：

```c
static void InsertObj(struct IdManager *manager, struct IdNode *idnode)
{
    NULL_PARAM_CHECK(manager);
    NULL_PARAM_CHECK(idnode);

    DoubleLinklistType *head =
        &manager->htable[idnode->id % manager->hoffset];

    if (head->node_prev == NONE)
        InitDoubleLinkList(head);

    DoubleLinkListInsertNodeAfter(head, &idnode->link);
}
```

计算 `head` 的这一行读取了 `idnode->id`。因此，**验证整个 `InsertObj` 时，前条件必须提供这个字段的访问权限。**

再看最后一行调用的底层函数。它的实际函数体只有四次赋值：

```c
void DoubleLinkListInsertNodeAfter(
    DoubleLinklistType *linklist,
    DoubleLinklistType *linklist_node)
{
    linklist->node_next->node_prev = linklist_node;
    linklist_node->node_next = linklist->node_next;

    linklist->node_next = linklist_node;
    linklist_node->node_prev = linklist;
}
```

这四行只访问 `node_next/node_prev`，没有读取或修改 `id`。所以，在 `InsertObj` 调用这个函数时，可以选择只要求链接资源的规约，把 `id` 字段留在 `InsertObj` 手里。假设该字段的值为 7，资源变化可示意为：

```text
调用前：原链表链接 ** 新节点链接 ** idnode->id ↦ 7
调用后：更新后的链表链接       ** idnode->id ↦ 7
```

这里 `idnode->id ↦ 7` 表示拥有该字段的内存资源，并且其中存着 7。它没有用于满足底层插入函数的前条件，而是通过 frame 在这次调用前后保留下来。所谓“留在调用者手里”，指的是证明中的资源划分，不会改变 C 函数的参数或搬运内存。

**同一个 `id` 字段，对整个 `InsertObj` 是需要提供的资源；对其中调用的 `DoubleLinkListInsertNodeAfter`，则可以作为 frame 保留。** 是否可以 frame，需要看当前证明的是哪一次调用。

## 7. 两种资源组织对后续访问的影响

同一次链表插入，可以把业务资源独立保留，也可以用 `storeA` 将它封装进链表。两种写法不改变 C 程序，但会影响 caller 下一步怎样取得字段资源。

先看一个已知节点的调用示例。假设调用前已拥有合法的链表、新节点链接，以及值为 7 的 `id` 字段；下面在插入之后增加一行读取：

```c
DoubleLinkListInsertNodeAfter(head, &idnode->link);
int value = idnode->id;
```

如果采用仅描述链接的规约，`id` 字段可以按上一节的方法通过 frame 保留。调用后的断言中直接有：

```text
更新后的链表链接 ** idnode->id ↦ 7
```

第二行读取直接使用右侧的字段资源，就能证明 `value == 7`。

如果采用携带业务资源的 `storeA`，插入后 `id` 字段会被收进链表谓词。它描述的资源可以示意为：

```text
更新后的链表谓词
  ├─ 第一个节点的链接 + 对应的 id 字段
  ├─ 第二个节点的链接 + 对应的 id 字段
  └─ ……
```

此时 `idnode->id` 的资源仍然存在，只是封装在链表谓词内部。证明第二行读取时，需要展开或拆分谓词，取出对应的字段资源；读取后，再根据后续规约需要恢复表示。**对于“已知节点，插入后立即读它”的调用，独立保留字段资源更直接。**

当前项目的 `InsertObj` 验证选择将 ID 资源封装进链表。这种组织方式的好处，可以从 `GetObj` 的实际遍历代码看出来：

```c
DOUBLE_LINKLIST_FOR_EACH(node, head) {
    idnode = CONTAINER_OF(node, struct IdNode, link);
    if (idnode->id == id)
        break;
    idnode = NONE;
}
```

每一轮访问的对象都由当前 `node` 决定。使用 `storeA` 时，展开当前链表节点，可以同时取得它的链接和对应业务资源；再展开具体业务谓词，得到宿主地址以及该对象的 `id` 字段资源。这样就能依次证明 `CONTAINER_OF` 的地址计算和 `idnode->id` 的读取。

如果业务资源独立存放，也能证明这段遍历，但每一轮都需要从独立资源集合中提取当前节点对应的 `id` 字段。**frame 能保留这些资源，不会自动找到当前节点对应的那一份。** 无论采用哪种组织方式，`GetObj` 的前条件都必须提供它内部读取业务字段所需的权限。

因此，已知业务对象、调用后直接使用它的字段时，独立保留资源通常更方便；沿链表逐个查找并访问业务字段时，使用 `storeA` 通常更方便。底层插入函数在两种情况下都只修改链接，业务字段都保持不变。

`storeA` 与 frame 可以配合使用：前者组织业务资源，后者保证未访问的资源在调用期间保持不变，即使这些资源原先封装在链表中，展开后也可以通过 frame 保留。库中已有 `store_dll_decompose` 和 `store_dll_compose`，支持将携带业务资源的链表拆成“仅含链接的链表与独立业务资源集合”，并重新组合。

callee 自身会访问哪些字段，可以从函数体确定；后条件把资源单独交还还是封装进数据结构，则需要结合 caller 后续的使用方式设计。缺少具体 caller 时，可以验证 callee 的行为，但还不能确认资源的组织方式是否方便后续业务使用。

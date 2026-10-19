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

本例将业务资源描述为：

```coq
Definition store_idnode
  (node_storeA : addr -> Z -> Prop)
  (link : addr) (id : Z) : Assertion :=
  EX p : addr,
    “ link = &(p # "IdNode" ->ₛ "link") ” &&
    “ node_storeA p id ” &&
    &(p # "IdNode" ->ₛ "id") # UShort |-> id.
```

这个断言以链表节点地址 `link` 为入口，给出宿主地址 `p`、业务关系，以及 ID 字段资源。它与 C 代码的对应关系是：

| C 代码 | 规范提供的依据 |
| --- | --- |
| `CONTAINER_OF(node, struct IdNode, link)` | `node = &p->link`，结合字段偏移计算，恢复宿主地址 `p` |
| `idnode->id` | 持有 `p->id` 字段，且其中存储逻辑值 `id` |

`node_storeA p id` 是返回 `Prop` 的纯关系；`UShort |-> id` 才提供实际字段的堆资源。因此，仅有“对象对应这个 ID”的纯命题，不足以支持 C 字段读取。

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

在 `IdNode` 例子中，业务侧选择 `A = Z`、`storeA = store_idnode node_storeA`。链表库统一验证结构操作，业务代码需要恢复宿主并读取 ID 时，再展开具体的 `store_idnode`。

删除规范体现了这个接口的收益。若 `nodes = prefix ++ [removed] ++ suffix` 且 `getPtr removed = x`，删除后返回：

```text
store_dll storeA head (prefix ++ suffix)
** xizi_dll_detached x
** storeA x (getData removed)
```

剩余节点的业务资源继续封装在链表中，被摘除节点的链接字段和业务资源交还调用者。`xizi_dll_detached x` 表示两个链接字段均指回 `x`。插入是相反的方向：调用者交出新节点的链接字段和业务资源，将它们一起封装进链表。

这样，业务侧不必在每次结构操作后，重新维护一套独立的“节点地址对应哪份业务资源”的关系。同一套结构证明可以用于不同的 `storeA` 实例。

## 5. storeA 的资源边界

链表谓词已经持有 `next/prev` 字段，业务实例不能再次包含它们的独占所有权。对于 `IdNode`，链表负责 `link.node_next/link.node_prev`，`store_idnode` 负责 `id` 字段。它们虽然位于同一个对象中，仍是不同的内存位置。

业务资源也可以放在链表断言之外，通过 frame rule 保留；`storeA` 的收益是把逐节点的数据与资源对应关系组织成可复用的接口。只关心链接结构时，可以取 `A = unit`、`storeA = fun _ _ => emp`。因此，使用非空 `storeA` 的动机来自业务验证的需要，而非内嵌链表结构本身。

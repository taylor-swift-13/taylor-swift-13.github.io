CRTOS 的 AVL 验证最初使用 `data2addr` 映射表示顶层状态，类型是 `Z -> option addr`。`m k = Some p` 表示树中存在键 `k`，而且这个键当前存放在节点地址 `p`。它同时回答了两个问题，键是否存在，以及键存在哪里。

随后，四个对外 API 的顶层状态统一为键集合 `Z -> Prop`。这个决定来自 Delete 的具体实现，也改变了 Search 向调用者交还内存资源的方式。底层仍然使用带地址的树图来证明指针操作，集合承担的是公开接口中的键语义。

## 一、data2addr 映射与 Search 规约

这里的 `data` 就是排序键。节点还有 `height`、`left` 和 `right`，没有另一个独立的业务 value 字段。讨论 `data2addr` 时，映射的值是节点地址。

最初的 Rocq 关系如下。

```coq
Definition avl_mapping : Type := Z -> option addr.

Definition avl_mapping_refines_graph
    (m : avl_mapping) (g : avl_model) : Prop :=
  forall key x,
    m key = Some x <->
      avl_vvalid g x /\ avl_key_of g x = key.
```

`None` 表示键不存在，`Some p` 表示对应地址为 `p`。根指针和整棵树的堆资源由另一层表示谓词管理。对于 Search，这个接口很直接，查找成功后的返回值就是 `m(data)` 中记录的地址。

map 对 Search 的好处尤其明确。顶层规约可以直接把返回值与输入映射联系起来，下面用原先的映射表示谓词写出这一形式；`avl_balanced_mapping_root_rep` 负责把 `m`、根指针与整树内存对应起来。

```c
AvlNodeType AvlNodeSearchNode(AvlNodeType avl_node, int32 data)
  /*@ high_level_spec <= low_level_spec
      With m
      Require avl_balanced_mapping_root_rep(m, avl_node)
      Ensure
        ((m(data) == None && __return == 0) ||
         (m(data) == Some(__return) && __return != 0)) &&
        avl_balanced_mapping_root_rep(m, avl_node)
  */
;
```

未命中时，`m(data) = None`，返回 `NULL`；命中时，返回值就是 `m(data)` 记录的地址。调用前若已知 `m(data) = Some p`，调用后便能直接推出 `__return = p`。这是 map 相比纯键集合提供的额外信息：调用者可以预先指定目标节点的身份，而不只是知道会返回某个保存该键的节点。继续读取 `p->data` 时，需要从树表示中取得字段的内存资源。

## 二、返回子树根与稳定的地址绑定

### 返回插入位置：直接关联键与地址

Boost.Intrusive 的官方 AVL 实现提供了直接返回插入节点的算法。Boost 1.85.0 的 `avltree_algorithms.hpp` 中，`insert_equal_upper_bound` 先把 `new_node` 接入二叉搜索树，再进行 AVL 再平衡，最后返回 `new_node`。下面是官方源码中的完整函数：[Boost 官方仓库，348—355 行](https://github.com/boostorg/intrusive/blob/boost-1.85.0/include/boost/intrusive/avltree_algorithms.hpp#L348-L355)。

```cpp
   template<class NodePtrCompare>
   static node_ptr insert_equal_upper_bound
      (node_ptr h, node_ptr new_node, NodePtrCompare comp)
   {
      bstree_algo::insert_equal_upper_bound(h, new_node, comp);
      rebalance_after_insertion(h, new_node);
      return new_node;
   }
```

参数 `h` 是树的头节点，`new_node` 是调用者提供的待插入节点，`comp` 是节点比较器。树的根通过头节点维护；完成再平衡后，函数把刚插入的节点地址交还给调用者。即使旋转改变了树根，返回值依然是 `new_node`。

以插入一个原先不存在的键 `data` 为例，设 `new_node = p`，data2addr 可以直接把输入节点、返回值和结果映射联系起来：

```text
ret = p
m_after = put(data, p, m)
```

这里 `put(data, p, m)` 把 `data` 绑定到 `p`，保留其余键的地址绑定。Boost 的这个算法接收已有节点并将其链接入树，调用者在调用前就持有 `p`；返回值继续标识这个节点。Search 也有同样的表达优势，命中后可以直接写出 `m(data) = Some ret`。

CRTOS 的 `AvlTreeInsertNode` 返回插入并平衡后的树根。根可能保存另一个键；调用者取得插入键所在节点的地址时，需要在结果根上调用 `AvlNodeSearchNode`。`AvlTreeDeleteNode` 同样返回删除并平衡后的树根，删空时返回 `NULL`。

| 接口 | 返回值的含义 | 调用者如何取得目标键的位置 |
| --- | --- | --- |
| Boost AVL 的 insert_equal_upper_bound | 传入的插入节点 new_node | 直接使用返回的节点 |
| CRTOS Insert | 插入后的树根；分配失败返回 `NULL` | 成功后在结果根上调用 Search |
| CRTOS Delete | 删除后的树根；删空返回 `NULL` | 对保留键在结果根上调用 Search |
| CRTOS Search | 命中节点的地址；未命中返回 `NULL` | 直接使用命中地址 |

对 CRTOS 的 AVL 树，例如原树根为 `30@A`，左孩子为 `10@B`，插入 `20` 并完成平衡后，`20` 成为新根，此时根地址恰好也是插入节点的地址。若在根 `20@A`、左孩子 `10@B` 的树中插入 `30@C`，树根保持 `A`，CRTOS Insert 返回 `A`，返回插入位置的接口则交付 `C`。两种接口分别把“更新整棵树的入口”和“访问目标元素的位置”交给调用者。

### 返回子树根：接回更新后的结构

一些 C++ 二叉搜索树实现让插入、删除的递归辅助函数返回修改后的子树根，父节点再把返回地址接回相应的孩子字段。删除节点没有右孩子时，可以直接删除当前节点并返回左子树根。

```cpp
if (node->right == nullptr) {
    Node* left = node->left;
    delete node;
    return left;
}
```

这里返回的是原左子树的根地址，左子树为空时就是 `nullptr`。若被删键 `20` 位于 `A`，左孩子键 `10` 位于 `B`，删除后返回 `B`，但 `10` 仍保存在 `B`。父节点需要接回的根变了，其余键的地址绑定没有改变。这个分支的映射变化就能精确写成 `m_after = remove(20, m)`。

在保留已有节点身份的实现中，新键插入成功后，已有键仍对应原节点，新键绑定到新分配的节点，结果映射可以写成 `m_after = put(data, new_addr, m)`。其中 `put` 只更新指定键的绑定，`remove` 只移除指定键。即使平衡操作把原左孩子或右孩子旋转为新根，递归函数返回了另一个地址，只要节点继续保存各自的键，旧键的 map 绑定就保持不变。根指针由树表示谓词单独记录。

要让整个删除操作都满足简单的 `remove`，双孩子分支也必须保持其余键所在节点的身份。例如，把前驱或后继节点本身摘出并移接到目标位置，而不是把它的键复制到另一个节点。libstdc++ 的红黑树实现就明确采用重新链接后继节点的方式处理双孩子删除，以保留未删除元素的迭代器有效性。这个例子体现了适合 data2addr 抽象的实现选择。参见 [GCC 的 stl_tree.h 源码说明](https://gnu.googlesource.com/gcc/+/refs/heads/master/libstdc%2B%2B-v3/include/bits/stl_tree.h)。

## 三、CRTOS Delete 的前驱键复制

CRTOS 的 Delete 采用了另一种处理方式，因而让地址这一层信息变得复杂。待删除节点有两个孩子时，代码在左子树中找到最右节点，也就是前驱，把前驱的键复制到当前节点，再递归删除原前驱节点。

```c
pred = avl_node->left;
while (pred->right) {
    pred = pred->right;
}

avl_node->data = pred->data;
avl_node->left = AvlTreeDeleteNode(avl_node->left, pred->data);
```

设树根的键是 `20`、地址是 `A`，左孩子的键是 `10`、地址是 `B`，右孩子的键是 `30`、地址是 `C`。删除 `20` 时，代码把前驱键 `10` 写进 `A->data`，随后在左子树里递归删除 `10`。这个例子里，递归删除最终释放的是 `B`。

| 键 | 删除前 | 删除后 |
| --- | --- | --- |
| `20` | `Some A` | `None` |
| `10` | `Some B` | `Some A` |
| `30` | `Some C` | `Some C` |

如果把删除的后条件写成 `m_after = remove(20, m)`，它会保留 `10 ↦ B` 这条旧绑定，但 `B` 已经被释放。对于这个双孩子分支，精确的 map 更新还必须把前驱键改绑到原目标节点的地址。目标节点至多有一个孩子时，直接移除目标绑定就足够。

旋转带来的影响要另外看。旋转会改变根和左右边，但每个节点仍然保存自己的键。某个节点成为新根，并不会因此改变 `data2addr` 的绑定。前面的地址变化来自复制前驱键和释放原前驱节点。

这次删除对应的结果映射 `m_after` 中，`10` 的值应为 `Some A`。要让调用者得到这一变化，顶层规约需要给出新旧地址之间的关系。此前验证通过的 Delete 规约对保留键使用了这样的条件。

```text
exists old_ptr new_ptr,
  m(key) = Some(old_ptr) /\
  m_after(key) = Some(new_ptr)
```

这只能保证该键在删除前后都存在，`old_ptr` 和 `new_ptr` 可以不同。调用者即使知道整个旧 map，也无法通过这条条件确定新地址，更无法据此证明一个保存下来的旧指针仍然有效。结果 map 在实际结果树上有确定含义，但接口没有把具体的新旧绑定关系交给调用者。

要把这种关系写得精确，就需要告诉调用者哪些情况下发生前驱替换，以及前驱是哪一个键。键的大小关系足以定义有序前驱，但 map 没有记录左右孩子，无法单独判断目标节点是否进入双孩子替换分支。随着这些结构事实进入接口，顶层规约会越来越接近底层树图。

## 四、集合抽象与底层内存表示

调整后的 API 公开键集合，底层图继续描述地址、拓扑和高度。插入和删除的集合变化可以直接由输入集合定义，调用者也不必在每次更新后接收一张地址绑定关系较弱的新 map。当前集合及其内存表示使用下面这些 Rocq 定义。

```coq
Definition avl_key_set := Z -> Prop.

Definition avl_set_refines_graph (keys : avl_key_set) (g : avl_model) : Prop :=
  forall key, keys key <-> In key (avl_keys g).

Definition avl_set_member (keys : avl_key_set) (key : Z) : Prop := keys key.

Definition avl_set_insert (keys : avl_key_set) (key : Z) : avl_key_set :=
  fun x => x = key \/ keys x.

Definition avl_set_remove (keys : avl_key_set) (key : Z) : avl_key_set :=
  fun x => keys x /\ x <> key.

Definition avl_balanced_set_root_rep (keys : avl_key_set) (root : addr) : Assertion :=
  EX g, “ avl_gvalid g /\ root = avl_ptr_of (avl_root g) /\
          avl_set_refines_graph keys g ” && avl_tree_store g.
```

`keys k` 表示键 `k` 属于集合。集合本身是纯逻辑对象，不提供任何字段的内存所有权。`avl_set_refines_graph` 要求集合成员与图中的键完全一致，`avl_balanced_set_root_rep` 则在内部存在量化一张图 `g`，同时持有 `avl_tree_store g`。

这张图仍记录根地址、每个有效节点、左右孩子、键和高度缓存。`avl_tree_store` 把每个节点对应到 C 的 `data`、`height`、`left` 和 `right` 四个字段，并用分离合取组合所有节点的资源。结构合法、键顺序、高度缓存一致和 AVL 平衡也由图级条件约束。顶层改成 set 后，证明指针读写、旋转和释放所需的地址信息仍保存在这一层。

## 五、四个 API 的集合语义

四个 API 的公开效果也因此可以用同一种状态描述。

| API | 返回值与集合变化 |
| --- | --- |
| Search | 未命中返回 `NULL`，命中返回保存该键的节点地址，集合保持 |
| Insert | 重复键时返回原根；新键插入成功后返回结果根，集合为 `keys ∪ {data}`；分配失败返回 `NULL`，交还原根上的树 |
| Delete | 未命中返回原根；命中后返回结果根，集合为 `keys \ {data}`，删空时结果根为 `NULL` |
| Modify | 非空输入修改成功后返回结果根，集合为 `(keys \ {source}) ∪ {target}`；空输入或分配失败返回 `NULL`，交还原树 |

Insert、Delete 和 Modify 的成功返回值表示结果树根。Insert 和 Modify 分配失败时返回 NULL，原树仍由旧根持有。Search 命中时返回目标节点的地址。调用者需要某个键的节点地址时，可以在当前根上调用 Search。

Delete 的当前 high-level spec 只保留两条分支，直接按目标键是否存在区分。

```c
AvlNodeType AvlTreeDeleteNode(AvlNodeType avl_node, int32 data)
  /*@ high_level_spec <= low_level_spec
      With keys
      Require avl_balanced_set_root_rep(keys, avl_node)
      Ensure
        (!avl_set_member(keys, data) && __return == avl_node &&
         avl_balanced_set_root_rep(keys, __return)) ||
        (avl_set_member(keys, data) &&
         avl_balanced_set_root_rep(avl_set_remove(keys, data), __return))
  */
;
```

空树的集合没有任何成员，所以输入为空树时自然落在未命中分支，返回原来的 `NULL` 根。如果删除唯一的键，目标在输入集合中，结果集合为空，返回的结果根为 `NULL`，仍然属于命中分支。`avl_balanced_set_root_rep` 支持空树，因此这两种情况都能由相同的表示谓词处理。

## 六、set 下的 Search 与字段所有权

Search 返回节点地址后，调用者可以继续读取 `p->data`。为了验证这次读取，后条件需要同时提供字段的内存所有权，以及字段值等于查找键的事实。

最初，这些事实封装在 `avl_balanced_set_hit_rep` 中。它在内部隐藏同一张图 `g`，保证结果节点有效、键匹配，并持有整树内存。但在 QCP 调用点中，直接写 `Given g` 会报错，因为符号执行状态里还没有显式的这个存在见证。可以先用 `Assert exists g, ...` 暴露图和字段，再用 Rocq 证明展开谓词、拆分节点资源，之后 `Given g` 才能使用它。

这个调用点能够验证通过，不过每个需要读取返回节点的调用者都要重复这一步。最终，Search 的接口证明承担资源展开，在命中后条件中直接写出 `exists g` 和字段断言。当前规约如下。

```c
AvlNodeType AvlNodeSearchNode(AvlNodeType avl_node, int32 data)
  /*@ high_level_spec <= low_level_spec
      With keys
      Require avl_balanced_set_root_rep(keys, avl_node)
      Ensure
        ((!avl_set_member(keys, data) && __return == 0) &&
         avl_balanced_set_root_rep(keys, avl_node)) ||
        (exists g,
          avl_set_member(keys, data) && __return != 0 &&
          avl_gvalid(g) &&
          avl_node == avl_ptr_of(avl_root(g)) &&
          avl_set_refines_graph(keys, g) &&
          avl_vvalid(g, __return) &&
          avl_key_of(g, __return) == data &&
          store(&(__return->data), data) *
          store(&(__return->height), avl_height_of(g, __return)) *
          store(&(__return->left), avl_ptr_of(avl_left(g, __return))) *
          store(&(__return->right), avl_ptr_of(avl_right(g, __return))) *
          avl_graph_nodes_store(g, avl_nodes_without(g, __return)))
   */
;
```

`store(&(__return->data), data)` 同时提供读取这个字段的资源和读出的值。其余三个字段及剩余节点资源也一并交还，调用者可以在需要时恢复整树表示。这里选择分别写出四个字段，是为了复用现成的节点拆分和重组证明。

## 七、调用点如何取得字段资源

已知查找键存在时，调用点直接使用上面的 high spec 读取节点。

```c
int32 SearchReadKey(AvlNodeType root, int32 key)
  /*@ With keys
      Require avl_set_member(keys, key) &&
              avl_balanced_set_root_rep(keys, root)
      Ensure __return == key@pre &&
             avl_balanced_set_root_rep(keys, root@pre)
  */
{
    AvlNodeType p = AvlNodeSearchNode(root, key)
        /*@ where(high_level_spec) keys = keys */;
    /*@ Given g */
    return p->data;
}
```

前条件中的成员关系排除了未命中分支。QCP 从命中后条件取得显式存在见证和字段资源，`Given g` 让注解可以引用这张图，`return p->data` 读出的值就是 `key`。返回时的 Rocq 义务把四个字段和剩余节点重新组合，得到后条件里的原树表示。

这个过程也说明了存在量词的作用。`g` 是用于证明的逻辑见证，返回地址 `p` 来自 C 函数的执行。打开 `exists g` 可以取得关于 `p` 的事实，集合本身并没有计算出一个地址。保留同一张图上的字段所有权，才让“找到键”能够接续到“读取返回节点”的证明。

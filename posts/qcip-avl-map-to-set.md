在 CRTOS AVL 的形式化验证中，`data2addr` map 很自然地描述 Search：每个键对应一个具体节点地址。但同一抽象用于 Delete 时，简单的“删除目标键、其余键地址不变”后条件无法证明。沿着失败的规约检查源码，发现双孩子删除会复制前驱的键并释放前驱节点。于是，删除一个键可能使先前 Search 返回的另一个键的指针失效。

为完成当前实现的验证，顶层规约暂时改用键集合 set，底层证明仍保留节点地址和内存结构。set 可以证明哪些键存在，却不能向保存了 Search 指针的调用者保证地址稳定。最终应修复 Delete，再以 data2addr map 作为公开抽象。本文讨论的是功能正确性问题如何在顶层 spec 的抽象冲突中暴露：Search 承诺可用的节点地址，Delete 却不能保证未删除键的地址保持不变。随后分析 set 过渡方案的代价，以及回到 map 所需的实现修改。

## 一、Search 的地址规约为何选择 data2addr

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

## 二、Delete 的源码如何使规约失败

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

### 从证明障碍到功能错误

Search 的 map 规约交还保存目标键的具体节点地址。Delete 若要允许调用者继续使用未删除键的旧指针，就必须满足 `m_after = remove(deleted_key, m_before)`。上面的源码反例说明，这个等式无法成立的原因在实现里：删除 `20` 会释放此前 Search 对 `10` 返回的节点。若调用者保存了 `p = Search(root, 10)`，删除 `20` 后访问 `p->data` 就可能访问已释放内存。验证中 map 规约无法统一的现象，因而揭示了对可复用 Search 指针不合理的 Delete 行为。

## 三、set 规约能证明什么、遗漏什么

为了验证当前尚未修复的实现，API 顶层规约暂时退到只描述键是否存在的集合；底层图继续描述地址、拓扑和高度。它能证明删除后某个键是否仍存在，却不能约束这个键对应的节点地址。删除前 `Search(root, 10) = B`，删除另一个键后，即使 set 仍包含 `10`，再次搜索也可能返回 `A`，而 `B` 已被释放。调用者保存的旧指针因此可能失效。这正是 set 作为最终公开抽象的局限，不只是少了一个可供查询的地址。当前过渡版本的集合及其内存表示使用下面这些 Rocq 定义。

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

这张图仍记录根地址、每个有效节点、左右孩子、键和高度缓存。`avl_tree_store` 把每个节点对应到 C 的 `data`、`height`、`left` 和 `right` 四个字段，并用分离合取组合所有节点的资源。结构合法、键顺序、高度缓存一致和 AVL 平衡也由图级条件约束。顶层改成 set 后，证明单次调用内的指针读写、旋转和释放所需的地址信息仍保存在这一层；但各次调用的顶层 set 不连接同一个键在调用前后的地址，因此不能推出旧 Search 结果仍有效。若调用者还要读取返回节点的字段，map 和 set 两种顶层规约都需要交还相应的内存资源；直接展开底层图 `g` 是两者共有的抽象泄漏，并非 set 特有的缺点，也不是发现 Delete 错误的原因。真正的冲突在于 Search 返回节点身份，而 Delete 当前实现会改变未删除键的节点身份；set 只记录键是否存在，恰好隐藏了这项功能要求。

## 四、现有四个 API 的集合语义

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

## 五、修复 Delete，并回到 map 顶层规约

最终方案是修改 CRTOS 的 Delete，并继续使用 data2addr map 表示顶层状态。这样 Search 可以直接给出查询键对应的地址，Delete 则承诺删除其他键时保留这条地址绑定。其目标规约可以明确写成：

```text
forall k, m_after(k) =
  if k == deleted_key then None else m_before(k)
```

旋转可以改变树根和孩子链接，因为它不会改动节点保存的键。双孩子删除则需要移动前驱节点本身到目标位置，只释放原来保存待删键的节点，不能复制前驱键再释放前驱节点。这个实现方向还须覆盖前驱恰为左孩子、前驱更深且带左孩子以及删除后旋转的情形。

截至 CRTOS `517cca2e9`，Delete 仍采用复制前驱键的实现。文中的 set 规约和 QCP 证明只对应这一过渡版本，不能证明 Search 返回的旧指针在删除其他键后依然有效。修复 Delete 后，应恢复统一的 map 顶层规约，重新证明上述地址稳定关系，并检查调用 Delete 的 Modify。抽象失败的意义在于指出源码与预期接口之间的功能缺口；单纯降低抽象精度会把这个缺口藏起来。

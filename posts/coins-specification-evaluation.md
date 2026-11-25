## 1. 引言：从 CLEVER 到规约评估

### 1.1 CLEVER 如何组织端到端验证

[CLEVER](https://arxiv.org/abs/2505.13938v4) 是一个面向端到端验证代码生成的 Lean 4 基准，将 HumanEval 中的 161 个编程任务改写为形式验证任务。每题包含自然语言需求、函数签名、人工编写的参考规约，以及规约等价性和实现正确性的待证命题。[论文 §1—2](https://arxiv.org/html/2505.13938v4#S2)

模型需要完成下面四个步骤。前两步组成**规约认证**，后两步组成**实现认证**。[官方任务说明](https://github.com/trishullab/clever#benchmark-focus)

| 步骤 | 模型需要生成的内容 | 检查目标 |
| --- | --- | --- |
| 规约生成 | 根据自然语言需求生成 Lean 规约 $\psi$ | 形式定义能够通过编译 |
| 规约认证 | 生成 $\psi$ 与隐藏参考规约 $\psi^*$ 的等价证明 | 生成规约与参考规约语义等价 |
| 实现生成 | 生成符合函数签名的 Lean 实现 $\pi$ | 实现能够通过编译 |
| 实现认证 | 生成 $\pi$ 满足 $\psi^*$ 的正确性证明 | 实现符合人工参考规约 |

这里有一个重要设置：实现认证针对的是人工参考规约 $\psi^*$。CLEVER 这样设计，是为了让实现正确性的评价独立于模型能否生成正确规约。端到端成功要求两项认证都完成，相关证明由 Lean 检查。[论文 §2—3](https://arxiv.org/html/2505.13938v4#S2)

[![CLEVER 原论文图 1：规约认证与实现认证](../assets/papers/coins-evaluation/clever-figure-1.png)](../assets/papers/coins-evaluation/clever-figure-1.png)

*CLEVER 原论文图 1。Task 1 生成规约并证明其与人工参考规约等价；Task 2 生成实现，并针对人工参考规约证明正确性。两条认证路径分别到达 QED 1、QED 2。[原论文 PDF，第 2 页](https://arxiv.org/pdf/2505.13938v4)*

COINS 在引言中指出，CLEVER 的评估方式存在以下局限。[COINS §1](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf)

1. **参考规约构造成本高**。参考等价认证依赖人工编写的参考规约，需要投入较多专家时间，限制了评估的扩展。
2. **全称等价证明负担重**。要求候选规约与参考规约对所有输入输出等价，可能超出当时大模型的证明能力，导致认证成功率很低。
3. **认证失败的原因难以区分**。规约生成、实现生成和形式证明耦合在同一流程中，失败可能来自候选规约有误、实现有误，也可能只是证明尚未完成。
4. **评估信号稀疏**。认证依赖完整证明；当证明成功率很低时，大量候选只能得到“未通过认证”的结果，难以据此有效区分不同候选规约的质量。

为此，我们提出 COINS，将评估目标转向具体输入输出行为：把候选规约应用于正负案例，由模型构造证明，再交给 Rocq 检查。正例获得接受证明，说明规约保留了该正确行为；负例若也获得接受证明，则暴露规约放过错误行为的问题。COINS 也允许使用可计算定义辅助实例检查，旨在降低单次检查的证明负担，为规约质量提供更具体的行为证据。[COINS §1、§3、§4.4](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf)

## 2. COINS 的评估对象与流程

### 2.1 评估对象：输入输出之间的逻辑关系

COINS 将形式规约视为输入与输出上的逻辑命题，刻画正确实现应满足的功能性关系。论文主要讨论与实现无关的输入输出行为，内存布局、运行时异常等语言相关性质不在该工作的评估范围内。[论文 §2](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf)

评估时，我们固定输入输出对，将其代入候选规约，得到具体的 Rocq 命题，再由模型尝试构造证明。实验覆盖 HumanEval 的 164 个任务：正例来自 HumanEval+，负例从变异实现的错误输出中提取，每题选取 10 个。[论文 §3.1、§4.1](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf)

### 2.2 论文中的 `sort_third` 示例

论文使用 HumanEval 的 `sort_third` 说明规约与实例化检查：给定一个列表，将索引能被 3 整除的位置上的元素按非递减顺序排列，其余位置的元素保持不变。索引从 0 开始。[论文 §2](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=3)

原文的 Rocq 规约 `sort_third_spec` 包含三个条件：

1. 输出是输入的一个排列，保留所有元素及其出现次数。
2. 索引不能被 3 整除的位置，输出元素与输入相同。
3. 索引能被 3 整除的位置，其元素按非递减顺序排列。

论文给出的输入为 `[2;1;3;7;8;9;10]`，对应的正负例输出如下：

| 案例 | 输出 |
| --- | --- |
| 正例 | `[2;1;3;7;8;9;10]` |
| 变异负例 | `[7;1;3;2;8;9;10]` |

正例对应的 Rocq 证明目标是：

```coq
Example sort_third_pos :
  sort_third_spec [2;1;3;7;8;9;10]
                  [2;1;3;7;8;9;10].
```

对负例，候选规约不应允许该输出；若模型仍能构造出通过 Rocq 检查的接受证明，就暴露了规约过于宽松的问题。这两类案例分别用于检查正确行为的接受情况，以及发现被规约放过的错误行为。[论文 §2](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=3)

### 2.3 四阶段筛选

COINS 依次执行 `SYNTAX`、`PASSfirst`、`PASSall` 和 `REJECTall`，逐步筛选生成规约。[论文 §3.2](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf)

[![COINS 图 1：准备阶段与多阶段评估](../assets/papers/coins-evaluation/coins-figure-1.png?v=2987d78)](../assets/papers/coins-evaluation/coins-figure-1.png?v=2987d78)

*COINS 图 1。上方为规约和行为案例的准备，下方为四阶段评估。图中 Gemini 3 Pro Preview 的候选数量从 164 份筛选至 46 份。[论文 §3.2、表 2](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf)*

| 阶段 | 检查内容 | 候选如何保留 |
| --- | --- | --- |
| `SYNTAX` | 规约定义能否在 Rocq 环境中编译 | 编译成功 |
| `PASSfirst` | 首个正例能否获得接受证明 | 证明通过 Rocq 检查 |
| `PASSall` | 全部选定正例能否获得接受证明 | 所有正例的接受证明均通过 |
| `REJECTall` | 负例是否也能获得接受证明 | 未发现通过检查的负例接受证明 |

负例阶段允许模型判断拒绝后跳过证明，因此 `REJECTall` 不要求为每个负例构造否定证明。[论文 §3.2](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf)

@@opinion-begin@@

`REJECTall` 的通过应理解为“本轮检查没有获得负例被接受的证明”，而不是已经证明所有负例均被拒绝。对于声明式规约，正向的接受证明难以构造时，反向的拒绝证明有时同样困难。因此，这项工作只要模型判断拒绝，或未能给出通过 Rocq 检查的负例接受证明，就将该案例计为 reject。本质上，这仍是对证明能力的一种妥协。

@@opinion-end@@

## 3. COINS 的主要实验与发现

论文围绕四个研究问题组织主实验：选择证明模型、评估规约生成、区分规约质量与证明能力，以及考察可执行成分的作用。实验比较六个模型；每个证明任务最多尝试三次，尝试之间提供编译器或验证器的错误反馈。[论文 §4、附录 C](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=5)

### 3.1 RQ1：先用人工规约选择证明模型

为了减少规约质量与证明能力相互影响带来的不确定性，论文先固定经过人工编写与审核的规约，比较各模型完成实例证明的能力，再选取表现最好的模型评价后续生成规约。下方直接使用原论文表 1，保留原表的百分比和通过任务数，任务总数为 164。[论文 §4.1、表 1](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=5)

[![COINS 原论文表 1：不同模型在人工规约上的证明表现](../assets/papers/coins-evaluation/coins-table-1.png?v=2987d78)](../assets/papers/coins-evaluation/coins-table-1.png?v=2987d78)

*COINS 原论文表 1。比较各证明模型的 `PASSfirst` 与 `PASSall`，括号中为通过任务数。[原论文 PDF，第 5 页](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=5)*

Gemini 3 Pro Preview 的 `PASSall` 最高，为 **50/164（30.49%）**，因此被选为后续实验的主要证明模型。论文同时指出，即使使用人工规约，完成全部实例证明仍然困难。[论文 §4.1](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=5)

**评估对偶性。** 规约未能通过验证时，错误可能来自规约，也可能来自证明器；更强的证明器有助于识别规约质量，更可靠的规约也有助于评价证明能力。人工规约在这里作为相对可靠的参照，但并不是绝对正确的真值。[论文 §4.1](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=5)

@@opinion-begin@@

人工编写规约的表现已经说明，这套评估方法在当时仍会受到证明能力的限制，从而低估规约质量。但随着模型证明能力提升，加上测试用例并不稀缺，这类方法能够通过不断扩充输入输出案例，持续积累细粒度的行为证据，为规约质量提供更连续的评估信号。

@@opinion-end@@

### 3.2 RQ2：统一证明模型后，规约生成表现如何

这一实验由六个模型分别生成规约，主要比较统一使用 Gemini 3 Pro Preview 生成证明的结果，同时报告各模型自验证的表现。下方直接使用原论文表 2，保留全部阶段和两种证明设置；百分比以 164 个任务为分母，括号中为通过任务数。[论文 §4.2、表 2](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=7)

[![COINS 原论文表 2：规约生成与自验证的完整实验结果](../assets/papers/coins-evaluation/coins-table-2.png?v=2987d78)](../assets/papers/coins-evaluation/coins-table-2.png?v=2987d78)

*COINS 原论文表 2。`Generate Model` 为规约生成模型，`Verify Model` 为证明模型，后续各列对应四阶段评估。[原论文 PDF，第 7 页](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=7)*

**语法是第一道瓶颈。** 六个模型的语法通过率从 7.93% 到 78.05%，大量候选在行为评估之前就因无效语法或类型构造被淘汰。原文在 HumanEval 和该测试协议的范围内，将这类形式表达错误归纳为主要失败来源。[论文 §4.2](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=6)

@@opinion-begin@@

语法问题主要体现在 pass@1 的单次生成设置中；在现在采用编译器反馈、允许多轮修正的 Agent 流程中，这类问题基本不再构成障碍。

@@opinion-end@@

论文还报告了三项观察：

- **单个正例不足以支持完整评价。** Gemini 3 Pro Preview 的 `PASSfirst` 为 100/164，而 `PASSall` 为 46/164。多个测试共同约束规约语义，单例成功不能代表整套案例都能通过。
- **模型差异能够被区分。** COINS 的最终筛选率从 DeepSeek-V3.1 的 1.22% 到 Gemini 3 Pro Preview 的 28.05%。作为对照，CLEVER 在每题 600 秒预算下，各方案的端到端成功率仅为 0—0.621%（最多 1/161），单独的规约认证率也仅为 0—1.863%。两项实验使用的模型、证明语言和成功条件不同。[CLEVER 表 1](https://arxiv.org/html/2505.13938v4#S3)
- **结果不只来自自验证。** 原文同时比较模型证明自身规约的表现。例如 Claude 4.5 Opus 自验证的 `PASSall` 为 18/164，改用 Gemini 后为 24/164；GPT-5 则从 12/164 变为 25/164。作者据此认为，Gemini 的整体优势不能仅归因于验证自身产物。[论文 §4.2、表 2](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=7)

此外，本表六组统一证明模型的结果中，`PASSall` 与 `REJECTall` 计数均相同。原文将二者接近归因于测试覆盖对过度近似空间的约束，以及 HumanEval 任务相对简单；这是作者对该实验结果的解释。[论文 §4.2](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=6)

### 3.3 RQ3：规约质量与证明能力分别贡献多少

论文以“模型生成规约，并由自身证明”（Self-Verify + Self Spec）为基线，分别更换规约来源或证明模型，进行两项受控干预。保留证明模型、将规约替换为人工规约（Self-Verify + Human Spec），原文报告平均提升 **5.08 个百分点**；保留生成规约、将证明模型替换为 Gemini（Gemini-Verify + Self Spec），平均提升 **3.05 个百分点**。各模型的结果见原论文图 2。[论文 §4.3、图 2](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=6)

[![COINS 原论文图 2：规约质量与证明能力的消融](../assets/papers/coins-evaluation/coins-figure-2.png?v=2987d78)](../assets/papers/coins-evaluation/coins-figure-2.png?v=2987d78)

*COINS 原论文图 2。分别改变规约来源和证明模型，观察通过率变化。[原论文 PDF，第 6 页](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=6)*

**验证复杂度的权衡。** 两项干预都影响评估结果。虽然替换人工规约带来的平均提升更大，证明能力在实例检查中仍有显著影响。证明义务越复杂，就越依赖强证明器，也越容易因证明失败而系统性低估规约质量；即使评价目标本身严格，过难的证明过程仍可能使评分难以反映生成能力。[论文 §4.3](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=7)

### 3.4 RQ4：允许可执行成分会怎样影响规约与证明

论文构造允许和禁止 `Fixpoint` 的两版人工规约，并用 Gemini 3 Pro Preview 进行比较。同时，图 3 统计了不同来源的规约中 `Fixpoint` 的使用情况。[论文 §4.4、图 3—4](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=7)

[![COINS 原论文图 3：Fixpoint 使用情况](../assets/papers/coins-evaluation/coins-figure-3.png?v=2987d78)](../assets/papers/coins-evaluation/coins-figure-3.png?v=2987d78)

*COINS 原论文图 3。柱内同时标出使用数量与分母：Gemini 为 43/128，GPT-5 为 44/110，Claude 4.5 Opus 为 43/98，人工规约为 65/164。[原论文 PDF，第 7 页](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=7)*

在图 3 的统计中，三个较强模型的使用比例为 33.6%—43.9%，人工规约约为 39.6%；较弱模型使用 `Fixpoint` 的比例明显更低。图 4 则显示，禁止 `Fixpoint` 后，人工规约的首例与全部正例通过率都下降；原文还报告，禁止递归定义的版本需要更多代码，关系式表达更冗长，证明也更困难。[论文 §4.4](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=8)

[![COINS 原论文图 4：禁止 Fixpoint 对人工规约评估结果的影响](../assets/papers/coins-evaluation/coins-figure-4.png?v=2987d78)](../assets/papers/coins-evaluation/coins-figure-4.png?v=2987d78)

*COINS 原论文图 4。允许 `Fixpoint` 时，`PASSfirst`、`PASSall` 分别为 75.6%、30.5%；禁止后分别降至 61.6%、15.2%。图中百分比保留一位小数，与表 1 的人工基线一致。[原论文 PDF，第 8 页](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=8)*

**可执行成分很重要。** 用 `Fixpoint` 封装适当的子逻辑，可以降低规约复杂度与验证难度；强制只使用纯关系式表达，会使定义和证明义务更冗长。这也是论文允许规约包含可执行成分的实验依据。[论文 §4.4](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=8)

@@opinion-begin@@

例如，要求二维列表的每行之和都等于 3。纯关系式写法可先用 `Inductive Sum` 描述一行的求和关系，再用 `Inductive AllRowsSum` 在外层逐行引用它。证明 `[[1; 2]; [3]]` 满足规约时，需要在这两层归纳关系中逐层构造证据。

若把内层求和写成 `Fixpoint sum`，规约可写为 `Forall (fun row => sum row = 3) rows`。外层仍需逐行证明，但 `sum [1; 2] = 3` 和 `sum [3] = 3` 都能直接通过计算化简，无需再逐项构造内层的求和证据。

@@opinion-end@@

### 3.5 补充实验：实例筛选之后，等价证明仍有多难

附录 E 进一步比较通过筛选的人工与模型规约。在双方都通过筛选的 29 个任务上，**9 个**任务的两个蕴含方向均证明成功，**3 个**只有一个方向证明成功，另有 **17 个**两个方向都未完成证明。[论文附录 E](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=22)

论文人工复核了三个单向成功的案例，并认为它们实际语义等价，缺失方向来自证明能力限制。因此，原文把这组结果作为等价证明可能低估规约质量的进一步证据，认为它不适合作为主要质量指标。[论文附录 E](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=22)

## 4. 其他工作如何评估规约

### 4.1 VERINA

**发表**：[ICLR 2026](https://openreview.net/forum?id=0A4Uf88pog)。

对照人工 GT，评价前后置条件的 soundness 与 completeness。先尝试证明关系，再通过 `decide` 和 `plausible` 检查正负案例；未决结果单独报告。[评估方法](https://arxiv.org/html/2505.23135v3#S4.SS1)

记参考前后置条件为 $P,Q$，生成条件为 $\widehat P,\widehat Q$，四项全称关系为：

- 前置条件 soundness：$P(i)\Rightarrow\widehat P(i)$。
- 前置条件 completeness：$\widehat P(i)\Rightarrow P(i)$。
- 后置条件 soundness：$P(i)\land\widehat Q(i,o)\Rightarrow Q(i,o)$。
- 后置条件 completeness：$P(i)\land Q(i,o)\Rightarrow\widehat Q(i,o)$。

### 4.2 VerinaPlus / VeriScale

**公开版本**：[arXiv 预印本，2026](https://arxiv.org/abs/2605.22368v1)。

扩充合法输入输出、无效输入和错误输出，尤其利用对抗实现寻找规约漏掉的错误行为，再用 VERINA 的评估脚本计分。VerinaLite 则选用较少的测试，保留边界输入和能暴露已知错误实现的案例，以减少评估耗时。[评估方法](https://arxiv.org/html/2605.22368v1#S3)

[![VeriScale 原论文表 1：三套测试集的数量](../assets/papers/coins-evaluation/veriscale-table-1.png)](../assets/papers/coins-evaluation/veriscale-table-1.png)

*VeriScale 原论文表 1。[原论文 PDF，第 6 页](https://arxiv.org/pdf/2605.22368v1#page=6)*

### 4.3 AuXSpec

**公开版本**：[arXiv 预印本，2026](https://arxiv.org/abs/2611.21421v1)。

AuXSpec 保留声明式后置条件 $Q(i,o)$，再配对一个返回布尔值的检查器 $b(i,o)$。检查器用于执行正负测试，两者在合法输入上的对应关系为：

$$
\forall i,o,\quad P(i)\Rightarrow\bigl(Q(i,o)\Leftrightarrow b(i,o)=\mathrm{true}\bigr).
$$

检查器有两条构造路径。[论文 §3.1、附录 G.2](https://arxiv.org/html/2611.21421v1#S3.SS1)

1. **通过 `decide` 构造**：已有可计算的 `Decidable` 实例时直接使用，否则尝试合成实例；检查器与原后置条件构造一致。合成数据中 35.5% 采用这条路径。
2. **单独生成布尔检查器**：实例合成失败时，另写可执行定义，并声明上述等价定理，之后单独尝试证明。例如，特殊子序列计数的检查器枚举索引子集，参考实现则用三个计数器线性扫描。[原文示例](https://arxiv.org/html/2611.21421v1#A7.SS2.SSS1)

候选接纳要求**编译检查、冻结测试和 LLM judges**通过。Judges 分别检查：

1. **需求忠实性**：声明式后置条件是否准确表达题目要求。
2. **非算法复述（non-tautology）**：后置条件应描述什么输出是正确的，避免把求解算法搬进规约、直接算出答案。
3. **检查器完整性**：可执行检查器是否也能接纳未测试输入上的正确输出，并对照已接受的后置条件查找漏接或误接。
4. **实现质量**：代码任务另检查实现能否在合法输入上终止，以及开销是否适合题目约束。[论文 §2、附录 G.2—G.3](https://arxiv.org/html/2611.21421v1#S2)

题目本身就是指定变换时，可豁免非算法复述检查。枚举候选的规约仍可通过评估，但 RL 奖励为 0.4，低于完全通过的 1；配对的可执行检查器负责实际计算测试结果。[论文附录 G.2](https://arxiv.org/html/2611.21421v1#A7.SS2)、[附录 E.3.1](https://arxiv.org/html/2611.21421v1#A5.SS3.SSS1)

@@opinion-begin@@

例如，需求是“返回非空列表中的最大值”。声明式条件可写为 $m\in xs\land\forall x\in xs,\ x\le m$。只保留后半句，会错误接受列表 `[1; 3]` 的输出 `100`，遗漏了需求中的成员关系；若写成 `m = scanMax xs`，再在 `scanMax` 中实现逐项扫描，则体现了非算法复述检查要排除的做法。

独立的可执行检查器可以遍历列表，检查成员关系与大小关系。若误把 $\le$ 写成 $<$，连正确输出 `3` 都会被拒绝，属于漏接正确答案。这个例子说明，声明式规约不复述求解算法，并不妨碍另设可执行检查器。

@@opinion-end@@

桥接等价和实现正确性定理的证明在生成、训练和评分时可保留为 `sorry`，随后另行审计。因此，执行测试、judge 接纳和已完成的桥接证明是论文分别报告的环节。[论文 §2、附录 H.4](https://arxiv.org/html/2611.21421v1#S2)

### 4.4 LeetProof

**发表**：[ASE 2026](https://doi.org/10.1145/3832783.3837559)。

在代码合成前，先进行类型检查和 LLM judge 审核，再用输入输出例子与 Plausible 性质测试，检查规约能否接纳正确行为、排除错误输出。实验另以参考规约等价证明和人工复核评价生成质量。实现验证基于 Velvet——嵌在 Lean 中的命令式程序验证器，结合 SMT 自动证明与交互式证明处理验证条件。[评估方法](https://vexoben.github.io/files/leetproof-ase2026.pdf#page=4)、[Velvet 说明](https://vexoben.github.io/files/leetproof-ase2026.pdf#page=3)

### 4.5 Fulminate

**发表**：[POPL 2025 / PACMPL 9，Article 43](https://doi.org/10.1145/3704879)。

把具有计算解释的 CN 分离逻辑规约编译成 C 运行时检查，检查具体执行中的前后置条件、内存所有权及其转移，并通过注入缺陷和测试执行观察能否发现错误。[评估方法](https://www.cs.ox.ac.uk/people/christopher.pulte/2024-cn-testing-paper.pdf)

### 4.6 Spec-Harness

**公开版本**：[arXiv 预印本，2026](https://arxiv.org/abs/2604.00280v3)。

固定具体输入输出，结合 OpenJML 的 SMT 符号验证与输入输出变异，分别评价前后置条件的正确性和完整性。反馈测试与最终评估测试分开使用。[评估方法](https://arxiv.org/html/2604.00280v3#S5)

[![Spec-Harness 原论文图 1：changeCase 的 JML 规约](../assets/papers/coins-evaluation/spec-harness-figure-1.png)](../assets/papers/coins-evaluation/spec-harness-figure-1.png)

*Spec-Harness 原论文图 1。[原论文 PDF，第 4 页](https://arxiv.org/pdf/2604.00280v3#page=4)*

### 4.7 Isomorphism Is Not Enough

**公开版本**：[arXiv 预印本，2026](https://arxiv.org/abs/2605.23772v2)。

用 Claude、Codex 和 OpenHands 三套 agentic 系统审计 CLEVER 的全部 161 项任务，分别记录生成规约是否为需求的合理解释（valid），以及是否已证明与固定参考规约等价（accepted）。等价失败时，继续区分证明未完成、规约错误（issue）和双方都合理但解释不同（mismatch），并检查单向蕴含关系。作者复核 Lean 证明、评估器结果和 agent 轨迹，再请 CLEVER 作者确认逐项判定。[审计方法](https://arxiv.org/html/2605.23772v2#S2.SS2)

论文报告 **80 项参考规约问题**，其中 **48 项涉及 Lean 编码陷阱**，例如把蕴含写成合取、误用运算符优先级；另有 **1 项辅助定义错误**和 **13 项合理解释差异**。这几类结果分别计数。[论文 §3.1、§4.2](https://arxiv.org/html/2605.23772v2#S3.SS1)

CLEVER 的规约以实现函数 $f$ 和输入 $x$ 为参数，记为 $S(f,x)$；固定实现后，$\forall x,\ S(f,x)$ 表示它满足整份契约。因此，整体等价认证比较的是“哪些实现满足这份契约”，而非只把某个测试用例代入规约。[CLEVER 的定义](https://arxiv.org/html/2505.13938v4#S2)

论文指出，CLEVER 检查的整体等价命题形如：

$$
\forall f,\quad\bigl(\forall x,\ S(f,x)\bigr)\Leftrightarrow\bigl(\forall x,\ T(f,x)\bigr).
$$

若两份契约均无任何实现能满足，则对每个 $f$，两边的全称命题都为假，等价仍成立：两份契约允许的实现集合都是空集。论文在第 67、160 项任务中观察到这种空洞成功。因此，作者建议增加逐点检查，或给出满足双方规约的见证实现，并结合其他语义评价。[论文 §4.4](https://arxiv.org/html/2605.23772v2#S4.SS4)

**评估机制对照**

规约本身能在实例上求值，记为“可执行”；通过另一个可运行的检查器判断行为，记为“可检查”。可执行检查器包括布尔检查器、性质测试和 SMT 求解器。证明内核的证书核验单独归入证明流程。

| 工作 | 原规约须可执行 | 可执行检查器 | LLM judge | 大模型写证明 |
| --- | --- | --- | --- | --- |
| [CLEVER](https://arxiv.org/html/2505.13938v4#S2) | 不要求 | 不要求 | — | 参考等价与实现证明 |
| [COINS](https://github.com/taylor-swift-13/Coins_ICML_2026/blob/main/paper/main.pdf#page=4) | 不要求 | 不要求 | 负例拒绝预判断 | 实例证明 |
| [VERINA](https://arxiv.org/html/2505.23135v3#A3.SS5) | 非硬性要求 | 测试分支用 `decide` / PBT | — | 先尝试关系证明，未决时回退测试 |
| [VerinaPlus / VeriScale](https://arxiv.org/html/2605.22368v1#S4.SS2) | 沿用 VERINA | 沿用 VERINA 测试评估器 | — | 未新增逐题证明要求 |
| [AuXSpec](https://arxiv.org/html/2611.21421v1#S2) | 不强制；`decide` 路径可执行 | 独立布尔检查器路径要求可检查 | 需求忠实性、非算法复述、检查器完整性 | 可判定实例构造、事后等价审计 |
| [LeetProof](https://vexoben.github.io/files/leetproof-ase2026.pdf) | 测试涉及的部分需可计算或可采样 | 规约用 Plausible；实现验证另用 SMT | 规约与例子审核 | 实验中的参考等价审计；实现证明 |
| [Fulminate](https://doi.org/10.1145/3704879) | 是：CN 的计算片段 | C 运行时检查（不依赖 SMT） | — | — |
| [Spec-Harness](https://arxiv.org/html/2604.00280v3#S5) | 不要求 | 是：OpenJML / SMT 符号检查 | — | — |
| [Isomorphism Is Not Enough](https://arxiv.org/html/2605.23772v2#S2.SS2) | 不要求 | 不要求 | agent 语义判读，人工复核 | Lean 等价与实现证明 |

## 5. 规约评估的困难

@@opinion-begin@@

1. **需求与使用场景决定什么是正确规约**。同一功能在不同场景下可能有不同的边界条件、允许行为和资源要求。现有基准多采用需求相对清晰的算法题，真实场景中的需求歧义和上下文依赖更难评估。
2. **内存权限与系统状态更难处理**。许多工作集中在算法题和 Lean 中的输入输出关系，避开了复杂内存管理。进入 C 等系统程序后，还需检查指针别名、资源所有权及其转移，单纯比较返回值远远不够。
3. **定理证明的瓶颈正在逐步消退**。随着大模型定理证明能力提升，因证明未完成而低估规约质量的问题有望持续减少，评估也能覆盖更复杂的声明式规约。
4. **可判定性与可执行性不是必要条件**。规约代入实例后不必能直接判定，规约本身也不必可执行。要求可判定或可执行，主要是出于检查成本的考虑。另外，一些工作要求规约不暴露实现细节，但仍依赖 LLM judge 作判断，缺少独立、确定的检查。因此，声明式规约更有利于隐藏实现细节，但更难进行自动检查。

@@opinion-end@@

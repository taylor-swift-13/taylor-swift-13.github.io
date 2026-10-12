## 一、两篇论文讲什么，问题从哪里来

### 1.1 Vero：仓库级的可验证代码生成

Ye 等人的 [*Vero: Can AI Agents Build Formally Verified Software Repositories?*](https://arxiv.org/abs/2608.13522) 于 **2026 年 8 月 13 日**作为 arXiv 预印本公开（arXiv:2608.13522）。论文研究代理能否同时完成整个软件仓库的实现与机器检查证明。已有基准主要考单个函数，或固定实现后的证明生成；Vero 把接口、规格和模块依赖一起交给代理。

Vero 收录 **43 个多模块 Lean 4 仓库**，提供固定 API、人工审核的规格和参考实现。它同时考 proof-only 与 code-and-proof，并允许代理用形式化反证指出规格或参考实现的错误。最强代理在 code-and-proof 模式完整解决 **27/43** 个仓库。仓库级完整解决数成为论文的核心指标。

### 1.2 CoCo-Prover：证明任务的成本调度

Yao 等人的 [*Cost-Efficient Theorem Proving via Agent Orchestration in Program Verification*](https://arxiv.org/abs/2610.09681) 被 **NeurIPS 2026 Workshop on AI for Verifiable Coding（VERICODEGEN）**接收为海报论文，并于 **2026 年 10 月 7 日**公开 arXiv 版本（arXiv:2610.09681）。论文研究证明成功率与模型费用的关系。一个仓库包含大量有依赖的证明目标：有些可由 Lean 自动化直接关闭，有些需要深层归纳或共享引理。均匀分配模型预算会把钱花在容易的目标上。

CoCo-Prover 用两层证明图保存进度，调度器给出当前可处理的目标，路由器决定调用哪类专家、使用多少推理预算。论文在 **五个 Lean 4 基准、三个底座模型**上比较成功率与费用，并报告了同底座下的明显提升。

### 1.3 饱和基准与反常对照

既有基准出现天花板效应：CoCo-Prover 论文引用的 Humanize 在 PutnamBench 报告 **100%**；在其函数级实验中，Humanize + GPT-5.6-Terra 完成 CLEVER 的 **97.5%**、VERINA 的 **98.9%**。Vero 转而考多模块、共享不变量和完整仓库；CoCo-Prover 也在 Vero 上测试调度效果。

反常出现在 Vero proof-only 模式：CoCo-Prover + GPT-5.6-Terra 完成 **23/43**，Vero 原论文的 Codex + GPT-5.5 (xhigh) 完成 **25/43**。CoCo-Prover 的 OpenAI 底座只有 Terra；另两组实验使用 Gemini-3.5-Flash 和 DeepSeek-V4-Flash。两篇论文的每题上限分别是 8 小时/$60 与 90 分钟。**更强模型与更高思考强度，会不会吞噬 CoCo-Prover 的方法增益？**后文先拆解任务与方法，再按实验口径回答。

## 二、Vero：把验证单位从函数提升到仓库

### 基准实例究竟给了什么

Vero 的一个实例是多模块 Lean 4 项目。策展者固定数据类型、辅助定义、API 签名与规格，代理填写实现和证明。论文把接口与规格写为

$$
\mathcal A=\{a_1,\ldots,a_m\},\qquad
\mathcal S=\{S_1,\ldots,S_n\},\qquad
S_i:\texttt{RepoImpl}\to\mathtt{Prop}.
$$

`RepoImpl` 为每个 API 提供一个字段。`canonical : RepoImpl` 指定本次被证明的实现：proof-only 模式采用参考实现，code-and-proof 模式采用代理实现。同一条规格 $S_i$ 因而可以检验不同实现。

论文图 2 的银行例子可以浓缩为：

```lean
structure RepoImpl where
  createAccount : AccountId → Ledger → Ledger
  accountExists : AccountId → Ledger → Bool
  getBalance : AccountId → Ledger → Option Balance

def canonical : RepoImpl := {
  createAccount := Bank.createAccount,
  accountExists := Bank.accountExists,
  getBalance := Bank.getBalance
}

def spec_create_zero_balance (impl : RepoImpl) : Prop :=
  ∀ (id : AccountId) (ledger : Ledger),
    impl.accountExists id ledger = false →
    impl.getBalance id (impl.createAccount id ledger) = some 0

theorem proof_create_zero_balance :
    spec_create_zero_balance canonical := by
  sorry
```

这条规格把实现作为参数，**直接调用 `impl` 中的三个 API 函数**。`canonical` 将这些字段绑定到具体代码：proof-only 使用参考实现，code-and-proof 使用代理实现。证明目标 `spec_create_zero_balance canonical` 因而涉及具体实现的函数定义，并要求对所有账户和账本成立；它不是有限输入上的运行测试。代码按论文图 2 摘取并整理。

#### 执行具体输入、化简符号输入、证明全部输入

图 2 的 `spec_create_zero_balance` 确实**直接调用被验证的实现**。取 `id = 7` 和一个具体账本 `ledger₀`，执行下面的表达式，就能看到这一次创建账户后的查询结果：

```lean
getBalance 7 (createAccount 7 ledger₀)
```

如果结果是 `some 0`，只能说明这个账本通过了检查。规格实际要求的是

$$
\forall\ id,ledger,\quad
\texttt{accountExists}\ id\ ledger=\texttt{false}
\;\Longrightarrow\;
\texttt{getBalance}\ id\ (\texttt{createAccount}\ id\ ledger)=\texttt{some }0.
$$

这里的 `ledger` 没有大小上限。对一百个测试账本运行成功，仍然没有证明第一百零一个账本；反过来，只要找到一个满足前提、结果却不是 `some 0` 的账本，就能推翻这条规格。

Lean 的证明过程可以*执行符号表达式*，但能化简到哪一步取决于实现。假设 `createAccount` 把新账户放在列表开头，而 `getBalance` 从列表开头查找，那么对任意 `ledger` 都有：

$$
\begin{aligned}
\texttt{getBalance}\ id\ (\texttt{createAccount}\ id\ ledger)
&=\texttt{getBalance}\ id\ ((id,0)::ledger)\\
&=\texttt{some }0.
\end{aligned}
$$

这个证明可能只需展开定义和化简；甚至用不到“原账本不存在该账户”的前提。**图 2 只展示接口、规格和待填证明，没有展示三个函数的函数体**，因此不能从图 2 判断参考实现是否真的这么简单。

换一种同样可执行的实现：`createAccount` 把 `(id,0)` 加在列表末尾，`getBalance` 从头向后查找。展开定义后，Lean 会遇到

$$
\texttt{getBalance}\ id\ (ledger\mathbin{++}[(id,0)]).
$$

因为 `ledger` 仍是任意列表，计算无法决定它是空表，还是以哪个账户开头。证明通常要对 `ledger` 归纳：空表直接算出 `some 0`；非空表利用 `accountExists id ledger = false` 排除前面的同名账户，再把结论传给尾部。这里已经出现了**运行一个例子无法替代的全称推理**。

所以你的直觉对图 2 的小例子很准确：有些实现确实能让证明接近“执行一下”。但“执行”在这里是对带变量的程序做可复核的符号化简，并交付 Lean 接受的通用证明。Vero 把整个仓库的全部规格都作为完成条件；当函数跨模块调用、共享状态或必须保持规范形式时，单步化简就不够了。

两种模式的证明目标都是

$$
\forall S_i\in\mathcal S,\quad S_i(\texttt{canonical}).
$$

**Proof-only** 固定 `canonical` 为参考实现；**code-and-proof** 要求代理先填入每个 $a_i\in\mathcal A$ 的函数体，再证明同一组规格。实现选择会影响证明难度。Vero 只在全部规格证明成功时计为完整解决，避免大量容易的局部性质掩盖剩余难题。

![Vero 论文图 1：从源仓库到 Lean 基准，再到代理评测的流程](../assets/papers/vero-pipeline.png)

*原论文图 1，展示来源仓库、人工审核的翻译流水线、两种评测模式及形式化审计。来源与授权见文末。*

### 数据从何而来，以及为什么需要审计

Vero 收集 **43 个仓库实例**：13 个原本使用 Dafny、Verus、Coq 等形式化语言，需要翻译既有定义与规格；30 个来自 Python，需要把实现迁到 Lean，并根据原项目编写规格。总计 **743 个计分 API、2,705 条计分规格**。项目覆盖密码协议、分布式系统、数据结构等领域。翻译流水线的每个阶段都经过人工审核。这个设置保留了真实项目的共享定义与模块依赖，同时统一了 Lean 4 的评测环境。

Vero 还把基准错误写成三个可证明的命题：

$$
\begin{aligned}
&\neg\bigwedge_{S\in\mathcal S}S(\texttt{canonical})
&&\text{参考实现违反规格；}\\
&\neg\exists\,impl:\texttt{RepoImpl},\ S(impl)
&&\text{某条规格无解；}\\
&\bigl(\forall S\in\mathcal S',\ \exists\,impl,\ S(impl)\bigr)
\land\neg\exists\,impl,\bigwedge_{S\in\mathcal S'}S(impl)
&&\text{各条规格单独可满足，却无法同时满足。}
\end{aligned}
$$

附录 F 的 `verdict` 案例把第三种问题说得很直白：Base64 的填充字符 `=` 是十六进制 `0x3D`。一条规格要求分类函数对它返回 `some none`，另一条“拒绝非法字符”的规格却把 `(0x39, 0x41)` 整段划为 `none`；`0x3D` 正好落在其中。于是不存在能同时满足两条规格的实现。修复方法是在拒绝范围中明确排除 `0x3D`。论文报告，审计在发布的 43 个实例中定位并修复了 **38 条有缺陷的规格**，涉及 9 个实例，另有 6 组联合不可满足的规格。

Vero 的审计机制让基准自身接受形式化检验。代理可以提交目标为假的机器检查证据，策展者据此修正规格。

### 分数揭示的真正瓶颈

Vero 原论文每个仓库限时 **90 分钟**，对四种编码代理配置同时评测两种模式。原论文图 3 给出全部结果：GPT-5.5 xhigh 在 code-and-proof / proof-only 下分别解决 **27/43**、**25/43**；GPT-5.5 medium 为 **2/43**、**6/43**；Opus 4.8 为 **8/43**、**10/43**；Sonnet 5 在两种模式下均为 **2/43**。

GPT-5.5 xhigh 的逐规格通过率在两种模式下分别达到 **87.3%** 和 **85.8%**，但完整仓库解决数仍为 27 与 25。GPT-5.5 的 medium 与 xhigh 之间差距尤其大：proof-only 从 6 增至 25。完整解决数对思考强度高度敏感，因而是检验 CoCo-Prover 方法增益的关键基线。

![Vero 论文图 3：各代理在两种任务模式下的完整仓库解决情况](../assets/papers/vero-results.svg)

*原论文图 3。曲线统计 90 分钟内累计完整解决的仓库；右侧展示不同配置解决了哪些实例。*

涉及**全局覆盖性**的规格失败率最高，达 **47.1%**；在同一仓库内，使用给定辅助定义、重复调用同一 API 的规格，失败率分别高出 **14.9** 和 **11.7 个百分点**。瓶颈集中在多次执行后的不变量与可复用引理。

附录 H 的 `deposit_sc` 包含 79 条规格，跨 `Bits`、`Tree`、`Merkle`、`Contract` 四个模块。“批量 deposit 的折叠结果等于逐个 deposit”的归纳步需要同时保持中间状态有效、树高不变、合并函数不变和默认值不变。成功证明提出一个**更强的合取归纳命题**，让这些事实随归纳假设一起传递。其 code-and-proof 提交包含 99 条辅助定理和 6,052 行非空证明代码。强通用代理已经能自行组织大型引理库；CoCo-Prover 的额外价值要在这样的基线上衡量。

## 三、CoCo-Prover：把证明搜索变成受成本约束的调度

CoCo-Prover 处理两项决策：**接下来证明哪些目标**，以及**给这些目标调用什么代理、投入多少预算**。它把成本记为实际模型费用，分别计算输入、缓存与输出 token 的价格。

### 两层证明图分别保存什么

CoCo-Prover 用两层图记录证明：

$$
\mathcal D=(L,E_{\mathcal D}),\qquad
\mathcal H_{\ell}=(A_{\ell},O_{\ell},E_{\ell})\quad(\ell\in L).
$$

**声明依赖图** $\mathcal D$ 的节点 $L$ 包含目标定理与辅助引理；边 $u\to v$ 表示 $v$ 的证明使用 $u$。系统记录每个引理是稳定、暂定还是废弃。**声明内证明图** $\mathcal H_{\ell}$ 用 AND 节点 $A_{\ell}$ 表示目标状态，用 OR 节点 $O_{\ell}$ 表示可选证明步骤；步骤生成的全部子目标都要关闭。$E_{\ell}$ 保存 Lean 已检查的转换。两层图分别支持跨定理复用和定理内部搜索。

![CoCo-Prover 论文图 2：引理依赖 DAG 与单一定理内部的 AND/OR 证明图](../assets/papers/coco-proof-graphs.svg)

*原论文图 2。左图表示跨声明复用，右图表示单个证明步骤如何展开为子目标。*

系统在第 $t$ 轮维护

$$
s_t=(\mathfrak G_t,\mathcal F_t,\sigma_t,\mathcal M_t,\mathcal L_t),
\qquad
\mathfrak G_t=(\mathcal D_t,\{\mathcal H_{\ell,t}\}_{\ell\in L_t}).
$$

$\mathcal F_t$ 是依赖已就绪的开放目标，$\sigma_t$ 记录证明产物状态，$\mathcal M_t$ 保存失败与反馈，$\mathcal L_t$ 是成本账本。调度器对依赖图做增量拓扑遍历，把完整前沿交给路由器：

$$
U_t=\operatorname{Sched}(s_t)=\mathcal F_t.
$$

路由器购买一次有成本的证明动作，执行结果再更新状态：

$$
c_t=(G_t,o_t,\theta_t),\quad G_t\subseteq U_t,\qquad
Y_t\sim P_{c_t}(\cdot\mid s_t,U_t),\qquad
s_{t+1}=T(s_t,U_t,c_t,Y_t).
$$

$G_t$ 是目标组，$o_t$ 是四种专家之一，$\theta_t$ 设置推理强度与迭代预算，$Y_t$ 包含 Lean 检查结果。论文的成本目标是

$$
\max\;\mathbb E\bigl[\mathbf 1[\mathrm{solve}]-\lambda C\bigr],
$$

其中 $C$ 为整次任务的模型费用，$\lambda$ 控制成本权重。路由器根据当前证据选择动作，并不显式求解最优值函数。一条昂贵引理若能被多个目标复用，可能降低总成本；临时引理失败时，依赖图确定需要回滚的后继。

论文把共享引理 $h$ 的成本写得更具体。若 $K$ 个目标各自重新发现 $h$，与先证明一次再共享的费用分别是

$$
C_{\mathrm{iso}}(h)=\sum_{i=1}^{K}(c_{h,i}+d_i),\qquad
C_{\mathrm{share}}(h)=c_h+\sum_{i=1}^{K}d_i+r_h.
$$

$c_{h,i}$ 是第 $i$ 个目标单独发现该事实的费用，$c_h$ 是证明共享引理一次的费用，$d_i$ 是各目标后续证明费用，$r_h$ 是失败与回滚开销。共享成立的条件直接是 $C_{\mathrm{share}}(h)<C_{\mathrm{iso}}(h)$。

### 一轮运行如何进行

![CoCo-Prover 论文图 3：调度器、路由器、四种专家代理及 Lean 检查器](../assets/papers/coco-workflow.svg)

*原论文图 3。调度器给出依赖已就绪的目标；路由器决定动作；代理把检查结果写回图和共享记忆。*

系统的循环可以按论文图 3 理解：

1. **符号调度**读取两层图，找出尚未解决、依赖已就绪的 Lean 目标。路由器用语义聚类把相近目标放在一起，并读取局部证明状态、失败记录、成本账本。
2. **路由决策**选择目标组、专家、推理强度和工作预算。初始原则是：如果两种动作对最终可证明性的预期相近，选完成整个任务预计更便宜的一种。规则可根据之后的检查反馈更新。
3. **执行与反馈**由专家代理调用 Lean，成功的步骤、产生的子目标、诊断和实际成本写回图。测试能排除错误的候选引理，但不能代替 Lean 内核证明。

四类专家各有职责：**Deterministic Automation** 先尝试无需模型的规则化策略；**Proof Writer** 写 Lean 证明并迭代修复，预算耗尽仍保存已经验证的部分；**Lemma Planner** 把阻碍证明的事实提升成有类型、能明确服务于目标的辅助引理，经过语法、无环性和反例检查后加入依赖图；**Recovery Reviewer** 判断分支是否可能为假或路线过贵，必要时退回最近的安全状态。一次失败只撤销受它影响的后继，不必重做全部已验证工作。

### 案例一：一个字符串定理为什么要九条引理

附录 D.1 的 CLEVER `prob_15` 要实现 `string_sequence`：将 `0` 到 `n` 的十进制表示用空格连接。实现自然写成 `" ".intercalate ((List.range (n+1)).map Nat.repr)`；规格却用 `splitOn " "` 重新解析输出，并要求第 $i$ 段等于 `i.repr`。人眼看到“拼接再切开”，Lean 需要知道每段没有空格、`intercalate` 与 `splitOn` 相互抵消。更麻烦的是 Lean 的字符串 API 下方涉及字符列表、私有累加器、UTF-8 字节位置扫描，并没有现成的一条总定理。

CoCo-Prover 沿抽象层逐步立引理：先把规格化成拼接后切分的目标；再证明自然数表示不含空格；然后桥接字符串与字符列表；最后下降到字节扫描和偏移量性质。运行共 **8 轮控制循环、18 次路由调用**，得到 **9 条辅助引理**，无回滚，花费 **$2.36**。同一模型和价格下，两个成功的基线分别花费 **$8.67**、**$10.74**；另一个基线花费 **$5.48** 仍未完成。论文指出，成功基线发现的数学事实大致相似，差距主要来自上下文重复发送和证明进度是否持久保存。

![CoCo-Prover 论文图 6：字符串案例的引理依赖图](../assets/papers/coco-case-lemmas.svg)

*原论文图 6。每条边从辅助引理指向使用它的声明；图的深度对应从规格下降到 UTF-8 扫描的层级。*

这个案例说明，“发现缺少一个事实”与“把事实变成可管理的证明任务”之间有很大距离。Lemma Planner 负责后一步，两层图确保已证事实不会在下一轮模型调用中丢失。

两个成功基线找到的引理结构与 CoCo-Prover 接近。此题的主要差别在组织成本：CoCo-Prover 花费 $2.36、耗时 2,816 秒，Codex 花费 $8.67、耗时 2,550 秒。结构化上下文节省模型费用，同时增加墙钟时间。

### 案例二：56 条区间规格如何共享一座证明库

附录 D.2 的 Vero `prob_14` 验证半开整数区间 $[lo,hi)$ 构成的集合库。库提供 `overlaps`、`mergeOverlaps`、`chop` 三组操作，共 **56 条规格**：合并前后覆盖相同、合并结果严格有序且不重叠、相同覆盖集合对应唯一规范形式、输入排列不改变规范结果。

证明难在实现不是单层函数：`mergeOverlaps` 先用 `insertByLo`/`sortByLo` 排序，再用 `coalesce` 合并。插入用结构递归，排序用折叠，合并则在改变列表头之后做良基递归。若直接展开所有定义，目标会膨胀。成功路线是先证明一次插入保持覆盖，再提升到排序；证明排序结果有序且非空；最后对合并函数使用与其递归方式相匹配的函数归纳。上层的唯一性、排列不变性再从“覆盖不变 + 规范形”推出，不重新展开排序算法。

该运行完成 **56/56 条目标**，最终文件含 **55 条被实际使用的辅助引理**，依赖链最深 6 层；同一底座模型的编码代理基线只完成 **5/56**。`sortByLo_pairwise_lo` 和 `sortByLo_output_nonempty` 两条引理分别被 31 和 28 条目标间接依赖。运行也进行了 52 次有理由的回滚，常见原因是自动化过早展开递归定义；系统退回安全节点，改用归纳或现成引理。

核心是**跨目标复用**：已证目标与辅助引理一样进入依赖图，后续目标直接调用。56 条规格共同构成一座逐层增长的证明库。

在同样的 Terra 底座下，编码代理完成 5/56，CoCo-Prover 完成 56/56。持久证明图在这个实例上价值很高；强模型在同一实例上的表现仍待测量。Vero 的 `deposit_sc` 案例表明，强代理本身也能建立大型引理库。

## 四、实验：成功率、费用和强模型对照

### 4.1 任务、基线与预算

CoCo-Prover 在五个 Lean 4 基准上评估：CLEVER **161** 题、VERINA **189** 题、AlgoVeri **77** 题是函数级任务；NTP4VC 取按名称排序的前 **300** 条验证条件，Vero 包含 **43** 个仓库。Vero 使用 **proof-only** 模式。所有评测都固定实现与定理陈述，测量的是证明生成。CLEVER 与 AlgoVeri 原本缺少参考实现，作者先用 GPT-5.6-Sol（high）生成实现、人工核对，再将相同实现交给所有证明系统。

底座模型为 **GPT-5.6-Terra、Gemini-3.5-Flash、DeepSeek-V4-Flash**。基线分三类：反复生成和修复证明的 Ax-Prover-Base；单定理代理 Humanize；每个模型对应的官方编码代理（Codex、Gemini CLI、DeepSeek Harness）。前两者按单条定理工作，仓库级任务因此只与编码代理比较。函数级每题上限 **5 小时、$30**；仓库级每题上限 **8 小时、$60**。模型调用按各提供商价格计费；Lean 检查、检索、嵌入等本地计算未折算进美元账单。

论文对成功结果做五道检查：Lean 重新检查并排除 `sorry` 等占位；核对定理陈述；检查新增公理；用另一代理复审；随机人工抽查。只有通过审查的完整证明计入成功率。以上口径对应 CoCo-Prover §4、附录 C.1。

### 4.2 五个基准的成功率

原论文表 1 列出全部“基准 × 底座”组合，上半部分是两个仓库级基准，下半部分是三个函数级基准。

[![CoCo-Prover 原论文表 1：五个基准、三个模型的完整成功率](../assets/papers/coco-table-1.png)](../assets/papers/coco-table-1.png)

同底座下，CoCo-Prover 在 15 组结果里最高或并列最高。函数级 CLEVER、VERINA 已接近满分，绝对提升空间有限；仓库级 Vero 的提升大得多。DeepSeek 上的差距尤其突出，论文附录 C.3 指出，若代理框架给模型过长的上下文和单次推理，DeepSeek 容易耗尽墙钟预算。这里同时存在**方法适配性**与**基线框架适配性**的差别。

### 4.3 共同成功题目的费用

论文表 2 对每个基线分别取成功交集，只比较双方都证明成功的题目。原表同时保留 Ax-Prover-Base、Humanize、编码代理三类对照、各自的交集题数与模型费用。

[![CoCo-Prover 原论文表 2：所有基线在共同成功题目上的费用对比](../assets/papers/coco-table-2.png)](../assets/papers/coco-table-2.png)

九个函数级组合里，CoCo-Prover 对 Humanize、Ax-Prover-Base 和编码代理的共同成功题目费用都更低。对 Humanize 的差额在 AlgoVeri + Terra 上仅 **1.3%**；对 Vero + Terra，唯一共同成功仓库反而由 Codex 更便宜。Vero 的共同成功交集太小，仓库级费用结论主要看 NTP4VC。表 2 衡量的是**成功交集里的模型费用**，而非所有题目的总资源消耗。

论文图 4 还把函数级每题预算从 $0 扫到 $30，统计在不同美元上限下累计完成多少题。三个底座下 CoCo-Prover 的曲线在大部分预算区间领先；Terra 在最高预算下完成 **419/427**。时间指标则呈现另一面：在 Terra 与 Gemini 上，CoCo-Prover 的平均墙钟时间高于编码代理。逐步路由与 Lean 检查节省模型调用，却延长串行执行。

![CoCo-Prover 论文图 4a：Terra 底座下的成功率与费用曲线](../assets/papers/coco-frontier-terra.svg)

![CoCo-Prover 论文图 4b：Gemini 底座下的成功率与费用曲线](../assets/papers/coco-frontier-gemini.svg)

![CoCo-Prover 论文图 4c：DeepSeek 底座下的成功率与费用曲线](../assets/papers/coco-frontier-deepseek.svg)

*原论文图 4 的三个子图。横轴为单题美元预算，纵轴为三个函数级基准累计完成的题数。*

### 4.4 消融与重复运行

组件消融固定 Gemini-3.5-Flash，从三个函数级基准各抽 **10 题**。原论文表 3 同时展示各基准与全部 30 题的成功数、费用；完整系统的费用为三次运行的均值。

[![CoCo-Prover 原论文表 3：路由器、自动化和引理规划器的完整消融结果](../assets/papers/coco-table-3.png)](../assets/papers/coco-table-3.png)

路由器和引理规划器带来明显的费用与成功率收益。自动化的平均成本收益较小：CLEVER、VERINA 受益，AlgoVeri 去掉它后反而便宜 **5.8%**。该消融覆盖 30 条函数级题目，Vero 仓库未参与。

论文还在 Gemini 上对全部 **427** 道函数级题运行三次：三次完成的题目集合相同，总费用均值 **$969.8**、标准差 **$89.5**（变异系数 **9.2%**）。30 题子集又在三个底座上各重复三次；所有重复运行都完成 30 题，费用波动集中在 AlgoVeri + Terra（变异系数 **34.2%**）。路由器、引理规划器约 40% 的消融费用差明显大于 Gemini 子集的运行波动；自动化的 5.8% 差值与波动量级接近。

### 4.5 强模型与思考强度：缺少的一格实验

对照上面的 **Vero 原论文图 3** 与 **CoCo-Prover 原论文表 1**：Codex + GPT-5.5 的 proof-only 完整解决数从 medium 的 **6/43** 增至 xhigh 的 **25/43**，每题限时 **90 分钟**。CoCo-Prover + GPT-5.6-Terra 完成 **23/43**，Gemini-3.5-Flash 组合完成 **26/43**，每题上限 **8 小时、$60**。两篇论文的模型、代理版本和预算不同；这些数字展示了思考强度的巨大影响，以及 CoCo-Prover 尚未测试的强模型对照。

CoCo-Prover 把每次调用的推理强度放入配置 $\theta$；字符串案例说引理规划使用 high-thinking、证明脚本使用 low-thinking。论文没有报告覆盖全部任务的逐次强度设置及强度扫描。OpenAI 证明底座只用了 Terra；GPT-5.6-Sol（high）只参与事先生成 CLEVER、AlgoVeri 的参考实现。**方法增益与模型增强的交互**因此仍是开放的实证问题。

## 五、模型能力会吞噬方法增益吗

### 5.1 交叉实验

在同一批 Vero proof-only 实例上交叉运行**普通编码代理 / CoCo-Prover**与**不同模型 / 不同思考强度**。固定 Lean 版本、定理、检索工具、审查规则及时间和美元上限。每一格报告完整解决数、逐题成功集合、模型费用、墙钟时间和多次运行方差。

逐题成功集合尤其关键：强模型若补上 CoCo-Prover 独有的题目，方法的成功率增益就会收缩；若 CoCo-Prover 仍能在强模型上补上新题，说明两者互补。

### 5.2 当前证据

现有实验清楚显示，**在同底座、同预算下，CoCo-Prover 的证明图与调度能提升成功率并降低共同成功题目的模型费用**。Vero 同时显示，GPT-5.5 从 medium 提高到 xhigh 会把 proof-only 的完整解决数由 6 提至 25。CoCo-Prover 在强推理配置下的额外增益尚未测出。下一轮实验的焦点是这两个效应如何叠加，以及更高的墙钟时间换来了多少新增证明。

## 来源与图像授权

- Zhe Ye 等，Vero: Can AI Agents Build Formally Verified Software Repositories?，arXiv:2608.13522v1，2026。文中 Vero 图 1、图 3 原样转载。
- Shuangjie Yao 等，Cost-Efficient Theorem Proving via Agent Orchestration in Program Verification，NeurIPS 2026 Workshop on AI for Verifiable Coding（VERICODEGEN）海报论文；arXiv:2610.09681v1。文中 CoCo-Prover 图 2、图 3、图 4、图 6 与表 1–3 均截自原论文。会场信息见[作者论文目录](https://cse.hkust.edu.hk/~dongdong/publications/)。

两篇论文均以 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 发布。本文文字是根据论文撰写的中文改编，代码例子有摘取和整理；原图与原表只做裁切，没有修改内容。本文及所转载图片按 CC BY-SA 4.0 分享。

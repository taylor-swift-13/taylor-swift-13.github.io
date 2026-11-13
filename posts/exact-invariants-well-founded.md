本文以整数状态循环为对象，说明如何通过良基前驱覆盖证明不变量恰好描述所有可达状态。主线是：定义可达性与 exact，解释良基性和前驱条件如何配合，再给出正式证明与检查方法。

## 1. 循环、不变式与 Exact

### 1.1 循环与状态转移

固定变量数 $n\ge1$，状态是整数数组：

$$
x=(x_1,\ldots,x_n)\in S,\qquad S=\mathbb Z^n.
$$

这里使用数学整数，不考虑机器整数溢出。状态包含决定循环后续行为所需的全部变量。

**定义 1（循环）。** 一个带初始条件的循环是：

$$
L=(Init,G,B),
$$

其中 $Init\subseteq S$ 是初始循环头状态集合，$G:S\to\{\mathrm{true},\mathrm{false}\}$ 是循环条件，$B\subseteq S\times S$ 是执行一次完整循环体的状态关系：

```text
从 Init 中取得初始状态 x
while G(x):
    取得满足 B(x, x') 的下一状态 x'
    x := x'
```

$Init$ 可以包含多个状态；$B$ 可以给同一状态提供多个后继，因此允许符号输入和非确定性。本文考虑循环体正常完成后返回循环头的 `while` 循环。

一步循环头转移定义为：

$$
T_L(x,x')\iff G(x)\land B(x,x').
$$

循环头位于条件检查之前，因此条件已经为假的退出状态也包含在循环头状态中。下文用 $I(x)$ 表示 $x\in I$，用 $Init(x)$ 表示 $x\in Init$。

### 1.2 可达状态

**定义 2（可达集合）。** 令 $R_k$ 表示至多执行 $k$ 次循环体后可以到达的状态集合：

$$
\begin{aligned}
R_0&=Init,\\
R_{k+1}&=R_k\cup\{x'\in S\mid\exists x\in R_k,\ T_L(x,x')\},\\
Reach_L&=\bigcup_{k\in\mathbb N}R_k,
\qquad\mathbb N=\{0,1,2,\ldots\}.
\end{aligned}
$$

初始状态通过零步执行可达。$Reach_L$ 包括所有有限执行前缀到达的循环头状态，不要求程序最终退出。

### 1.3 不变式、归纳性与 Exact

**定义 3（循环不变式）。** $I\subseteq S$ 是循环不变式，当且仅当：

$$
Reach_L\subseteq I.
$$

**定义 4（归纳循环不变式）。** $I$ 是归纳不变式，当且仅当满足初始化和保持性：

$$
\begin{aligned}
&Init\subseteq I,\\
&\forall x,x'\in S,\quad
I(x)\land T_L(x,x')\Rightarrow I(x').
\end{aligned}
$$

归纳不变式一定是不变式。它还要求从 $I$ 中可能不可达的状态出发，也不能通过合法转移离开 $I$。

**定义 5（Exact 不变式）。** $I$ 是 exact 的，当且仅当：

$$
\boxed{I=Reach_L.}
$$

普通不变式允许包含不可达状态；exact 要求同时证明：

$$
\underbrace{Reach_L\subseteq I}_{\text{不遗漏可达状态}}
\qquad\text{和}\qquad
\underbrace{I\subseteq Reach_L}_{\text{不包含不可达状态}}.
$$

初始化与保持性解决第一个方向，下面的良基前驱覆盖用于证明第二个方向。

## 2. 良基性与前驱覆盖如何配合

**定义 6（良基关系）。** 集合 $W$ 上的关系 $\prec$ 是良基的，当且仅当每个非空子集都有极小元素：

$$
\forall D\subseteq W,\quad D\ne\varnothing
\Rightarrow
\exists w\in D,\ \neg\exists v\in D:\ v\prec w.
$$

例如，$(\mathbb N,<)$ 良基，而 $(\mathbb Z,<)$ 不良基。良基性不要求“下降一定到 0”；一般的排序域甚至不一定有名为 0 的元素。

给定排序映射 $\rho:I\to W$，要求以下**前驱覆盖条件 PRED**：

$$
\forall x\in I\setminus Init,\quad
\exists p\in I:
T_L(p,x)\land\rho(p)\prec\rho(x).
$$

即每个非初始不变量状态，都有一个仍在 $I$ 中、可以合法执行一步到达它、且排序值更小的前驱。由 $T_L(p,x)=G(p)\land B(p,x)$，循环条件要求在前驱 $p$ 上成立，而不是在当前状态 $x$ 上成立。

### 2.1 为什么良基性排除无限下降链与环

假设按 PRED 寻找前驱的过程一直不结束，产生：

$$
x_0\leftarrow x_1\leftarrow x_2\leftarrow\cdots,
\qquad\rho(x_{j+1})\prec\rho(x_j).
$$

把这条链上的排序值组成集合：

$$
V=\{\rho(x_j)\mid j\in\mathbb N\}.
$$

$V$ 非空。根据良基性的定义，$V$ 有极小元素 $w$。由于 $w\in V$，必有某个 $k$ 满足 $w=\rho(x_k)$。但无限下降的假设又给出：

$$
\rho(x_{k+1})\in V,
\qquad\rho(x_{k+1})\prec w,
$$

与 $w$ 的极小性矛盾。因此，严格下降不可能无限持续。

排序关系中的环也被排除：反复沿环就会得到无限下降链。这里限制的是排序值按 $\prec$ 下降的关系，程序转移本身仍然可以有环。

### 2.2 为什么回溯只能停在初始状态

良基性排除无限下降；PRED 则保证，只要当前状态属于 $I$ 且不是初始状态，就一定还有更小的合法前驱。因此，按 PRED 回溯不能无限继续，也不能在非初始状态处因为缺少前驱而停止，最终只能到达初始状态。反转这条有限链，就是一条合法的正向到达路径。

例如：

```text
x := 0
while x < 5:
    x := x + 1
```

取 $I=\{0,1,\ldots,5\}$ 和 $\rho(x)=x$，从状态 5 开始的**回溯顺序**为：

$$
5\rightsquigarrow4\rightsquigarrow3\rightsquigarrow2
\rightsquigarrow1\rightsquigarrow0.
$$

到 0 停止，是因为 0 是初始状态，PRED 不再要求它有前驱。如果初始值改为 2，相应取 $I=\{2,3,4,5\}$，仍取 $\rho(x)=x$，回溯就停在 2，无须降到 0。

**这里结束的是按 PRED 选择前驱的反向回溯，不是原程序的正向循环。** PRED 只要求存在一个适当的前驱，并不要求程序的所有转移都服从排序。

### 2.3 为什么不能省去良基条件

考虑 `x := 0; while true: x := x`，取 $I=\{0,1\}$。初始化和保持性都成立；不可达状态 1 还可以用自身作为前驱。因此，“每个非初始状态都有合法前驱”仍然成立，但 $Reach_L=\{0\}\ne I$。良基排序排除了这种不可达状态相互提供前驱的情况。

## 3. Exact 认证定理与证明

**定理 1（良基前驱覆盖蕴含 Exact）。** 给定循环 $L=(Init,G,B)$。若 $I\subseteq S$ 是归纳不变式，并且存在良基关系 $(W,\prec)$ 及映射 $\rho:I\to W$ 满足 PRED，则：

$$
\boxed{I=Reach_L.}
$$

**证明。** 分别证明两个集合包含关系。

**第一步：$Reach_L\subseteq I$。** 初始状态由初始化条件包含在 $I$ 中；每次合法转移由保持性条件继续留在 $I$ 中。对执行路径长度归纳，即得所有有限步可达状态都属于 $I$。

**第二步：$I\subseteq Reach_L$。** 反设存在不可达的不变量状态，令：

$$
U=I\setminus Reach_L\ne\varnothing,
\qquad V=\{\rho(x)\mid x\in U\}.
$$

因为 $V$ 非空且排序关系良基，可以选择 $x\in U$，使它的排序值极小：

$$
\boxed{\neg\exists y\in U:\ \rho(y)\prec\rho(x).}
$$

这里选择的是**不可达状态集合 $U$ 中排序值极小的状态**，不是整个 $I$ 中排序值极小的状态。

初始状态通过零步执行可达，而 $x$ 不可达，所以 $x\notin Init$。由 PRED，存在前驱 $p$，满足：

$$
p\in I,\qquad T_L(p,x),\qquad\rho(p)\prec\rho(x).
$$

- **如果 $p$ 可达，** 在到达 $p$ 的有限路径后接上一步 $T_L(p,x)$，就能到达 $x$，与 $x$ 不可达矛盾。
- **如果 $p$ 不可达，** 则 $p\in U$，但 $\rho(p)\prec\rho(x)$，与选定的极小性矛盾。

因此 $U=\varnothing$，即 $I\subseteq Reach_L$。结合第一步，得到 $I=Reach_L$。证毕。

## 4. 转成 SMT 检查

实际检查时，可以选择整数值函数 $\rho:S\to\mathbb Z$，并额外证明 $I(x)\Rightarrow\rho(x)\ge0$。这样 $\rho$ 在 $I$ 上取值于良基域 $(\mathbb N,<)$，即可应用定理 1。

向求解器提交以下反例公式；自由变量由求解器寻找赋值，四项均为 `unsat` 即完成认证。

| 义务 | 必须不可满足的反例公式 |
|---|---|
| INIT：初始化 | $Init(x)\land\neg I(x)$ |
| STEP：保持性 | $I(x)\land G(x)\land B(x,x')\land\neg I(x')$ |
| RANK：排序非负 | $I(x)\land\rho(x)<0$ |
| PRED：前驱覆盖 | $I(x)\land\neg Init(x)\land\neg\exists p\,[I(p)\land G(p)\land B(p,x)\land\rho(p)<\rho(x)]$ |

若 $I$ 蕴含某个变量的下界 $\ell$，可以尝试 $\rho(x)=x_j-\ell$；有上界 $u$ 时，可以尝试 $\rho(x)=u-x_j$。这些界也可以依赖保持不变的入口参数。数学整数没有默认的类型上下界，所需边界必须得到证明。

`unknown` 或超时不建立证明。某个具体排序函数未通过检查，也不直接说明 $I$ 不是 exact。

## 5. 完整例子：符号输入

初始值不必是具体常数。考虑：

```text
输入 a, b，满足 a <= b
v := a
while v < b:
    v := v + 1
```

将输入也保留在状态中，取 $x=(a,b,v)\in\mathbb Z^3$：

$$
\begin{aligned}
Init&=\{(a,b,v)\mid a\le b\land v=a\},\\
G(a,b,v)&\iff v<b,\\
B\bigl((a,b,v),(a',b',v')\bigr)
&\iff a'=a\land b'=b\land v'=v+1.
\end{aligned}
$$

选择：

$$
I=\{(a,b,v)\mid a\le v\le b\},
\qquad\rho(a,b,v)=v-a.
$$

四个证明义务分别为：

1. **INIT：** 初始时 $v=a$ 且 $a\le b$，所以 $a\le v\le b$。
2. **STEP：** 若 $a\le v\le b$ 且 $v<b$，则 $a\le v+1\le b$，同时 $a,b$ 保持不变。
3. **RANK：** 由 $v\ge a$，得到 $v-a\ge0$。
4. **PRED：** 若 $(a,b,v)\in I\setminus Init$，则 $v>a$。取前驱 $p=(a,b,v-1)$，它满足 $a\le v-1<b$，仍在 $I$ 中并可执行一步到达当前状态，而且：

$$
\rho(p)=v-1-a=\rho(x)-1<\rho(x).
$$

由定理 1：

$$
\boxed{Reach_L=\{(a,b,v)\in\mathbb Z^3\mid a\le v\le b\}.}
$$

这个证明覆盖所有满足 $a\le b$ 的输入。对每个固定的 $a,b$，可达的 $v$ 恰好是 $a,a+1,\ldots,b$。

回溯过程中必须保留同一组入口参数：这里 $B$ 明确要求 $a'=a$、$b'=b$。如果原输入变量会被修改，可以增加不修改的入口快照来保留初值，不能在寻找前驱时换用另一组输入。

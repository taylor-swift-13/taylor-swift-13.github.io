本文讨论有限样本空间 $\mathcal X$ 上的两个概率分布 $P$ 和 $Q$。令 $X\sim P$，并统一使用自然对数。因此，以下信息量的单位是 nat；若改用以 $2$ 为底的对数，单位则为 bit。

## 支撑集

分布 $P$ 的支撑集（support）记作 $\operatorname{supp}(P)$，定义为

$$
\operatorname{supp}(P)=\{x\in\mathcal X:P(x)>0\}.
$$

它只包含在 $P$ 下概率严格大于零的结果。例如，若 $\mathcal X=\{a,b,c\}$，且 $P(a)=P(b)=1/2$、$P(c)=0$，那么 $\operatorname{supp}(P)=\{a,b\}$。下文的求和只在这个集合上进行：$P(c)=0$ 时，$c$ 不贡献求和项，无须计算未定义的 $0\log 0$。

## 定义

**交叉熵**衡量从 $P$ 抽取样本时，使用 $Q$ 给该样本赋予概率所得到的平均负对数概率：

$$
\begin{aligned}
H(P,Q)
&=\mathbb E_{X\sim P}\!\left[-\log Q(X)\right] \\
&=-\sum_{x\in\operatorname{supp}(P)}P(x)\log Q(x).
\end{aligned}
$$

**KL 散度**比较同一个样本在 $P$ 与 $Q$ 下的对数概率：

$$
\begin{aligned}
D_{\mathrm{KL}}(P\|Q)
&=\mathbb E_{X\sim P}\!\left[\log\frac{P(X)}{Q(X)}\right] \\
&=\sum_{x\in\operatorname{supp}(P)}P(x)\log\frac{P(x)}{Q(x)}.
\end{aligned}
$$

两式都以 $P$ 加权，因此一般不能交换 $P$ 与 $Q$ 的位置。若某个 $x\in\operatorname{supp}(P)$ 满足 $Q(x)=0$，则 $-\log Q(x)$ 和 $\log(P(x)/Q(x))$ 均按扩展实数约定为 $+\infty$，从而 $H(P,Q)=D_{\mathrm{KL}}(P\|Q)=+\infty$。

## 与熵的关系

$P$ 的熵是 $H(P)=H(P,P)$。在有限样本空间中，即使 $P$ 有零概率点，$H(P)$ 仍为有限值：

$$
H(P)=-\sum_{x\in\operatorname{supp}(P)}P(x)\log P(x).
$$

直接展开定义可得

$$
D_{\mathrm{KL}}(P\|Q)=H(P,Q)-H(P),
$$

等价地，$H(P,Q)=H(P)+D_{\mathrm{KL}}(P\|Q)$。如果 $Q$ 在 $\operatorname{supp}(P)$ 上取零，交叉熵和 KL 散度都是 $+\infty$，而 $H(P)$ 有限，因此上述关系在扩展实数意义下仍成立。

下面证明：**当且仅当 $Q=P$ 时，交叉熵 $H(P,Q)$ 取得最小值。** 证明用到 $\log t\leq t-1$（$t>0$）。令 $g(t)=t-1-\log t$，则 $g'(t)=1-1/t$；它在 $0<t<1$ 时为负，在 $t>1$ 时为正。因此 $g$ 在 $t=1$ 处取得唯一最小值 $g(1)=0$。拖动下图的 $t$ 可以查看两条函数曲线及其差值。

@@viz-log@@

若 $Q(x)>0$ 对所有 $x\in\operatorname{supp}(P)$ 成立，令 $t=Q(x)/P(x)$，逐项使用上述不等式，可得

$$
\begin{aligned}
-D_{\mathrm{KL}}(P\|Q)
&=\sum_{x\in\operatorname{supp}(P)}P(x)\log\frac{Q(x)}{P(x)} \\
&\leq\sum_{x\in\operatorname{supp}(P)}\bigl(Q(x)-P(x)\bigr) \\
&=\sum_{x\in\operatorname{supp}(P)}Q(x)-1\leq 0.
\end{aligned}
$$

第一步不等式取等号，要求支撑集中的每个点都满足 $Q(x)=P(x)$。由于这些点的 $P$ 概率之和为 $1$，此时 $Q$ 在支撑集外只能取零，故 $Q=P$。反之，$Q=P$ 时上述不等式显然取等号。若 $Q$ 在 $P$ 的支撑集内取零，则 $D_{\mathrm{KL}}(P\|Q)=+\infty$，不可能取等号。综上，对任意概率分布 $Q$，

$$
H(P,Q)\geq H(P,P)=H(P),
$$

且等号当且仅当 $Q=P$。因此，在固定 $P$ 并允许 $Q$ 遍历同一样本空间上所有概率分布时，交叉熵的最小值是 $H(P)$，唯一的最小化分布是 $P$。

## 与分类损失的关系

对单个分类样本，若真实类别为 $y$，令 $P$ 为集中在 $y$ 上的分布（即 $P(y)=1$），模型预测分布为 $Q$，则

$$
H(P,Q)=-\log Q(y).
$$

这正是该样本的负对数似然。对多个样本取平均，便得到常用的分类交叉熵损失。这里每个样本可以有不同的模型预测分布；前面的 $H(P,Q)$ 定义讨论的是一对固定分布。

## KL 的方向与模式选择

交换 KL 散度的两个参数，会同时改变期望所用的分布与对数比值。前面已定义 $D_{\mathrm{KL}}(P\|Q)$；反向的定义是

$$
\begin{aligned}
D_{\mathrm{KL}}(Q\|P)
&=\mathbb E_{X\sim Q}\!\left[\log\frac{Q(X)}{P(X)}\right] \\
&=\sum_{x\in\operatorname{supp}(Q)}Q(x)\log\frac{Q(x)}{P(x)}.
\end{aligned}
$$

$D_{\mathrm{KL}}(P\|Q)$ 又称 forward KL，$D_{\mathrm{KL}}(Q\|P)$ 又称 reverse KL。它们一般不相等。前者在 $P(x)>0$ 且 $Q(x)=0$ 时为 $+\infty$；后者在 $Q(x)>0$ 且 $P(x)=0$ 时为 $+\infty$。若固定目标分布 $P$，并且可选的 $Q$ 受到模型族限制，两种优化目标可能选择不同的 $Q$。如果模型族包含 $P$，则 $Q=P$ 同时使两种 KL 散度为零。

考虑三点空间 $\mathcal X=\{-1,0,1\}$，令目标分布 $P=(0.49,0.02,0.49)$。模型族只允许以下三个候选：

$$
\begin{aligned}
Q_{\mathrm{cover}}&=(0.30,0.40,0.30), \\
Q_{\mathrm{left}}&=(0.95,0.025,0.025), \\
Q_{\mathrm{right}}&=(0.025,0.025,0.95).
\end{aligned}
$$

在下图切换 KL 的方向或候选分布，可以比较每一项的概率质量与散度数值。所有数值均由上面的定义直接求和得到。

@@viz-kl@@

在这个受限模型族中，最小化 $D_{\mathrm{KL}}(P\|Q)$ 选择 $Q_{\mathrm{cover}}$：它给 $P$ 的两个峰都分配了质量，尽管也给低概率的中点分配了过多质量。最小化 $D_{\mathrm{KL}}(Q\|P)$ 则选择 $Q_{\mathrm{left}}$ 或 $Q_{\mathrm{right}}$：它主要落在一个峰上，避免把大量质量放在 $P(0)=0.02$ 的位置。这分别称为 **mode covering（覆盖多个峰）** 和 **mode seeking（偏向一个峰）**。

这些名称描述的是受限模型族下可能出现的优化行为，并不是 KL 散度本身的无条件定理。连续分布的相应讨论可见 [Jerfel 等人（2021）](https://proceedings.mlr.press/v161/jerfel21a.html)。

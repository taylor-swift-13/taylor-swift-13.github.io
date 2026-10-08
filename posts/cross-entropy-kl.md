本文讨论有限样本空间 $\mathcal X$ 上的两个概率分布 $P$ 和 $Q$。令 $X\sim P$，并统一使用自然对数。因此，以下信息量的单位是 nat；若改用以 $2$ 为底的对数，单位则为 bit。

## 支撑集

分布 $P$ 的支撑集（support）记作 $\operatorname{supp}(P)$，定义为

$$
\operatorname{supp}(P)=\{x\in\mathcal X:P(x)>0\}.
$$

它只包含在 $P$ 下概率严格大于零的结果。下文的求和只在这个集合上进行；当 $P(x)=0$ 时，$x$ 不贡献求和项，无须计算未定义的 $0\log 0$。

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

## KL 散度的参数顺序

设 $P$ 为目标分布，$Q$ 为待优化的模型分布。KL 散度第一个参数同时决定取期望的分布、求和的权重与对数比值的分子：

$$
\begin{aligned}
D_{\mathrm{KL}}(P\|Q)
&=\mathbb E_{X\sim P}\!\left[\log\frac{P(X)}{Q(X)}\right] \\
&=\sum_{x\in\operatorname{supp}(P)}P(x)\log\frac{P(x)}{Q(x)}, \\
D_{\mathrm{KL}}(Q\|P)
&=\mathbb E_{X\sim Q}\!\left[\log\frac{Q(X)}{P(X)}\right] \\
&=\sum_{x\in\operatorname{supp}(Q)}Q(x)\log\frac{Q(x)}{P(x)}.
\end{aligned}
$$

因此，一般有 $D_{\mathrm{KL}}(P\|Q)\ne D_{\mathrm{KL}}(Q\|P)$。若 $P(x)>0$ 而 $Q(x)=0$，前者为 $+\infty$；若 $Q(x)>0$ 而 $P(x)=0$，后者为 $+\infty$。

### Forward KL：在 $P$ 下取期望

固定 $P$ 后，$D_{\mathrm{KL}}(P\|Q)$ 中第一项与 $Q$ 无关：

$$
D_{\mathrm{KL}}(P\|Q)
=\sum_{x\in\operatorname{supp}(P)}P(x)\log P(x)
-\sum_{x\in\operatorname{supp}(P)}P(x)\log Q(x).
$$

优化 $Q$ 时，相关部分就是交叉熵 $-\mathbb E_{X\sim P}[\log Q(X)]$。在 $P(x)>0$、$Q(x)>0$ 的位置，暂时把 $Q(x)$ 视为独立变量，其偏导为

$$
\frac{\partial D_{\mathrm{KL}}(P\|Q)}{\partial Q(x)}
=-\frac{P(x)}{Q(x)}.
$$

当 $P(x)>0$ 且 $Q(x)$ 相对于 $P(x)$ 很小时，偏导的绝对值很大；当 $Q(x)=0$ 时，散度为 $+\infty$。因此，在受限模型族中最小化 forward KL，通常不愿漏掉 $P$ 赋予概率质量的区域。这是 **mode covering** 的来源。

### Reverse KL：在 $Q$ 下取期望

反向散度按 $Q$ 加权。在 $P(x)>0$、$Q(x)>0$ 的位置，暂时把 $Q(x)$ 视为独立变量，其偏导为

$$
\frac{\partial D_{\mathrm{KL}}(Q\|P)}{\partial Q(x)}
=\log\frac{Q(x)}{P(x)}+1.
$$

若 $Q$ 把较多概率放在 $P$ 很小的区域，对应的对数比值很大；若 $P(x)=0$ 而 $Q(x)>0$，散度直接为 $+\infty$。因此，受限的 $Q$ 往往倾向于避开 $P$ 的低概率区域。这是 **mode seeking** 或 **zero forcing** 的来源之一。

不能根据单个求和项直接决定怎样调整 $Q(x)$：当 $0<Q(x)<P(x)$ 时，$Q(x)\log(Q(x)/P(x))$ 本身是负数。KL 散度的非负性属于**求和结果**。此外，$\sum_xQ(x)=1$ 使各位置耦合；上述偏导只表示暂时忽略归一化约束时的局部变化。若允许 $Q=P$，两个方向均在 $Q=P$ 时取最小值零。mode covering 与 mode seeking 描述的是模型族受限时可能出现的倾向。

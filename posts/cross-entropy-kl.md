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

## KL 非负性与交叉熵的最小值

### 核心不等式

对任意 $t>0$，有

$$
\boxed{\log t\leq t-1}.
$$

等号当且仅当 $t=1$。令 $g(t)=t-1-\log t$，则 $g'(t)=1-1/t$；$g$ 在 $0<t<1$ 上递减，在 $t>1$ 上递增，故唯一最小值是 $g(1)=0$。下图显示两边的函数值与差距。

@@viz-log@@

### 逐项应用到 KL 散度

记 $S=\operatorname{supp}(P)$。若存在 $x\in S$ 使 $Q(x)=0$，则 $D_{\mathrm{KL}}(P\|Q)=+\infty$，非负性立即成立。以下假设 $Q(x)>0$ 对所有 $x\in S$ 成立。由定义，

$$
-D_{\mathrm{KL}}(P\|Q)
=\sum_{x\in S}P(x)\log\frac{Q(x)}{P(x)}.
$$

对每个 $x\in S$，都有 $P(x)>0$。取 $t=Q(x)/P(x)>0$，将核心不等式两边乘以 $P(x)$，得到

$$
P(x)\log\frac{Q(x)}{P(x)}
\leq P(x)\left(\frac{Q(x)}{P(x)}-1\right)
=Q(x)-P(x).
$$

对 $S$ 求和。因为 $\sum_{x\in S}P(x)=1$，而 $Q$ 在整个样本空间上的概率之和为 $1$，所以 $\sum_{x\in S}Q(x)\leq1$。于是

$$
\begin{aligned}
-D_{\mathrm{KL}}(P\|Q)
&\leq\sum_{x\in S}\bigl(Q(x)-P(x)\bigr) \\
&=\sum_{x\in S}Q(x)-1\leq0.
\end{aligned}
$$

因此，对任意 $P,Q$，

$$
\boxed{D_{\mathrm{KL}}(P\|Q)\geq0}.
$$

### 等号条件

要使 $D_{\mathrm{KL}}(P\|Q)=0$，上面两层不等式都必须取等号。第一层逐项使用 $\log t\leq t-1$，而每个系数 $P(x)$ 都严格为正；因此对所有 $x\in S$ 必须有 $Q(x)/P(x)=1$，即 $Q(x)=P(x)$。这些点已经占满 $Q$ 的全部概率质量：

$$
\sum_{x\in S}Q(x)=\sum_{x\in S}P(x)=1.
$$

所以 $S$ 外的 $Q(x)$ 只能为零；那里也有 $P(x)=0$。故 $Q=P$ 在整个样本空间上成立。反过来，$Q=P$ 时 KL 散度显然为零。因此

$$
D_{\mathrm{KL}}(P\|Q)=0\quad\Longleftrightarrow\quad Q=P.
$$

### 交叉熵的最小值

$P$ 的熵定义为 $H(P)=H(P,P)$。由于样本空间有限，$H(P)$ 总是有限：

$$
H(P)=-\sum_{x\in S}P(x)\log P(x).
$$

从交叉熵减去熵，直接得到

$$
\begin{aligned}
H(P,Q)-H(P)
&=-\sum_{x\in S}P(x)\log Q(x)
  +\sum_{x\in S}P(x)\log P(x) \\
&=D_{\mathrm{KL}}(P\|Q).
\end{aligned}
$$

若 $Q$ 在 $S$ 上取零，交叉熵和 KL 散度都为 $+\infty$，而 $H(P)$ 有限，因此等式在扩展实数意义下仍成立。结合 KL 非负性及等号条件，

$$
\boxed{H(P,Q)=H(P)+D_{\mathrm{KL}}(P\|Q)\geq H(P)},
$$

且等号当且仅当 $Q=P$。固定 $P$，让 $Q$ 遍历同一样本空间上的所有概率分布，可得

$$
\boxed{\min_Q H(P,Q)=H(P)},
$$

唯一达到最小值的分布是 $Q=P$。等式中的 $H(P)$ 只由目标分布决定；$D_{\mathrm{KL}}(P\|Q)$ 是使用 $Q$ 时增加的非负项。

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

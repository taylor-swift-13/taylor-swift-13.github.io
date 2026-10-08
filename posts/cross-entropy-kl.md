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
H(P,Q)=H(P)+D_{\mathrm{KL}}(P\|Q).
$$

这个等式在 $Q$ 于 $\operatorname{supp}(P)$ 上取零时仍成立：右侧的 KL 散度为 $+\infty$，而 $H(P)$ 有限。若 $Q(x)>0$ 对所有 $x\in\operatorname{supp}(P)$ 成立，则由 $\log t\leq t-1$ 可进一步得到

$$
\begin{aligned}
-D_{\mathrm{KL}}(P\|Q)
&=\sum_{x\in\operatorname{supp}(P)}P(x)\log\frac{Q(x)}{P(x)} \\
&\leq\sum_{x\in\operatorname{supp}(P)}\bigl(Q(x)-P(x)\bigr) \\
&=\sum_{x\in\operatorname{supp}(P)}Q(x)-1\leq 0.
\end{aligned}
$$

因此 $D_{\mathrm{KL}}(P\|Q)\geq 0$，且等号当且仅当 $P=Q$。对于固定的 $P$，最小化交叉熵等价于最小化 KL 散度，因为 $H(P)$ 不随 $Q$ 改变。

## 两个算例

**例 1：两个分布都处处为正。** 令 $\mathcal X=\{a,b\}$，$P=(1/2,1/2)$，$Q=(3/4,1/4)$。代入定义，得到

$$
\begin{aligned}
H(P)&=\log 2\approx 0.6931, \\
H(P,Q)&=-\tfrac12\log\tfrac34-\tfrac12\log\tfrac14
       =\log\frac{4}{\sqrt 3}\approx 0.8370, \\
D_{\mathrm{KL}}(P\|Q)&=\log\frac{2}{\sqrt 3}\approx 0.1438.
\end{aligned}
$$

这里 $H(P,Q)-H(P)=D_{\mathrm{KL}}(P\|Q)$；三个数均以 nat 为单位。

**例 2：零概率点。** 令 $\mathcal X=\{a,b,c\}$，$P=(1,0,0)$，$Q=(1/2,1/2,0)$。此时 $\operatorname{supp}(P)=\{a\}$，所以 $Q(c)=0$ 不影响求和，且

$$
H(P)=0,\qquad H(P,Q)=D_{\mathrm{KL}}(P\|Q)=\log 2.
$$

若改为 $Q'=(0,1,0)$，则 $P(a)>0$ 而 $Q'(a)=0$，因此 $H(P,Q')=D_{\mathrm{KL}}(P\|Q')=+\infty$。关键条件是 $Q$ 是否在 **$P$ 的支撑集内** 取零，而不是 $Q$ 是否在整个 $\mathcal X$ 上取零。

## 与分类损失的关系

对单个分类样本，若真实类别为 $y$，令 $P$ 为集中在 $y$ 上的分布（即 $P(y)=1$），模型预测分布为 $Q$，则

$$
H(P,Q)=-\log Q(y).
$$

这正是该样本的负对数似然。对多个样本取平均，便得到常用的分类交叉熵损失。这里每个样本可以有不同的模型预测分布；前面的 $H(P,Q)$ 定义讨论的是一对固定分布。

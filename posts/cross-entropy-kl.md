设 $\mathcal{X}$ 为有限样本空间，$P$ 和 $Q$ 是其上的概率分布。令 $X\sim P$，下文统一使用自然对数。记 $\operatorname{supp}(P)=\{x\in\mathcal{X}:P(x)>0\}$。交叉熵可以写为期望，也可以写为求和：

$$
\begin{aligned}
H(P,Q)
&=\mathbb{E}_{X\sim P}\!\left[-\log Q(X)\right] \\
&=-\sum_{x\in\operatorname{supp}(P)}P(x)\log Q(x).
\end{aligned}
$$

KL 散度采用相同的两种形式：

$$
\begin{aligned}
D_{\mathrm{KL}}(P\|Q)
&=\mathbb{E}_{X\sim P}\!\left[\log\frac{P(X)}{Q(X)}\right] \\
&=\sum_{x\in\operatorname{supp}(P)}P(x)\log\frac{P(x)}{Q(x)}.
\end{aligned}
$$

求和只遍历 $P(x)>0$ 的点，所以 $P(x)=0$ 的点不产生求和项。若存在 $P(x)>0$ 且 $Q(x)=0$ 的点，则相应的 $-\log Q(x)$ 与 $\log(P(x)/Q(x))$ 均取 $+\infty$；因此交叉熵和 KL 散度都取 $+\infty$。

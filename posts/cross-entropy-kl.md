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

## Softmax 与交叉熵：对 logit 的梯度

设有 $K$ 个类别。模型为每个类别输出一个实数 $z_i$，称为该类别的 **logit**。这些数本身不必非负，也不要求总和为 $1$。Softmax 用指数和归一化把它们转换为概率。记

$$
Z=\sum_{k=1}^K e^{z_k},\qquad Q_i=\frac{e^{z_i}}{Z}.
$$

每个 $e^{z_i}>0$，因此 $Q_i>0$；又因为分母正是所有分子的和，$\sum_iQ_i=Z/Z=1$。不同类别的 $Q_i$ 共用同一个 $Z$，所以改变 $z_j$ 时，其他类别的概率也会改变。

令目标分布为 $P_1,\ldots,P_K$，其中 $P_i\geq0$ 且 $\sum_iP_i=1$。$P$ 可以是单一类别的标签，也可以是软标签。求导时把 $P$ 视为固定，只调整模型的 logit。一个样本的交叉熵为

$$
L_{\mathrm{CE}}=-\sum_{i=1}^K P_i\log Q_i.
$$

先将 $Q_i=e^{z_i}/Z$ 代入对数。由于 $Z>0$，

$$
\log Q_i=\log\frac{e^{z_i}}{Z}=\log e^{z_i}-\log Z=z_i-\log Z.
$$

再代回交叉熵，并将与类别 $i$ 无关的 $\log Z$ 提出求和号：

$$
\begin{aligned}
L_{\mathrm{CE}}
&=-\sum_iP_i(z_i-\log Z)\\
&=-\sum_iP_i z_i+\left(\sum_iP_i\right)\log Z\\
&=\log Z-\sum_iP_i z_i.
\end{aligned}
$$

最后一步只用了 $\sum_iP_i=1$。现在固定一个类别 $j$，对 $z_j$ 求偏导，同时暂时固定其余 logit。先看 $\log Z$：$Z=\sum_k e^{z_k}$ 中只有 $e^{z_j}$ 随 $z_j$ 变化，所以

$$
\frac{\partial Z}{\partial z_j}=e^{z_j},\qquad
\frac{\partial\log Z}{\partial z_j}
=\frac{1}{Z}\frac{\partial Z}{\partial z_j}
=\frac{e^{z_j}}{Z}=Q_j.
$$

再看 $-\sum_iP_i z_i$：$P_i$ 已固定，求和中只有 $-P_jz_j$ 随 $z_j$ 变化，其导数为 $-P_j$。两部分相加便得到

$$
\boxed{\frac{\partial L_{\mathrm{CE}}}{\partial z_j}
=\frac{\partial\log Z}{\partial z_j}
-\frac{\partial}{\partial z_j}\sum_iP_i z_i
=Q_j-P_j.}
$$

这个结果也可以从“改变 $z_j$ 会影响所有 $Q_i$”直接验证。由 $\log Q_i=z_i-\log Z$，

$$
\frac{\partial\log Q_i}{\partial z_j}
=\begin{cases}
1-Q_j,&i=j,\\
-Q_j,&i\ne j.
\end{cases}
$$

对 $i=j$，$z_i$ 本身的导数是 $1$，同时还要减去分母带来的 $Q_j$；对 $i\ne j$，$z_i$ 不变，只有分母带来 $-Q_j$。把两类项都放回交叉熵的导数，得到

$$
\begin{aligned}
\frac{\partial L_{\mathrm{CE}}}{\partial z_j}
&=-P_j(1-Q_j)-\sum_{i\ne j}P_i(-Q_j)\\
&=-P_j+Q_j\left(P_j+\sum_{i\ne j}P_i\right)\\
&=Q_j-P_j.
\end{aligned}
$$

因此，$Q_j-P_j$ 已经包含了**所有类别的概率随 $z_j$ 改变**所产生的影响。这里求导的对象始终是 logit，而不是把一个 $Q_j$ 当成可以独立改变的概率。由 $\partial Q_i/\partial z_j=Q_i\,\partial\log Q_i/\partial z_j$，还可得到下文使用的 softmax 导数：

$$
\frac{\partial Q_i}{\partial z_j}=Q_i(\mathbf 1_{i=j}-Q_j),
$$

其中 $\mathbf 1_{i=j}$ 在 $i=j$ 时为 $1$，否则为 $0$。

### 与概率上的 MSE 比较

为使比较的输入一致，令 MSE 也作用于 softmax 概率，取损失 $L_{\mathrm{MSE}}=\tfrac12\sum_i(Q_i-P_i)^2$。这里的 $1/2$ 只为简化导数；若再除以类别数 $K$，梯度整体再乘 $1/K$。将上面的 softmax 导数代入链式法则，得到

$$
\begin{aligned}
\frac{\partial L_{\mathrm{MSE}}}{\partial z_j}
&=\sum_i(Q_i-P_i)\frac{\partial Q_i}{\partial z_j}\\
&=Q_j\left[(Q_j-P_j)-\sum_iQ_i(Q_i-P_i)\right].
\end{aligned}
$$

因此，MSE 的概率误差还要经过 softmax 的导数才能传到 logit；交叉熵的梯度则直接是 $Q_j-P_j$。例如真实类别为 $y$ 时，$P_y=1$。若模型对它给出 $Q_y\to0$，则 $\partial L_{\mathrm{CE}}/\partial z_y=Q_y-1\to-1$；上式中 MSE 对 $z_y$ 的梯度却因前面的 $Q_y$ 因子趋于 $0$。这解释了为什么 softmax 后接 MSE 在高置信错误处可能产生很小的 logit 梯度。比较的是这两种**具体组合**的梯度；它不意味着 MSE 在其他任务中不适用。

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

优化 $Q$ 时，相关部分就是交叉熵 $-\mathbb E_{X\sim P}[\log Q(X)]$。固定一个满足 $P(x)>0,Q(x)>0$ 的位置，记 $p=P(x)$、$q=Q(x)$，暂时固定其他坐标。与 $q$ 有关的求和项为 $p\log(p/q)=p\log p-p\log q$。其中 $p$ 是常数，所以对 $q$ 求导只剩下一项：

$$
\frac{\partial D_{\mathrm{KL}}(P\|Q)}{\partial Q(x)}
=\frac{\mathrm d}{\mathrm dq}\bigl(p\log p-p\log q\bigr)
=-\frac{p}{q}
=-\frac{P(x)}{Q(x)}.
$$

当 $P(x)>0$ 且 $Q(x)$ 相对于 $P(x)$ 很小时，偏导的绝对值很大；当 $Q(x)=0$ 时，散度为 $+\infty$。因此，在受限模型族中最小化 forward KL，通常不愿漏掉 $P$ 赋予概率质量的区域。这是 **mode covering** 的来源。

### Reverse KL：在 $Q$ 下取期望

反向散度按 $Q$ 加权。在同样的正概率位置，与 $q$ 有关的求和项为 $q\log(q/p)=q\log q-q\log p$。乘积求导给出 $(q\log q)'=\log q+1$；由于 $p$ 固定，$(q\log p)'=\log p$。因此

$$
\frac{\partial D_{\mathrm{KL}}(Q\|P)}{\partial Q(x)}
=\frac{\mathrm d}{\mathrm dq}\bigl(q\log q-q\log p\bigr)
=\log q+1-\log p
=\log\frac{Q(x)}{P(x)}+1.
$$

若 $Q$ 把较多概率放在 $P$ 很小的区域，对应的对数比值很大；若 $P(x)=0$ 而 $Q(x)>0$，散度直接为 $+\infty$。因此，受限的 $Q$ 往往倾向于避开 $P$ 的低概率区域。这是 **mode seeking** 或 **zero forcing** 的来源之一。

这两个偏导只说明：暂时固定其他概率，单独改变 $Q(x)$ 时，KL 对这个变化有多敏感。实际的 $Q$ 必须满足 $\sum_xQ(x)=1$；提高一个位置的概率，就要从别处移来。因此，不能把偏导当作逐点修改 $Q$ 的指令。前文的非负性证明已表明：若允许 $Q=P$，两个方向的 KL 都在 $Q=P$ 时取得最小值 $0$。

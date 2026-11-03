在 on-policy distillation（OPD）中，学生先生成自己的输出，老师再对这些输出给出训练信号。有些实现只使用实际抽中的 token，并把损失写成“一个权重乘以 SFT loss”：forward KL 的权重是 $q/p$，reverse KL 的权重是 $\log(q/p)$。这些权重从哪里来，为什么求导时要固定，又为什么一些实现偏向 reverse KL？

从全词表的 KL 出发，先求完整梯度，再把求和改写成学生采样下的期望，就能逐步得到这两个公式。关键是：**采样公式需要保证平均梯度正确，单次算出的 loss 数值无须等于完整 KL。**

## 1. 符号与讨论范围

固定同一个上下文，词表有限，学生和老师在这个上下文下给出的概率分别记作 $p$ 和 $q$：

| 符号 | 含义 |
| --- | --- |
| $p_i$ | 学生给第 $i$ 个 token 的概率，依赖学生参数 |
| $q_i$ | 老师给第 $i$ 个 token 的概率，老师不参与训练 |
| $a\sim p$ | 学生抽中的 token，$\Pr(a=i)=p_i$ |
| $\nabla$ | 对学生参数求梯度 |

下文统一使用自然对数，并假设所有 $p_i,q_i>0$。这覆盖有限 logit、未截断的 softmax 分布，也使概率比值和对数都有定义。讨论的是**用当前学生分布采样后，在同一参数位置计算的一次更新梯度**；上下文本身视为固定。

本文约定 forward KL 为 $D_{\mathrm{KL}}(q\|p)$，reverse KL 为 $D_{\mathrm{KL}}(p\|q)$。这里的 $p$ 始终表示学生，$q$ 始终表示老师；阅读不同资料时，需要先确认各自的符号约定。

## 2. Forward KL：把老师加权改写成学生采样

### 2.1 从完整 loss 求梯度

全词表的 forward KL 为

$$
\begin{aligned}
L_{\mathrm F}
&=\sum_i q_i\log\frac{q_i}{p_i}\\
&=\underbrace{\sum_i q_i\log q_i}_{\text{老师固定，与学生参数无关}}
+\sum_i q_i(-\log p_i).
\end{aligned}
$$

因此，它的梯度是每个 token 的负对数似然梯度，乘以老师概率后求和：

$$
\nabla L_{\mathrm F}
=\sum_i q_i\,\nabla(-\log p_i).
$$

这里把 $-\log p_i$ 称为这个 token 的 **SFT loss**。SFT 是监督微调；对指定 token $i$，它使用负对数概率作为损失。对学生参数 $\theta$ 求导，就得到本文所说的 **SFT 梯度**：

$$
L_{\mathrm{SFT}}=-\log p_i,
\qquad
\nabla_\theta L_{\mathrm{SFT}}=\nabla_\theta(-\log p_i).
$$

概率 $p_i$ 越大，$-\log p_i$ 越小。因此，沿负梯度做足够小的一步更新，会降低这个损失、提高指定 token 的概率。加上本次求导时固定的权重 $w$ 后，更新变成

$$
\theta_{\mathrm{新}}
=\theta_{\mathrm{旧}}-\eta w\nabla_\theta(-\log p_i),
\qquad \eta>0.
$$

- **$w>0$：** 沿降低 SFT loss 的方向更新，提高该 token 的概率。
- **$w<0$：** 更新方向反转，提高 SFT loss，降低该 token 的概率。
- **$w=0$：** 这个样本不产生更新。

例如，前缀是“法国的首都是”，本次指定 token 是“巴黎”。若 $w=2$，就沿提高“巴黎”概率的方向更新，步长是 $w=1$ 时的两倍；若 $w=-1$，则沿降低“巴黎”概率的方向更新。这里描述的是该样本单独做足够小的一步更新；合并其他样本的梯度后，实际变化还受它们影响。

在 OPD 中，指定 token 也可以由学生自己抽出，不一定是人工标注的标准答案。这里沿用“SFT loss”和“SFT 梯度”，指的是相同的负对数概率计算形式；前面的权重决定要鼓励还是抑制这个 token。

### 2.2 用学生抽样的频率提供外层权重

学生抽中 $i$ 的概率是 $p_i$，而完整梯度按 $q_i$ 加权。给每项乘、除同一个 $p_i$，即可把两者连接起来：

$$
\boxed{
\nabla L_{\mathrm F}
=\sum_i p_i\left[
\frac{q_i}{p_i}\,\nabla(-\log p_i)
\right].
}
$$

外面的 $p_i$ 由学生抽样的频率提供。抽到哪个 token，就计算方括号里的梯度；在同一上下文、同一学生参数下重复采样，平均梯度便回到全词表的结果。这就是重要性采样：用 $q_i/p_i$ 修正“按学生抽样”和“按老师加权”的差别。

记 $\operatorname{sg}(x)$ 为 stop-gradient：前向计算时取值等于 $x$，反向传播时将它视为常数。抽到 token $a$ 后，可以使用代理损失

$$
\boxed{
\widehat L_{\mathrm F}(a)
=\operatorname{sg}\!\left(\frac{q_a}{p_a}\right)
(-\log p_a).
}
$$

固定权重后，它对学生参数的梯度恰好是所需的 $(q_a/p_a)\nabla(-\log p_a)$。

## 3. Reverse KL：为什么最后出现对数权重

### 3.1 外层概率也需要求导

全词表的 reverse KL 为

$$
L_{\mathrm R}=\sum_i p_i\log\frac{p_i}{q_i}.
$$

外面的 $p_i$ 和对数里面的 $p_i$ 都依赖学生参数。用乘积求导法则，得到

$$
\begin{aligned}
\nabla L_{\mathrm R}
&=\sum_i\left[
\log\frac{p_i}{q_i}\,\nabla p_i
+p_i\,\nabla\log p_i
\right]\\
&=\sum_i\left[\log\frac{p_i}{q_i}+1\right]\nabla p_i.
\end{aligned}
$$

第二步使用了 $p_i\nabla\log p_i=\nabla p_i$。其中额外的 $+1$ 不是凭空省略的；学生概率之和恒等于 $1$，所以

$$
\sum_i\nabla p_i
=\nabla\!\left(\sum_i p_i\right)
=\nabla 1=0.
$$

因此，$+1$ 对应的部分在全词表求和后恰好为零，留下

$$
\nabla L_{\mathrm R}
=\sum_i\log\frac{p_i}{q_i}\,\nabla p_i.
$$

### 3.2 改写成“采样概率乘以加权 SFT 梯度”

利用 $\nabla p_i=p_i\nabla\log p_i$，并同时翻转两个负号：

$$
\begin{aligned}
\nabla L_{\mathrm R}
&=\sum_i p_i\log\frac{p_i}{q_i}\,\nabla\log p_i\\
&=\sum_i p_i\left[
\log\frac{q_i}{p_i}\,\nabla(-\log p_i)
\right].
\end{aligned}
$$

形式已经与 forward KL 一致：外面的 $p_i$ 仍由学生采样提供，每次只计算括号里的梯度。因此，reverse KL 的采样代理损失可以写成

$$
\boxed{
\widehat L_{\mathrm R}(a)
=\operatorname{sg}\!\left(\log\frac{q_a}{p_a}\right)
(-\log p_a).
}
$$

完整 loss 中的学生概率都正常参与求导；只在构造这个采样代理损失时，才把前面的对数比值固定。

## 4. 为什么要固定权重

前面已经推导出，抽到 token $a$ 后，需要的随机梯度是

$$
\log\frac{q_a}{p_a}\,\nabla(-\log p_a).
$$

为了让自动求导得到它，使用代理 loss：

$$
\widehat L_{\mathrm R}(a)
=\operatorname{sg}\!\left(\log\frac{q_a}{p_a}\right)(-\log p_a).
$$

**$\operatorname{sg}$ 保留权重的数值，但不对权重求导。** 例如权重算出来是 $2$，本次就得到 $2\nabla(-\log p_a)$；下次再重新计算权重。

如果不加 $\operatorname{sg}$，乘积求导会多出一项：

$$
\begin{aligned}
\nabla\left[\log\frac{q_a}{p_a}(-\log p_a)\right]
={}&\underbrace{\log\frac{q_a}{p_a}\,\nabla(-\log p_a)}_{\text{需要的梯度}}\\
&+\underbrace{(-\log p_a)\nabla\log\frac{q_a}{p_a}}_{\text{多出来的一项}}.
\end{aligned}
$$

老师的 $q_a$ 固定，权重里的学生概率 $p_a$ 却仍依赖参数，所以额外项一般不为零。原始 KL 已经在第 3 节完整求导；这里固定权重，是为了让代码准确实现推导出的梯度。

直接把 $\log(p_a/q_a)$ 当作 loss 也不行。对固定的采样 token 求导，结果与所需梯度分别是：

$$
\begin{aligned}
\text{直接求导：}\quad &\nabla\log p_a,\\
\text{所需梯度：}\quad &\log\frac{p_a}{q_a}\,\nabla\log p_a.
\end{aligned}
$$

第二行与开头的形式等价，因为两个因子同时换了符号。相差的乘数 $\log(p_a/q_a)$ 用来比较学生与老师：学生高估时压低该 token 的概率，低估时提高，相等时不调整。直接求导则让 $q_a$ 消失，而且梯度期望为零：

$$
\mathbb E_{a\sim p}[\nabla\log p_a]
=\sum_i p_i\frac{\nabla p_i}{p_i}
=\nabla\sum_i p_i=0.
$$

**代理 loss 用来产生正确梯度，数值不必等于 KL。** 要求的是 $\mathbb E[\nabla\widehat L_{\mathrm R}]=\nabla L_{\mathrm R}$。Forward 同理：固定 $q_a/p_a$，只对后面的 $-\log p_a$ 求导。

## 5. Forward 权重减去 1 有什么意义

### 5.1 先看作用：让权重直接表示学生与老师的偏差

原始的 forward 权重是 $q_a/p_a$。假设学生已经与老师完全一致，即所有 token 都满足 $p_i=q_i$，这个权重仍然是 $1$。于是抽到 token $a$ 后，单次梯度仍为

$$
\frac{q_a}{p_a}\nabla(-\log p_a)=\nabla(-\log p_a).
$$

也就是说，虽然学生已经学对，单次采样仍会推动它提高抽中 token 的概率。不同采样结果产生的梯度在期望上相互抵消，但每次更新仍可能产生随机波动。

如果把权重改成 $q_a/p_a-1$，它就直接反映两者的偏差：

- **$q_a>p_a$：** 权重为正，推动学生提高这个 token 的概率。
- **$q_a<p_a$：** 权重为负，推动学生降低这个 token 的概率。
- **$q_a=p_a$：** 权重为零，这个样本不产生更新。

特别是当整个分布 $p=q$ 时，每个样本的梯度都为零，不再只是平均梯度为零。这里说的提高或降低，是该样本单独做足够小的一步梯度下降时的方向；实际训练还会合并其他样本的梯度。

这也让它更方便与 reverse 权重 $\log(q_a/p_a)$ 比较：两者都在 $q_a/p_a=1$ 时为零，在比值大于 $1$ 时为正、小于 $1$ 时为负。

| $q_a/p_a$ | Forward：$q_a/p_a-1$ | Reverse：$\log(q_a/p_a)$ |
| --- | ---: | ---: |
| $100$ | $99$ | $4.61$ |
| $1$ | $0$ | $0$ |
| $0.01$ | $-0.99$ | $-4.61$ |

### 5.2 为什么减去 1 不改变平均梯度

减去 $1$，相当于从每个样本的原始梯度中减去一份 SFT 梯度：

$$
\left(\frac{q_a}{p_a}-1\right)\nabla(-\log p_a)
=\frac{q_a}{p_a}\nabla(-\log p_a)-\nabla(-\log p_a).
$$

关键在于：按学生分布采样时，被减去的这一项，其期望恰好为零。逐步展开：

$$
\begin{aligned}
\mathbb E_{a\sim p}[\nabla(-\log p_a)]
&=\sum_i p_i\nabla(-\log p_i)\\
&=-\sum_i p_i\frac{1}{p_i}\nabla p_i\\
&=-\sum_i\nabla p_i\\
&=-\nabla\left(\sum_i p_i\right)\\
&=-\nabla 1=0.
\end{aligned}
$$

因此，修改后的平均梯度等于原平均梯度减去零：

$$
\begin{aligned}
\mathbb E_{a\sim p}\left[\left(\frac{q_a}{p_a}-1\right)\nabla(-\log p_a)\right]
&=\mathbb E_{a\sim p}\left[\frac{q_a}{p_a}\nabla(-\log p_a)\right]
-\mathbb E_{a\sim p}[\nabla(-\log p_a)]\\
&=\nabla L_{\mathrm F}-0\\
&=\nabla L_{\mathrm F}.
\end{aligned}
$$

实现时，修改后的权重仍然需要固定：

$$
\widehat L_{\mathrm F,0}(a)
=\operatorname{sg}\!\left(\frac{q_a}{p_a}-1\right)(-\log p_a).
$$

这种做法叫作减去一个常数基线。**它改变单次样本的梯度，但不改变平均训练方向。** 它消除了 $p=q$ 时的采样梯度波动，不过并不保证在所有分布下都能降低方差。

## 6. 为什么一些 sampled-token 实现偏向 Reverse KL

### 6.1 对数缓和罕见样本的极端权重

假设某个 token 的学生概率只有 $p=0.001$，老师概率却有 $q=0.1$。学生平均约每一千次抽样才遇到它一次；一旦抽中，forward 的原始权重为 $100$，减去基线后仍有 $99$，而 reverse 权重只有 $\log100\approx4.61$。

使用学生样本估计 forward KL 时，可能出现“多数时候没有抽到重要 token，偶尔抽到却带来很大梯度”的情况。对数权重缓和了 $q/p$ 直接增长带来的极端更新。

这个比较**不能证明 reverse 梯度估计的方差始终更小**。方差还依赖完整的概率分布、各 token 的梯度、基线与采样方式；当 $q/p$ 很小时，对数权重的绝对值反而可以很大。

### 6.2 两种目标对遗漏和过度生成的侧重点不同

从上表可见，forward 的 $q/p-1$ 在学生严重低估老师概率时可以很大；当学生严重高估时，它的负值则以 $-1$ 为下界。Reverse 的 $\log(q/p)$ 对概率比值的高估、低估都给出对数尺度的信号，特别是在老师概率极低时，可以给出很强的负反馈。

因此，forward 更强调补足学生遗漏的老师行为，reverse 更强调避开学生过度生成、老师却不认可的行为。对于“学生先写出自己的推理，再由老师对生成过程提供反馈”的流程，后者是一种自然的选择动机。

当学生模型无法完全拟合老师时，这也对应常说的 mode covering 与 mode seeking：forward 倾向覆盖老师的多种输出，reverse 往往更愿意集中于其中一部分高概率输出。这是受限模型下的常见倾向，具体取舍依赖任务、模型与训练过程。GKD 论文讨论并实验比较了不同散度，指出合适的选择与任务有关。

### 6.3 对数概率差方便接入 RL 流程

Reverse 权重可以直接写成

$$
\log\frac{q_a}{p_a}=\log q_a-\log p_a.
$$

它只需要老师和学生对实际生成 token 的对数概率。把这个量作为固定的 token 级奖励或 advantage，就能复用策略梯度形式的训练流程。

Thinking Machines 的 OPD 实现正是先计算学生与老师的对数概率差，再将其相反数作为逐 token 的 advantage，接入已有的 RL importance-sampling loss。这个实现展示了 reverse KL 在工程上的便利，但不能由此推出它对所有蒸馏任务都更好。

## 7. On-policy 不限定 KL 的方向，也不限定只算一个 token

“上下文由谁生成”“每个上下文下比较哪一种散度”“计算全词表还是只计算抽中的 token”，是三个可以分别选择的问题。

GKD 就在学生生成的上下文上使用过 forward KL，也比较了 reverse KL 与广义 JSD。其论文中的 token 级分布损失按词表比较老师与学生，并在更新时固定采样得到的序列；不能把“学生生成训练序列”直接等同于本文的单 token 梯度估计。

若在每个上下文下计算全词表 KL，所有 token 都参与计算，就不再有本文所讨论的“当前这个罕见 token 偶尔被抽到，才贡献巨大权重”的估计问题。完整词表的代价，以及上下文、序列采样的随机性仍需另行考虑。

当模型能够精确拟合老师时，两种 KL 都在 $p=q$ 取得最小值 $0$。它们的区别主要体现在采样估计、优化过程，以及学生无法完整拟合老师时的取舍。

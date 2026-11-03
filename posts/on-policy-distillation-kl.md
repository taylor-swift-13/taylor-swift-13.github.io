在 on-policy distillation（OPD）中，学生先生成自己的输出，老师再对这些输出给出训练信号。有些实现只使用实际抽中的 token，并把损失写成“一个权重乘以 SFT loss”：forward KL 的权重是 $q/p$，reverse KL 的权重是 $\log(q/p)$。这些权重从哪里来，为什么求导时要固定，又为什么一些实现偏向 reverse KL？

@@opinion-begin@@

从全词表的 KL 出发，先求完整梯度，再把求和改写成学生采样下的期望，就能逐步得到这两个公式。关键是：**采样公式需要保证平均梯度正确，单次算出的 loss 数值无须等于完整 KL。**

@@opinion-end@@

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

这里把 $-\log p_i$ 称为这个 token 的 **SFT loss**（监督微调损失）；对学生参数求导得到 **SFT 梯度** $\nabla_\theta(-\log p_i)$。最小化这个损失会提高指定 token 的概率。

![SFT loss 曲线：概率越高，负对数损失越低](../assets/plots/sft-negative-log.svg)

*自然对数下，$p_i=0.1$ 时损失约为 $2.30$，$p_i=0.5$ 时约为 $0.69$，$p_i=1$ 时为 $0$。*

**$w$ 表示乘在 SFT loss 前面的权重，本次求导时固定。** Forward 取 $w=q_i/p_i$，Reverse 取 $w=\log(q_i/p_i)$。对加权损失 $w(-\log p_i)$ 做梯度下降：

- **正权重（$w>0$）**：提高指定 token 的概率。
- **负权重（$w<0$）**：降低指定 token 的概率。
- **零权重（$w=0$）**：不产生更新。

@@opinion-begin@@

例如，指定 token 是“巴黎”，$w=2$ 就推动模型提高“巴黎”的概率，$w=-1$ 则推动降低。这里描述的是单个样本、足够小的一步更新；多个样本的梯度会合并。

@@opinion-end@@

@@opinion-begin@@

OPD 中的指定 token 可以由学生自己采样；“SFT”在这里指负对数概率的计算形式，不要求它是人工标注的答案。

@@opinion-end@@

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

@@opinion-begin@@

外面的 $p_i$ 由学生抽样的频率提供。抽到哪个 token，就计算方括号里的梯度；在同一上下文、同一学生参数下重复采样，平均梯度便回到全词表的结果。这就是重要性采样：用 $q_i/p_i$ 修正“按学生抽样”和“按老师加权”的差别。

@@opinion-end@@

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

@@opinion-begin@@

完整 loss 中的学生概率都正常参与求导；只在构造这个采样代理损失时，才把前面的对数比值固定。

@@opinion-end@@

## 4. 为什么要固定权重

Reverse KL 对应的单 token 采样梯度是

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

@@opinion-begin@@

老师的 $q_a$ 固定，权重里的学生概率 $p_a$ 却仍依赖参数，所以额外项一般不为零。原始 KL 已经在第 3 节完整求导；这里固定权重，是为了让代码准确实现推导出的梯度。

@@opinion-end@@

直接把 $\log(p_a/q_a)$ 当作 loss 也不行。两种做法都用 SFT 梯度 $\nabla(-\log p_a)$ 表示，区别是：

$$
\begin{aligned}
\text{正确的采样梯度：}\quad
&\underbrace{\log(q_a/p_a)}_{\text{比较老师与学生}}\,\nabla(-\log p_a),\\
\text{直接对对数比值求导：}\quad
&\nabla\log(p_a/q_a)
=-\nabla(-\log p_a).
\end{aligned}
$$

正确采样梯度中的系数是 $\log(q_a/p_a)$：老师给这个 token 的概率更高时，系数为正，推动学生提高概率；老师给的概率更低时，系数为负，推动学生降低概率；两者相等时，系数为零。

@@opinion-begin@@

直接对 $\log(p_a/q_a)$ 求导，老师的 $q_a$ 是常数，求导后消失，SFT 梯度前的系数永远是 $-1$。因此，无论老师如何评价，都会沿降低抽中 token 概率的方向更新，不能实现所需的蒸馏更新。

@@opinion-end@@

@@opinion-begin@@

例如，学生概率 $p_a=0.2$：老师概率 $q_a=0.4$ 时，正确系数是 $\log 2>0$，应该提高学生概率；老师概率 $q_a=0.1$ 时，正确系数是 $\log 0.5<0$，应该降低学生概率。直接对对数比值求导，两个情况的系数却都是 $-1$。

@@opinion-end@@

@@opinion-begin@@

**代理 loss 的用途是让自动求导得到正确的训练梯度，不是计算 KL 的数值。** Reverse KL 使用 $\operatorname{sg}(\log(q_a/p_a))(-\log p_a)$，使采样梯度的期望等于完整 reverse KL 的梯度；Forward KL 使用 $\operatorname{sg}(q_a/p_a)(-\log p_a)$，同样只对负对数概率求导。

@@opinion-end@@

## 5. Forward 权重减去 1 有什么意义

### 5.1 先看作用：让权重直接表示学生与老师的偏差

原始的 forward 权重是 $q_a/p_a$。假设学生已经与老师完全一致，即所有 token 都满足 $p_i=q_i$，这个权重仍然是 $1$。于是抽到 token $a$ 后，单次梯度仍为

$$
\frac{q_a}{p_a}\nabla(-\log p_a)=\nabla(-\log p_a).
$$

@@opinion-begin@@

**这是合理的随机梯度波动，但不代表还需要把这个 token 的概率提高。**

@@opinion-end@@

@@opinion-begin@@

当学生已经等于老师时，完整 KL 的梯度为零。可是不减去 $1$ 的采样方法，每次只抽到一个 token，只看到它对应的那一项，所以仍可能产生非零更新。

@@opinion-end@@

@@opinion-begin@@

例如学生和老师都认为：

@@opinion-end@@

@@opinion-begin@@

- A 应出现 80%；
- B 应出现 20%。

@@opinion-end@@

@@opinion-begin@@

抽到 A 就推高 A，抽到 B 就推高 B。**这些更新在同一参数位置按各自的抽样概率取平均后恰好抵消**，因此整体梯度仍为零。实际有限次更新则会在最优点附近波动。

@@opinion-end@@

@@opinion-begin@@

减去 $1$ 的好处正是在这里：当 $p=q$ 时，权重 $q/p-1=0$，每一次更新都为零，消除了这种波动。

@@opinion-end@@

@@opinion-begin@@

即使学生分布已经等于教师分布，不减去 $1$ 的单样本梯度仍可能非零。这是采样噪声：其期望为零，而不是教师还要求提高该 token 的概率。

@@opinion-end@@

如果把权重改成 $q_a/p_a-1$，它就直接反映两者的偏差：

- **$q_a>p_a$：** 权重为正，推动学生提高这个 token 的概率。
- **$q_a<p_a$：** 权重为负，推动学生降低这个 token 的概率。
- **$q_a=p_a$：** 权重为零，这个样本不产生更新。

@@opinion-begin@@

特别是当整个分布 $p=q$ 时，每个样本的梯度都为零，不再只是平均梯度为零。这里说的提高或降低，是该样本单独做足够小的一步梯度下降时的方向；实际训练还会合并其他样本的梯度。

@@opinion-end@@

@@opinion-begin@@

这也让它更方便与 reverse 权重 $\log(q_a/p_a)$ 比较：两者都在 $q_a/p_a=1$ 时为零，在比值大于 $1$ 时为正、小于 $1$ 时为负。

@@opinion-end@@

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

@@opinion-begin@@

这种做法叫作减去一个常数基线。**它改变单次样本的梯度，但不改变平均训练方向。** 它消除了 $p=q$ 时的采样梯度波动，不过并不保证在所有分布下都能降低方差。

@@opinion-end@@

## 6. 为什么一些 sampled-token 实现偏向 Reverse KL

### 6.1 对数缓和罕见样本的极端权重

假设某个 token 的学生概率只有 $p=0.001$，老师概率却有 $q=0.1$。学生平均约每一千次抽样才遇到它一次；一旦抽中，forward 的原始权重为 $100$，减去基线后仍有 $99$，而 reverse 权重只有 $\log100\approx4.61$。

@@opinion-begin@@

使用学生样本估计 forward KL 时，可能出现“多数时候没有抽到重要 token，偶尔抽到却带来很大梯度”的情况。对数权重缓和了 $q/p$ 直接增长带来的极端更新。

Sampled-token Forward KL 对“教师概率高、学生概率低”的 token 可能产生较大的更新，因此在相同训练设置下可能带来更剧烈的策略变化。

@@opinion-end@@

![Forward 与 Reverse 权重曲线](../assets/plots/opd-weight-comparison.svg)

*横轴为概率比值 $r=q/p$（对数刻度）；蓝线为 Forward 权重 $r-1$，橙线为 Reverse 权重 $\log r$。两条曲线在 $r=1$ 时均为零。*

### 6.2 两种目标对遗漏和过度生成的侧重点不同

从上表可见，forward 的 $q/p-1$ 在学生严重低估老师概率时可以很大；当学生严重高估时，它的负值则以 $-1$ 为下界。Reverse 的 $\log(q/p)$ 对概率比值的高估、低估都给出对数尺度的信号，特别是在老师概率极低时，可以给出很强的负反馈。

@@opinion-begin@@

因此，forward 更强调补足学生遗漏的老师行为，reverse 更强调避开学生过度生成、老师却不认可的行为。对于“学生先写出自己的推理，再由老师对生成过程提供反馈”的流程，后者是一种自然的选择动机。

@@opinion-end@@

@@opinion-begin@@

当学生模型无法完全拟合老师时，这也对应常说的 mode covering 与 mode seeking：forward 倾向覆盖老师的多种输出，reverse 往往更愿意集中于其中一部分高概率输出。这是受限模型下的常见倾向，具体取舍依赖任务、模型与训练过程。GKD 论文讨论并实验比较了不同散度，指出合适的选择与任务有关。

@@opinion-end@@

### 6.3 对数概率差方便接入 RL 流程

Reverse 权重可以直接写成

$$
\log\frac{q_a}{p_a}=\log q_a-\log p_a.
$$

它只需要老师和学生对实际生成 token 的对数概率。把这个量作为固定的 token 级奖励或 advantage，就能复用策略梯度形式的训练流程。

Thinking Machines 的 OPD 实现正是先计算学生与老师的对数概率差，再将其相反数作为逐 token 的 advantage，接入已有的 RL importance-sampling loss。这个实现展示了 reverse KL 在工程上的便利，但不能由此推出它对所有蒸馏任务都更好。

## 7. On-policy 不限定 KL 的方向，也不限定只算一个 token

@@opinion-begin@@

“上下文由谁生成”“每个上下文下比较哪一种散度”“计算全词表还是只计算抽中的 token”，是三个可以分别选择的问题。

@@opinion-end@@

GKD 就在学生生成的上下文上使用过 forward KL，也比较了 reverse KL 与广义 JSD。其论文中的 token 级分布损失按词表比较老师与学生，并在更新时固定采样得到的序列；不能把“学生生成训练序列”直接等同于本文的单 token 梯度估计。

@@opinion-begin@@

若在每个上下文下计算全词表 KL，所有 token 都参与计算，就不再有本文所讨论的“当前这个罕见 token 偶尔被抽到，才贡献巨大权重”的估计问题。完整词表的代价，以及上下文、序列采样的随机性仍需另行考虑。

@@opinion-end@@

@@opinion-begin@@

当模型能够精确拟合老师时，两种 KL 都在 $p=q$ 取得最小值 $0$。它们的区别主要体现在采样估计、优化过程，以及学生无法完整拟合老师时的取舍。


@@opinion-end@@
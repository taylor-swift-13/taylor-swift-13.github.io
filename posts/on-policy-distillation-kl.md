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

本文约定 forward KL 为 $D_{\mathrm{KL}}(q\|p)$，reverse KL 为 $D_{\mathrm{KL}}(p\|q)$。这里的 $p$ 始终表示学生，$q$ 始终表示老师；阅读不同资料时，需要先确认各自的符号约定。KL 的定义、非负性与参数顺序可参见[《交叉熵与 KL 散度》](cross-entropy-kl.html)。

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

这里把 $-\log p_i$ 称为这个 token 的 SFT loss。即使该 token 由学生抽出，给定它以后，负对数似然的计算形式仍与 SFT 相同。

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

## 4. 为什么要固定权重：对齐的是梯度

把两组公式放在一起：

| 方法 | 全词表 loss | 学生采样后的代理 loss |
| --- | --- | --- |
| Forward KL | $\sum_i q_i\log(q_i/p_i)$ | $\operatorname{sg}(q_a/p_a)(-\log p_a)$ |
| Reverse KL | $\sum_i p_i\log(p_i/q_i)$ | $\operatorname{sg}(\log(q_a/p_a))(-\log p_a)$ |

两种采样公式保证的等式分别是

$$
\mathbb E_{a\sim p}\!\left[\nabla\widehat L_{\mathrm F}(a)\right]
=\nabla L_{\mathrm F},
$$

$$
\mathbb E_{a\sim p}\!\left[\nabla\widehat L_{\mathrm R}(a)\right]
=\nabla L_{\mathrm R}.
$$

这里先对**抽到的固定 token 的代理 loss**求梯度，再对这个随机梯度取期望。若直接把代理 loss 的数值取平均，forward 版本的期望是交叉熵，reverse 版本的期望一般也不等于完整 reverse KL。两者都不需要在数值上重建原始 KL。

固定权重正是为了让自动求导得到上面推导的随机梯度。例如，令 $\ell=\log p_a$、$c=\log q_a$；如果不固定 reverse 权重，直接对 $(c-\ell)(-\ell)$ 求导，就会得到

$$
\nabla\big[(c-\ell)(-\ell)\big]
=(2\ell-c)\nabla\ell.
$$

而所需的梯度是 $(\ell-c)\nabla\ell$，两者多出 $\ell\nabla\ell$。因此，“老师固定”还不够：权重中包含的学生概率也必须在这个代理损失里停止求导。

同样，只对抽中的 $\log(p_a/q_a)$ 正常反传，得到的是 $\nabla\log p_a$；它在 $a\sim p$ 下的平均值为零，也不能代替完整 reverse KL 的梯度。

## 5. Forward 权重为什么还可以减去 1

对学生采样，常数权重对应的平均 SFT 梯度为零：

$$
\begin{aligned}
\mathbb E_{a\sim p}\!\left[\nabla(-\log p_a)\right]
&=-\sum_i p_i\nabla\log p_i\\
&=-\sum_i\nabla p_i=0.
\end{aligned}
$$

因此，forward 权重可以从 $q_a/p_a$ 改为 $q_a/p_a-1$，仍然得到同一个平均梯度：

$$
\widehat L_{\mathrm F,0}(a)
=\operatorname{sg}\!\left(\frac{q_a}{p_a}-1\right)
(-\log p_a).
$$

这相当于减去一个常数基线。基线改变单次随机梯度和方差，但不改变其期望；减去 $1$ 也不保证在所有情况下都能降低方差。一个直接的区别是：当 $p=q$ 时，原权重为 $1$，单个样本仍可能产生非零梯度；减去 $1$ 后，每个样本的权重都为零。

用这个版本与 reverse 比较，就能让“双方一致时权重为零”成为共同的参照点。$q/p>1$ 表示学生低估这个 token，$q/p<1$ 表示学生高估它：

| $q/p$ | Forward：$q/p-1$ | Reverse：$\log(q/p)$ |
| --- | ---: | ---: |
| $100$ | $99$ | $4.61$ |
| $1$ | $0$ | $0$ |
| $0.01$ | $-0.99$ | $-4.61$ |

这些权重都乘在 $-\log p_a$ 前，并在求导时固定。对这个样本单独做足够小的一步梯度下降，正权重沿提高 $\log p_a$ 的方向更新，负权重沿降低它的方向更新。实际训练还会合并其他样本的梯度，参数共享也会影响其他 token 的概率。

## 6. 为什么一些 sampled-token 实现偏向 Reverse KL

### 6.1 对数缓和罕见样本的极端权重

假设某个 token 的学生概率只有 $p=0.001$，老师概率却有 $q=0.1$。学生平均约每一千次抽样才遇到它一次；一旦抽中，forward 的原始权重为 $100$，减去基线后仍有 $99$，而 reverse 权重只有 $\log100\approx4.61$。

使用学生样本估计 forward KL 时，可能出现“多数时候没有抽到重要 token，偶尔抽到却带来很大梯度”的情况。对数权重缓和了 $q/p$ 直接增长带来的极端更新。

这个比较**不能证明 reverse 梯度估计的方差始终更小**。方差还依赖完整的概率分布、各 token 的梯度、基线与采样方式；当 $q/p$ 很小时，对数权重的绝对值反而可以很大。

### 6.2 两种目标对遗漏和过度生成的侧重点不同

从上表可见，forward 的 $q/p-1$ 在学生严重低估老师概率时可以很大；当学生严重高估时，它的负值则以 $-1$ 为下界。Reverse 的 $\log(q/p)$ 对概率比值的高估、低估都给出对数尺度的信号，特别是在老师概率极低时，可以给出很强的负反馈。

因此，forward 更强调补足学生遗漏的老师行为，reverse 更强调避开学生过度生成、老师却不认可的行为。对于“学生先写出自己的推理，再由老师对生成过程提供反馈”的流程，后者是一种自然的选择动机。

当学生模型无法完全拟合老师时，这也对应常说的 mode covering 与 mode seeking：forward 倾向覆盖老师的多种输出，reverse 往往更愿意集中于其中一部分高概率输出。这是受限模型下的常见倾向，具体取舍依赖任务、模型与训练过程。GKD 论文讨论并实验比较了不同散度，指出合适的选择与任务有关。[GKD 第 3.1、4 节](https://arxiv.org/html/2306.13649v3#S3.SS1)

### 6.3 对数概率差方便接入 RL 流程

Reverse 权重可以直接写成

$$
\log\frac{q_a}{p_a}=\log q_a-\log p_a.
$$

它只需要老师和学生对实际生成 token 的对数概率。把这个量作为固定的 token 级奖励或 advantage，就能复用策略梯度形式的训练流程。

Thinking Machines 的 OPD 实现正是先计算学生与老师的对数概率差，再将其相反数作为逐 token 的 advantage，接入已有的 RL importance-sampling loss。这个实现展示了 reverse KL 在工程上的便利，但不能由此推出它对所有蒸馏任务都更好。[Thinking Machines：实现与伪代码](https://thinkingmachines.ai/blog/on-policy-distillation/#implementation)

## 7. On-policy 不限定 KL 的方向，也不限定只算一个 token

“上下文由谁生成”“每个上下文下比较哪一种散度”“计算全词表还是只计算抽中的 token”，是三个可以分别选择的问题。

GKD 就在学生生成的上下文上使用过 forward KL，也比较了 reverse KL 与广义 JSD。其论文中的 token 级分布损失按词表比较老师与学生，并在更新时固定采样得到的序列；不能把“学生生成训练序列”直接等同于本文的单 token 梯度估计。[GKD 第 3.1 节与算法 1](https://arxiv.org/html/2306.13649v3#S3.SS1)

若在每个上下文下计算全词表 KL，所有 token 都参与计算，就不再有本文所讨论的“当前这个罕见 token 偶尔被抽到，才贡献巨大权重”的估计问题。完整词表的代价，以及上下文、序列采样的随机性仍需另行考虑。

当模型能够精确拟合老师时，两种 KL 都在 $p=q$ 取得最小值 $0$。它们的区别主要体现在采样估计、优化过程，以及学生无法完整拟合老师时的取舍。

## 8. 实现：只让最后的负对数概率参与反传

下面用 PyTorch 风格的代码对应前文公式。`student_logp` 和 `teacher_logp` 是**实际抽中 token** 的对数概率；学生一侧需要保留计算图，老师一侧固定。示例对有效 token 取平均，padding 等无效位置应在此前排除。

```python
# a 按当前学生分布采样；此处在同一参数位置计算梯度。
# student_logp = log p_a，保留学生的计算图。
# teacher_logp = log q_a，老师不参与训练。
teacher_logp = teacher_logp.detach()
log_ratio = teacher_logp - student_logp.detach()
sft_loss = -student_logp

forward_loss = (log_ratio.exp() * sft_loss).mean()
forward_with_baseline = ((log_ratio.exp() - 1) * sft_loss).mean()
reverse_loss = (log_ratio * sft_loss).mean()

# 按训练目标选其中一个 loss 反传。
```

这里的 `detach()` 对应 $\operatorname{sg}$；最后的 `student_logp` 保留梯度。`forward_loss` 与 `forward_with_baseline` 的平均梯度相同，单次样本的梯度和 loss 数值可以不同。

使用这些等式时，还要对应实际采样与更新设置：

- **采样分布必须匹配。** 若使用温度、top-k 或 top-p，实际抽样分布可能与公式中的 $p$ 不同。重要性修正的分母需要对应实际抽样分布；被截断为零的 token 无法靠这种抽样恢复其非零梯度贡献。
- **参数位置必须匹配。** 本文推导针对当前参数处的新鲜样本。旧样本复用、多轮更新或 PPO 裁剪，需要按各自的训练目标分析重要性比率与偏差；不能直接沿用这里的无偏结论。
- **上下文在推导中固定。** 本文证明的是给定上下文的 token 级 KL 梯度。若把学生生成前缀的分布也写成参数相关的完整序列目标，对它求导时还会涉及前缀采样分布的贡献；本文没有推导这一部分。

## 9. 参考资料

- [交叉熵与 KL 散度](cross-entropy-kl.html)：本站前文，介绍 KL 非负性、softmax 梯度与参数顺序。
- [Agarwal 等：On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes](https://arxiv.org/abs/2306.13649)：GKD 框架；第 3.1 节介绍学生生成序列、散度选择及固定采样序列的更新，第 4 节比较不同设置。
- [Thinking Machines：On-Policy Distillation](https://thinkingmachines.ai/blog/on-policy-distillation/)：reverse KL、逐 token 对数概率反馈及复用 RL 流程的实现说明。

本文的单 token 采样公式由第 2–5 节直接推导；对两种权重的数值比较是这些公式的结果。外部资料用于说明实际方法的选择与实现，资料核对日期为 2026 年 10 月 28 日。

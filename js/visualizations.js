(() => {
  const logFigure = document.querySelector('[data-viz="log-inequality"]');
  if (logFigure) {
    const svg = logFigure.querySelector('svg');
    const slider = logFigure.querySelector('#log-t-slider');
    const output = logFigure.querySelector('#log-values');
    const left = 48, right = 610, top = 30, bottom = 258;
    const x = t => left + (t - 0.1) / 2.9 * (right - left);
    const y = value => bottom - (value + 2.5) / 4.7 * (bottom - top);
    const curve = fn => Array.from({ length: 146 }, (_, i) => {
      const t = 0.1 + i * 0.02;
      return `${i ? 'L' : 'M'} ${x(t).toFixed(2)} ${y(fn(t)).toFixed(2)}`;
    }).join(' ');
    svg.querySelector('#log-curve').setAttribute('d', curve(Math.log));
    svg.querySelector('#linear-curve').setAttribute('d', curve(t => t - 1));
    svg.querySelector('#log-zero').setAttribute('d', `M ${left} ${y(0)} H ${right}`);
    svg.querySelector('#log-one').setAttribute('d', `M ${x(1)} ${top} V ${bottom}`);
    svg.querySelector('#one-label').setAttribute('x', x(1) - 4);
    const updateLog = () => {
      const t = Number(slider.value);
      const lower = Math.log(t), upper = t - 1;
      svg.querySelector('#log-gap').setAttribute('d', `M ${x(t)} ${y(lower)} V ${y(upper)}`);
      svg.querySelector('#log-dot').setAttribute('cx', x(t));
      svg.querySelector('#log-dot').setAttribute('cy', y(lower));
      svg.querySelector('#line-dot').setAttribute('cx', x(t));
      svg.querySelector('#line-dot').setAttribute('cy', y(upper));
      output.textContent = `t = ${t.toFixed(2)}；log t = ${lower.toFixed(3)}；t − 1 = ${upper.toFixed(3)}；差值 = ${Math.max(0, upper - lower).toFixed(3)}`;
    };
    slider.addEventListener('input', updateLog);
    updateLog();
  }

  const klFigure = document.querySelector('[data-viz="kl-direction"]');
  if (klFigure) {
    const buttons = [...klFigure.querySelectorAll('[data-direction]')];
    const weight = klFigure.querySelector('#kl-weight');
    const explanation = klFigure.querySelector('#kl-explanation');
    const chart = klFigure.querySelector('.abstract-distribution');
    const candidateBars = [...klFigure.querySelectorAll('.shape-candidate')];
    const shapes = {
      forward: [30, 60, 45, 36, 45, 60, 30],
      reverse: [18, 90, 55, 18, 6, 3, 2],
    };
    let direction = 'forward';
    const updateKl = () => {
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.direction === direction)));
      candidateBars.forEach((bar, i) => { bar.style.height = `${shapes[direction][i]}%`; });
      if (direction === 'forward') {
        weight.textContent = 'P(x)';
        chart.setAttribute('aria-label', '目标 P 有两个高概率区域；示意 Q 向两边铺开，覆盖两个区域');
        explanation.textContent = 'P 的高概率区域决定权重。漏掉其中一个区域会受到较大惩罚；受限的 Q 可能向两边铺开。';
      } else {
        weight.textContent = 'Q(x)';
        chart.setAttribute('aria-label', '目标 P 有两个高概率区域；示意 Q 主要集中在左侧一个区域');
        explanation.textContent = 'Q 放置概率质量的位置决定权重。若两峰之间的 P 很小，Q 可能避开中间，只集中在一个高概率区域。';
      }
    };
    buttons.forEach(button => button.addEventListener('click', () => {
      direction = button.dataset.direction;
      updateKl();
    }));
    updateKl();
  }
})();

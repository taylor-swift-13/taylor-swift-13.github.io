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

})();

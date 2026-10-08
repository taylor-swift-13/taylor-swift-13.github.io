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
    const target = [0.49, 0.02, 0.49];
    const candidates = {
      cover: [0.30, 0.40, 0.30],
      left: [0.95, 0.025, 0.025],
      right: [0.025, 0.025, 0.95],
    };
    const names = { cover: '覆盖两个峰', left: '偏向左峰', right: '偏向右峰' };
    const kl = (a, b) => a.reduce((sum, value, i) => sum + value * Math.log(value / b[i]), 0);
    const scores = Object.fromEntries(Object.entries(candidates).map(([key, q]) => [key, {
      forward: kl(target, q), reverse: kl(q, target),
    }]));
    const buttons = [...klFigure.querySelectorAll('[data-direction]')];
    const select = klFigure.querySelector('#kl-candidate');
    const result = klFigure.querySelector('#kl-result');
    const chart = klFigure.querySelector('.distribution-chart');
    let direction = 'forward';
    const updateKl = () => {
      const best = direction === 'forward' ? 'cover' : 'left';
      const key = select.value === 'best' ? best : select.value;
      const q = candidates[key];
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.direction === direction)));
      klFigure.querySelectorAll('.distribution-row').forEach((row, i) => {
        row.querySelector('.bar-candidate').style.width = `${q[i] * 100}%`;
        row.querySelector('.bar-values').textContent = `P ${target[i].toFixed(3)} · Q ${q[i].toFixed(3)}`;
      });
      chart.setAttribute('aria-label', `目标 P 与候选 Q：${names[key]}；三个位置的概率分别是 P ${target.join('、')}，Q ${q.join('、')}`);
      const current = scores[key][direction];
      const winner = direction === 'forward' ? '覆盖两个峰' : '偏向左峰与偏向右峰并列';
      result.textContent = `当前候选：${names[key]}；${direction === 'forward' ? 'D(P‖Q)' : 'D(Q‖P)'} = ${current.toFixed(3)} nat。该方向的最小值由${winner}取得。`;
      klFigure.querySelectorAll('.kl-table tbody tr').forEach(row => {
        const item = scores[row.dataset.candidate];
        row.cells[1].textContent = item.forward.toFixed(3);
        row.cells[2].textContent = item.reverse.toFixed(3);
        row.classList.toggle('is-selected', row.dataset.candidate === key);
        row.cells[1].classList.toggle('is-minimum', direction === 'forward' && row.dataset.candidate === 'cover');
        row.cells[2].classList.toggle('is-minimum', direction === 'reverse' && row.dataset.candidate !== 'cover');
      });
    };
    buttons.forEach(button => button.addEventListener('click', () => {
      direction = button.dataset.direction;
      updateKl();
    }));
    select.addEventListener('change', updateKl);
    updateKl();
  }
})();

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: false })
  .use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: { throwOnError: true, trust: false, strict: 'error' },
  });

const articles = [
  {
    slug: 'on-policy-distillation-kl',
    title: '从全词表到采样梯度：理解 OPD 中的 Forward KL 与 Reverse KL',
    description: '推导学生采样下的两种 KL 梯度，解释固定权重、重要性采样与 reverse KL 的选择动机。',
    category: '模型蒸馏',
  },
  {
    slug: 'anthropic-formal-verification',
    title: 'Anthropic 的程序验证：功能性检查编码到 fuzz crash，不写 spec 只写证明',
    description: '从二进制操作语义与 fuzz 规约出发，讨论找 bug、功能正确性与大模型时代的信任取舍。',
    category: '形式化验证',
    sourceAware: true,
  },
  {
    slug: 'qcip-dll-storea',
    title: '内嵌双链表为什么要设计 storeA',
    description: '从地址级规范的边界出发，解释 storeA 如何连接业务对象与通用链表证明。',
    category: '形式化验证',
  },
  {
    slug: 'cross-entropy-kl',
    title: '交叉熵与 KL 散度',
    description: '交叉熵的最小性、softmax 梯度与 KL 散度的参数顺序。',
    category: '信息论',
  },
  {
    slug: 'vero-coco-prover',
    title: 'Compiler in the Loop 任务的消亡：方法增益会被模型迭代吞噬吗？从 Vero 到 CoCo-Prover 再到 Prove2Me',
    description: '从仓库级证明、成本调度到多代理协作，分析模型能力与证明基础设施各自解决的问题。',
    category: '形式化验证',
  },
];

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function articleHtml(article) {
  const source = readFileSync(path.join(root, 'posts', `${article.slug}.md`), 'utf8');
  let body = markdown.render(source);
  let opinionDepth = 0;
  body = body.replace(/<p>@@opinion-(begin|end)@@<\/p>/g, (_, boundary) => {
    if (boundary === 'begin') {
      if (opinionDepth) throw new Error(`Nested opinion block in ${article.slug}.md`);
      opinionDepth = 1;
      return '<div class="author-opinion">';
    }
    if (!opinionDepth) throw new Error(`Unexpected opinion end in ${article.slug}.md`);
    opinionDepth = 0;
    return '</div>';
  });
  if (opinionDepth || body.includes('@@opinion-')) {
    throw new Error(`Unclosed or invalid opinion marker in ${article.slug}.md`);
  }
  let quoteDepth = 0;
  body = body.replace(/<p>@@wechat-quote-(begin|end)@@<\/p>/g, (_, boundary) => {
    if (boundary === 'begin') {
      if (quoteDepth) throw new Error('Nested WeChat quotation');
      quoteDepth = 1;
      return '<div class="external-commentary">';
    }
    if (!quoteDepth) throw new Error('Unexpected WeChat quotation end');
    quoteDepth = 0;
    return '</div>';
  });
  if (quoteDepth || body.includes('@@wechat-quote-')) throw new Error('Unclosed WeChat quotation');
  for (const [marker, fragment] of [
    ['log', 'log-inequality.html'],
  ]) {
    const placeholder = `<p>@@viz-${marker}@@</p>`;
    if (body.includes(placeholder)) {
      body = body.replace(placeholder, readFileSync(path.join(root, 'partials', fragment), 'utf8'));
    }
  }
  if (body.includes('@@viz-')) throw new Error(`Unresolved visualization in ${article.slug}.md`);
  body = body.replace(/<p>@@anthropic-figure-([1-35])@@<\/p>/g, (_, number) => {
    if (article.slug !== 'anthropic-formal-verification') {
      throw new Error(`Unexpected Anthropic figure in ${article.slug}.md`);
    }
    const base = `../assets/papers/anthropic-verification/figure-${number}`;
    if (number === '5') {
      return `<figure class="source-figure" aria-label="原文图 5，共享证明与计算成本">
<a href="${base}-static.png"><img src="${base}-static.png" alt="原文图 5 完整静态图：证明复用弧线及各任务的 token 消耗"></a>
<details class="source-animation"><summary>播放原始 GIF 动画</summary><a href="${base}.gif"><img src="${base}.gif" alt="原文图 5 动画：按顺序展示证明复用和成本比较" loading="lazy"></a></details>
</figure>`;
    }
    return `<figure class="source-figure" aria-label="原文图 ${number}">
<a href="${base}-poster.png"><img src="${base}-poster.png" alt="原文图 ${number} 的完整静态画面，点击放大"></a>
<details class="source-animation"><summary>播放原始视频动画</summary>
<video controls muted loop playsinline preload="metadata" poster="${base}-poster.png" aria-label="原文图 ${number}，播放查看完整动画">
<source src="${base}.mp4" type="video/mp4">
<a href="${base}.mp4">打开原文图 ${number} 动画</a>
</video>
</details>
<figcaption><a href="${base}-poster.png">放大静态图 ↗</a> · <a href="${base}.mp4">单独打开动画 ↗</a></figcaption>
</figure>`;
  });
  if (body.includes('@@anthropic-figure-')) throw new Error(`Unresolved source figure in ${article.slug}.md`);
  body = body.replace(/<p>@@lps-source-(Decode|Run)@@<\/p>/g, (_, name) => {
    if (article.slug !== 'anthropic-formal-verification') throw new Error('Unexpected LPS source');
    const folder = 'assets/papers/anthropic-verification/code/lps';
    const manifest = JSON.parse(readFileSync(path.join(root, folder, 'sources.json'), 'utf8'));
    const entry = manifest.files.find(file => file.name === `${name}.v`);
    const bytes = readFileSync(path.join(root, folder, entry.name));
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
      throw new Error(`LPS source digest mismatch: ${entry.name}`);
    }
    const local = `../${folder}/${entry.name}`;
    if (!Array.isArray(entry.translation) || !entry.translation.length) {
      throw new Error(`Missing LPS source translation: ${entry.name}`);
    }
    const translation = entry.translation.map(({ label, text }) =>
      `<li><strong>${escapeHtml(label)}：</strong>${escapeHtml(text)}</li>`).join('\n');
    return `<details class="source-code-full" data-source-file="${entry.name}">
<summary>展开 ${entry.name} 完整源码（${entry.lines.toLocaleString('en-US')} 行）</summary>
<p class="source-code-meta"><a href="${entry.source}">官方仓库 · ${manifest.revision.slice(0, 8)}</a> · <a href="${local}" download>下载 ${entry.name}</a> · <a href="../${folder}/LICENSE">MIT 许可</a></p>
<pre tabindex="0" aria-label="${entry.name} 完整源码"><code class="language-coq">${escapeHtml(bytes.toString('utf8'))}</code></pre>
<div class="author-opinion code-translation">
<p><strong>${entry.name}</strong></p>
<ul>${translation}</ul>
</div>
</details>`;
  });
  if (body.includes('@@lps-source-')) throw new Error('Unresolved LPS source');
  if (article.slug === 'anthropic-formal-verification') {
    body = '<p class="reading-key">黑色为原文、附录与公开源码中的内容；<span class="commentary-key">橙色为补充讨论、例子与评价</span>；<span class="external-commentary">蓝色为引用的<a href="https://mp.weixin.qq.com/s/-ITZmEqXeOo4g7TVBvzluA">《解析 Anthropic 的机器码形式化验证：技术路线、潜力与局限》</a>内容</span>。</p>\n' + body;
  }
  const title = escapeHtml(article.title);
  const description = escapeHtml(article.description);
  const category = escapeHtml(article.category);
  const sourceAware = article.sourceAware || article.slug === 'vero-coco-prover';
  const styleVersion = sourceAware
    ? `?v=${createHash('sha256').update(readFileSync(path.join(root, 'css/style.css'))).digest('hex').slice(0, 12)}`
    : '';
  const articleStyle = article.slug === 'anthropic-formal-verification'
    ? `\n  <link rel="stylesheet" href="../css/anthropic-verification.css?v=${createHash('sha256').update(readFileSync(path.join(root, 'css/anthropic-verification.css'))).digest('hex').slice(0, 12)}">`
    : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#faf9f6">
  <meta name="description" content="${description}">
  <title>${title} — Notes</title>
  <link rel="stylesheet" href="../css/style.css${styleVersion}">${articleStyle}
  <link rel="stylesheet" href="../assets/katex/katex.min.css">
  <script src="../js/blog.js" defer></script>
  <script src="../js/visualizations.js" defer></script>
</head>
<body class="article-page${sourceAware ? ' source-aware' : ''}${article.slug === 'anthropic-formal-verification' ? ' source-figures' : ''}" id="top">
  <header class="site-header">
    <div class="shell header-inner">
      <a class="brand" href="../index.html" aria-label="Notes 首页">Notes</a>
      <nav aria-label="主导航">
        <a href="../index.html#writing">文章</a>
        <a href="https://github.com/taylor-swift-13" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
      </nav>
    </div>
  </header>
  <main class="article-shell article-main">
    <a class="back-link" href="../index.html#writing">← 返回文章列表</a>
    <header class="article-header">
      <p class="eyebrow">${category}</p>
      <h1>${title}</h1>
      <p class="article-deck">${description}</p>
    </header>
    <article class="prose">
${body}    </article>
    <div class="article-end"><a class="back-link" href="../index.html#writing">← 返回文章列表</a></div>
  </main>
  <footer class="site-footer"><div class="shell footer-inner"><span>© <span id="year">2026</span> Notes</span><a href="#top">返回顶部 ↑</a></div></footer>
</body>
</html>
`;
}

for (const article of articles) {
  const output = path.join(root, 'posts', `${article.slug}.html`);
  const html = articleHtml(article);
  if (check) {
    if (!existsSync(output) || readFileSync(output, 'utf8').replaceAll('\r\n', '\n') !== html.replaceAll('\r\n', '\n')) {
      throw new Error(`Generated page is stale: posts/${article.slug}.html`);
    }
  } else {
    writeFileSync(output, html);
  }
}

const katexDist = path.join(root, 'node_modules', 'katex', 'dist');
const assets = path.join(root, 'assets', 'katex');
if (check) {
  for (const relative of ['katex.min.css', 'fonts/KaTeX_Main-Regular.woff2']) {
    if (!existsSync(path.join(assets, relative))) {
      throw new Error(`Missing KaTeX asset: ${relative}`);
    }
  }
} else {
  mkdirSync(assets, { recursive: true });
  cpSync(path.join(katexDist, 'katex.min.css'), path.join(assets, 'katex.min.css'));
  cpSync(path.join(katexDist, 'fonts'), path.join(assets, 'fonts'), { recursive: true });
  cpSync(path.join(root, 'node_modules', 'katex', 'LICENSE'), path.join(assets, 'LICENSE'));
}

console.log(check ? 'Generated pages and KaTeX assets are current.' : 'Built articles and copied KaTeX assets.');

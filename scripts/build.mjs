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
  for (const [marker, fragment] of [
    ['log', 'log-inequality.html'],
  ]) {
    const placeholder = `<p>@@viz-${marker}@@</p>`;
    if (body.includes(placeholder)) {
      body = body.replace(placeholder, readFileSync(path.join(root, 'partials', fragment), 'utf8'));
    }
  }
  if (body.includes('@@viz-')) throw new Error(`Unresolved visualization in ${article.slug}.md`);
  const title = escapeHtml(article.title);
  const description = escapeHtml(article.description);
  const category = escapeHtml(article.category);
  const styleVersion = article.slug === 'vero-coco-prover'
    ? `?v=${createHash('sha256').update(readFileSync(path.join(root, 'css/style.css'))).digest('hex').slice(0, 12)}`
    : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#faf9f6">
  <meta name="description" content="${description}">
  <title>${title} — Notes</title>
  <link rel="stylesheet" href="../css/style.css${styleVersion}">
  <link rel="stylesheet" href="../assets/katex/katex.min.css">
  <script src="../js/blog.js" defer></script>
  <script src="../js/visualizations.js" defer></script>
</head>
<body class="article-page${article.slug === 'vero-coco-prover' ? ' source-aware' : ''}" id="top">
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

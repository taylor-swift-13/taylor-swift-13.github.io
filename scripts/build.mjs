import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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
    slug: 'cross-entropy-kl',
    title: '交叉熵与 KL 散度',
    description: '有限离散分布下的定义、支撑集、零概率约定与数值算例。',
    category: '信息论',
  },
];

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function articleHtml(article) {
  const source = readFileSync(path.join(root, 'posts', `${article.slug}.md`), 'utf8');
  const body = markdown.render(source);
  const title = escapeHtml(article.title);
  const description = escapeHtml(article.description);
  const category = escapeHtml(article.category);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#faf9f6">
  <meta name="description" content="${description}">
  <title>${title} — Notes</title>
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="../assets/katex/katex.min.css">
  <script src="../js/blog.js" defer></script>
</head>
<body class="article-page" id="top">
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
    if (!existsSync(output) || readFileSync(output, 'utf8') !== html) {
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

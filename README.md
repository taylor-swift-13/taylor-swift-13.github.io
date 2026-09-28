# Y / Notes 技术博客

静态个人博客，面向 GitHub Pages。网站仅包含公开文章；论文阅读器和 Codex 不属于这个仓库，也不在博客上运行。

## 本地预览

在仓库根目录运行：

```bash
python3 -m http.server 8000
```

打开 `http://localhost:8000`。站点没有构建步骤或服务端依赖。

## 发布

GitHub 仓库 **Settings → Pages** 中选择 **Deploy from a branch**，分支选 `main`（或实际默认分支），目录选 `/ (root)`。提交并推送后，GitHub Pages 会发布根目录的 `index.html`。

## 添加文章

1. 在 `posts/` 中添加独立的 HTML 文件，可复制 `posts/craft.html` 作为版式起点。
2. 在 `index.html` 的文章区添加入口和摘要。
3. 给新页面写独立的标题和描述，检查手机宽度与所有链接。

站点样式集中在 `css/style.css`。第一篇是交叉熵与 KL 散度的占位草稿；第二篇是基于 [CRAFT](https://github.com/taylor-swift-13/CRAFT) 项目资料写成的笔记。

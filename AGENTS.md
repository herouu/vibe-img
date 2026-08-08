# vibe-img 开发指南

## 项目概述
Cloudflare Pages 上的确定性像素头像生成器。相同输入 → 相同 SVG 输出，无状态，无数据库。

## 开发命令
```sh
npm run dev         # 本地 Pages 开发服务器 (http://localhost:8788)
npm run typecheck   # TypeScript 类型检查 (functions/tsconfig.json)
npm run deploy      # 部署到 Cloudflare Pages
```

## 项目结构
```
public/           # 静态前端 (HTML, CSS, JS) - 无构建步骤
functions/
  api/
    avatar.ts     # Pages Function HTTP 处理器
    _lib/
      generator.ts  # 纯 SVG 生成器 (无 I/O，无依赖)
```

## 关键约定
- `functions/api/_lib/` 以下划线开头：Cloudflare Pages bundler 将其视为模块导入目标，而非路由
- TypeScript 配置在 `functions/tsconfig.json`，类型检查仅针对 `functions/` 目录
- 前端是 vanilla JS，无框架，无构建步骤
- 生成器是纯函数：相同种子 + 相同参数 = 相同字节输出

## 添加新头像风格
1. 在 `functions/api/_lib/generator.ts` 中添加构建函数（纯函数）
2. 扩展 `Style` 联合类型和 `GRID` 映射
3. 在 `generateSvg` 中添加 case
4. 在 `functions/api/avatar.ts` 和 `public/app.js` 的 `STYLES` 数组中同步新值
5. 在 `public/index.html` 中添加 `<label>`

## 注意事项
- 无测试、CI 或代码格式化配置
- 无 lint 或 prettier 配置
- 仅 TypeScript 类型检查，无构建步骤
- 前端直接引用 `/api/avatar` 端点
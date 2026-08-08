# vibe-img

确定性像素头像生成器，部署在 Cloudflare Pages 上。

相同的 seed + style + size → 字节级一致的 SVG 永久输出。无账号、无存储、无 AI、无追踪。整个流水线就是一个 Pages Function，把字符串哈希成一张 SVG。

## 快速开始

```sh
npm install
npm run dev          # wrangler pages dev ./public  →  http://localhost:8788
```

打开页面后，输入 seed（或点 **Random**），选风格，复制 / 下载 / 导出 PNG。

## 部署

```sh
npx wrangler login
npm run deploy       # wrangler pages deploy ./public
```

第一次部署会创建 `vibe-img` Pages 项目，之后的部署复用。`wrangler.toml` 里的项目名是占位符，可以在那里改或在 Cloudflare 后台用 `wrangler pages project create` 改。

## API

```
GET /api/avatar
```

| 参数      | 类型     | 范围 / 取值                                                       | 默认值          |
| --------- | -------- | ----------------------------------------------------------------- | --------------- |
| `seed`    | string   | 最长 64 字符                                                     | `anonymous`     |
| `style`   | enum     | `identicon` \| `pixel` \| `abstract` \| `anime` \| `xiuxian` \| `pixel-detail` | `pixel-detail` |
| `size`    | int      | 16..512                                                          | 128             |
| `bg`      | hex      | `#rgb` 或 `#rrggbb`                                              | 由 seed 推导     |
| `palette` | hex list | 逗号分隔的 `#rrggbb`                                             | 由 seed 推导     |

响应 `image/svg+xml`，HTTP 头 `Cache-Control: public, max-age=31536000, immutable`。

示例：

```
/api/avatar?seed=alice&style=pixel&size=256
```

可以直接嵌进 `<img src>` 或 CSS `url()`。

## 风格一览

### `identicon` — 5×5 对称色块

GitHub 风格的 identicon，hash 决定每个格子是否填充，垂直镜像生成对称图案。两种颜色（背景 + 主色）。

### `pixel` — 8×8 8-bit 脸

hash 选 4 种脸型模板（不同刘海 / 表情），颜色由 seed 推导。

### `abstract` — 8×8 多色抽象

随机分布的彩色像素，hash 决定每个格子是否填充、填哪种颜色（前景 + 两个 accent）。

### `anime` — 12×12 卡通肖像

**30 个变体**覆盖：
- 发型（0-9）：标准刘海、刺猬、侧马尾、双马尾、短波波、莫西干、道髻、长直发、波浪、偏分刘海
- 眼睛（10-19）：心形、星形、X 形、闭眼、螺旋、哭泣、墨镜、眨眼、独眼、机器人面罩
- 嘴（20-23）：张嘴、獠牙、伸舌、猫嘴
- 配饰（24-29）：猫耳、兔耳、恶魔角、天使光环、王冠、巫师帽

每种风格用 slot 0-6 编码，hash `% 30` 选变体。

### `xiuxian` (修仙) — 12×12 中国风修士

**30 个变体**覆盖：
- 头冠（0-9, 19, 27）：标准凤冠、宽冠、镂空冠、低道髻、高凤冠、无冠道髻、横剑、宝塔冠、三层宝塔、龙角冠、宝石冠
- 法器（6, 10-15, 25, 26）：横剑、竖剑、双剑、无武器、酒葫芦、念珠、折扇、阴阳符、法杖、水晶球
- 道具（16-18, 20-24, 28）：莲花座、祥云、凤凰翼、长发垂背、罗盘、丹炉、画卷、旌旗、葫芦包
- 异形（29）：道士帽（无冠）

slot 0-14 编码：0 空、1 发、2 肤、3 瞳色、4 眼白、5 嘴、6 红晕、7 袍、8 冠金、9 剑光蓝、10 长须灰、11 红物、12 棕物、13 金饰、14 深褐。

长老（slot 10 长须）也可叠加到其它变体上。

### `pixel-detail` — 64×64 多层细节（默认）

像素艺术盆栽。分 3 个独立维度派生：

- **植物类型**（10 种）：雏菊、仙人掌、多肉、蘑菇、树、盆景、郁金香、芦荟、竹子、向日葵
- **树子型**（4 种，仅树）：圆冠、松树、棕榈、垂柳
- **盆形**（4 种）：经典梯形、高圆盆、浅碗、方盆

`hash % 10` 选植物，`hash % 4` 选盆形，独立维度互不干扰。`palette.background` 画底色，每层植物按子函数绘制到 64×64 像素画布上。

## 目录结构

```
.
├── public/                 # 静态资源，根路径直接服务
│   ├── index.html          # 主页面 UI
│   ├── style.css
│   └── app.js              # 纯 DOM 逻辑，无构建
├── functions/
│   └── api/
│       ├── avatar.ts       # Pages Function HTTP handler
│       └── _lib/
│           └── generator.ts # 纯 SVG 生成器（无 I/O、无依赖）
├── scripts/
│   ├── smoke.ts            # 烟囱测试：每种风格跑几个 seed
│   └── gen-samples.ts      # 调试样例脚本
├── wrangler.toml
├── package.json
├── README.md
└── AGENTS.md               # 项目 agent 协作约定
```

`functions/api/_lib/` 故意以下划线开头，让 Cloudflare Pages bundler 把它当作模块导入目标，而不是路由。

## 架构

```
浏览器  ─►  /index.html
       │     └─► /style.css, /app.js
       │
       └────►  /api/avatar?seed=...   ──►  avatar.ts
                                         └─►  _lib/generator.ts
                                               └─►  fnv1a(seed)
                                                     └─►  SVG 字节
```

- **无状态**。无数据库、无 KV、无 R2。函数是纯变换。
- **Edge 原生**。跑在每个 Cloudflare POP 上。冷启动微秒级——生成器是一个零 I/O 零依赖的小文件。
- **永久可缓存**。相同输入产出相同字节，所以响应带 `immutable`，CDN 吸收重复流量。

## 开发

```sh
npm run dev         # 本地 Pages dev server，带热重载
npm run typecheck   # tsc --noEmit 对 functions/tsconfig.json
```

`wrangler pages dev` 把 Functions 暴露在 `/api/*` 下，跟生产一致。无独立 API 进程要跑。

### 加新风格 / 变体

**加新风格**（如 `barcode`）：

1. `functions/api/_lib/generator.ts` 加 `buildBarcode(hash, palette): string`（纯函数）
2. `Style` union 加 `"barcode"`，`GRID` 映射加 `{ cols: N, rows: N }`
3. `generateSvg` switch 加 case
4. `functions/api/avatar.ts` 和 `public/app.js` 的 `STYLES` 数组同步加新值
5. `public/index.html` 加一个 `<label class="style-option">`

**加已有风格的变体**（如给 anime 加 31 号变体）：

1. `functions/api/_lib/generator.ts` 找到对应数组（`ANIME_VARIANTS` / `XIUXIAN_VARIANTS` / 各 `drawPlant*` 函数）
2. 在数组末尾追加新 variant（12×12 网格或 draw 函数）
3. slot 值必须在已有 slot 范围内；如需新颜色，先扩 `XiuxianVariant` 类型 + `fills` 数组

> 前端无需改动——变体由 `hash % length` 自动选取，URL 也不暴露变体 id。

### 为什么不用框架

前端是单页 + 几个控件，引入框架意味着构建步骤、依赖膨胀、cold start 恶化——而这其实一个 `app.js` 就够了。如果 UI 超出这个体量，再主动引入构建步骤——不要提前塞。

## 许可

MIT。

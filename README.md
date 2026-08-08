# vibe-img

A deterministic pixel avatar generator that runs on Cloudflare Pages.

Same seed, same style, same size → same SVG, byte for byte, forever. No
accounts, no storage, no AI, no tracking. The entire pipeline is one Pages
Function that hashes a string into a small SVG.

## Quick start

```sh
npm install
npm run dev          # wrangler pages dev ./public  →  http://localhost:8788
```

Open the URL, type a seed (or click **Random**), pick a style, copy or
download the result.

## Deploy

```sh
npx wrangler login
npm run deploy       # wrangler pages deploy ./public
```

The first deploy provisions a new `vibe-img` Pages project. Subsequent
deploys reuse it. The project name in `wrangler.toml` is a starting point —
rename it there or via `wrangler pages project create`.

## API

```
GET /api/avatar
```

| Param    | Type     | Range / values                       | Default      |
| -------- | -------- | ------------------------------------ | ------------ |
| `seed`   | string   | up to 64 chars                       | `anonymous`  |
| `style`  | enum     | `identicon` \| `pixel` \| `abstract` \| `anime` \| `xiuxian` \| `pixel-detail` | `identicon`  |
| `size`   | int      | 16..512                              | 128          |
| `bg`     | hex      | `#rgb` or `#rrggbb`                  | derived      |
| `palette`| hex list | comma-separated `#rrggbb`            | derived      |

Response: `image/svg+xml`, `Cache-Control: public, max-age=31536000,
immutable`.

Example:

```
/api/avatar?seed=alice&style=pixel&size=256
```

The endpoint is safe to embed directly in `<img src>` or as a CSS `url()`.

## Project layout

```
.
├── public/                 # static assets served at the site root
│   ├── index.html          # main UI
│   ├── style.css
│   └── app.js              # vanilla DOM, no build step
├── functions/
│   └── api/
│       ├── avatar.ts       # Pages Function: HTTP handler
│       └── _lib/
│           └── generator.ts # pure SVG generator (no I/O, no deps)
├── wrangler.toml
├── package.json
└── README.md
```

`functions/api/_lib/` is intentionally prefixed with `_` so Cloudflare's
Pages bundler treats it as a module import target, not a route.

## Architecture

```
browser  ─►  /index.html
        │     └─► /style.css, /app.js
        │
        └────►  /api/avatar?seed=...   ──►  avatar.ts
                                          └─►  _lib/generator.ts
                                                └─►  fnv1a(seed)
                                                      └─►  SVG bytes
```

- **Stateless.** No DB, no KV, no R2. The function is a pure transform.
- **Edge-native.** Runs on every Cloudflare POP. Cold start is microseconds
  because the generator is a single small file with no I/O.
- **Cacheable forever.** Identical inputs produce identical bytes, so the
  response carries `immutable` and the CDN absorbs repeat traffic.

## Development

```sh
npm run dev         # local Pages dev server with live reload
npm run typecheck   # tsc --noEmit against functions/tsconfig.json
```

`wrangler pages dev` exposes the Functions under `/api/*` exactly like
production. There is no separate API server to run.

### Adding a new avatar style

1. Open `functions/api/_lib/generator.ts`.
2. Add a builder function (pure: `(hash, palette) => svgInner`).
3. Extend the `Style` union and the `GRID` map.
4. Add a case in `generateSvg`.
5. Mirror the new value in `STYLES` arrays in both
   `functions/api/avatar.ts` and `public/app.js`, then add a `<label>` in
   `public/index.html`.

### Why no frameworks

The frontend is a single page with a few controls. Adding a framework would
mean a build step, dependency churn, and a worse cold-start story for
something that fits in a single `app.js`. If the UI grows beyond that,
introduce a build step deliberately — don't reach for it preemptively.

## License

MIT.

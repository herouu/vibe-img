/**
 * GET /api/avatar
 *
 * Query params:
 *   seed   - string, used to derive the avatar (default: "anonymous")
 *   style  - "identicon" | "pixel" | "abstract" (default: "identicon")
 *   size   - integer 16..512, total width/height in px (default: 128)
 *
 * Response: image/svg+xml. Identical inputs return identical bytes, so the
 * handler returns Cache-Control: immutable and lets the CDN absorb traffic.
 */

import { generateSvg, type Style } from "./_lib/generator";

interface Env {}

const STYLES: readonly Style[] = [
  "identicon",
  "pixel",
  "abstract",
  "anime",
  "xiuxian",
  "pixel-detail",
];

function isStyle(v: string): v is Style {
  return (STYLES as readonly string[]).includes(v);
}

function isHexColor(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const seedRaw = url.searchParams.get("seed");
  const styleRaw = url.searchParams.get("style") ?? "identicon";
  const sizeRaw = url.searchParams.get("size");
  const bgRaw = url.searchParams.get("bg");
  const paletteRaw = url.searchParams.get("palette");

  const seed = (seedRaw ?? "anonymous").slice(0, 64);
  if (!isStyle(styleRaw)) {
    return new Response(
      `Invalid style. Expected one of: ${STYLES.join(", ")}.`,
      { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  let size = 128;
  if (sizeRaw !== null) {
    const parsed = Number.parseInt(sizeRaw, 10);
    if (!Number.isFinite(parsed)) {
      return new Response("Invalid size: must be an integer.", {
        status: 400,
      });
    }
    if (parsed < 16 || parsed > 512) {
      return new Response("Invalid size: must be between 16 and 512.", {
        status: 400,
      });
    }
    size = parsed;
  }

  let background: string | undefined;
  if (bgRaw !== null) {
    if (!isHexColor(bgRaw)) {
      return new Response("Invalid bg: expected #rgb or #rrggbb.", {
        status: 400,
      });
    }
    background = bgRaw;
  }

  let palette: string[] | undefined;
  if (paletteRaw !== null) {
    const parts = paletteRaw.split(",").map((p) => p.trim());
    if (parts.length === 0 || !parts.every(isHexColor)) {
      return new Response(
        "Invalid palette: comma-separated hex colors, e.g. palette=%23fff,%2300f",
        { status: 400 },
      );
    }
    palette = parts;
  }

  const svg = generateSvg({ seed, style: styleRaw, size, background, palette });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
};

/**
 * HEAD shares the same validation as GET so that cache validators, image
 * preloaders (`<link rel="preload" as="image">`), and tooling that issues
 * HEAD before GET see consistent headers.
 */
export const onRequestHead: PagesFunction<Env> = async (context) => {
  const getResponse = await onRequestGet(context);
  // Strip the body — HEAD must not return one.
  return new Response(null, { status: getResponse.status, headers: getResponse.headers });
};

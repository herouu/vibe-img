// Vibe-img frontend. Pure DOM, no framework. Reads controls, renders the
// preview by pointing an <img> at /api/avatar (the Pages Function). Also
// mirrors state into the URL hash so a generated avatar is shareable.

const STYLES = ["identicon", "pixel", "abstract", "anime", "xiuxian", "pixel-detail"];

const seedInput = /** @type {HTMLInputElement} */ (document.getElementById("seed"));
const randomBtn = /** @type {HTMLButtonElement} */ (document.getElementById("random"));
const styleRadios = document.querySelectorAll('input[name="style"]');
const sizeInput = /** @type {HTMLInputElement} */ (document.getElementById("size"));
const sizeValue = document.getElementById("size-value");
const sizePresets = document.querySelectorAll(".chip");
const preview = /** @type {HTMLImageElement} */ (document.getElementById("preview"));
const apiUrl = /** @type {HTMLParagraphElement} */ (document.getElementById("api-url"));
const copyBtn = /** @type {HTMLButtonElement} */ (document.getElementById("copy"));
const downloadLink = /** @type {HTMLAnchorElement} */ (document.getElementById("download"));
const downloadPngBtn = /** @type {HTMLButtonElement} */ (
  document.getElementById("download-png")
);

const state = {
  seed: "",
  style: "pixel-detail",
  size: 128,
};

function randomSeed() {
  // 8-char base36. Plenty of variety, easy to type.
  return Math.random().toString(36).slice(2, 10);
}

function currentStyle() {
  for (const r of styleRadios) {
    if (/** @type {HTMLInputElement} */ (r).checked) {
      return /** @type {HTMLInputElement} */ (r).value;
    }
  }
  return "pixel-detail";
}

function buildApiUrl({ seed, style, size }) {
  const params = new URLSearchParams({ seed, style, size: String(size) });
  return `/api/avatar?${params.toString()}`;
}

function render() {
  const url = buildApiUrl(state);
  // Cache-bust only when the URL changes; otherwise let the browser use the
  // cached SVG to keep the preview snappy.
  if (preview.getAttribute("src") !== url) {
    preview.src = url;
  }
  apiUrl.textContent = url;
  downloadLink.href = url;
  downloadLink.setAttribute(
    "download",
    `avatar-${state.style}-${state.seed || "anonymous"}.svg`,
  );
  sizeValue.textContent = String(state.size);
  // Update preset chip pressed state
  sizePresets.forEach((chip) => {
    const v = Number(chip.getAttribute("data-size"));
    chip.setAttribute("aria-pressed", String(v === state.size));
  });
}

function syncFromInputs() {
  state.seed = seedInput.value;
  state.style = currentStyle();
  state.size = Number(sizeInput.value);
  render();
}

let debounceHandle = 0;
function scheduleRender() {
  window.clearTimeout(debounceHandle);
  debounceHandle = window.setTimeout(() => {
    syncFromInputs();
    writeHash();
  }, 80);
}

function readHash() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const seed = params.get("seed");
  const style = params.get("style");
  const size = params.get("size");
  if (seed === null) return null;
  if (style && !STYLES.includes(style)) return null;
  const sizeNum = size !== null ? Number.parseInt(size, 10) : NaN;
  if (size !== null && (!Number.isFinite(sizeNum) || sizeNum < 16 || sizeNum > 512)) {
    return null;
  }
  return {
    seed: seed.slice(0, 64),
    style: style ?? "pixel-detail",
    size: Number.isFinite(sizeNum) ? sizeNum : 128,
  };
}

function writeHash() {
  const params = new URLSearchParams({
    seed: state.seed,
    style: state.style,
    size: String(state.size),
  });
  const newHash = `#${params.toString()}`;
  if (window.location.hash !== newHash) {
    // replaceState avoids polluting browser history on every keystroke.
    window.history.replaceState(null, "", newHash);
  }
}

function applyState(s) {
  state.seed = s.seed;
  state.style = s.style;
  state.size = s.size;
  seedInput.value = s.seed;
  sizeInput.value = String(s.size);
  for (const r of styleRadios) {
    /** @type {HTMLInputElement} */ (r).checked =
      /** @type {HTMLInputElement} */ (r).value === s.style;
  }
  render();
}

async function copyToClipboard(text) {
  // navigator.clipboard requires a secure context; Pages serves over HTTPS in
  // production and localhost in dev, so this is fine in practice. Fall back to
  // a hidden textarea for the rare HTTP case.
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

function flashButton(btn, label) {
  const original = btn.textContent;
  btn.textContent = label;
  btn.disabled = true;
  window.setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 1200);
}

// Wire up events
seedInput.addEventListener("input", scheduleRender);
sizeInput.addEventListener("input", scheduleRender);
for (const r of styleRadios) {
  r.addEventListener("change", () => {
    syncFromInputs();
    writeHash();
  });
}
sizePresets.forEach((chip) => {
  chip.addEventListener("click", () => {
    const v = Number(chip.getAttribute("data-size"));
    if (Number.isFinite(v)) {
      sizeInput.value = String(v);
      syncFromInputs();
      writeHash();
    }
  });
});
randomBtn.addEventListener("click", () => {
  seedInput.value = randomSeed();
  syncFromInputs();
  writeHash();
  seedInput.focus();
  seedInput.select();
});
copyBtn.addEventListener("click", async () => {
  const fullUrl = new URL(buildApiUrl(state), window.location.origin).toString();
  const ok = await copyToClipboard(fullUrl);
  flashButton(copyBtn, ok ? "Copied" : "Copy failed");
});

/* Rasterize the current SVG to a PNG and trigger a download.
   The SVG is drawn into an offscreen <canvas> at the user's chosen size with
   nearest-neighbor sampling so the pixel art stays crisp. */
async function downloadPng() {
  if (!downloadPngBtn) return;
  const size = state.size;
  const url = buildApiUrl(state);
  const originalLabel = downloadPngBtn.textContent ?? "Download PNG";
  downloadPngBtn.disabled = true;
  downloadPngBtn.textContent = "Rendering…";
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`avatar fetch ${response.status}`);
    const svgText = await response.text();
    const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const img = new Image();
      img.src = svgUrl;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2d context unavailable");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, size, size);
      const pngBlob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!pngBlob) throw new Error("toBlob returned null");
      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `avatar-${state.style}-${state.seed || "anonymous"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(pngUrl);
      flashButton(downloadPngBtn, "Downloaded");
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  } catch (err) {
    console.error("PNG download failed:", err);
    flashButton(downloadPngBtn, "Failed");
  } finally {
    downloadPngBtn.disabled = false;
    if (downloadPngBtn.textContent === "Rendering…") {
      downloadPngBtn.textContent = originalLabel;
    }
  }
}
if (downloadPngBtn) downloadPngBtn.addEventListener("click", downloadPng);
window.addEventListener("hashchange", () => {
  const s = readHash();
  if (s) applyState(s);
});

// Initial state: hash takes precedence; otherwise a fresh random seed.
const initial = readHash() ?? { seed: randomSeed(), style: "pixel-detail", size: 128 };
applyState(initial);
// Reflect initial seed in the URL so the first share preserves it.
if (!window.location.hash) writeHash();

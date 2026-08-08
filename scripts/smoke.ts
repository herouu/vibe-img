// Smoke test: import the generator and render one SVG per style.
// Run with: npx tsx scripts/smoke.ts
import { generateSvg } from "../functions/api/_lib/generator.ts";

const seeds = ["alice", "bob-42", "中文", "👻", "x"];
const styles = ["identicon", "pixel", "abstract", "anime", "xiuxian", "pixel-detail"] as const;

let allOk = true;
for (const style of styles) {
  for (const seed of seeds) {
    const svg = generateSvg({ seed, style, size: 64 });
    const ok = svg.startsWith("<svg") && svg.endsWith("</svg>") && svg.includes(`width="64"`);
    if (!ok) {
      console.error(`FAIL ${style}/${seed}: ${svg.slice(0, 80)}...`);
      allOk = false;
    } else {
      console.log(`OK   ${style}/${seed}  (${svg.length} bytes)`);
    }
  }
}

// Determinism check: same inputs must give identical output.
const a = generateSvg({ seed: "determinism", style: "pixel", size: 128 });
const b = generateSvg({ seed: "determinism", style: "pixel", size: 128 });
console.log(a === b ? "OK   determinism: byte-identical" : "FAIL determinism");

// Caching safety: with Cache-Control: immutable, the only thing that must
// change is what we change. Change the seed and confirm bytes differ.
const c = generateSvg({ seed: "determinism-2", style: "pixel", size: 128 });
console.log(a !== c ? "OK   seed-sensitivity: different" : "FAIL seed-sensitivity");

console.log(allOk ? "\nAll OK" : "\nSome failures");
process.exit(allOk ? 0 : 1);

import { generateSvg } from "../functions/api/_lib/generator.ts";
import { writeFileSync } from "fs";

const seeds = ["alice", "bob-42", "中文", "ghost", "x"];
for (const seed of seeds) {
  const svg = generateSvg({ seed, style: "pixel-detail", size: 128 });
  writeFileSync(`./sample-${seed}.svg`, svg);
  console.log(`saved sample-${seed}.svg (${svg.length} bytes)`);
}

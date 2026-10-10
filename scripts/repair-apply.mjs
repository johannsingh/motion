import { readFileSync, writeFileSync, lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
const candidate = JSON.parse(readFileSync(".repair/candidate.json", "utf8"));
if (
  !Array.isArray(candidate.files) ||
  candidate.files.length < 1 ||
  candidate.files.length > 4
)
  throw Error("Invalid repair scope");
let total = 0;
const seen = new Set();
for (const f of candidate.files) {
  if (
    typeof f.path !== "string" ||
    typeof f.content !== "string" ||
    seen.has(f.path) ||
    !/^(components\/[a-z0-9-]+\.(tsx|ts)|lib\/(domain|demo|whoop-data)\.ts|app\/globals\.css)$/.test(
      f.path,
    )
  )
    throw Error("Disallowed repair path");
  seen.add(f.path);
  if (
    lstatSync(f.path).isSymbolicLink() ||
    realpathSync(f.path) !== resolve(f.path)
  )
    throw Error("Symlink forbidden");
  total += Buffer.byteLength(f.content);
  if (total > 240000 || f.content.includes("\0"))
    throw Error("Repair too large");
}
for (const f of candidate.files) writeFileSync(f.path, f.content);
console.log(
  "Applied " +
    candidate.files.length +
    " candidate files for isolated verification.",
);

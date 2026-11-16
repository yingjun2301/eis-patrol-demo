import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
// Produce a self-contained review artifact from the same Vite build.
// Source remains React + TypeScript; the HTML is regenerated, never hand-edited.
const out = resolve("dist");
let html = await readFile(resolve(out, "index.html"), "utf8");
const scripts = [
  ...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g),
];
for (const match of scripts) {
  const code = await readFile(resolve(out, match[1]), "utf8");
  html = html.replace(
    match[0],
    () =>
      '<script type="module">' +
      code.replace(/<\/script/gi, "<\\/script") +
      "</script>",
  );
}
const styles = [...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g)];
for (const match of styles) {
  const css = await readFile(resolve(out, match[1]), "utf8");
  html = html.replace(match[0], () => "<style>" + css + "</style>");
}
const favicon = await readFile(resolve(out, "favicon.svg"), "utf8");
html = html.replace(
  /href="[^"]*favicon\.svg"/,
  'href="data:image/svg+xml;base64,' +
    Buffer.from(favicon).toString("base64") +
    '"',
);
await writeFile(resolve(out, "演示.html"), html);
console.log(
  "Standalone preview: dist/演示.html (no server or runtime network needed)",
);

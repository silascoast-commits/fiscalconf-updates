// Gera a página standalone do classificador (um único HTML com motor e base oficial embutidos).
// Uso: npx tsx script/gerar-standalone.ts [saida.html]
import { build } from "esbuild";
import fs from "fs";
import path from "path";

async function main() {
  const saida = path.resolve(process.argv[2] || "dist-standalone/classificador-ibs-cbs.html");
  const r = await build({ entryPoints: [path.resolve("script/standalone/entry.ts")], bundle: true, minify: true, format: "iife", write: false, target: "es2020" });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  const tpl = fs.readFileSync(path.resolve("script/standalone/template.html"), "utf8");
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, tpl.replace("/*__MOTOR__*/", () => js));
  console.log(`Página gerada: ${saida} (${(fs.statSync(saida).size / 1024 / 1024).toFixed(1)} MB)`);
}
main().catch(e => { console.error(e); process.exit(1); });

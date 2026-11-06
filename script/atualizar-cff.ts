// Atualiza a base oficial de classificação tributária (CST/cClassTrib × NCM/NBS)
// a partir do Portal da Conformidade Fácil (SVRS).
//
// Uso:
//   npx tsx script/atualizar-cff.ts                 → baixa do SVRS
//   npx tsx script/atualizar-cff.ts caminho.html    → usa página salva localmente
//
// Gera shared/data/cff-oficial.json (embutido no build do servidor).
import fs from "fs";
import path from "path";
import { URL_CFF_SVRS, extrairDadosSvrs, compactarBase } from "../shared/cffOficial";

async function main() {
  const arquivo = process.argv[2];
  const html = arquivo
    ? fs.readFileSync(arquivo, "utf8")
    : await (await fetch(URL_CFF_SVRS)).text();
  const versao = process.argv[3] || "";
  const base = compactarBase(extrairDadosSvrs(html), versao);
  const destino = path.resolve(import.meta.dirname, "..", "shared", "data", "cff-oficial.json");
  fs.writeFileSync(destino, JSON.stringify(base));
  const nNcm = base.vinculos.filter(v => v[1] === "N").length;
  console.log(`Base gravada em ${destino}`);
  console.log(`  cClassTribs: ${Object.keys(base.classificacoes).length} · vínculos NCM: ${nNcm} · NBS: ${base.vinculos.length - nNcm}`);
  console.log(`  publicação mais recente: ${base.publicacaoMaisRecente} · tamanho: ${(fs.statSync(destino).size / 1024).toFixed(0)} KB`);
}
main().catch(e => { console.error(e); process.exit(1); });

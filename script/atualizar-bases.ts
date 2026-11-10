// Atualiza o retrato da base fiscal oficial versionado no repositório.
// Uso: npx tsx script/atualizar-bases.ts [ncm.json svrs.html]
//   sem argumentos: baixa do Siscomex e da SVRS; com argumentos: usa arquivos locais.
import fs from "fs";
import path from "path";
import { baixarEMontarBase, montarBase } from "../server/bases/importar";

async function main() {
  const [ncmArq, ctArq] = process.argv.slice(2);
  const base = ncmArq && ctArq
    ? montarBase(fs.readFileSync(ncmArq, "utf8"), fs.readFileSync(ctArq, "utf8"))
    : await baixarEMontarBase();
  const destino = path.resolve("server/data/base-fiscal.json");
  fs.writeFileSync(destino, JSON.stringify(base));
  console.log(`Base gravada em ${destino}`);
  console.log(`  NCM: ${Object.keys(base.ncm).length} códigos (${base.versao.ncm})`);
  console.log(`  cClassTrib: ${Object.keys(base.classTrib).length} códigos; ${Object.keys(base.regras).length} NCMs com regra de anexo (${base.versao.classTrib})`);
}
main().catch(e => { console.error(e.message || e); process.exit(1); });

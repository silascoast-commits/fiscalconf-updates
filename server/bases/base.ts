// Carrega a base fiscal oficial: a versão atualizada pelo usuário (arquivo ao lado do banco)
// ou, na falta dela, o retrato embutido no build (server/data/base-fiscal.json).
import fs from "fs";
import path from "path";
import baseEmbutida from "../data/base-fiscal.json";
import type { BaseFiscal } from "@shared/classificador/tipos";
import { Classificador } from "@shared/classificador/motor";

const ARQ_ATUALIZADA = path.resolve("base-fiscal-atualizada.json");

let base: BaseFiscal = baseEmbutida as unknown as BaseFiscal;
let origem: "embutida" | "atualizada" = "embutida";
try {
  if (fs.existsSync(ARQ_ATUALIZADA)) {
    const b = JSON.parse(fs.readFileSync(ARQ_ATUALIZADA, "utf8")) as BaseFiscal;
    if (b?.versao?.geradoEm && b.versao.geradoEm > base.versao.geradoEm) { base = b; origem = "atualizada"; }
  }
} catch (e) {
  console.warn("Base fiscal atualizada ilegível, usando a embutida:", (e as Error).message);
}
let classificador = new Classificador(base);

export function getClassificador(): Classificador { return classificador; }
export function getBase(): BaseFiscal { return base; }

export function statusBase() {
  return {
    origem,
    versao: base.versao,
    totais: { ncm: Object.keys(base.ncm).length, classTrib: Object.keys(base.classTrib).length, ncmComRegra: Object.keys(base.regras).length },
  };
}

export function substituirBase(nova: BaseFiscal) {
  fs.writeFileSync(ARQ_ATUALIZADA, JSON.stringify(nova));
  base = nova;
  origem = "atualizada";
  classificador = new Classificador(base);
}

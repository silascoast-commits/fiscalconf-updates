// Carregamento da base oficial cClassTrib × NCM/NBS (SVRS) no servidor.
//
// • A base vem embutida no build (shared/data/cff-oficial.json).
// • O usuário pode atualizá-la pelo sistema: a versão baixada é gravada em
//   ./cff-oficial.json (ao lado do data.db) e passa a ter prioridade enquanto
//   for mais recente que a embutida.
import fs from "fs";
import path from "path";
import https from "https";
import embutida from "@shared/data/cff-oficial.json";
import { URL_CFF_SVRS, extrairDadosSvrs, compactarBase, type BaseOficial } from "@shared/cffOficial";

const ARQUIVO_LOCAL = path.resolve(process.cwd(), "cff-oficial.json");

let baseAtual: BaseOficial = embutida as unknown as BaseOficial;
let origem: "embutida" | "atualizada" = "embutida";

function carregarLocal() {
  try {
    if (!fs.existsSync(ARQUIVO_LOCAL)) return;
    const local = JSON.parse(fs.readFileSync(ARQUIVO_LOCAL, "utf8")) as BaseOficial;
    if (local?.vinculos?.length && local.publicacaoMaisRecente >= baseAtual.publicacaoMaisRecente) {
      baseAtual = local;
      origem = "atualizada";
    }
  } catch (e) {
    console.warn("[reforma] base local inválida — usando a embutida:", (e as Error).message);
  }
}
carregarLocal();

export function getBase(): BaseOficial { return baseAtual; }

export function infoBase() {
  const b = baseAtual;
  const nNcm = b.vinculos.filter(v => v[1] === "N").length;
  return {
    origem, fonte: b.fonte, versaoTabela: b.versaoTabela, extraidoEm: b.extraidoEm,
    publicacaoMaisRecente: b.publicacaoMaisRecente,
    totalClassificacoes: Object.keys(b.classificacoes).length,
    vinculosNcm: nNcm, vinculosNbs: b.vinculos.length - nNcm,
  };
}

function baixar(url: string, redirecionamentos = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "FiscalConf/3 (+atualizacao tabela cClassTrib)" }, timeout: 60000 }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirecionamentos > 0) {
        res.resume();
        return resolve(baixar(new URL(res.headers.location, url).toString(), redirecionamentos - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`SVRS respondeu HTTP ${res.statusCode}`)); }
      const partes: Buffer[] = [];
      res.on("data", c => partes.push(c));
      res.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
    });
    req.on("timeout", () => req.destroy(new Error("Tempo esgotado ao acessar o SVRS")));
    req.on("error", reject);
  });
}

/** Baixa a tabela vigente do SVRS e passa a usá-la imediatamente */
export async function atualizarBaseOnline() {
  const html = await baixar(URL_CFF_SVRS);
  const nova = compactarBase(extrairDadosSvrs(html), "SVRS (download)");
  if (!nova.vinculos.length) throw new Error("Tabela baixada sem vínculos NCM/NBS — atualização cancelada");
  fs.writeFileSync(ARQUIVO_LOCAL, JSON.stringify(nova));
  const anterior = infoBase();
  baseAtual = nova;
  origem = "atualizada";
  return { anterior, atual: infoBase() };
}

/** Descrição oficial do cClassTrib (com fallback) */
export function nomeClassTrib(codigo: string): string | null {
  const c = baseAtual.classificacoes[codigo];
  return c ? (c.nomeReduzido || c.nome) : null;
}
export function nomeCst(cst: string): string | null {
  return baseAtual.cst[cst]?.nome || null;
}

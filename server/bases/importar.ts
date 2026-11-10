// Importa as bases oficiais e monta a BaseFiscal compacta.
//   NCM:        https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json
//   cClassTrib: https://dfe-portal.svrs.rs.gov.br/DFE/ClassificacaoTributaria (JSON embutido na página)
import type { BaseFiscal, ClassTribInfo, RegraNcm } from "@shared/classificador/tipos";

export const URL_NCM = "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json";
export const URL_CLASSTRIB = "https://dfe-portal.svrs.rs.gov.br/DFE/ClassificacaoTributaria";

const ROMANOS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII"];

function limpar(s: unknown): string {
  return String(s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/** Extrai o array `dadosOriginais` embutido na página da SVRS (ou aceita o JSON já extraído). */
export function extrairClassTrib(conteudo: string): any[] {
  const t = conteudo.trim();
  if (t.startsWith("[")) return JSON.parse(t);
  const marca = "var dadosOriginais = ";
  const i = conteudo.indexOf(marca);
  if (i < 0) throw new Error("Não encontrei a tabela de cClassTrib no arquivo (esperado: página da SVRS ou JSON)");
  // Lê um valor JSON a partir da posição, respeitando strings
  const ini = i + marca.length;
  let prof = 0, emStr = false, escp = false, fim = -1;
  for (let k = ini; k < conteudo.length; k++) {
    const c = conteudo[k];
    if (emStr) { if (escp) escp = false; else if (c === "\\") escp = true; else if (c === '"') emStr = false; continue; }
    if (c === '"') emStr = true;
    else if (c === "[" || c === "{") prof++;
    else if (c === "]" || c === "}") { prof--; if (prof === 0) { fim = k + 1; break; } }
  }
  if (fim < 0) throw new Error("Tabela de cClassTrib incompleta no arquivo");
  return JSON.parse(conteudo.slice(ini, fim));
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function montarBase(ncmJsonTexto: string, classTribTexto: string): BaseFiscal {
  // ── NCM ──
  const ncmRaw = JSON.parse(ncmJsonTexto.replace(/^﻿/, ""));
  const lista: { Codigo: string; Descricao: string }[] = ncmRaw.Nomenclaturas || [];
  if (lista.length < 5000) throw new Error("Tabela NCM com poucos registros — arquivo inválido?");
  const nos = new Map<string, string>();
  for (const n of lista) nos.set(String(n.Codigo).replace(/\D/g, ""), limpar(n.Descricao).replace(/^[-–\s]+/, "").replace(/:$/, ""));
  const ncm: Record<string, string> = {};
  for (const [cod, desc] of Array.from(nos.entries())) {
    if (cod.length !== 8) continue;
    // Hierarquia: posição (4) › subposições (5, 6) › item/subitem (7) › código (8)
    const partes: string[] = [];
    for (const tam of [4, 5, 6, 7]) {
      const p = nos.get(cod.slice(0, tam));
      if (p && p !== partes[partes.length - 1] && !/^outr[oa]s$/i.test(p)) partes.push(p);
    }
    if (desc !== partes[partes.length - 1]) partes.push(desc);
    ncm[cod] = partes.join(" › ");
  }

  // ── cClassTrib e anexos ──
  const csts = extrairClassTrib(classTribTexto);
  const cst: Record<string, string> = {};
  const classTrib: Record<string, ClassTribInfo> = {};
  const textos: string[] = [];
  const idxTexto = new Map<string, number>();
  const tx = (s: unknown) => {
    const v = limpar(s);
    if (!v) return -1;
    let i = idxTexto.get(v);
    if (i === undefined) { i = textos.length; textos.push(v); idxTexto.set(v, i); }
    return i;
  };
  const regras: Record<string, RegraNcm[]> = {};
  let ultimaPub = "";

  for (const c of csts) {
    cst[c.Cst] = limpar(c.NomeCst);
    for (const t of c.ClassificacoesTributarias || []) {
      if (t.DthFimVig && new Date(t.DthFimVig) < new Date()) continue;
      if (t.DthPublicacao && t.DthPublicacao > ultimaPub) ultimaPub = t.DthPublicacao;
      const nro = Number(t.NroAnexo);
      classTrib[t.CodClassTrib] = {
        cst: t.Cst,
        nome: limpar(t.NomeReduzido) || limpar(t.NomeClassTrib).slice(0, 120),
        nomeCompleto: limpar(t.NomeClassTrib),
        redIbs: Number(t.PercRedIbs) || 0,
        redCbs: Number(t.PercRedCbs) || 0,
        anexo: nro >= 1 && nro < ROMANOS.length ? `Anexo ${ROMANOS[nro]}` : null,
        nfe: !!t.IndNfe,
        nfce: !!t.IndNfce,
        url: t.TexUrlLegislacao || null,
      };
      for (const a of t.Anexos || []) {
        if (a.TipoCodigo !== "NCM" || !a.CodNcmNbs) continue;
        if (a.DthFimVig && new Date(a.DthFimVig) < new Date()) continue;
        const cod = String(a.CodNcmNbs).replace(/\D/g, "");
        if (cod.length !== 8) continue;
        const r: RegraNcm = [t.CodClassTrib, a.TipoPermissao === "VEDADO" ? 0 : 1, tx(a.DescItemAnexo), tx(a.DescCondicao), tx(a.DescExcecao)];
        (regras[cod] ||= []).push(r);
      }
    }
  }
  if (Object.keys(classTrib).length < 50) throw new Error("Tabela de cClassTrib com poucos registros — arquivo inválido?");

  return {
    versao: {
      ncm: [limpar(ncmRaw.Data_Ultima_Atualizacao_NCM), limpar(ncmRaw.Ato)].filter(Boolean).join(" — "),
      classTrib: `Portal DF-e SVRS — publicação mais recente em ${fmtData(ultimaPub)}`,
      geradoEm: new Date().toISOString(),
    },
    cst, classTrib, ncm, textos, regras,
  };
}

async function baixarTexto(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; FiscalConf)" } });
    if (!r.ok) throw new Error(`${url} respondeu HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function baixarEMontarBase(): Promise<BaseFiscal> {
  const [ncmTxt, ctTxt] = await Promise.all([baixarTexto(URL_NCM), baixarTexto(URL_CLASSTRIB)]);
  return montarBase(ncmTxt, ctTxt);
}

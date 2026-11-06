// ═══════════════════════════════════════════════════════════════════════════
// TABELA OFICIAL DE CLASSIFICAÇÃO TRIBUTÁRIA (CST / cClassTrib IBS-CBS)
// Fonte: Portal da Conformidade Fácil — SVRS (dfe-portal.svrs.rs.gov.br/CFF)
//        Informe Técnico 2025.002 — Tabela de Classificação Tributária
//
// Este módulo converte o conteúdo publicado pelo SVRS (página HTML com os dados
// embutidos) para um formato compacto, e oferece tipos e consultas sobre ele.
// Não tem dependências de Node — pode ser usado no servidor e em scripts.
// ═══════════════════════════════════════════════════════════════════════════

export const URL_CFF_SVRS = "https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributaria";

export interface CstOficial {
  nome: string;
  exigeTributo: boolean;
  monofasica: boolean;
  reducaoAliquota: boolean;
  diferimento: boolean;
  reducaoBc: boolean;
  transferenciaCredito: boolean;
}

export interface ClassTribOficial {
  cst: string;
  nome: string;
  nomeReduzido: string;
  redIbs: number;
  redCbs: number;
  url: string | null;
  inicioVigencia: string | null;
  fimVigencia: string | null;
  publicacao: string | null;
  permiteCreditoPresumido: boolean;
  tributacaoRegular: boolean;
  /** documentos fiscais em que o código é aceito */
  documentos: string[];
}

/** [codigoNcmNbs, tipo (N|S), cClassTrib, permissao (P|V|""), iCondicao, iExcecao, iObs, iItem, iAnexo, inicio, fim] */
export type VinculoCompacto = [string, "N" | "S", string, "P" | "V" | "", number, number, number, number, number, string, string];

export interface BaseOficial {
  fonte: string;
  versaoTabela: string;
  extraidoEm: string;
  publicacaoMaisRecente: string;
  cst: Record<string, CstOficial>;
  classificacoes: Record<string, ClassTribOficial>;
  /** tabela de textos deduplicados (índice 0 = vazio) */
  textos: string[];
  vinculos: VinculoCompacto[];
}

export interface Vinculo {
  codigo: string;
  tipo: "NCM" | "NBS";
  cClassTrib: string;
  permissao: "PERMITIDO" | "VEDADO" | null;
  condicao: string;
  excecao: string;
  observacao: string;
  itemAnexo: string;
  anexo: string;
  inicio: string;
  fim: string;
}

const DOCS: [string, string][] = [
  ["IndNfe", "NF-e"], ["IndNfce", "NFC-e"], ["IndCte", "CT-e"], ["IndCteos", "CT-e OS"], ["IndBpe", "BP-e"],
  ["IndNf3e", "NF3-e"], ["IndNfcom", "NFCom"], ["IndNfse", "NFS-e"], ["IndBpetm", "BP-e TM"], ["IndBpeta", "BP-e TA"],
  ["IndNfag", "NFAg"], ["IndNfsvia", "NFS-via"], ["IndNfabi", "NFABI"], ["IndNfgas", "NFGas"], ["IndDere", "DeRE"],
];

const dia = (v: any) => (v ? String(v).slice(0, 10) : "");
const limpa = (v: any) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

/** Extrai o array `dadosOriginais` da página HTML publicada pelo SVRS */
export function extrairDadosSvrs(html: string): any[] {
  const marca = "dadosOriginais = ";
  const i = html.indexOf(marca);
  if (i < 0) throw new Error("Página do SVRS não contém a tabela de classificação (dadosOriginais)");
  // Localiza o fim do array JSON contando colchetes, respeitando strings
  let j = i + marca.length, prof = 0, emString = false, esc = false;
  for (; j < html.length; j++) {
    const ch = html[j];
    if (emString) {
      if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') emString = false;
      continue;
    }
    if (ch === '"') emString = true;
    else if (ch === "[" || ch === "{") prof++;
    else if (ch === "]" || ch === "}") { prof--; if (prof === 0) { j++; break; } }
  }
  return JSON.parse(html.slice(i + marca.length, j));
}

/** Converte os dados brutos do SVRS na base compacta */
export function compactarBase(dados: any[], versaoTabela = ""): BaseOficial {
  const textos: string[] = [""];
  const idx = new Map<string, number>([["", 0]]);
  const t = (v: any) => {
    const s = limpa(v);
    let k = idx.get(s);
    if (k === undefined) { k = textos.length; textos.push(s); idx.set(s, k); }
    return k;
  };

  const cst: Record<string, CstOficial> = {};
  const classificacoes: Record<string, ClassTribOficial> = {};
  const vinculos: VinculoCompacto[] = [];
  let pub = "";

  for (const c of dados) {
    cst[c.Cst] = {
      nome: limpa(c.NomeCst), exigeTributo: !!c.IndExigeTrib, monofasica: !!c.IndMonofasica,
      reducaoAliquota: !!c.IndReducaoAliq, diferimento: !!c.IndDiferimento, reducaoBc: !!c.IndReducaoBc,
      transferenciaCredito: !!c.IndTransferenciaCred,
    };
    for (const ct of c.ClassificacoesTributarias || []) {
      const p = dia(ct.DthPublicacao);
      if (p > pub) pub = p;
      classificacoes[ct.CodClassTrib] = {
        cst: ct.Cst, nome: limpa(ct.NomeClassTrib), nomeReduzido: limpa(ct.NomeReduzido || ct.NomeClassTrib),
        redIbs: Number(ct.PercRedIbs) || 0, redCbs: Number(ct.PercRedCbs) || 0,
        url: limpa(ct.TexUrlLegislacao) || null,
        inicioVigencia: dia(ct.DthIniVig) || null, fimVigencia: dia(ct.DthFimVig) || null, publicacao: p || null,
        permiteCreditoPresumido: !!ct.IndPermiteCredPres, tributacaoRegular: !!ct.IndTribRegular,
        documentos: DOCS.filter(([k]) => ct[k]).map(([, n]) => n),
      };
      for (const a of ct.Anexos || []) {
        const perm = a.TipoPermissao === "PERMITIDO" ? "P" : a.TipoPermissao === "VEDADO" ? "V" : "";
        vinculos.push([
          String(a.CodNcmNbs), a.TipoCodigo === "NBS" ? "S" : "N", ct.CodClassTrib, perm,
          t(a.DescCondicao), t(a.DescExcecao), t(a.Observacao), t(a.DescItemAnexo), t(a.DescAnexo),
          dia(a.DthIniVig), dia(a.DthFimVig),
        ]);
      }
    }
  }
  vinculos.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[2] < y[2] ? -1 : 1));

  return {
    fonte: URL_CFF_SVRS, versaoTabela, extraidoEm: new Date().toISOString().slice(0, 10),
    publicacaoMaisRecente: pub, cst, classificacoes, textos, vinculos,
  };
}

export function expandirVinculo(b: BaseOficial, v: VinculoCompacto): Vinculo {
  return {
    codigo: v[0], tipo: v[1] === "S" ? "NBS" : "NCM", cClassTrib: v[2],
    permissao: v[3] === "P" ? "PERMITIDO" : v[3] === "V" ? "VEDADO" : null,
    condicao: b.textos[v[4]], excecao: b.textos[v[5]], observacao: b.textos[v[6]],
    itemAnexo: b.textos[v[7]], anexo: b.textos[v[8]], inicio: v[9], fim: v[10],
  };
}

/** Índice código → vínculos (montado uma vez por base) */
const cacheIndice = new WeakMap<BaseOficial, Map<string, VinculoCompacto[]>>();
export function indice(b: BaseOficial) {
  let m = cacheIndice.get(b);
  if (!m) {
    m = new Map();
    for (const v of b.vinculos) {
      const k = v[1] + v[0];
      const arr = m.get(k);
      if (arr) arr.push(v); else m.set(k, [v]);
    }
    cacheIndice.set(b, m);
  }
  return m;
}

export function vigente(ini: string | null | undefined, fim: string | null | undefined, data: string) {
  return (!ini || ini <= data) && (!fim || fim > data);
}

export function vinculosDoCodigo(b: BaseOficial, codigo: string, tipo: "NCM" | "NBS", data = new Date().toISOString().slice(0, 10)): Vinculo[] {
  const arr = indice(b).get((tipo === "NBS" ? "S" : "N") + codigo) || [];
  return arr
    .filter(v => vigente(v[9], v[10], data) && vigente(b.classificacoes[v[2]]?.inicioVigencia, b.classificacoes[v[2]]?.fimVigencia, data))
    .map(v => expandirVinculo(b, v));
}

/** Vínculos cujo código começa com o prefixo (para consulta por posição/subposição) */
export function vinculosDoPrefixo(b: BaseOficial, prefixo: string, tipo: "NCM" | "NBS", limite = 400): Vinculo[] {
  const t = tipo === "NBS" ? "S" : "N";
  const out: Vinculo[] = [];
  for (const v of b.vinculos) {
    if (v[1] === t && v[0].startsWith(prefixo)) { out.push(expandirVinculo(b, v)); if (out.length >= limite) break; }
  }
  return out;
}

/** cClassTribs que possuem correlação oficial por NCM (N) ou NBS (S) */
const cacheMapeados = new WeakMap<BaseOficial, { N: Set<string>; S: Set<string> }>();
export function classTribsMapeados(b: BaseOficial) {
  let m = cacheMapeados.get(b);
  if (!m) {
    m = { N: new Set(), S: new Set() };
    for (const v of b.vinculos) m[v[1]].add(v[2]);
    cacheMapeados.set(b, m);
  }
  return m;
}

// Motor de classificação IBS/CBS (NCM → CST / cClassTrib) sobre a base oficial.
// Módulo puro: roda no servidor e na página standalone.
//
// Ordem de decisão para cada item:
//   1. Operação (CFOP): exportação, transferência, bonificação → CST/cClassTrib da operação.
//   2. NCM: inválido (sem 8 dígitos) ou inexistente na tabela NCM vigente.
//   3. Decisão salva (memória do cliente) para o NCM/produto.
//   4. Regras oficiais dos anexos: cClassTrib PERMITIDOS menos os VEDADOS para o NCM.
//   5. Filtro pelo destinatário (órgão público, produtor rural).
//   6. Leitura da descrição do produto e do perfil da empresa para escolher entre opções.
import type { BaseFiscal, ClassTribInfo } from "./tipos";

export type Destinatario = "geral" | "orgao_publico" | "produtor_rural_contribuinte" | "produtor_rural_nao_contribuinte";
export type Perfil = "geral" | "alimentos" | "agro" | "saude" | "higiene_limpeza" | "pet";

export interface Contexto {
  cfop?: string;
  destinatario?: Destinatario;
  perfil?: Perfil;
}

export interface ItemEntrada {
  ncm: string;
  descricao?: string;
  codigo?: string;          // código do produto no ERP
  cfop?: string;            // CFOP do item (prevalece sobre o do contexto)
  cstNota?: string;         // CST IBS/CBS informado na NF-e (auditoria)
  cClassTribNota?: string;  // cClassTrib informado na NF-e (auditoria)
  origem?: string;          // ex.: arquivo/nota de onde veio
}

export interface DecisaoSalva {
  ncm: string;
  chave: string;            // descrição normalizada ("" = vale para o NCM inteiro)
  cClassTrib: string;
  justificativa?: string | null;
}

export type Situacao =
  | "OPERACAO"      // CST vem da operação (CFOP)
  | "MEMORIA"       // decisão salva anteriormente
  | "AUTOMATICO"    // havia mais de uma opção e a descrição/perfil/destinatário resolveu
  | "CONFIRMADO"    // uma opção e a descrição confere com o item do anexo
  | "VERDE"         // não consta nos anexos: tributação integral
  | "AMARELO"       // uma opção, conferir condição
  | "VERMELHO"      // mais de uma opção, escolher
  | "INEXISTENTE"   // NCM não existe na tabela vigente
  | "INVALIDO";     // NCM sem 8 dígitos

export interface Opcao {
  cClassTrib: string;
  cst: string;
  nome: string;
  anexo: string | null;
  reducao: number;          // % (IBS; CBS igual nos anexos)
  itens: string[];          // itens do anexo em que o NCM aparece
  condicoes: string[];
  excecoes: string[];
  pontos: number;           // aderência à descrição/perfil
  motivos: string[];
}

export interface Alerta { tipo: "erro" | "aviso" | "info"; texto: string }

export interface Resultado {
  entrada: ItemEntrada;
  ncm: string;
  ncmFormatado: string;
  ncmDescricao: string | null;   // descrição oficial (Siscomex)
  zeroCorrigido: boolean;
  situacao: Situacao;
  cst: string | null;
  cClassTrib: string | null;
  nome: string | null;
  reducao: number | null;
  aliquota2026: number | null;   // CBS 0,9% + IBS 0,1% (ano-teste) com a redução aplicada
  baseLegal: string;
  motivo: string;                // por que chegou nesta situação
  opcoes: Opcao[];
  alertas: Alerta[];
  auditoria: { cstNota: string; cClassTribNota: string; ok: boolean; problemas: string[] } | null;
}

// ─── utilidades de texto ─────────────────────────────────────────────────────

const STOP = new Set("de da do das dos e em para com sem por a o as os ao aos na no nas nos um uma ou que se tipo cx und un pct kg g ml l lt cm mm pc unid c/ s/ ncm sh codigo codigos subposicao subposicoes posicao posicoes classificados classificadas classificado relacionados mesmo outros outras exceto conformidade requisitos legislacao especifica relativa demais".split(" "));

export function normalizar(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function radical(w: string): string {
  return w.replace(/oes$|aes$/, "ao").replace(/ais$/, "al").replace(/eis$/, "el").replace(/ns$/, "m").replace(/s$/, "").slice(0, 5);
}

function radicais(s: string): string[] {
  return normalizar(s).split(" ")
    .filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w))
    .map(radical);
}

/** Chave de memória de um produto: descrição normalizada, sem números de embalagem. */
export function chaveProduto(descricao?: string): string {
  return radicais(descricao || "").slice(0, 8).join(" ");
}

/** Termos com peso: "!" = decisivo (7), "~" = fraco (3), sem prefixo = forte (5). */
function acharTermos(textoNorm: string, termos: string[]): { termo: string; peso: number }[] {
  const achados: { termo: string; peso: number }[] = [];
  for (const raw of termos) {
    const peso = raw[0] === "!" ? 7 : raw[0] === "~" ? 3 : 5;
    const t = raw.replace(/^[!~]/, "");
    if (new RegExp(`(^| )${t}`).test(textoNorm)) achados.push({ termo: t.trim(), peso });
  }
  return achados;
}

// Famílias de cClassTrib e termos que indicam cada uma na descrição do produto
const FAMILIA: Record<string, string> = {
  "200003": "alimentos", "200034": "alimentos", "200014": "alimentos",
  "200038": "agro", "515001": "agro", "200002": "agro",
  "200035": "higiene_limpeza", "200013": "higiene_limpeza",
  "200004": "saude", "200005": "saude", "200030": "saude", "200007": "saude", "200008": "saude",
  "200031": "saude", "200011": "saude", "200033": "saude",
};

const TERMOS: Record<string, string[]> = {
  agro: ["!semente", "!semeadura", "!plantio", "!para plantar", "muda", "adubo", "fertiliz", "corretivo de solo", "calcario agric", "defensivo", "agrotox", "herbicida", "fungicida", "inseticida agric", "!lavoura", "!agricol", "!agropecuar", "!pecuar", "racao", "premix", "nucleo", "sal mineral", "suplemento mineral", "!veterinar", "!uso veterinar", "!bovino", "!suino", "!equino", "!ovino", "!caprino", "!gado", "!aviario", "!granja", "!curral", "pastagem", "forrag", "inoculante", "silagem", "aquicol", "piscicult"],
  alimentos: ["~alimento", "consumo humano", "arroz", "feijao", "cafe", "acucar", "leite", "queijo", "carne", "frango", "peixe", "farinha", "macarrao", "~massa", "biscoito", "pao", "iogurte", "oleo de soja", "oleo de cozinha", "margarina", "manteiga", "fuba", "tapioca", "~polpa", "~suco", "ovo", "mel", "sal refinado", "sal grosso"],
  higiene_limpeza: ["higien", "limpeza", "!uso domestic", "domestic", "!domissanit", "sanitari", "~desinfet", "multiuso", "lava louc", "detergente", "sabao", "sabonete", "creme dental", "escova de dente", "papel higien", "fralda", "absorvente", "tampao", "coletor menstru", "agua sanitaria", "alvejante", "~pinho", "~lavanda", "~banheiro", "~cozinha"],
  saude: ["hospitalar", "cirurgic", "~medic", "clinic", "ortoped", "protese", "ortese", "seringa", "agulha", "cateter", "sonda", "curativo", "diu", "marcapasso", "deficien", "acessibil", "cadeira de rodas", "auditiv", "nutricao enteral", "enteral", "parenteral", "~dieta"],
  pet: ["cao", "caes", "cachorro", "gato", "felino", "canino", "pet", "animal domest", "animais domest"],
};

// Capítulos NCM típicos de cada família (para o alerta de NCM possivelmente errado)
const CAPITULOS: Record<string, string[]> = {
  alimentos: ["01","02","03","04","05","07","08","09","10","11","12","15","16","17","18","19","20","21","22","25"],
  higiene_limpeza: ["28","33","34","38","39","40","48","56","96"],
};

const PERFIL_FAMILIA: Record<Perfil, string | null> = {
  geral: null, alimentos: "alimentos", agro: "agro", saude: "saude", higiene_limpeza: "higiene_limpeza", pet: null,
};

// Códigos exclusivos para venda a órgão público e o equivalente na venda comum
const ORGAO_PUBLICO: Record<string, string | null> = { "200005": "200030", "200008": "200031", "200011": "200033", "200043": null };

// ─── operação ────────────────────────────────────────────────────────────────

export interface ResultadoOperacao {
  tributavel: boolean;
  cfop: string;
  descricao: string;
  cst?: string;
  cClassTrib?: string;
  baseLegal?: string;
  observacao?: string;
}

const CFOP_TRANSFERENCIA = new Set(["5151", "5152", "5155", "5156", "5408", "5409", "6151", "6152", "6155", "6156", "6408", "6409"]);

export function analisarOperacao(cfopRaw?: string): ResultadoOperacao | null {
  const cfop = (cfopRaw || "").replace(/\D/g, "");
  if (!cfop) return null;
  if (cfop.length !== 4) return { tributavel: true, cfop, descricao: "CFOP inválido", observacao: "Use 4 dígitos. Seguindo para a análise por NCM." };
  if (cfop[0] === "7") return { tributavel: false, cfop, descricao: "Exportação", cst: "410", cClassTrib: "410004", baseLegal: "Art. 8º, LC 214/25 — imunidade e não incidência na exportação" };
  if (CFOP_TRANSFERENCIA.has(cfop)) return { tributavel: false, cfop, descricao: "Transferência entre estabelecimentos do mesmo contribuinte", cst: "410", cClassTrib: "410002", baseLegal: "Art. 6º, LC 214/25" };
  if (cfop === "5910" || cfop === "6910") return { tributavel: false, cfop, descricao: "Bonificação, doação ou brinde", cst: "410", cClassTrib: "410001", baseLegal: "Art. 6º, LC 214/25 — doação ou amostra grátis sem contraprestação usa 410003" };
  if (cfop === "5911" || cfop === "6911") return { tributavel: false, cfop, descricao: "Amostra grátis", cst: "410", cClassTrib: "410003", baseLegal: "Art. 6º, LC 214/25" };
  if (/^[56]20[1-9]$|^[56]41[0-3]$|^[56]55[3-6]$/.test(cfop)) return { tributavel: true, cfop, descricao: "Devolução", observacao: "A devolução segue a classificação da nota original." };
  if ("123".includes(cfop[0])) return { tributavel: true, cfop, descricao: "Entrada", observacao: "Em CFOP de entrada vale a classificação do fornecedor; o resultado serve para conferir." };
  return { tributavel: true, cfop, descricao: "Operação tributável" };
}

// ─── NCM ─────────────────────────────────────────────────────────────────────

export function normalizarNcm(raw: string): { ncm: string; zeroCorrigido: boolean } {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 8) return { ncm: d, zeroCorrigido: false };
  if (d.length === 7) return { ncm: "0" + d, zeroCorrigido: true };
  return { ncm: "", zeroCorrigido: false };
}

export function formatarNcm(n: string): string {
  return n.length === 8 ? `${n.slice(0, 4)}.${n.slice(4, 6)}.${n.slice(6)}` : n;
}

export function aliquota2026(reducao: number): number {
  // Ano-teste 2026: CBS 0,9% + IBS 0,1% (art. 343 e 346, LC 214/25)
  return Math.round((0.9 + 0.1) * (1 - reducao / 100) * 1000) / 1000;
}

function baseLegalDe(info: ClassTribInfo | undefined, cod: string): string {
  if (!info) return `cClassTrib ${cod}`;
  const red = info.redIbs === 100 ? "alíquota zero" : info.redIbs > 0 ? `redução de ${info.redIbs}%` : "sem redução";
  const art = info.url?.match(/#art(\d+)/i)?.[1];
  return [info.anexo, art ? `art. ${art} da LC 214/25` : null, red].filter(Boolean).join(" · ");
}

// ─── classificação ───────────────────────────────────────────────────────────

export class Classificador {
  private codigosComAnexo: Set<string>;
  constructor(private base: BaseFiscal) {
    this.codigosComAnexo = new Set();
    for (const rs of Object.values(base.regras)) for (const r of rs) this.codigosComAnexo.add(r[0]);
  }

  get info() { return this.base.versao; }
  classTrib(cod: string) { return this.base.classTrib[cod]; }
  descricaoNcm(ncm: string) { return this.base.ncm[ncm] ?? null; }

  private montarOpcoes(ncm: string): { opcoes: Opcao[]; vedados: string[] } {
    const regras = this.base.regras[ncm] || [];
    const T = this.base.textos;
    const vedados = new Set(regras.filter(r => r[1] === 0).map(r => r[0]));
    const mapa = new Map<string, Opcao>();
    for (const [cod, perm, iItem, iCond, iExc] of regras) {
      if (!perm || vedados.has(cod)) continue;
      const info = this.base.classTrib[cod];
      if (!info) continue;
      let o = mapa.get(cod);
      if (!o) {
        o = { cClassTrib: cod, cst: info.cst, nome: info.nome, anexo: info.anexo, reducao: info.redIbs, itens: [], condicoes: [], excecoes: [], pontos: 0, motivos: [] };
        mapa.set(cod, o);
      }
      const add = (arr: string[], i: number) => { if (i >= 0 && !arr.includes(T[i])) arr.push(T[i]); };
      add(o.itens, iItem); add(o.condicoes, iCond); add(o.excecoes, iExc);
    }
    return { opcoes: Array.from(mapa.values()), vedados: Array.from(vedados) };
  }

  private aplicarDestinatario(opcoes: Opcao[], dest: Destinatario, motivos: string[]): Opcao[] {
    let out = opcoes;
    const tem = (c: string) => out.some(o => o.cClassTrib === c);
    if (dest === "orgao_publico") {
      for (const [esp, comum] of Object.entries(ORGAO_PUBLICO)) {
        if (comum && tem(esp) && tem(comum)) { out = out.filter(o => o.cClassTrib !== comum); motivos.push(`venda a órgão público: ${esp} no lugar de ${comum}`); }
      }
    } else {
      const antes = out.length;
      out = out.filter(o => !(o.cClassTrib in ORGAO_PUBLICO));
      if (out.length < antes && out.length > 0) motivos.push("códigos exclusivos de venda a órgão público descartados");
      if (out.length === 0) out = opcoes; // só havia código de órgão público: mantém para o usuário ver
    }
    if (dest === "produtor_rural_contribuinte") {
      if (tem("515001") && tem("200038")) { out = out.filter(o => o.cClassTrib !== "200038"); motivos.push("produtor rural contribuinte: diferimento (515001)"); }
    } else if (tem("515001") && out.length > 1) {
      out = out.filter(o => o.cClassTrib !== "515001");
    }
    if (dest === "produtor_rural_nao_contribuinte" && tem("200038")) {
      const info = this.base.classTrib["200002"];
      if (info) {
        out = out.filter(o => o.cClassTrib !== "200038" && o.cClassTrib !== "515001");
        out.push({ cClassTrib: "200002", cst: info.cst, nome: info.nome, anexo: info.anexo, reducao: info.redIbs, itens: ["Insumo agropecuário fornecido a produtor rural não contribuinte"], condicoes: [], excecoes: [], pontos: 0, motivos: [] });
        motivos.push("produtor rural não contribuinte: 200002");
      }
    }
    return out;
  }

  /** Termos do item do anexo que não estão na descrição oficial do NCM (o item é mais estreito que o NCM). */
  private termosEspecificos(o: Opcao, ncm: string): Set<string> {
    const oficial = new Set(radicais(this.base.ncm[ncm] || ""));
    const genericos = new Set(["comum", "denom", "destin", "humano", "humana", "consum", "produt", "confor", "alimen", "subpo", "inclu", "exclu", "simil", "prepa"]);
    return new Set(radicais(o.itens.join(" ")).filter(r => r.length >= 3 && !oficial.has(r) && !genericos.has(r)));
  }

  private pontuar(opcoes: Opcao[], descricao: string, perfil: Perfil, ncm: string): void {
    const dn = normalizar(descricao);
    const rad = new Set(radicais(descricao));
    const ehPet = acharTermos(dn, TERMOS.pet).length > 0;
    for (const o of opcoes) {
      const fam = FAMILIA[o.cClassTrib];
      if (fam && dn) {
        const achados = acharTermos(dn, TERMOS[fam] || []);
        if (achados.length) {
          const pts = Math.min(Math.max(...achados.map(x => x.peso)) + 2 * (achados.length - 1), 11);
          o.pontos += pts;
          // Termo decisivo só vale para destinação agropecuária (Anexo IX é definido pelo uso, não pelo produto)
          if (fam === "agro" && achados.some(x => x.peso === 7)) (o as any).decisivo = true;
          o.motivos.push(`a descrição indica ${fam.replace("_", " e ")} (${achados.slice(0, 3).map(x => `"${x.termo}"`).join(", ")})`);
        }
      }
      if (fam && PERFIL_FAMILIA[perfil] === fam) { o.pontos += 2; o.motivos.push("perfil da empresa"); }
      if (rad.size) {
        const ref = new Set(radicais(o.itens.join(" ") + " " + o.condicoes.join(" ")));
        const comuns = Array.from(rad).filter(r => ref.has(r));
        if (comuns.length) { o.pontos += Math.min(2 * comuns.length, 6); o.motivos.push(`termos em comum com o item do anexo: ${comuns.slice(0, 4).join(", ")}`); }
        // Item mais estreito que o NCM (ex.: só "pão francês" dentro de 1905.90.90): exige termo específico
        // Só nos NCMs residuais ("Outros"), onde o anexo escolhe um produto específico dentro do código
        const folha = (this.base.ncm[ncm] || "").split(" › ").pop() || "";
        const esp = /^outr[oa]s\b/i.test(folha) ? this.termosEspecificos(o, ncm) : new Set<string>();
        const radArr = Array.from(rad);
        const batemEsp = radArr.filter(r => esp.has(r)).length;
        const todosNoItem = radArr.every(r => esp.has(r) || new Set(radicais(o.itens.join(" "))).has(r));
        if (esp.size >= 2 && batemEsp < 2 && !todosNoItem) {
          o.pontos -= 4;
          o.motivos.push(`o anexo só alcança parte do NCM: ${o.itens[0]?.slice(0, 90)}`);
          (o as any).estreito = true;
        }
      }
      // Exceções explícitas do anexo
      const exc = normalizar(o.excecoes.join(" "));
      if (ehPet && /domest|caes|gatos|pet/.test(exc)) { o.pontos -= 20; o.motivos.push("exceção do anexo: produto para animais domésticos"); }
      else if (exc && rad.size) {
        const radExc = radicais(o.excecoes.join(" ")).filter(r => r.length >= 4);
        const radItem = new Set(radicais(o.itens.join(" ")));
        const hit = radExc.filter(r => rad.has(r) && !radItem.has(r));
        if (hit.length) { o.pontos -= 6; o.motivos.push(`possível exceção do anexo (${hit.slice(0, 3).join(", ")})`); }
      }
    }
    opcoes.sort((a, b) => b.pontos - a.pontos || b.reducao - a.reducao);
  }

  /** Alerta quando a descrição aponta para uma família de produto fora dos capítulos NCM típicos dela. */
  private coerenciaNcm(ncm: string, descricao: string): Alerta | null {
    const dn = normalizar(descricao);
    if (!dn) return null;
    const cap = ncm.slice(0, 2);
    for (const fam of Object.keys(CAPITULOS)) {
      const fortes = acharTermos(dn, TERMOS[fam]).filter(x => x.peso >= 5);
      if (fortes.length && !CAPITULOS[fam].includes(cap)) {
        return { tipo: "aviso", texto: `A descrição indica ${fam.replace("_", " e ")} ("${fortes[0].termo}"), mas o NCM é do capítulo ${cap}. Confira se o NCM está correto.` };
      }
    }
    return null;
  }

  classificar(item: ItemEntrada, ctx: Contexto = {}, decisoes: DecisaoSalva[] = []): Resultado {
    const dest = ctx.destinatario || "geral";
    const perfil = ctx.perfil || "geral";
    const descricao = item.descricao || "";
    const { ncm, zeroCorrigido } = normalizarNcm(item.ncm);
    const alertas: Alerta[] = [];
    const vazio: Resultado = {
      entrada: item, ncm, ncmFormatado: ncm ? formatarNcm(ncm) : item.ncm, ncmDescricao: ncm ? this.descricaoNcm(ncm) : null,
      zeroCorrigido, situacao: "INVALIDO", cst: null, cClassTrib: null, nome: null, reducao: null, aliquota2026: null,
      baseLegal: "", motivo: "", opcoes: [], alertas, auditoria: null,
    };
    if (zeroCorrigido) alertas.push({ tipo: "aviso", texto: `Zero à esquerda completado (veio ${item.ncm}).` });

    const fechar = (r: Partial<Resultado> & { situacao: Situacao }): Resultado => {
      const res = { ...vazio, ...r };
      if (res.cClassTrib) {
        const info = this.base.classTrib[res.cClassTrib];
        res.cst = res.cst || info?.cst || res.cClassTrib.slice(0, 3);
        res.nome = res.nome || info?.nome || null;
        res.reducao = res.reducao ?? info?.redIbs ?? null;
        res.aliquota2026 = res.reducao !== null ? aliquota2026(res.reducao) : null;
        res.baseLegal = res.baseLegal || baseLegalDe(info, res.cClassTrib);
      }
      if (item.cClassTribNota !== undefined || item.cstNota !== undefined) res.auditoria = this.auditar(res, item);
      return res;
    };

    // 1. Operação
    const op = analisarOperacao(item.cfop || ctx.cfop);
    if (op && !op.tributavel) {
      return fechar({ situacao: "OPERACAO", cst: op.cst!, cClassTrib: op.cClassTrib!, baseLegal: op.baseLegal!, motivo: `CFOP ${op.cfop}: ${op.descricao}. O NCM não interfere.` });
    }
    if (op?.observacao) alertas.push({ tipo: "info", texto: `CFOP ${op.cfop} (${op.descricao}): ${op.observacao}` });

    // 2. NCM
    if (!ncm) return fechar({ situacao: "INVALIDO", motivo: "O NCM precisa ter 8 dígitos (com ou sem pontos)." });
    if (!this.base.ncm[ncm]) {
      return fechar({ situacao: "INEXISTENTE", motivo: `O NCM ${formatarNcm(ncm)} não existe na tabela NCM vigente. Corrija o cadastro do produto: a NF-e será rejeitada.` });
    }
    const coer = this.coerenciaNcm(ncm, descricao);
    if (coer) alertas.push(coer);

    // 3. Memória
    const chave = chaveProduto(descricao);
    const mem = decisoes.find(d => d.ncm === ncm && d.chave && d.chave === chave) || decisoes.find(d => d.ncm === ncm && !d.chave);
    const { opcoes: todas, vedados } = this.montarOpcoes(ncm);
    if (mem && this.base.classTrib[mem.cClassTrib]) {
      return fechar({ situacao: "MEMORIA", cClassTrib: mem.cClassTrib, opcoes: todas, motivo: `Decisão salva${mem.chave ? " para este produto" : " para este NCM"}${mem.justificativa ? `: ${mem.justificativa}` : ""}.` });
    }

    // 4. Regras dos anexos
    if (todas.length === 0) {
      const motivoV = vedados.length
        ? `O NCM é vedado em ${vedados.map(v => this.base.classTrib[v]?.anexo || v).join(", ")}. Tributação integral.`
        : "Não consta nos anexos de redução da LC 214/2025. Tributação integral.";
      return fechar({ situacao: "VERDE", cst: "000", cClassTrib: "000001", baseLegal: "Tributação integral (art. 4º e seguintes, LC 214/25)", motivo: motivoV });
    }

    // 5. Destinatário
    const motivosCtx: string[] = [];
    let opcoes = this.aplicarDestinatario(todas.map(o => ({ ...o, motivos: [] })), dest, motivosCtx);

    // 6. Descrição e perfil
    this.pontuar(opcoes, descricao, perfil, ncm);
    // Opções que caíram em exceção explícita saem; se todas caírem, é tributação integral
    const validas = opcoes.filter(o => o.pontos > -10);
    if (validas.length === 0) {
      return fechar({ situacao: "VERDE", cst: "000", cClassTrib: "000001", opcoes, baseLegal: "Tributação integral (exceção prevista no anexo)", motivo: `O produto cai na exceção do anexo (${opcoes[0].excecoes[0] || "produto excluído"}). Tributação integral.` });
    }
    opcoes = validas;

    const ctxTxt = motivosCtx.length ? ` (${motivosCtx.join("; ")})` : "";
    const estreito = (o: Opcao) => !!(o as any).estreito;
    const decisivo = (o: Opcao) => !!(o as any).decisivo;
    // Opções cujo item específico bate com a descrição vêm antes das "estreitas"
    opcoes.sort((x, y) => Number(estreito(x)) - Number(estreito(y)) || y.pontos - x.pontos || y.reducao - x.reducao);
    const largas = opcoes.filter(o => !estreito(o));

    // Todas as opções alcançam só produtos específicos do NCM e a descrição não é nenhum deles
    if (descricao && largas.length === 0) {
      const top = opcoes[0];
      const itensTxt = opcoes.map(o => `${o.anexo || o.cClassTrib}: ${o.itens[0]?.slice(0, 80)}`).join(" · ");
      if (decisivo(top) && (opcoes.length === 1 || top.pontos - opcoes[1].pontos >= 2)) {
        return fechar({ situacao: "AMARELO", cClassTrib: top.cClassTrib, opcoes,
          motivo: `A descrição indica ${top.anexo || top.cClassTrib}, mas o anexo só alcança: "${top.itens[0]?.slice(0, 140)}". Confira se o produto é esse; se não for, é tributação integral${ctxTxt}.` });
      }
      return fechar({ situacao: "AMARELO", cst: "000", cClassTrib: "000001", opcoes, baseLegal: "Tributação integral (produto fora dos itens específicos do anexo)",
        motivo: `Neste NCM os anexos só alcançam produtos específicos (${itensTxt}). A descrição não corresponde a nenhum deles: sugestão tributação integral. Confira${ctxTxt}.` });
    }
    if (largas.length === 1) {
      const o = largas[0];
      const confere = o.pontos >= 3 && !o.motivos.some(m => m.startsWith("possível exceção"));
      const unico = opcoes.length === 1;
      if (!unico && confere) {
        return fechar({ situacao: "AUTOMATICO", cClassTrib: o.cClassTrib, opcoes, motivo: `Escolhido entre ${opcoes.length} opções: ${o.motivos.join("; ")}${ctxTxt}.` });
      }
      return fechar({
        situacao: confere ? "CONFIRMADO" : "AMARELO", cClassTrib: o.cClassTrib, opcoes,
        motivo: confere
          ? `Único enquadramento e a descrição confere: ${o.motivos.join("; ")}${ctxTxt}.`
          : `${unico ? "Único enquadramento" : "Enquadramento mais provável"} (${o.anexo || o.cClassTrib}). Confira: ${o.condicoes[0] || o.itens[0] || "a condição do anexo"}${o.excecoes.length ? `. Exceções: ${o.excecoes[0]}` : ""}${ctxTxt}.`,
      });
    }
    const [a, b] = largas.length ? largas : opcoes;
    if (a.pontos >= 3 && a.pontos - b.pontos >= 2) {
      return fechar({ situacao: "AUTOMATICO", cClassTrib: a.cClassTrib, opcoes, motivo: `Escolhido entre ${opcoes.length} opções: ${a.motivos.join("; ")}${ctxTxt}.` });
    }
    return fechar({
      situacao: "VERMELHO", opcoes,
      motivo: `${opcoes.length} enquadramentos possíveis${ctxTxt}. ${descricao ? "A descrição não foi suficiente para decidir." : "Informe a descrição do produto para o sistema tentar decidir."}`,
    });
  }

  /** Confere o CST/cClassTrib informado na NF-e contra a base oficial e a sugestão. */
  auditar(r: Resultado, item: ItemEntrada): Resultado["auditoria"] {
    const cstNota = (item.cstNota || "").trim();
    const ctNota = (item.cClassTribNota || "").trim();
    const problemas: string[] = [];
    if (!ctNota && !cstNota) {
      problemas.push("Nota sem o grupo IBS/CBS (CST e cClassTrib).");
    } else {
      const info = this.base.classTrib[ctNota];
      if (!info) problemas.push(`cClassTrib ${ctNota || "(vazio)"} não existe na tabela oficial.`);
      else {
        if (cstNota && info.cst !== cstNota) problemas.push(`CST ${cstNota} incompatível com o cClassTrib ${ctNota} (exige CST ${info.cst}).`);
        if (!info.nfe && !info.nfce) problemas.push(`cClassTrib ${ctNota} não é permitido em NF-e/NFC-e.`);
        if (r.ncm && info.anexo) {
          const regras = this.base.regras[r.ncm] || [];
          if (regras.some(x => x[0] === ctNota && x[1] === 0)) problemas.push(`O NCM é vedado no ${info.anexo} (cClassTrib ${ctNota}).`);
          else if (!regras.some(x => x[0] === ctNota && x[1] === 1) && this.codigosComAnexo.has(ctNota)) {
            problemas.push(`O NCM não consta no ${info.anexo}: o cClassTrib ${ctNota} não se aplica a este produto.`);
          }
        }
      }
      const definitivo = ["OPERACAO", "MEMORIA", "AUTOMATICO", "CONFIRMADO", "VERDE"].includes(r.situacao);
      if (definitivo && r.cClassTrib && ctNota && r.cClassTrib !== ctNota) problemas.push(`Diverge da sugestão: o sistema indica ${r.cClassTrib}.`);
      if (r.situacao === "VERMELHO" && ctNota && !r.opcoes.some(o => o.cClassTrib === ctNota) && ctNota !== "000001") problemas.push("O código da nota não está entre os enquadramentos possíveis.");
    }
    if (r.situacao === "INEXISTENTE") problemas.push("NCM inexistente na tabela vigente.");
    return { cstNota, cClassTribNota: ctNota, ok: problemas.length === 0, problemas };
  }

  classificarLote(itens: ItemEntrada[], ctx: Contexto = {}, decisoes: DecisaoSalva[] = []): Resultado[] {
    return itens.map(i => this.classificar(i, ctx, decisoes));
  }
}

// ─── leitura de listas coladas / CSV ─────────────────────────────────────────

const RE_NCM = /(?<!\d)(?:\d{4}\.\d{2}\.\d{2}|\d{3}\.\d{2}\.\d{2}|\d{7,8})(?!\d)/;

/**
 * Lê uma lista colada do Excel ou um CSV. Aceita:
 *   - um NCM por linha, com ou sem descrição na mesma linha;
 *   - colunas separadas por tab ou ";" (código do produto, descrição, NCM, CFOP… em qualquer ordem).
 * Linhas de cabeçalho sem NCM são ignoradas.
 */
export function lerLista(texto: string, limite = 10000): ItemEntrada[] {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const itens: ItemEntrada[] = [];
  for (const linha of linhas) {
    if (itens.length >= limite) break;
    const sep = linha.includes("\t") ? "\t" : (linha.split(";").length > 2 ? ";" : null);
    if (sep) {
      const cols = linha.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
      const iNcm = cols.findIndex(c => RE_NCM.test(c) && c.replace(/[\d.\s]/g, "") === "");
      if (iNcm < 0) { if (itens.length === 0) continue; itens.push({ ncm: cols.join(" "), descricao: "" }); continue; }
      const resto = cols.map((c, i) => ({ c, i })).filter(x => x.i !== iNcm && x.c);
      const cfop = resto.find(x => /^\d{4}$/.test(x.c) && /^[1-7]/.test(x.c));
      const textos = resto.filter(x => x !== cfop && /[a-zA-ZÀ-ú]/.test(x.c));
      const desc = textos.sort((p, q) => q.c.length - p.c.length)[0];
      const cod = resto.find(x => x !== cfop && x !== desc && x.c.length <= 20);
      itens.push({ ncm: cols[iNcm], descricao: desc?.c || "", codigo: cod?.c, cfop: cfop?.c });
      continue;
    }
    const m = linha.match(RE_NCM);
    if (!m) { if (/[a-zA-Z]/.test(linha) && itens.length === 0) continue; itens.push({ ncm: linha, descricao: "" }); continue; }
    const descricao = linha.replace(m[0], " ").replace(/^[\s\-–:;,|]+|[\s\-–:;,|]+$/g, "").replace(/\s+/g, " ");
    itens.push({ ncm: m[0], descricao });
  }
  return itens;
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMULAÇÃO DE OPERAÇÃO — IBS/CBS/IS com destino, regime do vendedor e crédito
// ═══════════════════════════════════════════════════════════════════════════
import { cronogramaTransicao, type ResultadoReforma, type AliquotasReferencia } from "./reformaTributaria";

export type Destino = "mercado_interno" | "exportacao" | "zfm" | "orgao_publico";
export type RegimeVendedor = "regular" | "simples_das" | "simples_fora";
export type Adquirente = "contribuinte" | "consumidor_final";

export interface ParametrosSimulacao {
  valor: number;
  ano: number;
  destino: Destino;
  regimeVendedor: RegimeVendedor;
  adquirente: Adquirente;
  /** % de IBS+CBS embutido no DAS (Simples dentro do DAS) */
  aliquotaDasIbsCbs: number;
  /** premissa de alíquota do IS (%) */
  aliquotaIS: number;
  ref: AliquotasReferencia;
}

export interface ResultadoSimulacao {
  aplicavel: boolean;
  motivo?: string;
  cClassTrib: string;
  cst: string;
  observacoes: string[];
  aliquotaIbs: number;
  aliquotaCbs: number;
  valorIS: number;
  baseCalculo: number;
  valorIbs: number;
  valorCbs: number;
  totalTributos: number;
  creditoAdquirente: number;
  custoLiquidoAdquirente: number;
  comparativo: { regime: RegimeVendedor; label: string; tributos: number; credito: number; custoLiquido: number }[];
}

export const DESTINO_LABEL: Record<Destino, string> = {
  mercado_interno: "Mercado interno",
  exportacao: "Exportação",
  zfm: "Zona Franca de Manaus",
  orgao_publico: "Órgão da administração pública",
};
export const REGIME_LABEL: Record<RegimeVendedor, string> = {
  regular: "Regime regular (Presumido/Real)",
  simples_das: "Simples Nacional — IBS/CBS no DAS",
  simples_fora: "Simples Nacional — IBS/CBS fora do DAS",
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const ADM_PUBLICA = ["200005", "200008", "200010", "200011", "200043"];

export function simularOperacao(r: ResultadoReforma, p: ParametrosSimulacao): ResultadoSimulacao {
  const obs: string[] = [];
  let cClassTrib = r.regra.cClassTrib;
  let cst = r.regra.cst;
  let redIbs = r.regra.reducao;
  let redCbs = r.regra.reducaoCbs ?? r.regra.reducao;
  let tratamento = r.regra.tratamento;
  let isAplica = !!r.is && p.ano >= 2027 && p.aliquotaIS > 0;

  const vazio = (motivo: string): ResultadoSimulacao => ({
    aplicavel: false, motivo, cClassTrib, cst, observacoes: obs, aliquotaIbs: 0, aliquotaCbs: 0, valorIS: 0,
    baseCalculo: 0, valorIbs: 0, valorCbs: 0, totalTributos: 0, creditoAdquirente: 0, custoLiquidoAdquirente: 0, comparativo: [],
  });

  if (tratamento === "monofasico") return vazio("Combustíveis: tributação monofásica com alíquota ad rem (R$ por unidade) — não se aplica alíquota percentual.");
  if (tratamento === "especifico") return vazio("Regime específico: base de cálculo e alíquotas próprias do setor — use a apuração específica do regime.");

  // ── Destino ───────────────────────────────────────────────────────────────
  if (p.destino === "exportacao") {
    cClassTrib = r.tipo === "NCM" ? "410004" : "410027"; cst = "410"; tratamento = "imunidade";
    obs.push(r.tipo === "NCM"
      ? "Exportação de bens: não incidência de IBS/CBS com manutenção dos créditos (LC 214/2025, art. 8º). Venda a comercial exportadora pode usar suspensão (550001)."
      : "Exportação de serviço: não incidência (LC 214/2025, art. 80) — exige consumo/fruição no exterior.");
    if (isAplica && r.is?.categoria !== "Bens minerais") { isAplica = false; obs.push("IS não incide sobre exportações."); }
    else if (isAplica) obs.push("IS incide sobre bens minerais extraídos mesmo quando exportados.");
  } else if (p.destino === "zfm") {
    if (r.tipo === "NCM") {
      cClassTrib = "200022"; cst = "200"; redIbs = 100; redCbs = 100; tratamento = "reducao_100";
      obs.push("Venda de bem material industrializado de origem fora da ZFM a contribuinte estabelecido na ZFM: alíquotas reduzidas a zero (LC 214/2025, art. 445). Confira as exclusões legais (armas e munições, fumo, bebidas alcoólicas, automóveis de passageiros e perfumaria, entre outras).");
    } else {
      obs.push("Serviços prestados a contribuinte da ZFM não têm redução específica — tributação conforme o enquadramento do serviço.");
    }
  } else if (p.destino === "orgao_publico") {
    const alt = (r.regra.alternativas || []).find(a => ADM_PUBLICA.includes(a.cClassTrib));
    if (alt) {
      cClassTrib = alt.cClassTrib; cst = "200";
      redIbs = alt.cClassTrib === "200043" ? 60 : 100; redCbs = redIbs; tratamento = redIbs === 100 ? "reducao_100" : "reducao_60";
      obs.push(`Fornecimento à administração pública com tratamento próprio: cClassTrib ${alt.cClassTrib}.`);
    }
    obs.push("Compras governamentais: a receita de IBS/CBS é destinada integralmente ao ente contratante, com redutor de alíquota (EC 132/2023, art. 149-C). O percentual do redutor não está incluído nesta simulação.");
  }

  // ── Alíquotas do ano ──────────────────────────────────────────────────────
  const linha = cronogramaTransicao(redIbs, tratamento, r.tipo, p.ref, redCbs).find(l => l.ano === p.ano)
    || cronogramaTransicao(redIbs, tratamento, r.tipo, p.ref, redCbs).at(-1)!;
  const valorIS = isAplica ? r2(p.valor * p.aliquotaIS / 100) : 0;
  if (isAplica) obs.push(`Imposto Seletivo estimado em ${p.aliquotaIS}% (premissa). O IS integra a base de cálculo do IBS/CBS e não gera crédito.`);
  else if (r.is && p.ano < 2027) obs.push("Imposto Seletivo só passa a incidir em 2027.");
  const baseCalculo = r2(p.valor + valorIS);

  const calcular = (regime: RegimeVendedor) => {
    let ibs = r2(baseCalculo * linha.ibs / 100);
    let cbs = r2(baseCalculo * linha.cbs / 100);
    if (regime === "simples_das" && p.destino !== "exportacao") {
      // No DAS, IBS/CBS seguem as tabelas da LC 123 — informado pelo usuário
      const tot = r2(p.valor * p.aliquotaDasIbsCbs / 100);
      const prop = linha.total > 0 ? linha.ibs / linha.total : 0.5;
      ibs = r2(tot * prop); cbs = r2(tot - ibs);
    }
    const tributos = r2(ibs + cbs + valorIS);
    const credito = p.adquirente === "contribuinte" ? r2(ibs + cbs) : 0;
    return { ibs, cbs, tributos, credito, custoLiquido: r2(p.valor + tributos - credito) };
  };

  const atual = calcular(p.regimeVendedor);
  if (p.regimeVendedor === "simples_das") obs.push("Simples no DAS: o adquirente se credita apenas do IBS/CBS efetivamente recolhido no DAS (LC 214/2025 c/c LC 123/2006).");
  if (p.adquirente === "consumidor_final") obs.push("Consumidor final não apropria crédito: o IBS/CBS é custo integral.");
  if (p.ano === 2026) obs.push("2026 é ano-teste: IBS/CBS destacados são compensáveis com PIS/Cofins (ou dispensados), sem efeito financeiro líquido.");

  return {
    aplicavel: true, cClassTrib, cst, observacoes: obs,
    aliquotaIbs: linha.ibs, aliquotaCbs: linha.cbs, valorIS, baseCalculo,
    valorIbs: atual.ibs, valorCbs: atual.cbs, totalTributos: atual.tributos,
    creditoAdquirente: atual.credito, custoLiquidoAdquirente: atual.custoLiquido,
    comparativo: (["regular", "simples_fora", "simples_das"] as RegimeVendedor[]).map(reg => {
      const c = calcular(reg);
      return { regime: reg, label: REGIME_LABEL[reg], tributos: c.tributos, credito: c.credito, custoLiquido: c.custoLiquido };
    }),
  };
}

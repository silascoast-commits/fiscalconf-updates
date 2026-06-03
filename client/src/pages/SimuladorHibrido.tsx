import { useState, useMemo } from "react";
import { useCliente } from "@/contexts/ClienteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2, XCircle, AlertTriangle, Info, TrendingDown, TrendingUp,
  ArrowRightLeft, Building2, ShoppingCart, Users, BadgePercent, Scale,
  ChevronDown, ChevronUp, Lightbulb, FileText, DollarSign,
} from "lucide-react";

// ─── TABELAS DO SIMPLES NACIONAL (pós-reforma 2033) ──────────────────────────
// Estrutura: alíquotas mantidas; IBS substitui ICMS/ISS; CBS substitui PIS/COFINS
// Fonte: LC 123/2006 (Res. CGSN 140/2018) + LC 214/2025 (arts. 140-152)
// pctIbsDas = fração do DAS total que corresponde ao IBS (ex-ICMS ou ex-ISS)
// pctCbsDas = fração do DAS total que corresponde à CBS (ex-PIS/COFINS)

interface FaixaSN {
  rbt12Max: number;
  aliq: number;       // alíquota nominal (%)
  deducao: number;    // parcela dedutível (R$)
}

interface AnexoConfig {
  nome: string;
  descricao: string;
  exemplos: string;
  pctIbsDas: number;
  pctCbsDas: number;
  faixas: FaixaSN[];
}

const ANEXOS: Record<string, AnexoConfig> = {
  I: {
    nome: "Anexo I — Comércio",
    descricao: "Revenda de mercadorias",
    exemplos: "Supermercado, farmácia, loja de roupas, material de construção",
    pctIbsDas: 0.3400,  // ICMS → IBS: ~34% do DAS
    pctCbsDas: 0.1560,  // PIS+COFINS → CBS: ~15,6% do DAS
    faixas: [
      { rbt12Max:  180_000, aliq:  4.00, deducao:       0 },
      { rbt12Max:  360_000, aliq:  7.30, deducao:   5_940 },
      { rbt12Max:  720_000, aliq:  9.50, deducao:  13_860 },
      { rbt12Max: 1_800_000, aliq: 10.70, deducao:  22_500 },
      { rbt12Max: 3_600_000, aliq: 14.30, deducao:  87_300 },
      { rbt12Max: 4_800_000, aliq: 19.00, deducao: 378_000 },
    ],
  },
  II: {
    nome: "Anexo II — Indústria",
    descricao: "Fabricação e transformação de produtos",
    exemplos: "Confecção, alimentos, móveis, embalagens, calçados",
    pctIbsDas: 0.3400,
    pctCbsDas: 0.1560,
    faixas: [
      { rbt12Max:  180_000, aliq:  4.50, deducao:       0 },
      { rbt12Max:  360_000, aliq:  7.80, deducao:   5_940 },
      { rbt12Max:  720_000, aliq: 10.00, deducao:  13_860 },
      { rbt12Max: 1_800_000, aliq: 11.20, deducao:  22_500 },
      { rbt12Max: 3_600_000, aliq: 14.70, deducao:  85_500 },
      { rbt12Max: 4_800_000, aliq: 30.00, deducao: 720_000 },
    ],
  },
  III: {
    nome: "Anexo III — Serviços (grupo A)",
    descricao: "Serviços com ISS embutido no DAS",
    exemplos: "Instalação, reparos, manutenção, agências de turismo, academias",
    pctIbsDas: 0.3350,  // ISS → IBS: ~33,5% do DAS
    pctCbsDas: 0.1560,
    faixas: [
      { rbt12Max:  180_000, aliq:  6.00, deducao:       0 },
      { rbt12Max:  360_000, aliq: 11.20, deducao:   9_360 },
      { rbt12Max:  720_000, aliq: 13.50, deducao:  17_640 },
      { rbt12Max: 1_800_000, aliq: 16.00, deducao:  35_640 },
      { rbt12Max: 3_600_000, aliq: 21.00, deducao: 125_640 },
      { rbt12Max: 4_800_000, aliq: 33.00, deducao: 648_000 },
    ],
  },
  IV: {
    nome: "Anexo IV — Serviços (grupo B)",
    descricao: "Serviços sem CPP no DAS (recolhido à parte)",
    exemplos: "Construção civil, limpeza, vigilância, advocacia, saúde",
    pctIbsDas: 0.4450,  // ISS proporcionalmente maior por não ter CPP
    pctCbsDas: 0.2150,
    faixas: [
      { rbt12Max:  180_000, aliq:  4.50, deducao:       0 },
      { rbt12Max:  360_000, aliq:  9.00, deducao:   8_100 },
      { rbt12Max:  720_000, aliq: 10.20, deducao:  12_420 },
      { rbt12Max: 1_800_000, aliq: 14.00, deducao:  39_780 },
      { rbt12Max: 3_600_000, aliq: 22.00, deducao: 183_780 },
      { rbt12Max: 4_800_000, aliq: 33.00, deducao: 828_000 },
    ],
  },
  V: {
    nome: "Anexo V — Serviços (grupo C / fator r)",
    descricao: "Serviços intelectuais — alíquota depende da folha/receita",
    exemplos: "TI, engenharia, auditoria, publicidade, medicina, arquitetura",
    pctIbsDas: 0.3000,
    pctCbsDas: 0.1280,
    faixas: [
      { rbt12Max:  180_000, aliq: 15.50, deducao:       0 },
      { rbt12Max:  360_000, aliq: 18.00, deducao:   4_500 },
      { rbt12Max:  720_000, aliq: 19.50, deducao:   9_900 },
      { rbt12Max: 1_800_000, aliq: 20.50, deducao:  17_100 },
      { rbt12Max: 3_600_000, aliq: 23.00, deducao:  62_100 },
      { rbt12Max: 4_800_000, aliq: 30.50, deducao: 540_000 },
    ],
  },
};

// Alíquotas plenas do IVA Dual (2033) — alíquotas de referência
// IBS pleno = 17,7% (estados + municípios) | CBS plena = 8,8% (federal)
// Fontes: EC 132/2023, LC 214/2025 — valores de referência (Senado fixará definitivos)
const IBS_PLENO = 17.7;
const CBS_PLENO = 8.8;

// ─── CÁLCULO DA ALÍQUOTA EFETIVA SN ─────────────────────────────────────────
function calcAliqEfetivaSN(rbt12: number, faixas: FaixaSN[]) {
  for (let i = 0; i < faixas.length; i++) {
    if (rbt12 <= faixas[i].rbt12Max) {
      const aliqEfetiva =
        rbt12 > 0
          ? Math.max(0, ((rbt12 * faixas[i].aliq) / 100 - faixas[i].deducao) / rbt12 * 100)
          : faixas[i].aliq;
      return { aliqEfetiva, faixa: i + 1, aliqNominal: faixas[i].aliq };
    }
  }
  return { aliqEfetiva: 0, faixa: 7, aliqNominal: 0 }; // fora do SN
}

// ─── MOTOR DE CÁLCULO PRINCIPAL ──────────────────────────────────────────────
function calcSimulacao(p: {
  faturamentoMensal: number;
  rbt12: number;
  anexo: string;
  comprasMensais: number;
  pctComprasLPLR: number; // % compras com crédito pleno (LP/LR)
  pctVendasB2B: number;   // % vendas para pessoas jurídicas
}) {
  const config = ANEXOS[p.anexo];
  if (!config || p.faturamentoMensal <= 0) return null;

  const { aliqEfetiva, faixa, aliqNominal } = calcAliqEfetivaSN(p.rbt12, config.faixas);

  // ── SIMPLES NACIONAL PADRÃO (SN) ────────────────────────────────────────────
  // DAS total — sem crédito de entradas (tributação sobre receita bruta)
  const dasTotalMensal = p.faturamentoMensal * (aliqEfetiva / 100);

  // Parcelas de IBS e CBS embutidas no DAS
  const ibsNoDas   = dasTotalMensal * config.pctIbsDas;
  const cbsNoDas   = dasTotalMensal * config.pctCbsDas;
  const ibsCbsNoDas = ibsNoDas + cbsNoDas;

  // Alíquota efetiva de IBS/CBS que o cliente pode creditar (proporcional ao DAS)
  // Comprador do regime pleno (LP/LR) credita exatamente IBS/CBS embutido no DAS
  const aliqCreditoClienteSN = p.faturamentoMensal > 0
    ? (ibsCbsNoDas / p.faturamentoMensal) * 100 : 0;

  const creditoClienteSN = p.faturamentoMensal * (p.pctVendasB2B / 100) * (aliqCreditoClienteSN / 100);

  const cargaSN_mensal = dasTotalMensal;
  const cargaSN_pct    = aliqEfetiva;

  // ── SISTEMA HÍBRIDO ──────────────────────────────────────────────────────────
  // DAS reduzido = apenas IRPJ + CSLL + CPP (IBS e CBS saem do DAS)
  const pctDasReduzido   = Math.max(0, 1 - config.pctIbsDas - config.pctCbsDas);
  const dasReduzidoMensal = dasTotalMensal * pctDasReduzido;
  const aliqDasReduzido   = aliqEfetiva * pctDasReduzido;

  // IBS e CBS apurados separadamente (alíquotas plenas nas saídas)
  const ibsSaidaMensal = p.faturamentoMensal * (IBS_PLENO / 100);
  const cbsSaidaMensal = p.faturamentoMensal * (CBS_PLENO / 100);

  // Créditos das entradas:
  //   — Fornecedores LP/LR: crédito pleno (IBS pleno + CBS plena)
  //   — Fornecedores SN: crédito proporcional ≈ 15% (Art. 144, LC 214/2025)
  const comprasLPLR = p.comprasMensais * (p.pctComprasLPLR / 100);
  const comprasSN   = p.comprasMensais * ((100 - p.pctComprasLPLR) / 100);

  const creditoIbsEntradas = comprasLPLR * (IBS_PLENO / 100) + comprasSN * (IBS_PLENO / 100) * 0.15;
  const creditoCbsEntradas = comprasLPLR * (CBS_PLENO / 100) + comprasSN * (CBS_PLENO / 100) * 0.15;
  const creditoEntradasTotal = creditoIbsEntradas + creditoCbsEntradas;

  // IBS/CBS líquido (débito - crédito); não pode ser negativo neste modelo
  const ibsCbsLiquido = Math.max(0, ibsSaidaMensal + cbsSaidaMensal - creditoEntradasTotal);

  const cargaHibrido_mensal = dasReduzidoMensal + ibsCbsLiquido;
  const cargaHibrido_pct    = (cargaHibrido_mensal / p.faturamentoMensal) * 100;

  // Crédito gerado para clientes no híbrido = IBS pleno + CBS plena = 26,5%
  const aliqCreditoClienteHibrido = IBS_PLENO + CBS_PLENO; // 26.5%
  const creditoClienteHibrido = p.faturamentoMensal * (p.pctVendasB2B / 100) * (aliqCreditoClienteHibrido / 100);

  // ── ANÁLISE COMPARATIVA ───────────────────────────────────────────────────────
  // Custo extra do híbrido para a empresa
  const diferencaCarga       = cargaHibrido_mensal - cargaSN_mensal;
  // Benefício extra gerado para clientes B2B
  const beneficioClientesExtra = creditoClienteHibrido - creditoClienteSN;
  // Saldo líquido econômico: quanto o ecossistema ganha no híbrido
  const saldoLiquido = beneficioClientesExtra - diferencaCarga;

  // Índice de competitividade: se a empresa puder repassar o custo extra como
  // redução de preço, ainda assim geraria mais crédito ao cliente?
  const fatorCompetitividade = diferencaCarga > 0
    ? (beneficioClientesExtra / diferencaCarga) : 99;

  // ── RECOMENDAÇÃO ─────────────────────────────────────────────────────────────
  let recomendacao: "hibrido" | "simples" | "analisar";
  let justificativa: string;
  let nivel: "forte" | "moderado" | "fraco";

  const ibsCbsHibridoRatio = (ibsCbsLiquido / p.faturamentoMensal) * 100;
  const ibsCbsSNRatio = (ibsCbsNoDas / p.faturamentoMensal) * 100;

  if (p.pctVendasB2B < 20) {
    recomendacao = "simples";
    nivel = "forte";
    justificativa =
      `Apenas ${p.pctVendasB2B}% das vendas são para empresas (B2B). ` +
      "O benefício do crédito pleno é irrelevante para clientes pessoa física. " +
      "O híbrido encareceria a carga tributária sem contrapartida comercial. " +
      "Permanecer no Simples Nacional padrão é claramente a melhor opção.";
  } else if (diferencaCarga <= 0) {
    recomendacao = "hibrido";
    nivel = "forte";
    justificativa =
      "O sistema híbrido apresenta carga tributária igual ou MENOR que o Simples Nacional padrão, " +
      "com a vantagem adicional de gerar créditos plenos (26,5%) para os seus clientes empresariais. " +
      "A opção pelo híbrido é vantajosa em todos os aspectos.";
  } else if (fatorCompetitividade >= 2.0 && p.pctVendasB2B >= 60) {
    recomendacao = "hibrido";
    nivel = "forte";
    justificativa =
      `Com ${p.pctVendasB2B}% de vendas B2B e um fator de competitividade de ${fatorCompetitividade.toFixed(1)}x, ` +
      "os clientes ganham muito mais em crédito do que a empresa paga de custo extra. " +
      "A opção pelo híbrido fortalece sua posição competitiva no mercado B2B e justifica " +
      "uma eventual negociação de preço com os compradores.";
  } else if (fatorCompetitividade >= 1.5 && p.pctVendasB2B >= 40) {
    recomendacao = "hibrido";
    nivel = "moderado";
    justificativa =
      "O benefício de crédito para clientes B2B supera o custo extra do híbrido. " +
      "Recomenda-se avaliar a migração, especialmente se seus clientes são empresas do regime " +
      "pleno (LP/LR) que sofrerão com a baixa geração de crédito no SN padrão. " +
      "Simule com seu cliente o impacto do crédito pleno no custo efetivo de aquisição.";
  } else if (diferencaCarga > 0 && fatorCompetitividade < 1.0) {
    recomendacao = "simples";
    nivel = "forte";
    justificativa =
      "O custo extra do híbrido supera o benefício gerado para os clientes. " +
      "Permanecer no Simples Nacional padrão é financeiramente mais vantajoso. " +
      "Reavalie se o perfil de clientes mudar (mais B2B) ou se a margem aumentar.";
  } else {
    recomendacao = "analisar";
    nivel = "moderado";
    justificativa =
      "O resultado é equilibrado. A decisão depende do perfil dos seus clientes: " +
      "se a maioria é empresa do regime pleno (LP/LR) com alta necessidade de crédito, " +
      "o híbrido pode ser estrategicamente vantajoso mesmo com custo ligeiramente maior. " +
      "Consulte seus principais clientes antes de decidir.";
  }

  return {
    // SN
    aliqEfetiva, aliqNominal, faixa,
    dasTotalMensal,
    ibsNoDas, cbsNoDas, ibsCbsNoDas,
    aliqCreditoClienteSN, creditoClienteSN,
    cargaSN_mensal, cargaSN_pct,
    // Híbrido
    dasReduzidoMensal, aliqDasReduzido,
    ibsSaidaMensal, cbsSaidaMensal,
    creditoIbsEntradas, creditoCbsEntradas, creditoEntradasTotal,
    ibsCbsLiquido,
    cargaHibrido_mensal, cargaHibrido_pct,
    aliqCreditoClienteHibrido, creditoClienteHibrido,
    // Comparativo
    diferencaCarga,
    beneficioClientesExtra,
    saldoLiquido,
    fatorCompetitividade,
    recomendacao,
    justificativa,
    nivel,
    // auxiliares
    ibsCbsHibridoRatio,
    ibsCbsSNRatio,
    config,
  };
}

// ─── FORMATADORES ────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${v.toFixed(2)}%`;
const fmtPct1 = (v: number) => `${v.toFixed(1)}%`;

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function SimuladorHibrido() {
  const { clienteAtivo } = useCliente();

  // ── Inputs ──
  const [faturamento, setFaturamento]     = useState("100000");
  const [rbt12Str,    setRbt12Str]        = useState("");
  const [anexo,       setAnexo]           = useState("I");
  const [compras,     setCompras]         = useState("60000");
  const [pctLPLR,     setPctLPLR]         = useState("70");
  const [pctB2B,      setPctB2B]          = useState("80");
  const [detalhes,    setDetalhes]        = useState(false);

  // Preenche faturamento via cliente ativo
  // (sem useEffect explícito para manter o componente simples)

  const fat    = parseFloat(faturamento.replace(/[^0-9,.]/g, "").replace(",", ".")) || 0;
  const rbt12  = rbt12Str
    ? parseFloat(rbt12Str.replace(/[^0-9,.]/g, "").replace(",", ".")) || fat * 12
    : fat * 12;
  const comp   = parseFloat(compras.replace(/[^0-9,.]/g, "").replace(",", ".")) || 0;

  const sim = useMemo(() => calcSimulacao({
    faturamentoMensal: fat,
    rbt12,
    anexo,
    comprasMensais: comp,
    pctComprasLPLR: parseFloat(pctLPLR) || 0,
    pctVendasB2B:   parseFloat(pctB2B)  || 0,
  }), [fat, rbt12, anexo, comp, pctLPLR, pctB2B]);

  const config = ANEXOS[anexo];

  // ── Cores da recomendação ──
  const recCores = {
    hibrido: {
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-400 dark:border-emerald-600",
      title: "text-emerald-800 dark:text-emerald-200",
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />,
      label: "Optar pelo Sistema Híbrido",
    },
    simples: {
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-400 dark:border-blue-600",
      title: "text-blue-800 dark:text-blue-200",
      badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
      icon: <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />,
      label: "Permanecer no Simples Nacional",
    },
    analisar: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-400 dark:border-amber-600",
      title: "text-amber-800 dark:text-amber-200",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
      icon: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />,
      label: "Análise Caso a Caso Recomendada",
    },
  };

  return (
    <div className="space-y-6">

      {/* ─── CABEÇALHO ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">Simulador Híbrido SN × Regime Híbrido</h1>
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-[10px]">
            LC 214/2025 — Art. 140–152
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Analisa se o cliente do <strong>Simples Nacional</strong> deve optar pelo{" "}
          <strong>Sistema Híbrido</strong> — apurando IBS e CBS fora do DAS com crédito pleno —
          ou permanecer no modelo padrão. Projeção baseada nas alíquotas de referência para
          o regime maduro (<strong>2033</strong>).
        </p>
      </div>

      {/* Banner cliente */}
      {clienteAtivo && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium">{clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial}</span>
          <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">SN</Badge>
          {clienteAtivo.anexo && (
            <span className="text-xs text-muted-foreground">Anexo {clienteAtivo.anexo}</span>
          )}
        </div>
      )}

      {/* ─── EXPLICAÇÃO RÁPIDA ───────────────────────────────────────────── */}
      <Alert className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10">
        <Info className="h-4 w-4 text-purple-600" />
        <AlertDescription className="text-purple-900 dark:text-purple-200 text-xs space-y-1">
          <p><strong>O que é o Sistema Híbrido?</strong> Pela LC 214/2025 (Art. 144), o optante do Simples Nacional pode segregar IBS e CBS do DAS,
          recolhendo-os separadamente com <em>não-cumulatividade plena</em>. O resultado: seus clientes empresariais (LP/LR)
          passam a ter crédito de <strong>26,5%</strong> sobre as compras (IBS 17,7% + CBS 8,8%), em vez do crédito proporcional
          reduzido que o SN padrão gera.</p>
          <p className="text-purple-700 dark:text-purple-400">
            <strong>Pergunta central:</strong> O benefício competitivo (crédito extra para seus clientes) compensa o custo tributário adicional do híbrido?
          </p>
        </AlertDescription>
      </Alert>

      {/* ─── PARÂMETROS ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Parâmetros da Empresa
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Preencha com os dados do cliente do Simples Nacional
          </p>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Linha 1: Faturamento + RBT12 + Anexo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Faturamento Mensal (R$)</Label>
              <Input
                value={faturamento}
                onChange={e => setFaturamento(e.target.value.replace(/[^0-9.,]/g, ""))}
                className="codigo-fiscal"
                placeholder="100.000"
              />
              <p className="text-[10px] text-muted-foreground">Receita bruta média mensal</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RBT12 (12 meses acumulados, R$)</Label>
              <Input
                value={rbt12Str}
                onChange={e => setRbt12Str(e.target.value.replace(/[^0-9.,]/g, ""))}
                className="codigo-fiscal"
                placeholder={`≈ ${fmtBRL(fat * 12)}`}
              />
              <p className="text-[10px] text-muted-foreground">Determina a faixa e alíquota do DAS. Vazio = mensal × 12.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Anexo do Simples Nacional</Label>
              <select
                value={anexo}
                onChange={e => setAnexo(e.target.value)}
                className="w-full text-sm border rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(ANEXOS).map(([k, v]) => (
                  <option key={k} value={k}>{v.nome}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">{config?.exemplos}</p>
            </div>
          </div>

          <Separator />

          {/* Linha 2: Compras + % LP/LR + % B2B */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                Compras / Entradas Mensais (R$)
              </Label>
              <Input
                value={compras}
                onChange={e => setCompras(e.target.value.replace(/[^0-9.,]/g, ""))}
                className="codigo-fiscal"
                placeholder="60.000"
              />
              <p className="text-[10px] text-muted-foreground">
                Mercadorias, insumos e serviços tomados com IBS/CBS
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                % Compras de Fornecedores LP/LR
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={pctLPLR}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "" || (parseFloat(v) >= 0 && parseFloat(v) <= 100)) setPctLPLR(v);
                  }}
                  type="number" min="0" max="100" step="5"
                  className="codigo-fiscal"
                />
                <span className="text-sm text-muted-foreground shrink-0">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Fornecedor LP/LR → crédito pleno. SN → crédito proporcional (~15%)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                % Vendas para Empresas (B2B)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={pctB2B}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "" || (parseFloat(v) >= 0 && parseFloat(v) <= 100)) setPctB2B(v);
                  }}
                  type="number" min="0" max="100" step="5"
                  className="codigo-fiscal"
                />
                <span className="text-sm text-muted-foreground shrink-0">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Apenas B2B se beneficia do crédito pleno. B2C (PF) não utiliza créditos.
              </p>
            </div>
          </div>

        </CardContent>
      </Card>

      {sim && (
        <>
          {/* ─── RESULTADO PRINCIPAL: COMPARATIVO ────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Simples Nacional */}
            <Card className={`border-2 ${sim.recomendacao === "simples" ? "border-blue-400 dark:border-blue-600" : "border-border"}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Scale className="h-4 w-4 text-blue-600" />
                    Simples Nacional Padrão
                  </CardTitle>
                  {sim.recomendacao === "simples" && (
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 text-[10px]">
                      RECOMENDADO
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">DAS único — IBS/CBS embarcados</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Alíquota */}
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    Alíquota Efetiva DAS — {sim.config.nome} — Faixa {sim.faixa}
                  </div>
                  <div className="text-3xl font-bold codigo-fiscal text-blue-700 dark:text-blue-400">
                    {fmtPct(sim.aliqEfetiva)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Nominal: {fmtPct(sim.aliqNominal)} · RBT12: {fmtBRL(rbt12)}
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">DAS Total Mensal</span>
                    <span className="font-semibold codigo-fiscal">{fmtBRL(sim.dasTotalMensal)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-blue-700 dark:text-blue-400">
                    <span>↳ IBS embutido no DAS ({fmtPct1(sim.config.pctIbsDas * 100)} do DAS)</span>
                    <span className="codigo-fiscal">{fmtBRL(sim.ibsNoDas)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-blue-700 dark:text-blue-400">
                    <span>↳ CBS embutida no DAS ({fmtPct1(sim.config.pctCbsDas * 100)} do DAS)</span>
                    <span className="codigo-fiscal">{fmtBRL(sim.cbsNoDas)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-t font-semibold">
                    <span>Carga tributária mensal</span>
                    <span className="codigo-fiscal text-base">{fmtBRL(sim.cargaSN_mensal)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground">
                    <span>Carga anual estimada</span>
                    <span className="codigo-fiscal">{fmtBRL(sim.cargaSN_mensal * 12)}</span>
                  </div>
                </div>

                {/* Crédito para clientes */}
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-2.5 text-xs">
                  <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1 flex items-center gap-1">
                    <BadgePercent className="h-3.5 w-3.5" />
                    Crédito gerado para clientes B2B
                  </p>
                  <div className="flex justify-between">
                    <span className="text-amber-700 dark:text-amber-400">Alíquota de crédito</span>
                    <span className="font-semibold codigo-fiscal text-amber-800 dark:text-amber-300">
                      {fmtPct(sim.aliqCreditoClienteSN)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700 dark:text-amber-400">Crédito mensal p/ clientes ({parseFloat(pctB2B)}% B2B)</span>
                    <span className="font-semibold codigo-fiscal text-amber-800 dark:text-amber-300">
                      {fmtBRL(sim.creditoClienteSN)}
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">
                    Proporcional ao DAS — regra do Art. 144, LC 214/2025
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Sistema Híbrido */}
            <Card className={`border-2 ${sim.recomendacao === "hibrido" ? "border-emerald-400 dark:border-emerald-600" : "border-border"}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
                    Sistema Híbrido (IBS/CBS fora do DAS)
                  </CardTitle>
                  {sim.recomendacao === "hibrido" && (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 text-[10px]">
                      RECOMENDADO
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">DAS reduzido + IBS/CBS com crédito pleno</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Alíquota */}
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    Carga Efetiva Total (DAS Reduzido + IBS/CBS Líquido)
                  </div>
                  <div className={`text-3xl font-bold codigo-fiscal ${sim.cargaHibrido_pct < sim.cargaSN_pct ? "text-emerald-700 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
                    {fmtPct(sim.cargaHibrido_pct)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sim.cargaHibrido_pct < sim.cargaSN_pct
                      ? `−${fmtPct(sim.cargaSN_pct - sim.cargaHibrido_pct)} vs SN padrão`
                      : `+${fmtPct(sim.cargaHibrido_pct - sim.cargaSN_pct)} vs SN padrão`}
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">DAS Reduzido (sem IBS/CBS)</span>
                    <span className="codigo-fiscal">{fmtBRL(sim.dasReduzidoMensal)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">IBS saídas ({fmtPct1(IBS_PLENO)})</span>
                    <span className="codigo-fiscal">{fmtBRL(sim.ibsSaidaMensal)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">CBS saídas ({fmtPct1(CBS_PLENO)})</span>
                    <span className="codigo-fiscal">{fmtBRL(sim.cbsSaidaMensal)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-emerald-600 dark:text-emerald-400">
                    <span>− Crédito IBS entradas</span>
                    <span className="codigo-fiscal">−{fmtBRL(sim.creditoIbsEntradas)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-emerald-600 dark:text-emerald-400">
                    <span>− Crédito CBS entradas</span>
                    <span className="codigo-fiscal">−{fmtBRL(sim.creditoCbsEntradas)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-t font-semibold">
                    <span>Carga tributária mensal</span>
                    <span className={`codigo-fiscal text-base ${sim.cargaHibrido_mensal > sim.cargaSN_mensal ? "text-orange-600" : "text-emerald-700 dark:text-emerald-400"}`}>
                      {fmtBRL(sim.cargaHibrido_mensal)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground">
                    <span>Carga anual estimada</span>
                    <span className="codigo-fiscal">{fmtBRL(sim.cargaHibrido_mensal * 12)}</span>
                  </div>
                </div>

                {/* Crédito para clientes */}
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-2.5 text-xs">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1">
                    <BadgePercent className="h-3.5 w-3.5" />
                    Crédito gerado para clientes B2B
                  </p>
                  <div className="flex justify-between">
                    <span className="text-emerald-700 dark:text-emerald-400">Alíquota de crédito</span>
                    <span className="font-semibold codigo-fiscal text-emerald-800 dark:text-emerald-300">
                      {fmtPct(sim.aliqCreditoClienteHibrido)} <span className="text-[10px] font-normal">(IBS+CBS plenos)</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-700 dark:text-emerald-400">Crédito mensal p/ clientes ({parseFloat(pctB2B)}% B2B)</span>
                    <span className="font-semibold codigo-fiscal text-emerald-800 dark:text-emerald-300">
                      {fmtBRL(sim.creditoClienteHibrido)}
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-1">
                    Crédito integral IBS (17,7%) + CBS (8,8%) — LC 214/2025
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── PAINEL COMPARATIVO ───────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                Análise Comparativa — Resumo Financeiro Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  {
                    label: "Diferença de Carga",
                    valor: sim.diferencaCarga,
                    subLabel: sim.diferencaCarga > 0 ? "Híbrido é mais caro" : "Híbrido é mais barato",
                    cor: sim.diferencaCarga > 0 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400",
                    bgCor: sim.diferencaCarga > 0 ? "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800" : "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800",
                    sinal: sim.diferencaCarga > 0 ? "+" : "",
                  },
                  {
                    label: "Crédito Extra p/ Clientes",
                    valor: sim.beneficioClientesExtra,
                    subLabel: "Por mês (vendas B2B)",
                    cor: "text-emerald-600 dark:text-emerald-400",
                    bgCor: "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800",
                    sinal: "+",
                  },
                  {
                    label: "Saldo Líquido Econômico",
                    valor: sim.saldoLiquido,
                    subLabel: "Benefício extra − custo extra",
                    cor: sim.saldoLiquido >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                    bgCor: sim.saldoLiquido >= 0 ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800",
                    sinal: sim.saldoLiquido > 0 ? "+" : "",
                  },
                  {
                    label: "Fator de Competitividade",
                    valor: null,
                    custom: (
                      <span className={`text-3xl font-bold codigo-fiscal ${sim.fatorCompetitividade >= 1.5 ? "text-emerald-700 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
                        {sim.fatorCompetitividade > 50 ? "∞" : `${sim.fatorCompetitividade.toFixed(1)}×`}
                      </span>
                    ),
                    subLabel: "Benefício/Custo — acima de 1,5× recomenda híbrido",
                    cor: "",
                    bgCor: sim.fatorCompetitividade >= 1.5 ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800",
                    sinal: "",
                  },
                ].map((item, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${item.bgCor}`}>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">{item.label}</div>
                    {item.custom ?? (
                      <div className={`text-2xl font-bold codigo-fiscal ${item.cor}`}>
                        {item.sinal}{fmtBRL(Math.abs(item.valor ?? 0))}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">{item.subLabel}</div>
                  </div>
                ))}
              </div>

              {/* Barra visual de crédito */}
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Alíquota de crédito para clientes B2B</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Simples Nacional Padrão</span>
                      <span className="font-semibold codigo-fiscal text-amber-700 dark:text-amber-400">{fmtPct(sim.aliqCreditoClienteSN)}</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 dark:bg-amber-600 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (sim.aliqCreditoClienteSN / (IBS_PLENO + CBS_PLENO)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Sistema Híbrido</span>
                      <span className="font-semibold codigo-fiscal text-emerald-700 dark:text-emerald-400">{fmtPct(sim.aliqCreditoClienteHibrido)} (máximo)</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 dark:bg-emerald-600 rounded-full" style={{ width: "100%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── RECOMENDAÇÃO ─────────────────────────────────────────────── */}
          {(() => {
            const rc = recCores[sim.recomendacao];
            return (
              <Card className={`border-2 ${rc.border} ${rc.bg}`}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-3">
                    {rc.icon}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-bold text-base ${rc.title}`}>
                          Recomendação: {rc.label}
                        </h3>
                        <Badge className={`text-[10px] ${rc.badge}`}>
                          {sim.nivel === "forte" ? "Confiança Alta" : "Confiança Moderada"}
                        </Badge>
                      </div>
                      <p className={`text-sm ${rc.title} leading-relaxed`}>
                        {sim.justificativa}
                      </p>
                      {/* Métricas resumidas */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-muted-foreground">Carga SN: </span>
                          <span className="font-semibold codigo-fiscal">{fmtPct(sim.cargaSN_pct)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Carga Híbrido: </span>
                          <span className="font-semibold codigo-fiscal">{fmtPct(sim.cargaHibrido_pct)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Crédito SN: </span>
                          <span className="font-semibold codigo-fiscal">{fmtPct(sim.aliqCreditoClienteSN)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Crédito Híbrido: </span>
                          <span className="font-semibold codigo-fiscal">{fmtPct(sim.aliqCreditoClienteHibrido)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* ─── IMPACTO NO CLIENTE B2B ───────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Impacto para o Cliente B2B (Comprador LP/LR)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Como a decisão afeta o custo efetivo de aquisição do seu cliente empresarial
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Compra de R$100.000 do seu cliente</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço pago</span>
                      <span className="font-semibold">R$ 100.000</span>
                    </div>
                    <div className="flex justify-between text-amber-700 dark:text-amber-400">
                      <span>Crédito (SN padrão)</span>
                      <span className="font-semibold codigo-fiscal">
                        R$ {(1000 * sim.aliqCreditoClienteSN).toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>Crédito (Híbrido)</span>
                      <span className="font-semibold codigo-fiscal">
                        R$ {(1000 * sim.aliqCreditoClienteHibrido).toFixed(0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                      <span>Crédito extra no híbrido</span>
                      <span className="codigo-fiscal">
                        + R$ {(1000 * (sim.aliqCreditoClienteHibrido - sim.aliqCreditoClienteSN)).toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Custo efetivo para o comprador</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custo bruto</span>
                      <span className="font-semibold">R$ 100.000</span>
                    </div>
                    <div className="flex justify-between text-amber-700 dark:text-amber-400">
                      <span>Custo líquido (SN padrão)</span>
                      <span className="font-semibold codigo-fiscal">
                        R$ {(100000 - 1000 * sim.aliqCreditoClienteSN).toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>Custo líquido (Híbrido)</span>
                      <span className="font-semibold codigo-fiscal">
                        R$ {(100000 - 1000 * sim.aliqCreditoClienteHibrido).toFixed(0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                      <span>Economia do cliente</span>
                      <span className="codigo-fiscal">
                        R$ {(1000 * (sim.aliqCreditoClienteHibrido - sim.aliqCreditoClienteSN)).toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10 p-3 text-xs">
                  <p className="text-[10px] text-purple-700 dark:text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" /> Argumento Comercial
                  </p>
                  <p className="text-purple-800 dark:text-purple-300 leading-relaxed">
                    No híbrido, seu cliente LP/LR compra a{" "}
                    <strong>R$ 100.000</strong> mas credita{" "}
                    <strong>R$ {(1000 * sim.aliqCreditoClienteHibrido).toFixed(0)}</strong> de IBS/CBS,
                    reduzindo o custo efetivo para{" "}
                    <strong>R$ {(100000 - 1000 * sim.aliqCreditoClienteHibrido).toFixed(0)}</strong>.
                    {sim.aliqCreditoClienteSN < sim.aliqCreditoClienteHibrido && (
                      <> No SN padrão, o custo efetivo seria{" "}
                      <strong>R$ {(100000 - 1000 * sim.aliqCreditoClienteSN).toFixed(0)}</strong> — {" "}
                      <span className="text-purple-600 dark:text-purple-400 font-semibold">
                        R$ {(1000 * (sim.aliqCreditoClienteHibrido - sim.aliqCreditoClienteSN)).toFixed(0)} a mais.
                      </span></>
                    )}
                  </p>
                </div>
              </div>

              {/* Alertas situacionais */}
              <div className="space-y-2">
                {parseFloat(pctB2B) < 20 && (
                  <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-xs text-blue-800 dark:text-blue-300">
                      <strong>Perfil B2C:</strong> Com apenas {pctB2B}% de vendas para empresas, o crédito gerado para clientes é pouco relevante.
                      O híbrido não oferece vantagem competitiva significativa neste perfil.
                    </AlertDescription>
                  </Alert>
                )}
                {parseFloat(pctB2B) >= 70 && (
                  <Alert className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="text-xs text-emerald-800 dark:text-emerald-300">
                      <strong>Perfil B2B alto ({pctB2B}%):</strong> A maioria dos clientes são empresas que podem aproveitar créditos.
                      O sistema híbrido torna sua empresa significativamente mais competitiva no mercado B2B.
                    </AlertDescription>
                  </Alert>
                )}
                {sim.fatorCompetitividade > 0 && sim.fatorCompetitividade < 1 && (
                  <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-xs text-red-800 dark:text-red-300">
                      <strong>Fator desfavorável:</strong> O custo extra do híbrido ({fmtBRL(sim.diferencaCarga)}/mês) supera o
                      benefício gerado para clientes ({fmtBRL(sim.beneficioClientesExtra)}/mês).
                      Hibridizar seria prejudicial neste cenário.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── DETALHAMENTO TÉCNICO (expansível) ──────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <button
                className="flex items-center justify-between w-full"
                onClick={() => setDetalhes(v => !v)}
              >
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  Detalhamento Técnico — Memória de Cálculo
                </CardTitle>
                {detalhes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </CardHeader>
            {detalhes && (
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-semibold">Componente</th>
                        <th className="text-right px-3 py-2 font-semibold text-blue-700 dark:text-blue-400">SN Padrão</th>
                        <th className="text-right px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-400">Híbrido</th>
                        <th className="text-right px-3 py-2 font-semibold">Diferença</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        { label: "DAS (total / reduzido)", sn: sim.dasTotalMensal, hib: sim.dasReduzidoMensal },
                        { label: `IBS (SN embutido / pleno ${fmtPct1(IBS_PLENO)})`, sn: sim.ibsNoDas, hib: sim.ibsSaidaMensal },
                        { label: `CBS (SN embutida / plena ${fmtPct1(CBS_PLENO)})`, sn: sim.cbsNoDas, hib: sim.cbsSaidaMensal },
                        { label: "− Crédito IBS entradas", sn: 0, hib: -sim.creditoIbsEntradas },
                        { label: "− Crédito CBS entradas", sn: 0, hib: -sim.creditoCbsEntradas },
                        { label: "CARGA TOTAL MENSAL", sn: sim.cargaSN_mensal, hib: sim.cargaHibrido_mensal, bold: true },
                        { label: "Carga % receita", sn: null, hib: null, pctSN: sim.cargaSN_pct, pctHib: sim.cargaHibrido_pct, bold: true },
                        { label: "Crédito p/ clientes B2B", sn: sim.creditoClienteSN, hib: sim.creditoClienteHibrido },
                      ].map((row, i) => (
                        <tr key={i} className={row.bold ? "bg-muted/30 font-semibold" : ""}>
                          <td className="px-3 py-2 text-muted-foreground">{row.label}</td>
                          <td className="px-3 py-2 text-right codigo-fiscal text-blue-700 dark:text-blue-400">
                            {row.pctSN !== undefined ? fmtPct(row.pctSN) : fmtBRL(row.sn ?? 0)}
                          </td>
                          <td className="px-3 py-2 text-right codigo-fiscal text-emerald-700 dark:text-emerald-400">
                            {row.pctHib !== undefined ? fmtPct(row.pctHib) : fmtBRL(row.hib ?? 0)}
                          </td>
                          <td className={`px-3 py-2 text-right codigo-fiscal ${
                            row.pctSN !== undefined
                              ? (sim.cargaHibrido_pct - sim.cargaSN_pct) > 0 ? "text-red-600" : "text-emerald-600"
                              : row.bold
                                ? (sim.cargaHibrido_mensal > sim.cargaSN_mensal ? "text-red-600" : "text-emerald-600")
                                : "text-muted-foreground"
                          }`}>
                            {row.pctSN !== undefined
                              ? `${(sim.cargaHibrido_pct - sim.cargaSN_pct) > 0 ? "+" : ""}${fmtPct(sim.cargaHibrido_pct - sim.cargaSN_pct)}`
                              : row.sn !== null && row.hib !== null
                                ? `${((row.hib ?? 0) - (row.sn ?? 0)) > 0 ? "+" : ""}${fmtBRL((row.hib ?? 0) - (row.sn ?? 0))}`
                                : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1 text-muted-foreground">
                  <p className="font-semibold text-foreground">Premissas e Bases Legais</p>
                  <p>• Alíquotas IBS/CBS de referência para 2033: IBS 17,7% (estados + municípios) + CBS 8,8% (federal). Valores definitivos fixados por resolução do Senado Federal (EC 132/2023, art. 11).</p>
                  <p>• Proporção IBS/CBS no DAS estimada com base na distribuição atual de ICMS/ISS/PIS/COFINS por Anexo (LC 123/2006, Res. CGSN 140/2018), mantida no regime pós-reforma.</p>
                  <p>• Crédito proporcional SN: ~15% do IBS/CBS pleno (Art. 144, §1º, LC 214/2025). Percentual definitivo será definido por regulamentação complementar.</p>
                  <p>• Crédito pleno LP/LR nas entradas: 100% do IBS+CBS pago pelo fornecedor (Art. 28–47, LC 214/2025 — não-cumulatividade plena).</p>
                  <p>• Modelo simplificado para fins de planejamento tributário. Não substitui análise técnica individualizada com os dados fiscais reais do cliente.</p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* ─── CHECKLIST DE FATORES DE DECISÃO ─────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Fatores Complementares para Decisão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  {
                    titulo: "Perfil da Carteira de Clientes",
                    favoravel: parseFloat(pctB2B) >= 50,
                    desc: parseFloat(pctB2B) >= 50
                      ? `${pctB2B}% B2B: clientes empresariais valorizam o crédito pleno — híbrido tem vantagem competitiva.`
                      : `${pctB2B}% B2B: maioria B2C não aproveita créditos — híbrido tem pouco impacto comercial.`,
                  },
                  {
                    titulo: "Margem de Valor Adicionado",
                    favoravel: comp > 0 && (fat - comp) / fat > 0.3,
                    desc: comp > 0
                      ? `Margem estimada: ${fmtPct1(((fat - comp) / fat) * 100)}. ${
                          (fat - comp) / fat > 0.4
                            ? "Margem alta → IBS/CBS líquido menor no híbrido."
                            : "Margem baixa → crédito de entradas reduz pouco o IBS/CBS."
                        }`
                      : "Informe o valor de compras para avaliar o impacto dos créditos de entradas.",
                  },
                  {
                    titulo: "Concorrência e Posicionamento",
                    favoravel: sim.aliqCreditoClienteHibrido > sim.aliqCreditoClienteSN * 3,
                    desc: `Concorrentes LP/LR geram ${fmtPct1(IBS_PLENO + CBS_PLENO)} de crédito. No SN padrão você gera apenas ${fmtPct(sim.aliqCreditoClienteSN)}. ${
                      sim.aliqCreditoClienteHibrido > sim.aliqCreditoClienteSN * 3
                        ? "O híbrido equipara sua oferta à dos concorrentes."
                        : "A diferença não é tão expressiva no seu caso."
                    }`,
                  },
                  {
                    titulo: "Complexidade Operacional",
                    favoravel: false,
                    desc: "O híbrido exige apuração separada de IBS/CBS (DCTF Web / EFD), escrituração de créditos de entradas e controle de saldo credor. Avalie o custo contábil adicional.",
                  },
                  {
                    titulo: "Risco de Saldo Credor Acumulado",
                    favoravel: comp > fat * 0.5,
                    desc: comp > fat * 0.5
                      ? "Alto volume de compras → pode acumular crédito de IBS/CBS. A LC 214/2025 prevê ressarcimento ou compensação."
                      : "Compras moderadas → pouco risco de saldo credor acumulado.",
                  },
                  {
                    titulo: "Negociação de Preço com Clientes",
                    favoravel: sim.beneficioClientesExtra > sim.diferencaCarga,
                    desc: sim.beneficioClientesExtra > sim.diferencaCarga
                      ? `Para cada R$ 1,00 de custo extra, você gera R$ ${sim.fatorCompetitividade.toFixed(2)} de benefício para o cliente. Espaço para negociar reajuste de preço.`
                      : "O benefício gerado para o cliente não compensa o custo extra. Negociação de reajuste seria difícil.",
                  },
                ].map((f, i) => (
                  <div key={i} className={`rounded-lg border p-3 flex items-start gap-2 ${
                    f.favoravel
                      ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10"
                      : "border-border bg-muted/20"
                  }`}>
                    {f.favoravel
                      ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      : <TrendingDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                    <div>
                      <p className={`font-semibold mb-0.5 ${f.favoravel ? "text-emerald-800 dark:text-emerald-300" : "text-foreground"}`}>
                        {f.titulo}
                      </p>
                      <p className={f.favoravel ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
                        {f.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!sim && fat > 0 && (
        <Card>
          <CardContent className="pt-6 pb-6 text-center text-muted-foreground text-sm">
            Preencha os parâmetros acima para iniciar a simulação.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

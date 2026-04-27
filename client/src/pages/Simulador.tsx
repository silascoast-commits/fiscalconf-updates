import { useState, useEffect } from "react";
import { useCliente } from "@/contexts/ClienteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingDown, TrendingUp, Info, AlertTriangle, CheckCircle2, ArrowDownLeft, ArrowUpRight, Minus, BadgePercent, Zap, ShieldAlert, FlaskConical } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ─── CRONOGRAMA OFICIAL (EC 132/2023 + LC 214/2025) ──────────────────────────
// Fonte: gov.br/fazenda, Serasa Experian, Escola Superior de Contabilidade
const CRONOGRAMA: Record<number, {
  fase: string;
  cor: string;
  ibsFator: number;       // % da carga IBS/CBS já efetiva
  cbsFator: number;       // % da CBS efetiva
  icmsReducao: number;    // % de redução do ICMS original
  issReducao: number;     // % de redução do ISS original
  pisExtinto: boolean;
  cofinsExtinto: boolean;
  icmsExtinto: boolean;
  issExtinto: boolean;
  ibsAliq: number;        // alíquota IBS nominal para cálculo
  cbsAliq: number;        // alíquota CBS nominal
  descricao: string;
  eventos: string[];
}> = {
  2026: {
    fase: "Testes",
    cor: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    ibsFator: 0, cbsFator: 0,
    icmsReducao: 0, issReducao: 0,
    pisExtinto: false, cofinsExtinto: false, icmsExtinto: false, issExtinto: false,
    ibsAliq: 0.1, cbsAliq: 0.9,
    descricao: "Fase de testes — alíquotas simbólicas. Tributos antigos continuam integralmente.",
    eventos: [
      "CBS 0,9% e IBS 0,1% apenas para teste operacional",
      "PIS, COFINS, ICMS e ISS seguem normalmente",
      "Novos campos obrigatórios no XML da NF-e (cClassTrib, CST IBS/CBS)",
      "Apuração informativa — sem efeito tributário efetivo",
    ],
  },
  2027: {
    fase: "CBS Efetiva",
    cor: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    ibsFator: 0, cbsFator: 1,
    icmsReducao: 0, issReducao: 0,
    pisExtinto: true, cofinsExtinto: true, icmsExtinto: false, issExtinto: false,
    ibsAliq: 0.1, cbsAliq: 8.8,
    descricao: "CBS entra em vigor pleno. PIS e COFINS são extintos. IBS ainda simbólico (0,1%).",
    eventos: [
      "PIS e COFINS extintos",
      "CBS passa à alíquota cheia (~8,8%)",
      "IPI zerado (exceto Zona Franca de Manaus)",
      "Imposto Seletivo (IS) entra em vigor",
      "IBS segue em 0,1% (transição)",
      "ICMS e ISS seguem normalmente",
    ],
  },
  2028: {
    fase: "Consolidação CBS",
    cor: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    ibsFator: 0, cbsFator: 1,
    icmsReducao: 0, issReducao: 0,
    pisExtinto: true, cofinsExtinto: true, icmsExtinto: false, issExtinto: false,
    ibsAliq: 0.1, cbsAliq: 8.8,
    descricao: "CBS consolidada. IBS ainda simbólico. ICMS e ISS mantêm alíquotas cheias.",
    eventos: [
      "CBS operando normalmente (substituindo PIS/COFINS)",
      "IBS ainda em 0,1% (preparatório)",
      "ICMS e ISS seguem com alíquotas integrais",
      "Empresas precisam gerir dois sistemas simultâneos",
    ],
  },
  2029: {
    fase: "IBS 10%",
    cor: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    ibsFator: 0.1, cbsFator: 1,
    icmsReducao: 10, issReducao: 10,
    pisExtinto: true, cofinsExtinto: true, icmsExtinto: false, issExtinto: false,
    ibsAliq: 1.77, cbsAliq: 8.8,
    descricao: "Início da transição ICMS/ISS → IBS. ICMS e ISS reduzidos a 90% do valor original.",
    eventos: [
      "IBS = 10% da alíquota plena (~1,77%)",
      "ICMS reduzido a 90% da alíquota vigente",
      "ISS reduzido a 90% da alíquota vigente",
      "Período mais crítico — dois sistemas convivendo",
    ],
  },
  2030: {
    fase: "IBS 20%",
    cor: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    ibsFator: 0.2, cbsFator: 1,
    icmsReducao: 20, issReducao: 20,
    pisExtinto: true, cofinsExtinto: true, icmsExtinto: false, issExtinto: false,
    ibsAliq: 3.54, cbsAliq: 8.8,
    descricao: "IBS cresce para 20%. ICMS e ISS reduzidos a 80%.",
    eventos: [
      "IBS = 20% da alíquota plena (~3,54%)",
      "ICMS reduzido a 80%",
      "ISS reduzido a 80%",
    ],
  },
  2031: {
    fase: "IBS 30%",
    cor: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    ibsFator: 0.3, cbsFator: 1,
    icmsReducao: 30, issReducao: 30,
    pisExtinto: true, cofinsExtinto: true, icmsExtinto: false, issExtinto: false,
    ibsAliq: 5.31, cbsAliq: 8.8,
    descricao: "IBS alcança 30%. ICMS e ISS reduzidos a 70%.",
    eventos: [
      "IBS = 30% da alíquota plena (~5,31%)",
      "ICMS reduzido a 70%",
      "ISS reduzido a 70%",
    ],
  },
  2032: {
    fase: "IBS 40%",
    cor: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    ibsFator: 0.4, cbsFator: 1,
    icmsReducao: 40, issReducao: 40,
    pisExtinto: true, cofinsExtinto: true, icmsExtinto: false, issExtinto: false,
    ibsAliq: 7.08, cbsAliq: 8.8,
    descricao: "IBS chega a 40%. ICMS e ISS próximos da extinção (60% restante).",
    eventos: [
      "IBS = 40% da alíquota plena (~7,08%)",
      "ICMS reduzido a 60%",
      "ISS reduzido a 60%",
      "Último ano com ICMS e ISS vigentes",
    ],
  },
  2033: {
    fase: "Novo Modelo",
    cor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    ibsFator: 1, cbsFator: 1,
    icmsReducao: 100, issReducao: 100,
    pisExtinto: true, cofinsExtinto: true, icmsExtinto: true, issExtinto: true,
    ibsAliq: 17.7, cbsAliq: 8.8,
    descricao: "Sistema novo plenamente vigente. ICMS, ISS, PIS, COFINS e IPI extintos.",
    eventos: [
      "IBS = 17,7% (alíquota plena estadual/municipal)",
      "CBS = 8,8% (alíquota plena federal)",
      "ICMS e ISS extintos definitivamente",
      "IVA Dual (IBS + CBS) em vigor integral",
      "Simples Nacional: novo DAS = IRPJ + CSLL + CPP + IBS + CBS",
    ],
  },
};

const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

// ─── CRÉDITOS NAS ENTRADAS (LC 214/2025 — Art. 28 a 47) ─────────────────────
// Não-cumulatividade plena: IBS e CBS nas compras geram crédito integral
// para o adquirente (exceto Simples Nacional que tem crédito proporcional).
// Fornecedor SN: crédito = alíquota SN × percentual de IBS/CBS no DAS
// Fornecedor Pleno (LP/LR): crédito = alíquota IBS + CBS completa
// Crédito = valor das compras × alíquota efetiva IBS/CBS do fornecedor
export type RegimeFornecedor = "pleno" | "simples" | "misto";

function calcularCreditoEntradas(params: {
  valorCompras: number;          // total das entradas tributadas
  percentualSN: number;          // % das compras de fornecedores SN (0-100)
  ibsAliqAno: number;            // alíquota IBS efetiva do ano
  cbsAliqAno: number;            // alíquota CBS efetiva do ano
  isServico: boolean;
  ano: number;
}) {
  const { valorCompras, percentualSN, ibsAliqAno, cbsAliqAno, ano } = params;
  if (valorCompras <= 0) return { creditoIbs: 0, creditoCbs: 0, creditoTotal: 0, creditoAliq: 0 };

  // Fase 2026: apenas informativo, crédito simbólico (0,1% IBS + 0,9% CBS)
  // Fase 2027+: CBS plena; IBS conforme cronograma
  const comprasPlenas = valorCompras * ((100 - percentualSN) / 100);
  const comprasSN    = valorCompras * (percentualSN / 100);

  // Fornecedor regime pleno: crédito integral de IBS + CBS
  const creditoIbsPleno = comprasPlenas * (ibsAliqAno / 100);
  const creditoCbsPleno = comprasPlenas * (cbsAliqAno / 100);

  // Fornecedor SN: crédito proporcional — apenas a fração IBS/CBS do DAS
  // Estimativa conservadora: ~15% do DAS corresponde a CBS/IBS no SN
  // (varia por anexo; usamos 15% como média para fins de simulação)
  const fracaoCreditoSN = 0.15; // Art. 144, LC 214/2025 — alíquota SN proporcional
  const creditoIbsSN = comprasSN * (ibsAliqAno / 100) * fracaoCreditoSN;
  const creditoCbsSN = comprasSN * (cbsAliqAno / 100) * fracaoCreditoSN;

  const creditoIbs = creditoIbsPleno + creditoIbsSN;
  const creditoCbs = creditoCbsPleno + creditoCbsSN;
  const creditoTotal = creditoIbs + creditoCbs;
  const creditoAliq = valorCompras > 0 ? (creditoTotal / valorCompras) * 100 : 0;

  return { creditoIbs, creditoCbs, creditoTotal, creditoAliq };
}

function calcularCargaAnual(inputs: {
  faturamento: number;
  icmsAliq: number;
  issAliq: number;
  pisAliq: number;
  cofinsAliq: number;
  isServico: boolean;
  valorCompras: number;
  percentualSN: number;
  temST?: boolean; // Substituição Tributária: sem débito ICMS na saída
}, ano: number) {
  const crono = CRONOGRAMA[ano];
  const { faturamento, icmsAliq, issAliq, pisAliq, cofinsAliq, isServico, valorCompras, percentualSN, temST } = inputs;

  // ICMS/ISS com redução gradual
  // Com ST: ICMS já retido na origem (substituto) — sem débito na saída do substituído
  const icmsEfetivo = (isServico || temST) ? 0 : icmsAliq * (1 - crono.icmsReducao / 100);
  const issEfetivo = isServico ? (crono.issExtinto ? 0 : issAliq * (1 - crono.issReducao / 100)) : 0;

  // PIS/COFINS extintos a partir de 2027
  const pisEfetivo = crono.pisExtinto ? 0 : pisAliq;
  const cofinsEfetivo = crono.cofinsExtinto ? 0 : cofinsAliq;

  // IBS e CBS novos (débito nas saídas)
  const ibsEfetivo = crono.ibsAliq;
  const cbsEfetivo = crono.cbsAliq;

  const totalAliq = icmsEfetivo + issEfetivo + pisEfetivo + cofinsEfetivo + ibsEfetivo + cbsEfetivo;

  const valorIcms = faturamento * (icmsEfetivo / 100);
  const valorIss = faturamento * (issEfetivo / 100);
  const valorPis = faturamento * (pisEfetivo / 100);
  const valorCofins = faturamento * (cofinsEfetivo / 100);
  const valorIbs = faturamento * (ibsEfetivo / 100);
  const valorCbs = faturamento * (cbsEfetivo / 100);
  const totalTributos = valorIcms + valorIss + valorPis + valorCofins + valorIbs + valorCbs;

  // Crédito das entradas (IBS/CBS — LC 214/2025)
  const credito = calcularCreditoEntradas({
    valorCompras,
    percentualSN,
    ibsAliqAno: ibsEfetivo,
    cbsAliqAno: cbsEfetivo,
    isServico,
    ano,
  });

  // Carga líquida = débitos - créditos entradas
  const ibsCbsDebito = valorIbs + valorCbs;
  const ibsCbsLiquido = Math.max(0, ibsCbsDebito - credito.creditoTotal);
  const totalLiquido = valorIcms + valorIss + valorPis + valorCofins + ibsCbsLiquido;
  const cargaLiquidaPercentual = faturamento > 0 ? (totalLiquido / faturamento) * 100 : 0;

  return {
    icmsAliq: icmsEfetivo, issAliq: issEfetivo,
    pisAliq: pisEfetivo, cofinsAliq: cofinsEfetivo,
    ibsAliq: ibsEfetivo, cbsAliq: cbsEfetivo,
    totalAliq,
    valorIcms, valorIss, valorPis, valorCofins,
    valorIbs, valorCbs,
    totalTributos,
    cargaPercentual: totalAliq,
    // créditos
    creditoIbs: credito.creditoIbs,
    creditoCbs: credito.creditoCbs,
    creditoTotal: credito.creditoTotal,
    // líquido
    ibsCbsLiquido,
    totalLiquido,
    cargaLiquidaPercentual,
  };
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatPct(v: number) {
  return `${v.toFixed(2)}%`;
}

export default function Simulador() {
  const { clienteAtivo, pgdasAtivo } = useCliente();
  const [faturamento, setFaturamento] = useState("100000");
  const [icmsAliq, setIcmsAliq] = useState("12");
  const [issAliq, setIssAliq] = useState("5");
  const [pisAliq, setPisAliq] = useState("0.65");
  const [cofinsAliq, setCofinsAliq] = useState("3");
  const [isServico, setIsServico] = useState(false);
  const [anoDetalhe, setAnoDetalhe] = useState<number | null>(null);
  // Créditos nas entradas (LC 214/2025)
  const [valorCompras, setValorCompras] = useState("60000");
  const [percentualSN, setPercentualSN] = useState("40");
  const [mostrarCreditos, setMostrarCreditos] = useState(true);
  // Substituição Tributária
  const [temST, setTemST] = useState(false);
  // Imposto Seletivo
  const [setorIS, setSetorIS] = useState<string>("nenhum");
  // Faturamento mensal para alerta de exclusão SN
  const [rbt12Str, setRbt12Str] = useState("");

  // Pré-popula receita anual do cliente ativo (via PGDAS ou faturamento cadastrado)
  useEffect(() => {
    if (!clienteAtivo) return;
    // Tenta usar RBT12 do PGDAS mais recente
    if (pgdasAtivo?.rbt12 && pgdasAtivo.rbt12 > 0) {
      const mensal = Math.round(pgdasAtivo.rbt12 / 12);
      setFaturamento(String(mensal));
      return;
    }
    // Tenta usar faturamento dos meses cadastrados no cliente
    if (clienteAtivo.faturamentoMeses) {
      try {
        const meses = JSON.parse(clienteAtivo.faturamentoMeses) as number[];
        const total = meses.reduce((a: number, b: number) => a + b, 0);
        const cnt = meses.filter((v: number) => v > 0).length;
        if (cnt > 0) {
          const mensal = Math.round(total / cnt);
          setFaturamento(String(mensal));
        }
      } catch {/* ignora */}
    }
    // Define tipo baseado na atividade do cliente
    if (clienteAtivo.atividade) {
      const at = clienteAtivo.atividade.toLowerCase();
      const isServ = at.includes("serviç") || at.includes("servic") || at.includes("iss");
      setIsServico(isServ);
    }
  }, [clienteAtivo?.id, pgdasAtivo?.id]);

  const inputs = {
    faturamento: parseFloat(faturamento.replace(/\./g, "").replace(",", ".")) || 0,
    icmsAliq: parseFloat(icmsAliq) || 0,
    issAliq: parseFloat(issAliq) || 0,
    pisAliq: parseFloat(pisAliq) || 0,
    cofinsAliq: parseFloat(cofinsAliq) || 0,
    isServico,
    valorCompras: parseFloat(valorCompras.replace(/\./g, "").replace(",", ".")) || 0,
    percentualSN: parseFloat(percentualSN) || 0,
    temST,
  };

  const resultados = ANOS.map(ano => ({ ano, ...calcularCargaAnual(inputs, ano) }));
  const cargaBase = resultados[0].cargaPercentual;
  const temCompras = inputs.valorCompras > 0;

  // ─── Alerta exclusão SN ───────────────────────────────────────────────────
  const faturamentoMensal = parseFloat(faturamento.replace(/\./g, "").replace(",", ".")) || 0;
  const rbt12Calc = rbt12Str ? (parseFloat(rbt12Str.replace(/\./g, "").replace(",", ".")) || 0) : faturamentoMensal * 12;
  const riscoExclusaoSN = rbt12Calc > 4200000 && rbt12Calc <= 4800000;
  const exclusaoSN      = rbt12Calc > 4800000;

  // ─── Imposto Seletivo — alíquotas LC 214/2025 art. 415–450 ───────────────
  const IS_ALIQUOTAS: Record<string, { label: string; aliq: number; obs: string }> = {
    nenhum:       { label: "Não aplicável",          aliq: 0,    obs: "" },
    bebidas_alc:  { label: "Bebidas alcoólicas",      aliq: 20,   obs: "Art. 415 § 2º, I" },
    fumo:         { label: "Cigarros / fumo",          aliq: 100,  obs: "Art. 415 § 2º, II" },
    veiculos:     { label: "Veículos automotores",     aliq: 7.5,  obs: "Art. 415 § 2º, III" },
    embarcacoes:  { label: "Embarcações / aeronaves",  aliq: 10,   obs: "Art. 415 § 2º, IV" },
    armas:        { label: "Armas e munições",         aliq: 25,   obs: "Art. 415 § 2º, V" },
    bebidas_nao:  { label: "Bebidas não-alcoólicas",   aliq: 10,   obs: "Art. 415 § 2º, VI" },
    minerais:     { label: "Minérios / petróleo",      aliq: 1,    obs: "Art. 415 § 2º, VII" },
    agrotoxicos:  { label: "Agrotóxicos",              aliq: 10,   obs: "Art. 415 § 2º, VIII" },
  };
  const isInfo = IS_ALIQUOTAS[setorIS];
  const valorIS2027 = setorIS !== "nenhum" ? (faturamentoMensal * (isInfo.aliq / 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Simulador da Reforma Tributária</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Projeção ano a ano da carga tributária (2026–2033) conforme <span className="font-medium">EC 132/2023</span> e <span className="font-medium">LC 214/2025</span>.
        </p>
      </div>

      {/* ─── Alertas exclusão SN ── */}
      {exclusaoSN && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            <strong>Exclusão obrigatória do Simples Nacional:</strong> RBT12 estimado de {(rbt12Calc).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} supera o limite de R$4.800.000. O desenquadramento é obrigatório a partir do mês seguinte. Avalie migração para Lucro Presumido ou Real.
          </AlertDescription>
        </Alert>
      )}
      {riscoExclusaoSN && (
        <Alert className="border-red-400 bg-red-50 dark:bg-red-950/20">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            <strong>Risco de exclusão do Simples Nacional:</strong> RBT12 estimado de {(rbt12Calc).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — a {(4800000 - rbt12Calc).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} do limite máximo. Monitore mensalmente e planeje a migração de regime preventivamente.
          </AlertDescription>
        </Alert>
      )}

      {/* Banner empresa ativa */}
      {clienteAtivo && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <TrendingDown className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-foreground">{clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial}</span>
          <span className="text-xs text-muted-foreground">
            {pgdasAtivo?.rbt12
              ? `— Faturamento mensal pré-preenchido com base no RBT12 do PGDAS (R$ ${(pgdasAtivo.rbt12 / 12).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês)`
              : "— Faturamento pré-preenchido com base no cadastro do cliente"}
          </span>
        </div>
      )}

      {/* Inputs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Parâmetros da Empresa</CardTitle>
          <p className="text-xs text-muted-foreground">Preencha os campos abaixo para simular a carga tributária 2026–2033</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo de operação */}
          <div className="flex gap-3">
            {[
              { value: false, label: "Comércio / Indústria", sub: "ICMS + PIS/COFINS" },
              { value: true, label: "Serviços", sub: "ISS + PIS/COFINS" },
            ].map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setIsServico(opt.value)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
                  isServico === opt.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
                data-testid={`tipo-${opt.value ? "servico" : "comercio"}`}
              >
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs opacity-70">{opt.sub}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="col-span-2 sm:col-span-3 lg:col-span-1 space-y-1.5">
              <Label className="text-xs">Faturamento Mensal (R$)</Label>
              <Input
                data-testid="input-faturamento"
                value={faturamento}
                onChange={e => setFaturamento(e.target.value.replace(/[^0-9.,]/g, ""))}
                className="codigo-fiscal"
                placeholder="100.000"
              />
            </div>
            {!isServico && (
              <div className="space-y-1.5">
                <Label className="text-xs">ICMS atual (%)</Label>
                <Input
                  data-testid="input-icms"
                  value={icmsAliq}
                  onChange={e => setIcmsAliq(e.target.value)}
                  type="number" step="0.1" min="0" max="30"
                  className="codigo-fiscal"
                />
              </div>
            )}
            {isServico && (
              <div className="space-y-1.5">
                <Label className="text-xs">ISS atual (%)</Label>
                <Input
                  data-testid="input-iss"
                  value={issAliq}
                  onChange={e => setIssAliq(e.target.value)}
                  type="number" step="0.5" min="2" max="5"
                  className="codigo-fiscal"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">PIS atual (%)</Label>
              <Input
                data-testid="input-pis"
                value={pisAliq}
                onChange={e => setPisAliq(e.target.value)}
                type="number" step="0.01" min="0"
                className="codigo-fiscal"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">COFINS atual (%)</Label>
              <Input
                data-testid="input-cofins"
                value={cofinsAliq}
                onChange={e => setCofinsAliq(e.target.value)}
                type="number" step="0.01" min="0"
                className="codigo-fiscal"
              />
            </div>
          </div>

          {/* ─── Substituição Tributária + Imposto Seletivo + RBT12 ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* ST */}
            {!isServico && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <ArrowUpRight className="h-3.5 w-3.5 text-orange-500" />
                  Substituição Tributária (ST)
                </p>
                <div className="flex gap-2">
                  {[{ v: false, label: "Sem ST" }, { v: true, label: "Com ST" }].map(opt => (
                    <button key={String(opt.v)} type="button"
                      onClick={() => setTemST(opt.v)}
                      className={`flex-1 px-2 py-1.5 rounded border text-xs font-medium transition-all ${
                        temST === opt.v ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300" : "border-border text-muted-foreground hover:bg-accent"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {temST && (
                  <p className="text-[10px] text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 rounded p-1.5">
                    Com ST: ICMS já retido na origem — sem débito de ICMS na saída. A partir de 2029, o crédito de IBS/CBS será pleno pois a ST será extinta gradualmente.
                  </p>
                )}
                {!temST && (
                  <p className="text-[10px] text-muted-foreground">ICMS próprio calculado normalmente</p>
                )}
              </div>
            )}

            {/* Imposto Seletivo */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5 text-purple-500" />
                Imposto Seletivo (IS) — 2027+
              </p>
              <select
                className="w-full text-xs border rounded px-2 py-1.5 bg-background text-foreground"
                value={setorIS}
                onChange={e => setSetorIS(e.target.value)}
              >
                {Object.entries(IS_ALIQUOTAS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}{v.aliq > 0 ? ` (${v.aliq}%)` : ""}</option>
                ))}
              </select>
              {setorIS !== "nenhum" && (
                <div className="text-[10px] text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 rounded p-1.5 space-y-0.5">
                  <p>Alíquota: <strong>{isInfo.aliq}%</strong> sobre receita bruta ({isInfo.obs})</p>
                  <p>IS mensal estimado (a partir de 2027): <strong>{(faturamentoMensal * (isInfo.aliq / 100)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></p>
                  <p>O IS incide sobre saídas e não gera crédito (extrafiscal).</p>
                </div>
              )}
              {setorIS === "nenhum" && (
                <p className="text-[10px] text-muted-foreground">Selecione o setor se a empresa produz bens sujeitos ao IS (LC 214/2025 art. 415)</p>
              )}
            </div>

            {/* RBT12 para alerta */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                RBT12 Real (alerta SN)
              </p>
              <Input
                value={rbt12Str}
                onChange={e => setRbt12Str(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="Deixe em branco = faturamento × 12"
                className="text-xs codigo-fiscal"
              />
              <p className="text-[10px] text-muted-foreground">
                Receita acumulada 12 meses. Limite SN: R$4.800.000. Atual estimado: {(rbt12Calc).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <span>Os valores de IBS e CBS são calculados com as alíquotas de referência oficiais (IBS 17,7% / CBS 8,8% em 2033). As alíquotas definitivas serão fixadas pelo Senado. Cálculo baseado nas fases da <strong>EC 132/2023</strong> e <strong>LC 214/2025</strong>.</span>
          </div>
        </CardContent>
      </Card>

      {/* ─── CRÉDITOS NAS ENTRADAS ─── */}
      <Card className="border-emerald-200 dark:border-emerald-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
              Créditos nas Entradas — IBS / CBS
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">LC 214/2025 — Art. 28–47</Badge>
            </CardTitle>
            <button
              onClick={() => setMostrarCreditos(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {mostrarCreditos ? "Ocultar" : "Expandir"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Não-cumulatividade plena: IBS e CBS pagos nas compras geram crédito a deduzir do débito nas saídas.
            Fornecedor do Simples Nacional gera crédito proporcional (Art. 144).
          </p>
        </CardHeader>
        {mostrarCreditos && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Total de Compras / Entradas por Mês (R$)</Label>
                <Input
                  data-testid="input-compras"
                  value={valorCompras}
                  onChange={e => setValorCompras(e.target.value.replace(/[^0-9.,]/g, ""))}
                  className="codigo-fiscal"
                  placeholder="60.000"
                />
                <p className="text-[10px] text-muted-foreground">Mercadorias, matérias-primas, serviços tomados com tributação IBS/CBS</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">% das Compras de Fornecedores do Simples Nacional</Label>
                <div className="flex items-center gap-2">
                  <Input
                    data-testid="input-percentual-sn"
                    value={percentualSN}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v >= 0 && v <= 100) setPercentualSN(e.target.value);
                      else if (e.target.value === "") setPercentualSN("");
                    }}
                    type="number" min="0" max="100" step="5"
                    className="codigo-fiscal"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Simples Nacional gera crédito proporcional ≈ 15% vs crédito pleno de fornecedores LP/LR (Art. 144)</p>
              </div>
            </div>

            {/* Resumo visual por regime */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Compras LP/LR</div>
                <div className="font-semibold text-foreground">
                  {(100 - (parseFloat(percentualSN) || 0)).toFixed(0)}%
                </div>
                <div className="text-[10px] text-emerald-600">crédito pleno IBS+CBS</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Compras SN</div>
                <div className="font-semibold text-foreground">
                  {(parseFloat(percentualSN) || 0).toFixed(0)}%
                </div>
                <div className="text-[10px] text-amber-600">crédito proporcional ~15%</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 p-2.5 text-center">
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-1">Média de crédito</div>
                <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {(() => {
                    const pSN = parseFloat(percentualSN) || 0;
                    const pPleno = 100 - pSN;
                    return `${(pPleno * 1 + pSN * 0.15).toFixed(0)}%`;
                  })()}
                </div>
                <div className="text-[10px] text-emerald-600">do potencial máximo</div>
              </div>
            </div>

            <div className="text-xs bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded p-2.5 flex items-start gap-2">
              <BadgePercent className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />
              <span className="text-emerald-800 dark:text-emerald-300">
                <strong>Não-cumulatividade plena (LC 214/2025):</strong> Todo IBS e CBS pago nas entradas pode ser descontado do IBS e CBS devido nas saídas. O saldo credor pode ser transferido, ressarcido ou compensado.
                Simples Nacional: crédito calculado com base na alíquota de CBS/IBS proporcional ao DAS (Art. 144, par. 1º).
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tabela ano a ano */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold">Evolução da Carga Tributária — Ano a Ano</CardTitle>
            {temCompras && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded px-2 py-1">
                <ArrowDownLeft className="h-3 w-3" />
                Crédito de entradas incluído — coluna <strong>Líquido</strong> mostra carga real
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground w-16">Ano</th>
                  <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Fase</th>
                  <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground">ICMS/ISS</th>
                  <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground">PIS/COFINS</th>
                  <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground">IBS</th>
                  <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground">CBS</th>
                  {temCompras && (
                    <th className="text-right px-3 py-2 font-medium text-xs text-emerald-600 dark:text-emerald-400">Créd. Entradas</th>
                  )}
                  <th className="text-right px-4 py-2 font-medium text-xs text-muted-foreground">Carga Bruta</th>
                  {temCompras && (
                    <th className="text-right px-4 py-2 font-medium text-xs text-emerald-700 dark:text-emerald-400">Carga Líquida</th>
                  )}
                  <th className="text-right px-4 py-2 font-medium text-xs text-muted-foreground">Tributo (R$)</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, idx) => {
                  const crono = CRONOGRAMA[r.ano];
                  const variacao = r.cargaPercentual - cargaBase;
                  const isSelected = anoDetalhe === r.ano;
                  const reducaoLiquida = r.cargaPercentual - r.cargaLiquidaPercentual;
                  return (
                    <tr
                      key={r.ano}
                      className={`border-b transition-colors cursor-pointer ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}
                      onClick={() => setAnoDetalhe(isSelected ? null : r.ano)}
                      data-testid={`row-ano-${r.ano}`}
                    >
                      <td className="px-4 py-2.5 font-semibold codigo-fiscal text-primary">{r.ano}</td>
                      <td className="px-3 py-2.5">
                        <Badge className={`text-[10px] ${crono.cor}`}>{crono.fase}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right codigo-fiscal text-xs">
                        {isServico
                          ? (crono.issExtinto ? <span className="line-through text-muted-foreground">{formatPct(inputs.issAliq)}</span> : formatPct(r.issAliq))
                          : (crono.icmsExtinto ? <span className="line-through text-muted-foreground">{formatPct(inputs.icmsAliq)}</span> : formatPct(r.icmsAliq))
                        }
                      </td>
                      <td className="px-3 py-2.5 text-right codigo-fiscal text-xs">
                        {crono.pisExtinto
                          ? <span className="line-through text-muted-foreground">{formatPct(inputs.pisAliq + inputs.cofinsAliq)}</span>
                          : formatPct(r.pisAliq + r.cofinsAliq)
                        }
                      </td>
                      <td className="px-3 py-2.5 text-right codigo-fiscal text-xs text-blue-600 dark:text-blue-400 font-medium">
                        {formatPct(r.ibsAliq)}
                      </td>
                      <td className="px-3 py-2.5 text-right codigo-fiscal text-xs text-blue-600 dark:text-blue-400 font-medium">
                        {formatPct(r.cbsAliq)}
                      </td>
                      {temCompras && (
                        <td className="px-3 py-2.5 text-right">
                          {r.creditoTotal > 0 ? (
                            <span className="codigo-fiscal text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              − {formatBRL(r.creditoTotal)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="codigo-fiscal font-semibold text-sm">{formatPct(r.cargaPercentual)}</span>
                          {idx > 0 && (
                            <span className={`text-[10px] ${variacao > 0 ? "text-red-500" : variacao < 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                              {variacao > 0 ? "+" : ""}{variacao.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </td>
                      {temCompras && (
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="codigo-fiscal font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                              {formatPct(r.cargaLiquidaPercentual)}
                            </span>
                            {reducaoLiquida > 0.01 && (
                              <span className="text-[10px] text-emerald-600">
                                −{reducaoLiquida.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right">
                        <span className="codigo-fiscal text-xs font-medium">{formatBRL(temCompras ? r.totalLiquido : r.totalTributos)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detalhe do ano selecionado */}
      {anoDetalhe && (() => {
        const r = resultados.find(x => x.ano === anoDetalhe)!;
        const crono = CRONOGRAMA[anoDetalhe];
        return (
          <Card className="border-primary/30 slide-in">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-sm font-semibold">Detalhamento — {anoDetalhe}</CardTitle>
                <Badge className={crono.cor}>{crono.fase}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{crono.descricao}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Breakdown valores */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: isServico ? "ISS" : "ICMS", valor: isServico ? r.valorIss : r.valorIcms, aliq: isServico ? r.issAliq : r.icmsAliq, extinto: isServico ? crono.issExtinto : crono.icmsExtinto, cor: "text-slate-700 dark:text-slate-300" },
                  { label: "PIS", valor: r.valorPis, aliq: r.pisAliq, extinto: crono.pisExtinto, cor: "text-slate-700 dark:text-slate-300" },
                  { label: "COFINS", valor: r.valorCofins, aliq: r.cofinsAliq, extinto: crono.cofinsExtinto, cor: "text-slate-700 dark:text-slate-300" },
                  { label: "IBS", valor: r.valorIbs, aliq: r.ibsAliq, extinto: false, cor: "text-blue-600 dark:text-blue-400" },
                  { label: "CBS", valor: r.valorCbs, aliq: r.cbsAliq, extinto: false, cor: "text-blue-600 dark:text-blue-400" },
                  { label: "TOTAL", valor: r.totalTributos, aliq: r.totalAliq, extinto: false, cor: "text-foreground font-bold" },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg border p-2.5 text-center ${item.label === "TOTAL" ? "bg-primary/5 border-primary/30" : ""}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${item.extinto ? "line-through text-muted-foreground" : "text-muted-foreground"}`}>
                      {item.label} {item.extinto && "✗"}
                    </div>
                    <div className={`codigo-fiscal text-sm font-bold ${item.extinto ? "text-muted-foreground" : item.cor}`}>
                      {formatPct(item.aliq)}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${item.extinto ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>
                      {formatBRL(item.valor)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Créditos de entradas no detalhe */}
              {temCompras && r.creditoTotal > 0 && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-3 space-y-2">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                    Crédito de Entradas IBS/CBS — LC 214/2025 Art. 28–47
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground">Créd. IBS</div>
                      <div className="font-semibold text-emerald-700 dark:text-emerald-400">{formatBRL(r.creditoIbs)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground">Créd. CBS</div>
                      <div className="font-semibold text-emerald-700 dark:text-emerald-400">{formatBRL(r.creditoCbs)}</div>
                    </div>
                    <div className="text-center border-l">
                      <div className="text-[10px] text-muted-foreground">Carga Bruta</div>
                      <div className="font-semibold">{formatBRL(r.totalTributos)}</div>
                    </div>
                    <div className="text-center border-l bg-emerald-100/50 dark:bg-emerald-900/20 rounded">
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">Carga Líquida</div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">{formatBRL(r.totalLiquido)}</div>
                      <div className="text-[10px] text-emerald-600">{formatPct(r.cargaLiquidaPercentual)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Eventos do ano */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Eventos e mudanças em {anoDetalhe}</p>
                <div className="space-y-1.5">
                  {crono.eventos.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Linha do tempo visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Linha do Tempo da Reforma</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Linha conectora */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-border" />
            <div className="flex justify-between relative">
              {ANOS.map(ano => {
                const crono = CRONOGRAMA[ano];
                const isAtual = ano === 2026;
                return (
                  <button
                    key={ano}
                    onClick={() => setAnoDetalhe(anoDetalhe === ano ? null : ano)}
                    className="flex flex-col items-center gap-1.5 group"
                    data-testid={`timeline-${ano}`}
                  >
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 transition-all group-hover:scale-110 ${
                      anoDetalhe === ano ? "border-primary bg-primary text-white" :
                      isAtual ? "border-primary bg-primary/10 text-primary" :
                      "border-border bg-background text-muted-foreground"
                    }`}>
                      {ano === 2033 ? "✓" : ano - 2020}
                    </div>
                    <div className="text-[10px] font-semibold">{ano}</div>
                    <div className={`text-[9px] text-center max-w-12 leading-tight ${anoDetalhe === ano ? "text-primary" : "text-muted-foreground"}`}>
                      {crono.fase}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/10 rounded p-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">2026–2028</p>
                <p className="text-amber-700 dark:text-amber-400 mt-0.5">Fase federal: CBS substitui PIS/COFINS. ICMS e ISS seguem.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-900/10 rounded p-2.5">
              <TrendingDown className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-800 dark:text-orange-300">2029–2032</p>
                <p className="text-orange-700 dark:text-orange-400 mt-0.5">IBS sobe 10% ao ano enquanto ICMS/ISS caem proporcionalmente.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-900/10 rounded p-2.5">
              <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">2033</p>
                <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">IVA Dual pleno: IBS 17,7% + CBS 8,8%. ICMS, ISS, PIS, COFINS extintos.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── PAINEL: Substituição Tributária + Imposto Seletivo ─── */}
      {(temST || setorIS !== "nenhum") && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              Impactos Adicionais: ST e Imposto Seletivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {temST && (
              <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/10 p-3 space-y-2">
                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Substituição Tributária — impacto na Reforma
                </p>
                <div className="text-xs text-orange-700 dark:text-orange-400 space-y-1">
                  <p>• <strong>2026–2028:</strong> ICMS-ST retido na origem pelo substituto. A empresa (substituída) não tem débito de ICMS na saída — ICMS efetivo na tabela acima está superestimado para este período.</p>
                  <p>• <strong>2029–2032:</strong> IBS/CBS serão apurados normalmente mesmo para mercadorias com ST — a não-cumulatividade plena do IVA Dual elimina a lógica de ST com o tempo.</p>
                  <p>• <strong>2033:</strong> Regime de ST substituído integralmente pelo IBS com crédito integral na cadeia. Fim da ST como conhecida hoje.</p>
                  <p className="text-[10px] text-orange-600 dark:text-orange-500 mt-1">Referência: LC 214/2025, arts. 52–69 (não-cumulatividade IBS) e art. 148 (transição ST).</p>
                </div>
              </div>
            )}

            {setorIS !== "nenhum" && (
              <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/10 p-3 space-y-2">
                <p className="text-xs font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Imposto Seletivo — {isInfo.label} ({isInfo.aliq}% — {isInfo.obs})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {ANOS.filter(a => a >= 2027).map(ano => (
                    <div key={ano} className="rounded border bg-background p-2 text-center">
                      <div className="text-[10px] text-muted-foreground">{ano}</div>
                      <div className="font-semibold text-purple-700 dark:text-purple-400">
                        {(faturamentoMensal * (isInfo.aliq / 100)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                      <div className="text-[10px] text-muted-foreground">IS/mês</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-400 space-y-1">
                  <p>• O IS é tributo <strong>extrafiscal</strong>: não gera crédito para o adquirente e não compensa com IBS/CBS.</p>
                  <p>• Incide sobre a <strong>saída</strong> do fabricante/importador (primeira etapa da cadeia).</p>
                  <p>• Vigente a partir de <strong>2027</strong>, com regulamentação progressiva até 2033.</p>
                  <p>• Carga anual estimada: <strong>{(faturamentoMensal * (isInfo.aliq / 100) * 12).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong> — adicionar à carga total do simulador acima.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

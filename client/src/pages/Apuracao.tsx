import { useState, useMemo, useEffect } from "react";
import { useCliente } from "@/contexts/ClienteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  TrendingUp,
  Calculator,
  BarChart3,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Layers,
  CheckCircle2,
  Circle,
  CalendarDays,
  Zap,
  FileCode2,
  ArrowRightLeft,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS E TABELAS SIMPLES NACIONAL (LC 123/2006 — versão vigente)
// ─────────────────────────────────────────────────────────────────────────────
type Faixa = {
  min: number;
  max: number;
  aliquota: number;
  parcela: number;
};

type DistribuicaoTributos = {
  IRPJ: number;
  CSLL: number;
  COFINS: number;
  PIS: number;
  CPP: number;
  ICMS?: number;
  IPI?: number;
  ISS?: number;
};

type AnexoInfo = {
  label: string;
  descricao: string;
  faixas: Faixa[];
  distribuicao: DistribuicaoTributos[];
  cpFora?: boolean;
  temISS?: boolean;
  temICMS?: boolean;
  temIPI?: boolean;
};

const ANEXOS: Record<string, AnexoInfo> = {
  I: {
    label: "Anexo I — Comércio",
    descricao: "Comércio em geral (ICMS incluso no DAS)",
    faixas: [
      { min: 0, max: 180000, aliquota: 4.0, parcela: 0 },
      { min: 180000.01, max: 360000, aliquota: 7.3, parcela: 5940 },
      { min: 360000.01, max: 720000, aliquota: 9.5, parcela: 13860 },
      { min: 720000.01, max: 1800000, aliquota: 10.7, parcela: 22500 },
      { min: 1800000.01, max: 3600000, aliquota: 14.3, parcela: 87300 },
      { min: 3600000.01, max: 4800000, aliquota: 19.0, parcela: 378000 },
    ],
    distribuicao: [
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 41.5, ICMS: 34.0 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 41.5, ICMS: 34.0 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 42.0, ICMS: 33.5 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 42.0, ICMS: 33.5 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 42.0, ICMS: 33.5 },
      { IRPJ: 13.5, CSLL: 10.0, COFINS: 28.27, PIS: 6.13, CPP: 42.1, ICMS: 0 },
    ],
    temICMS: true,
  },
  II: {
    label: "Anexo II — Indústria",
    descricao: "Indústria (IPI + ICMS incluso no DAS)",
    faixas: [
      { min: 0, max: 180000, aliquota: 4.5, parcela: 0 },
      { min: 180000.01, max: 360000, aliquota: 7.8, parcela: 5940 },
      { min: 360000.01, max: 720000, aliquota: 10.0, parcela: 13860 },
      { min: 720000.01, max: 1800000, aliquota: 11.2, parcela: 22500 },
      { min: 1800000.01, max: 3600000, aliquota: 14.7, parcela: 85500 },
      { min: 3600000.01, max: 4800000, aliquota: 30.0, parcela: 720000 },
    ],
    distribuicao: [
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, ICMS: 32.0, IPI: 7.5 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, ICMS: 32.0, IPI: 7.5 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, ICMS: 32.0, IPI: 7.5 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, ICMS: 32.0, IPI: 7.5 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, ICMS: 32.0, IPI: 7.5 },
      { IRPJ: 8.0, CSLL: 5.5, COFINS: 22.45, PIS: 4.86, CPP: 23.75, ICMS: 28.27, IPI: 7.17 },
    ],
    temICMS: true,
    temIPI: true,
  },
  III: {
    label: "Anexo III — Serviços (ISS)",
    descricao: "Serviços com ISS incluso (Fator R ≥ 28%: migra do Anexo V)",
    faixas: [
      { min: 0, max: 180000, aliquota: 6.0, parcela: 0 },
      { min: 180000.01, max: 360000, aliquota: 11.2, parcela: 9360 },
      { min: 360000.01, max: 720000, aliquota: 13.5, parcela: 17640 },
      { min: 720000.01, max: 1800000, aliquota: 16.0, parcela: 35640 },
      { min: 1800000.01, max: 3600000, aliquota: 21.0, parcela: 125640 },
      { min: 3600000.01, max: 4800000, aliquota: 33.0, parcela: 648000 },
    ],
    distribuicao: [
      { IRPJ: 4.0, CSLL: 3.5, COFINS: 12.82, PIS: 2.78, CPP: 43.4, ISS: 33.5 },
      { IRPJ: 4.0, CSLL: 3.5, COFINS: 14.05, PIS: 3.05, CPP: 43.4, ISS: 32.0 },
      { IRPJ: 4.0, CSLL: 3.5, COFINS: 13.64, PIS: 2.96, CPP: 43.4, ISS: 32.5 },
      { IRPJ: 4.0, CSLL: 3.5, COFINS: 13.64, PIS: 2.96, CPP: 43.4, ISS: 32.5 },
      { IRPJ: 4.0, CSLL: 3.5, COFINS: 12.82, PIS: 2.78, CPP: 43.4, ISS: 33.5 },
      { IRPJ: 35.0, CSLL: 15.0, COFINS: 16.03, PIS: 2.76, CPP: 29.22, ISS: 2.0 },
    ],
    temISS: true,
  },
  IV: {
    label: "Anexo IV — Serviços (CPP fora)",
    descricao: "Serviços com CPP recolhido separadamente (construção, vigilância, limpeza)",
    faixas: [
      { min: 0, max: 180000, aliquota: 4.5, parcela: 0 },
      { min: 180000.01, max: 360000, aliquota: 9.0, parcela: 8100 },
      { min: 360000.01, max: 720000, aliquota: 10.2, parcela: 12420 },
      { min: 720000.01, max: 1800000, aliquota: 14.0, parcela: 39780 },
      { min: 1800000.01, max: 3600000, aliquota: 22.0, parcela: 183780 },
      { min: 3600000.01, max: 4800000, aliquota: 33.0, parcela: 828000 },
    ],
    distribuicao: [
      { IRPJ: 18.8, CSLL: 15.2, COFINS: 19.0, PIS: 4.1, CPP: 0, ISS: 42.9 },
      { IRPJ: 19.8, CSLL: 15.2, COFINS: 19.0, PIS: 4.1, CPP: 0, ISS: 41.9 },
      { IRPJ: 20.8, CSLL: 15.2, COFINS: 19.0, PIS: 4.1, CPP: 0, ISS: 40.9 },
      { IRPJ: 17.8, CSLL: 19.2, COFINS: 19.0, PIS: 4.1, CPP: 0, ISS: 39.9 },
      { IRPJ: 18.8, CSLL: 19.2, COFINS: 19.0, PIS: 4.1, CPP: 0, ISS: 38.9 },
      { IRPJ: 53.5, CSLL: 21.5, COFINS: 20.55, PIS: 4.45, CPP: 0, ISS: 0 },
    ],
    cpFora: true,
    temISS: true,
  },
  V: {
    label: "Anexo V — Serviços Intelectuais",
    descricao: "TI, engenharia, consultoria, medicina (Fator R < 28%)",
    faixas: [
      { min: 0, max: 180000, aliquota: 15.5, parcela: 0 },
      { min: 180000.01, max: 360000, aliquota: 18.0, parcela: 4500 },
      { min: 360000.01, max: 720000, aliquota: 19.5, parcela: 9900 },
      { min: 720000.01, max: 1800000, aliquota: 20.5, parcela: 17100 },
      { min: 1800000.01, max: 3600000, aliquota: 23.0, parcela: 62100 },
      { min: 3600000.01, max: 4800000, aliquota: 30.5, parcela: 540000 },
    ],
    distribuicao: [
      { IRPJ: 25.0, CSLL: 15.0, COFINS: 14.1, PIS: 3.05, CPP: 28.85, ISS: 14.0 },
      { IRPJ: 23.0, CSLL: 15.0, COFINS: 14.1, PIS: 3.05, CPP: 27.85, ISS: 17.0 },
      { IRPJ: 24.0, CSLL: 15.0, COFINS: 14.92, PIS: 3.23, CPP: 23.85, ISS: 19.0 },
      { IRPJ: 21.0, CSLL: 15.0, COFINS: 15.74, PIS: 3.41, CPP: 23.85, ISS: 21.0 },
      { IRPJ: 23.0, CSLL: 12.5, COFINS: 14.1, PIS: 3.05, CPP: 23.85, ISS: 23.5 },
      { IRPJ: 35.0, CSLL: 15.0, COFINS: 16.03, PIS: 3.47, CPP: 13.0, ISS: 17.5 },
    ],
    temISS: true,
  },
};

// Reforma Tributária 2026–2033
const REFORMA_CRONOGRAMA = [
  { ano: 2026, fase: "Testes", ibs: 0.1, cbs: 0.9, icmsIss: 100, descricao: "IBS e CBS em fase de testes" },
  { ano: 2027, fase: "CBS Efetiva", ibs: 0.1, cbs: 8.8, icmsIss: 100, descricao: "PIS/COFINS extintos; CBS em vigor pleno" },
  { ano: 2028, fase: "Consolidação", ibs: 0.1, cbs: 8.8, icmsIss: 100, descricao: "Período de consolidação" },
  { ano: 2029, fase: "IBS 10%", ibs: 1.77, cbs: 8.8, icmsIss: 90, descricao: "Redução gradual ICMS/ISS começa" },
  { ano: 2030, fase: "IBS 20%", ibs: 3.54, cbs: 8.8, icmsIss: 80, descricao: "Transição acelerada" },
  { ano: 2031, fase: "IBS 30%", ibs: 5.31, cbs: 8.8, icmsIss: 70, descricao: "" },
  { ano: 2032, fase: "IBS 40%", ibs: 7.08, cbs: 8.8, icmsIss: 60, descricao: "" },
  { ano: 2033, fase: "Novo Modelo", ibs: 17.7, cbs: 8.8, icmsIss: 0, descricao: "ICMS e ISS extintos; IBS e CBS plenos" },
];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function parseMoeda(val: string): number {
  const cleaned = val.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function formatMoeda(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(val: number, decimals = 2): string {
  return val.toFixed(decimals).replace(".", ",") + "%";
}

function calcFaixa(rbt12: number, faixas: Faixa[]): { faixa: Faixa; idx: number } | null {
  for (let i = 0; i < faixas.length; i++) {
    if (rbt12 <= faixas[i].max) return { faixa: faixas[i], idx: i };
  }
  return null;
}

function calcAliquotaEfetiva(rbt12: number, faixa: Faixa): number {
  if (rbt12 === 0) return 0;
  return ((rbt12 * (faixa.aliquota / 100)) - faixa.parcela) / rbt12;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function Apuracao() {
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth();
  const { clienteAtivo, pgdasAtivo } = useCliente();

  const [faturamentos, setFaturamentos] = useState<string[]>(Array(12).fill(""));
  const [anexo, setAnexo] = useState<string>("I");
  const [folha12, setFolha12] = useState<string>("");
  const [empresaNova, setEmpresaNova] = useState(false);
  const [mesReferencia, setMesReferencia] = useState<number>(mesAtual);
  const [showTabela, setShowTabela] = useState(false);
  const [activeTab, setActiveTab] = useState("apuracao");
  const [pgdasCarregado, setPgdasCarregado] = useState(false);

  // Pré-popula com dados do cliente ativo e PGDAS mais recente
  useEffect(() => {
    if (!clienteAtivo) {
      setPgdasCarregado(false);
      return;
    }
    // Define anexo do cliente
    if (clienteAtivo.anexo) {
      setAnexo(clienteAtivo.anexo);
    }
  }, [clienteAtivo?.id]);

  useEffect(() => {
    if (!pgdasAtivo) {
      setPgdasCarregado(false);
      return;
    }
    // Importa receitas mensais do PGDAS
    if (pgdasAtivo.receitasMeses) {
      try {
        const meses = JSON.parse(pgdasAtivo.receitasMeses) as Array<{ mes: string; receita: number }>;
        if (Array.isArray(meses) && meses.length > 0) {
          // Distribui os até 12 últimos meses nas posições do array
          const novos = Array(12).fill("");
          const fatMeses = meses.slice(0, 12);
          fatMeses.forEach((m, i) => {
            if (m.receita > 0) {
              novos[i] = m.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
          });
          setFaturamentos(novos);
          setPgdasCarregado(true);
        }
      } catch {/* ignora JSON inválido */}
    }
    // Define anexo detectado no PGDAS
    if (pgdasAtivo.anexoDetectado) {
      setAnexo(pgdasAtivo.anexoDetectado);
    }
  }, [pgdasAtivo?.id]);

  // ── Derivações ────────────────────────────────────────────────────────────
  const valores = useMemo(() => faturamentos.map(parseMoeda), [faturamentos]);
  const totalFaturado = useMemo(() => valores.reduce((a, b) => a + b, 0), [valores]);
  const mesesPreenchidos = useMemo(() => valores.filter((v) => v > 0).length, [valores]);

  const rbt12 = useMemo(() => {
    if (empresaNova && mesesPreenchidos > 0 && mesesPreenchidos < 12) {
      return (totalFaturado / mesesPreenchidos) * 12;
    }
    return totalFaturado;
  }, [empresaNova, totalFaturado, mesesPreenchidos]);

  const folhaNum = useMemo(() => parseMoeda(folha12), [folha12]);
  const fatorR = useMemo(() => (rbt12 > 0 ? (folhaNum / rbt12) * 100 : 0), [folhaNum, rbt12]);

  const anexoEfetivo = useMemo(() => {
    if (anexo === "V" && fatorR >= 28) return "III";
    return anexo;
  }, [anexo, fatorR]);

  const anexoInfo = ANEXOS[anexoEfetivo];

  const faixaResult = useMemo(() => {
    if (rbt12 <= 0) return null;
    return calcFaixa(rbt12, anexoInfo.faixas);
  }, [rbt12, anexoInfo]);

  const aliquotaEfetiva = useMemo(() => {
    if (!faixaResult) return 0;
    return calcAliquotaEfetiva(rbt12, faixaResult.faixa);
  }, [rbt12, faixaResult]);

  const fatMesRef = useMemo(() => valores[mesReferencia] || 0, [valores, mesReferencia]);
  const dasMesRef = useMemo(() => fatMesRef * aliquotaEfetiva, [fatMesRef, aliquotaEfetiva]);
  const dasAnual = useMemo(() => totalFaturado * aliquotaEfetiva, [totalFaturado, aliquotaEfetiva]);
  const dasPorMes = useMemo(() => valores.map((v) => v * aliquotaEfetiva), [valores, aliquotaEfetiva]);

  const distTributos = useMemo(() => {
    if (!faixaResult || dasMesRef === 0) return null;
    const dist = anexoInfo.distribuicao[faixaResult.idx];
    const result: Record<string, number> = {};
    const entries = Object.entries(dist) as [string, number][];
    for (const [key, pct] of entries) {
      if (typeof pct === "number" && pct > 0) {
        result[key] = dasMesRef * (pct / 100);
      }
    }
    return result;
  }, [faixaResult, dasMesRef, anexoInfo]);

  const limiteSimples = 4800000;
  const limite6Faixa = 3600000;
  const pctLimite = rbt12 > 0 ? (rbt12 / limiteSimples) * 100 : 0;

  const alerta = useMemo(() => {
    if (rbt12 > limiteSimples) return { tipo: "error" as const, msg: "RBT12 supera R$ 4.800.000 — empresa deve ser desenquadrada do Simples Nacional!" };
    if (rbt12 > limite6Faixa) return { tipo: "warning" as const, msg: "Empresa na 6ª faixa (R$ 3,6M–4,8M). Avalie se migração para Lucro Presumido é mais vantajosa." };
    if (rbt12 > limite6Faixa * 0.9) return { tipo: "warning" as const, msg: "Empresa se aproximando da 6ª faixa. Acompanhe o faturamento de perto." };
    return null;
  }, [rbt12]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleFaturamento(idx: number, val: string) {
    const next = [...faturamentos];
    next[idx] = val;
    setFaturamentos(next);
  }

  function limpar() {
    setFaturamentos(Array(12).fill(""));
    setFolha12("");
  }

  function replicarPrimeiro() {
    const primeiro = faturamentos.find((f) => parseMoeda(f) > 0) || "";
    if (primeiro) setFaturamentos(Array(12).fill(primeiro));
  }

  // ── Cálculo reforma ───────────────────────────────────────────────────────
  function calcDasReforma(r: typeof REFORMA_CRONOGRAMA[0]): number {
    if (!faixaResult || totalFaturado === 0) return 0;
    const dist = anexoInfo.distribuicao[faixaResult.idx];
    const icmsIssShare = ((dist.ICMS || 0) + (dist.ISS || 0)) / 100;
    const icmsIssFatia = dasAnual * icmsIssShare;
    // DAS reduzido conforme ICMS/ISS saem + IBS e CBS adicionados sobre faturamento
    const dasAjustado = (dasAnual - icmsIssFatia) + (icmsIssFatia * (r.icmsIss / 100)) +
      totalFaturado * ((r.ibs + r.cbs) / 100);
    return dasAjustado;
  }

  // ─────────────────────────────────────────────────────────────────────────
  const coresTributos: Record<string, string> = {
    IRPJ: "bg-blue-500",
    CSLL: "bg-indigo-500",
    COFINS: "bg-purple-500",
    PIS: "bg-violet-400",
    CPP: "bg-orange-500",
    ICMS: "bg-green-500",
    ISS: "bg-teal-500",
    IPI: "bg-cyan-500",
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Apuração Simples Nacional
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          RBT12 · Alíquota Efetiva · DAS Mensal · Distribuição de Tributos · Impacto Reforma 2026–2033
        </p>
      </div>

      {/* Banner empresa ativa */}
      {clienteAtivo && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm ${
          pgdasCarregado
            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800"
            : "bg-primary/5 border-primary/20"
        }`}>
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-medium text-foreground">{clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial}</span>
          {pgdasCarregado && pgdasAtivo ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              — Faturamento carregado do PGDAS-D ({pgdasAtivo.periodoApuracao})
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              — Selecione o cliente para carregar o PGDAS automaticamente
            </span>
          )}
          {pgdasCarregado && (
            <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] px-1.5">
              PGDAS importado
            </Badge>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="apuracao" data-testid="tab-apuracao">Apuração</TabsTrigger>
          <TabsTrigger value="mensal" data-testid="tab-mensal">DAS Mensal</TabsTrigger>
          <TabsTrigger value="reforma" data-testid="tab-reforma">Reforma</TabsTrigger>
          <TabsTrigger value="hibrido" data-testid="tab-hibrido" className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            <span>Híbrido</span>
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════ TAB 1 — APURAÇÃO ════════════════════════ */}
        <TabsContent value="apuracao" className="space-y-5 mt-4">

          {/* Configuração */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Configuração</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Anexo */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Anexo / Atividade</Label>
                <Select value={anexo} onValueChange={setAnexo}>
                  <SelectTrigger data-testid="select-anexo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ANEXOS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{ANEXOS[anexo].descricao}</p>
              </div>

              {/* Fator R — Anexos III e V */}
              {(anexo === "III" || anexo === "V") && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Folha de Salários — 12 meses (R$)</Label>
                  <Input
                    placeholder="Ex: 120.000,00"
                    value={folha12}
                    onChange={(e) => setFolha12(e.target.value)}
                    data-testid="input-folha12"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Fator R:</span>
                    <Badge variant={fatorR >= 28 ? "default" : "secondary"} className="text-xs">
                      {fatorR > 0 ? formatPct(fatorR) : "—"}
                      {fatorR >= 28 ? " → Anexo III" : fatorR > 0 ? " → Anexo V" : ""}
                    </Badge>
                  </div>
                  {fatorR >= 28 && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Fator R ≥ 28% — tributação migra para o Anexo III (mais favorável)
                    </p>
                  )}
                  {fatorR >= 22 && fatorR < 28 && (
                    <div className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
                      <p className="font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 inline" />
                        Fator R na fronteira ({fatorR.toFixed(1)}%) — a {(28 - fatorR).toFixed(1)} p.p. do Anexo III
                      </p>
                      {(() => {
                        const rbt = rbt12;
                        if (rbt <= 0) return null;
                        // Aliq efetiva Anexo V atual
                        const calcAe = (rb: number, faixas: { min: number; max: number; aliquota: number; parcela: number }[]) => {
                          const f = faixas.find(fx => rb <= fx.max) ?? faixas[faixas.length - 1];
                          return rb > 0 ? ((rb * (f.aliquota / 100)) - f.parcela) / rb : 0;
                        };
                        const ANEXO_III_F = [{min:0,max:180000,aliquota:6.0,parcela:0},{min:180000.01,max:360000,aliquota:11.2,parcela:9360},{min:360000.01,max:720000,aliquota:13.5,parcela:17640},{min:720000.01,max:1800000,aliquota:16.0,parcela:35640},{min:1800000.01,max:3600000,aliquota:21.0,parcela:125640},{min:3600000.01,max:4800000,aliquota:33.0,parcela:648000}];
                        const ANEXO_V_F  = [{min:0,max:180000,aliquota:15.5,parcela:0},{min:180000.01,max:360000,aliquota:18.0,parcela:4500},{min:360000.01,max:720000,aliquota:19.5,parcela:9900},{min:720000.01,max:1800000,aliquota:20.5,parcela:17100},{min:1800000.01,max:3600000,aliquota:23.0,parcela:62100},{min:3600000.01,max:4800000,aliquota:30.5,parcela:540000}];
                        const aeV   = calcAe(rbt, ANEXO_V_F);
                        const aeIII = calcAe(rbt, ANEXO_III_F);
                        const economia = rbt * (aeV - aeIII);
                        if (economia <= 0) return null;
                        return (
                          <p>
                            Economia potencial ao atingir 28%:{" "}
                            <strong>{economia.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}/ano</strong>{" "}
                            ({(economia/12).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}/mês).
                            Avalie aumentar o pró-labore — compare o custo previdenciário adicional com a economia tributária.
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Empresa nova */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Empresa nova (menos de 12 meses)?</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={empresaNova ? "default" : "outline"}
                    onClick={() => setEmpresaNova(true)}
                    data-testid="btn-empresa-nova-sim"
                    className="flex-1 text-xs"
                  >
                    Sim
                  </Button>
                  <Button
                    size="sm"
                    variant={!empresaNova ? "default" : "outline"}
                    onClick={() => setEmpresaNova(false)}
                    data-testid="btn-empresa-nova-nao"
                    className="flex-1 text-xs"
                  >
                    Não
                  </Button>
                </div>
                {empresaNova && mesesPreenchidos > 0 && mesesPreenchidos < 12 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    RBT12 projetado com base em {mesesPreenchidos} meses informados
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Faturamento 12 meses */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-semibold">Faturamento — Últimos 12 Meses</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2"
                    onClick={replicarPrimeiro}
                    data-testid="btn-replicar"
                  >
                    Replicar 1º mês
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2"
                    onClick={limpar}
                    data-testid="btn-limpar"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {MESES.map((mes, idx) => (
                  <div key={idx} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{mes}</Label>
                    <Input
                      placeholder="0,00"
                      value={faturamentos[idx]}
                      onChange={(e) => handleFaturamento(idx, e.target.value)}
                      className="text-right text-sm h-8"
                      data-testid={`input-fat-${idx}`}
                    />
                    {dasPorMes[idx] > 0 && (
                      <p className="text-xs text-right text-primary font-medium">
                        DAS: {formatMoeda(dasPorMes[idx])}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resultados principais */}
          {totalFaturado > 0 && (
            <>
              {alerta && (
                <Alert variant={alerta.tipo === "error" ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{alerta.msg}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">RBT12</p>
                    <p className="text-base font-bold text-primary mt-1" data-testid="resultado-rbt12">
                      {formatMoeda(rbt12)}
                    </p>
                    {empresaNova && mesesPreenchidos < 12 && (
                      <Badge variant="secondary" className="text-xs mt-1">projetado</Badge>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Faixa</p>
                    {faixaResult ? (
                      <>
                        <p className="text-base font-bold text-blue-700 dark:text-blue-400 mt-1">
                          {faixaResult.idx + 1}ª Faixa
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Nominal: {formatPct(faixaResult.faixa.aliquota)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-bold text-red-600 mt-1">Acima do limite</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Alíquota Efetiva</p>
                    <p className="text-base font-bold text-green-700 dark:text-green-400 mt-1" data-testid="resultado-aliquota">
                      {formatPct(aliquotaEfetiva * 100)}
                    </p>
                    <p className="text-xs text-muted-foreground">sobre a receita</p>
                  </CardContent>
                </Card>

                <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">DAS Total/Ano</p>
                    <p className="text-base font-bold text-amber-700 dark:text-amber-400 mt-1" data-testid="resultado-das-anual">
                      {formatMoeda(dasAnual)}
                    </p>
                    <p className="text-xs text-muted-foreground">{totalFaturado > 0 ? `sobre ${formatMoeda(totalFaturado)}` : ""}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Barra de progresso limite */}
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Utilização do limite Simples Nacional (R$ 4.800.000)
                    </span>
                    <span className="text-xs font-semibold">{formatPct(Math.min(pctLimite, 100), 1)}</span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pctLimite > 100 ? "bg-red-500" : pctLimite > 75 ? "bg-amber-500" : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(pctLimite, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-muted-foreground">R$ 0</span>
                    <span className="text-xs text-muted-foreground">R$ 4.800.000</span>
                  </div>
                </CardContent>
              </Card>

              {/* Fórmula */}
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fórmula — Alíquota Efetiva</p>
                  {faixaResult && (
                    <div className="font-mono text-xs bg-muted/50 rounded p-3 space-y-1">
                      <p>Alíq. Efetiva = (RBT12 × Alíq. Nominal − Parcela a Deduzir) ÷ RBT12</p>
                      <p className="text-muted-foreground">
                        = ({formatMoeda(rbt12)} × {formatPct(faixaResult.faixa.aliquota)} − {formatMoeda(faixaResult.faixa.parcela)}) ÷ {formatMoeda(rbt12)}
                      </p>
                      <p className="text-primary font-bold">= {formatPct(aliquotaEfetiva * 100)}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    DAS Mensal = Receita do Mês × {formatPct(aliquotaEfetiva * 100)}
                  </p>
                </CardContent>
              </Card>

              {/* Tabela expandível */}
              <Card>
                <CardHeader
                  className="pb-2 cursor-pointer select-none"
                  onClick={() => setShowTabela(!showTabela)}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      {anexoInfo.label} — Tabela Completa de Faixas
                    </CardTitle>
                    {showTabela
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </CardHeader>
                {showTabela && (
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Faixa</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground">RBT12 até</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Alíq. Nominal</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Parcela Deduzir</th>
                            <th className="text-right py-2 pl-2 font-medium text-muted-foreground">Alíq. Efetiva (seu RBT12)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {anexoInfo.faixas.map((f, i) => {
                            const isAtual = faixaResult?.idx === i;
                            return (
                              <tr
                                key={i}
                                className={`border-b last:border-0 ${isAtual ? "bg-primary/10 font-semibold" : "hover:bg-muted/40"}`}
                              >
                                <td className="py-2 pr-3">
                                  {i + 1}ª
                                  {isAtual && (
                                    <Badge className="ml-2 text-xs py-0 h-4" variant="default">atual</Badge>
                                  )}
                                </td>
                                <td className="text-right py-2 px-2">
                                  {f.max >= 4800000 ? "R$ 4.800.000" : formatMoeda(f.max)}
                                </td>
                                <td className="text-right py-2 px-2">{formatPct(f.aliquota)}</td>
                                <td className="text-right py-2 px-2">
                                  {f.parcela > 0 ? formatMoeda(f.parcela) : "—"}
                                </td>
                                <td className="text-right py-2 pl-2 text-primary">
                                  {isAtual ? formatPct(aliquotaEfetiva * 100) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {anexoInfo.cpFora && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          Anexo IV: CPP não incluso no DAS — recolher separadamente via GPS (folha × alíquota INSS patronal).
                        </p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            </>
          )}
        </TabsContent>

        {/* ═══════════════════════ TAB 2 — DAS MENSAL ══════════════════════ */}
        <TabsContent value="mensal" className="space-y-5 mt-4">
          {totalFaturado === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Calculator className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Preencha o faturamento na aba Apuração para ver o DAS mensal.</p>
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">DAS Detalhado por Competência</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Selecione o mês para detalhamento</Label>
                    <Select
                      value={String(mesReferencia)}
                      onValueChange={(v) => setMesReferencia(Number(v))}
                    >
                      <SelectTrigger data-testid="select-mes-referencia">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map((m, i) => (
                          <SelectItem key={i} value={String(i)} disabled={valores[i] === 0}>
                            {m} {valores[i] > 0 ? `— ${formatMoeda(valores[i])}` : "(sem faturamento)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {fatMesRef > 0 && faixaResult && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-muted/40 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Faturamento {MESES[mesReferencia]}</p>
                          <p className="text-base font-bold mt-1">{formatMoeda(fatMesRef)}</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Alíquota Efetiva</p>
                          <p className="text-base font-bold mt-1 text-green-700 dark:text-green-400">
                            {formatPct(aliquotaEfetiva * 100)}
                          </p>
                        </div>
                        <div className="bg-primary/10 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">DAS a Recolher</p>
                          <p className="text-base font-bold mt-1 text-primary">{formatMoeda(dasMesRef)}</p>
                        </div>
                      </div>

                      {distTributos && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                            Composição do DAS — {MESES[mesReferencia]} ({anexoInfo.label})
                          </p>
                          <div className="space-y-2.5">
                            {Object.entries(distTributos).map(([trib, val]) => {
                              const pct = dasMesRef > 0 ? (val / dasMesRef) * 100 : 0;
                              return (
                                <div key={trib} className="flex items-center gap-2" data-testid={`tributo-${trib}`}>
                                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${coresTributos[trib] || "bg-gray-500"}`} />
                                  <span className="text-xs font-semibold w-12">{trib}</span>
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${coresTributos[trib] || "bg-gray-500"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-10 text-right">{formatPct(pct, 1)}</span>
                                  <span className="text-xs font-medium w-24 text-right">{formatMoeda(val)}</span>
                                </div>
                              );
                            })}
                          </div>
                          {anexoInfo.cpFora && (
                            <Alert className="mt-3">
                              <Info className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                Anexo IV: CPP não consta no DAS acima. Calcular separadamente: folha mensal × alíquota INSS patronal.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Tabela anual completa */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Resumo Anual — DAS por Competência</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-muted-foreground">Mês</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Faturamento</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Alíq. Efetiva</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">DAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MESES.map((mes, i) => (
                          <tr
                            key={i}
                            className={`border-b last:border-0 transition-colors ${
                              valores[i] === 0 ? "opacity-40" : "hover:bg-muted/30 cursor-pointer"
                            } ${mesReferencia === i ? "bg-primary/5" : ""}`}
                            onClick={() => { if (valores[i] > 0) setMesReferencia(i); }}
                          >
                            <td className="py-2">{mes}</td>
                            <td className="text-right py-2">{valores[i] > 0 ? formatMoeda(valores[i]) : "—"}</td>
                            <td className="text-right py-2">{valores[i] > 0 ? formatPct(aliquotaEfetiva * 100) : "—"}</td>
                            <td className="text-right py-2 font-medium text-primary">
                              {dasPorMes[i] > 0 ? formatMoeda(dasPorMes[i]) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/30">
                          <td className="py-2 font-semibold">Total Anual</td>
                          <td className="text-right py-2 font-semibold">{formatMoeda(totalFaturado)}</td>
                          <td className="text-right py-2 font-semibold">—</td>
                          <td className="text-right py-2 font-bold text-primary">{formatMoeda(dasAnual)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ═══════════════════ TAB 3 — REFORMA 2026–2033 ═══════════════════ */}
        <TabsContent value="reforma" className="space-y-5 mt-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <p className="font-semibold">Reforma Tributária — LC 214/2025 (EC 132/2023)</p>
              <p>IBS substitui ICMS + ISS gradualmente. CBS substitui PIS + COFINS a partir de 2027. Em 2033 o modelo tributário brasileiro é completamente novo.</p>
              {totalFaturado > 0 && (
                <p className="font-medium">Projeções baseadas no faturamento informado: {formatMoeda(totalFaturado)}/ano.</p>
              )}
            </div>
          </div>

          {totalFaturado === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Preencha o faturamento na aba Apuração para ver a projeção 2026–2033.</p>
            </div>
          ) : (
            <>
              {/* Projeção tabela */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Projeção Carga Tributária 2026–2033</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {anexoInfo.label} · RBT12: {formatMoeda(rbt12)} · Alíquota efetiva: {formatPct(aliquotaEfetiva * 100)}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Ano</th>
                          <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Fase</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">IBS</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">CBS</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">ICMS/ISS</th>
                          <th className="text-right py-2 pl-2 font-medium text-muted-foreground">DAS Estimado</th>
                          <th className="text-right py-2 pl-2 font-medium text-muted-foreground">Vs. Atual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {REFORMA_CRONOGRAMA.map((r) => {
                          const dasEstimado = calcDasReforma(r);
                          const variacao = dasEstimado - dasAnual;
                          const varPct = dasAnual > 0 ? (variacao / dasAnual) * 100 : 0;
                          const isAtual = r.ano === anoAtual;
                          return (
                            <tr
                              key={r.ano}
                              className={`border-b last:border-0 ${isAtual ? "bg-primary/10 font-semibold" : "hover:bg-muted/30"}`}
                            >
                              <td className="py-2 pr-2">
                                {r.ano}
                                {isAtual && (
                                  <Badge variant="default" className="ml-2 text-xs py-0 h-4">atual</Badge>
                                )}
                              </td>
                              <td className="py-2 pr-2 text-muted-foreground">{r.fase}</td>
                              <td className="text-right py-2 px-2 font-mono">{r.ibs}%</td>
                              <td className="text-right py-2 px-2 font-mono">{r.cbs}%</td>
                              <td className="text-right py-2 px-2 font-mono">{r.icmsIss}%</td>
                              <td className="text-right py-2 pl-2 font-medium">{formatMoeda(dasEstimado)}</td>
                              <td className={`text-right py-2 pl-2 ${varPct > 0.5 ? "text-red-600 dark:text-red-400" : varPct < -0.5 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                                {Math.abs(varPct) > 0.1
                                  ? `${varPct > 0 ? "+" : ""}${varPct.toFixed(1)}%`
                                  : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Estimativa simplificada baseada na composição tributária do {anexoInfo.label}.
                    Regulamentação específica do Simples Nacional pós-2033 ainda em definição.
                  </p>
                </CardContent>
              </Card>

              {/* Impacto 2026 e 2027 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-4">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-3">
                      Impacto 2026 — Fase de Testes
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IBS (0,1% sobre receita)</span>
                        <span className="font-medium">{formatMoeda(totalFaturado * 0.001)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CBS (0,9% sobre receita)</span>
                        <span className="font-medium">{formatMoeda(totalFaturado * 0.009)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>Total adicional IBS + CBS</span>
                        <span className="text-blue-700 dark:text-blue-400">{formatMoeda(totalFaturado * 0.01)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Em 2026 PIS/COFINS ainda existem — o adicional é apenas o 1% de teste.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 dark:border-orange-800">
                  <CardContent className="pt-4">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wide mb-3">
                      Impacto 2027 — CBS Efetiva (PIS/COFINS extintos)
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CBS (8,8% sobre receita)</span>
                        <span className="font-medium">{formatMoeda(totalFaturado * 0.088)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IBS (0,1% sobre receita)</span>
                        <span className="font-medium">{formatMoeda(totalFaturado * 0.001)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>CBS + IBS total</span>
                        <span className="text-orange-700 dark:text-orange-400">{formatMoeda(totalFaturado * 0.089)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        PIS e COFINS são extintos. CBS passa a ser o tributo federal sobre consumo.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ── CRÉDITOS NAS ENTRADAS (LC 214/2025) ── */}
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
                    Crédito de Entradas IBS/CBS — Impacto na Carga Líquida
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">LC 214/2025 Art. 28–47</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Não-cumulatividade plena: IBS e CBS pagos nas compras deduzem do débito nas saídas.
                    Estimativa baseada em 60% do faturamento como compras tributadas, mix 50% LP/LR e 50% SN.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Ano</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">IBS+CBS Débito</th>
                          <th className="text-right py-2 px-2 font-medium text-emerald-600">Créd. Entradas</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">DAS Bruto</th>
                          <th className="text-right py-2 pl-2 font-medium text-emerald-700 dark:text-emerald-400">DAS Líquido</th>
                          <th className="text-right py-2 pl-2 font-medium text-muted-foreground">Redução</th>
                        </tr>
                      </thead>
                      <tbody>
                        {REFORMA_CRONOGRAMA.map((r) => {
                          const comprasEst = totalFaturado * 0.6;
                          // 50% do faturamento de fornecedores LP/LR (crédito pleno), 50% SN (crédito 15%)
                          const creditoIBS = comprasEst * 0.5 * (r.ibs / 100) + comprasEst * 0.5 * (r.ibs / 100) * 0.15;
                          const creditoCBS = comprasEst * 0.5 * (r.cbs / 100) + comprasEst * 0.5 * (r.cbs / 100) * 0.15;
                          const creditoTotal = creditoIBS + creditoCBS;
                          const dasEstimado = calcDasReforma(r);
                          const ibsCbsDebito = totalFaturado * ((r.ibs + r.cbs) / 100);
                          const dasLiquido = Math.max(0, dasEstimado - creditoTotal);
                          const reducao = dasEstimado > 0 ? ((dasEstimado - dasLiquido) / dasEstimado) * 100 : 0;
                          const isAtual = r.ano === anoAtual;
                          return (
                            <tr key={r.ano} className={`border-b last:border-0 ${ isAtual ? "bg-primary/5 font-semibold" : "hover:bg-muted/20" }`}>
                              <td className="py-2 pr-2">
                                {r.ano}
                                {isAtual && <Badge variant="default" className="ml-1 text-[9px] py-0 h-4">atual</Badge>}
                              </td>
                              <td className="text-right py-2 px-2 font-mono">{formatMoeda(ibsCbsDebito)}</td>
                              <td className="text-right py-2 px-2 font-mono text-emerald-600 dark:text-emerald-400">
                                {creditoTotal > 0 ? `− ${formatMoeda(creditoTotal)}` : "—"}
                              </td>
                              <td className="text-right py-2 px-2 font-mono text-muted-foreground">{formatMoeda(dasEstimado)}</td>
                              <td className="text-right py-2 pl-2 font-medium text-emerald-700 dark:text-emerald-400">{formatMoeda(dasLiquido)}</td>
                              <td className={`text-right py-2 pl-2 ${ reducao > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground" }`}>
                                {reducao > 0.1 ? `−${reducao.toFixed(1)}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2 space-y-0.5">
                    <p><strong>Premissas desta estimativa:</strong> compras tributadas = 60% do faturamento; 50% de fornecedores LP/LR (crédito pleno) e 50% do Simples Nacional (crédito proporcional ~15% conforme Art. 144 LC 214/2025).</p>
                    <p>Use o <strong>Simulador</strong> para ajustar os percentuais ao perfil real de compras da empresa.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Cronograma de Transição 2026–2033
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-4 pl-8">
                      {REFORMA_CRONOGRAMA.map((r) => {
                        const isAtual = r.ano === anoAtual;
                        return (
                          <div key={r.ano} className="relative">
                            <div
                              className={`absolute -left-[22px] top-1.5 h-3 w-3 rounded-full border-2 ${
                                isAtual
                                  ? "bg-primary border-primary"
                                  : r.ano < anoAtual
                                  ? "bg-muted-foreground border-muted-foreground"
                                  : "bg-background border-muted-foreground"
                              }`}
                            />
                            <div className={`${isAtual ? "text-foreground" : "text-muted-foreground"}`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold ${isAtual ? "text-primary" : ""}`}>{r.ano}</span>
                                <span className="text-xs font-semibold">{r.fase}</span>
                                {r.descricao && (
                                  <span className="text-xs">— {r.descricao}</span>
                                )}
                                {isAtual && <Badge variant="default" className="text-xs py-0 h-4">você está aqui</Badge>}
                              </div>
                              <div className="flex gap-4 mt-0.5 text-xs text-muted-foreground">
                                <span>IBS: <strong className="text-foreground">{r.ibs}%</strong></span>
                                <span>CBS: <strong className="text-foreground">{r.cbs}%</strong></span>
                                <span>ICMS/ISS: <strong className="text-foreground">{r.icmsIss}%</strong></span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
        {/* ═══════════════════ TAB 4 — SISTEMA HÍBRIDO ═══════════════════ */}
        <TabsContent value="hibrido" className="space-y-5 mt-4">
          <SistemaHibridoTab rbt12={rbt12} totalFaturado={totalFaturado} aliquotaEfetiva={aliquotaEfetiva} dasAnual={dasAnual} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA HÍBRIDO — Componente separado
// ─────────────────────────────────────────────────────────────────────────────

// Alíquotas IBS/CBS para Simples Nacional 2026 (fase de testes)
// Dentro do DAS: alíquotas próprias do SN (aprox. 0,1% IBS + 0,9% CBS teste)
// Fora do DAS (regime regular): alíquota plena sujeira a variação conforme atividade
const IBS_DENTRO_DAS_2026 = 0.001;   // 0,1% fase teste
const CBS_DENTRO_DAS_2026 = 0.009;   // 0,9% fase teste
const IBS_FORA_DAS_2026  = 0.001;    // idem — fase teste idêntica mas com crédito gerado
const CBS_FORA_DAS_2026  = 0.009;    // idem
// A diferença real é que fora do DAS o cliente da cadeia pode tomar crédito

const CAMPOS_XML_NT2025: Array<{
  campo: string;
  descricao: string;
  obrigatorio: boolean;
  novoLayout: boolean;
  local: string;
}> = [
  { campo: "CST_IBS",     descricao: "Código de Situação Tributária — IBS",           obrigatorio: true,  novoLayout: true,  local: "Por item" },
  { campo: "CST_CBS",     descricao: "Código de Situação Tributária — CBS",           obrigatorio: true,  novoLayout: true,  local: "Por item" },
  { campo: "cClassTrib",  descricao: "Classificação Tributária (NBS ou NCM)",         obrigatorio: true,  novoLayout: false, local: "Por item" },
  { campo: "pIBS",        descricao: "Alíquota do IBS aplicada ao item (%)",          obrigatorio: true,  novoLayout: true,  local: "Por item" },
  { campo: "pCBS",        descricao: "Alíquota da CBS aplicada ao item (%)",          obrigatorio: true,  novoLayout: true,  local: "Por item" },
  { campo: "vIBS",        descricao: "Valor do IBS calculado sobre o item (R$)",      obrigatorio: true,  novoLayout: true,  local: "Por item" },
  { campo: "vCBS",        descricao: "Valor da CBS calculado sobre o item (R$)",      obrigatorio: true,  novoLayout: true,  local: "Por item" },
  { campo: "cCredPres",   descricao: "Classificação do Crédito Presumido",            obrigatorio: false, novoLayout: true,  local: "Por item" },
  { campo: "cBenef",      descricao: "Código de Benefício Fiscal (cBenef)",           obrigatorio: false, novoLayout: false, local: "Por item" },
  { campo: "cEST",        descricao: "Código Especificador da Substituição Tributária",obrigatorio: false, novoLayout: false, local: "Por item" },
  { campo: "vTotIBS",     descricao: "Total IBS da NF-e (soma dos itens)",            obrigatorio: true,  novoLayout: true,  local: "Total nota" },
  { campo: "vTotCBS",     descricao: "Total CBS da NF-e (soma dos itens)",            obrigatorio: true,  novoLayout: true,  local: "Total nota" },
];

const JANELAS_OPCAO = [
  {
    mes: "Setembro",
    prazo: "30/09 de cada ano",
    vigencia: "1º semestre do ano seguinte",
    descricao: "Opção até setembro → válida de janeiro a junho do próximo exercício",
    cor: "blue",
  },
  {
    mes: "Março",
    prazo: "31/03 de cada ano",
    vigencia: "2º semestre do mesmo ano",
    descricao: "Opção até março → válida de julho a dezembro do mesmo exercício",
    cor: "indigo",
  },
];

function SistemaHibridoTab({
  rbt12,
  totalFaturado,
  aliquotaEfetiva,
  dasAnual,
}: {
  rbt12: number;
  totalFaturado: number;
  aliquotaEfetiva: number;
  dasAnual: number;
}) {
  const [modo, setModo] = useState<"dentro" | "fora">("dentro");
  const [showXml, setShowXml] = useState(false);
  const [valorVenda, setValorVenda] = useState("");

  const limiteHibridoCompulsorio = 3_600_000;
  const limiteDesEnquadramento  = 4_800_000;

  // Situação do cliente
  const situacao: "normal" | "compulsorio" | "desenquadrado" =
    rbt12 > limiteDesEnquadramento
      ? "desenquadrado"
      : rbt12 > limiteHibridoCompulsorio
      ? "compulsorio"
      : "normal";

  function parseMoedaLocal(v: string) {
    return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
  }
  function fmtMoeda(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function fmtPct(v: number, d = 2) {
    return v.toFixed(d).replace(".", ",") + "%";
  }

  const venda = parseMoedaLocal(valorVenda);

  // Cálculo comparativo por nota
  const ibs_dentro = venda * IBS_DENTRO_DAS_2026;
  const cbs_dentro = venda * CBS_DENTRO_DAS_2026;
  const ibs_fora   = venda * IBS_FORA_DAS_2026;
  const cbs_fora   = venda * CBS_FORA_DAS_2026;
  // Fora do DAS: ICMS/PIS/COFINS continuam no DAS, mas IBS/CBS recolhidos separado
  // Benefício: clientes da cadeia tomam crédito pleno de IBS/CBS
  const creditoGerado = venda > 0 ? (ibs_fora + cbs_fora) : 0;

  return (
    <div className="space-y-5">

      {/* Banner explicativo */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800">
        <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Sistema Híbrido — Simples Nacional + IBS/CBS (LC 214/2025 + LC 227/2026)
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Durante 2026–2033, a empresa do Simples Nacional pode escolher entre recolher IBS/CBS <strong>dentro do DAS</strong>
            (padrão, com alíquotas próprias do SN) ou <strong>fora do DAS</strong> pelo regime regular — gerando crédito
            para a cadeia produtiva. Acima de R$ 3.600.000 de RBT12, o recolhimento fora do DAS é <strong>obrigatório</strong>.
          </p>
        </div>
      </div>

      {/* Alerta por situação */}
      {situacao === "desenquadrado" && (
        <Alert variant="destructive" data-testid="alerta-desenquadramento">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>RBT12 acima de R$ 4.800.000 — Empresa DESENQUADRADA do Simples Nacional.</strong>{" "}
            Deve migrar para Lucro Presumido ou Lucro Real. Não se aplica o regime híbrido.
          </AlertDescription>
        </Alert>
      )}

      {situacao === "compulsorio" && rbt12 > 0 && (
        <Alert data-testid="alerta-hibrido-compulsorio" className="border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-300">
            <strong>Híbrido Compulsório —</strong> RBT12 entre R$ 3.600.000 e R$ 4.800.000.
            O IBS deve ser recolhido <strong>fora do DAS</strong> pelo regime regular.
            A CBS pode permanecer no DAS. A empresa opera dois regimes simultaneamente.
            Verifique e comunique seu cliente.
          </AlertDescription>
        </Alert>
      )}

      {rbt12 === 0 && totalFaturado === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
          <Layers className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">Preencha o faturamento na aba <strong>Apuração</strong> para habilitar a análise híbrida.</p>
        </div>
      )}

      {(rbt12 > 0 || totalFaturado > 0) && situacao !== "desenquadrado" && (
        <>
          {/* ── Painel RBT12 e Limites ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">RBT12 Atual</p>
              <p className="text-lg font-bold text-foreground" data-testid="hibrido-rbt12">{fmtMoeda(rbt12)}</p>
              <Badge
                className="text-xs"
                variant={situacao === "compulsorio" ? "destructive" : "secondary"}
              >
                {situacao === "compulsorio" ? "Híbrido compulsório" : "Opção voluntária"}
              </Badge>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Limite — Opção Voluntária</p>
              <p className="text-lg font-bold text-foreground">R$ 3.600.000</p>
              <p className="text-xs text-muted-foreground">Abaixo: empresa escolhe</p>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Limite — Simples Nacional</p>
              <p className="text-lg font-bold text-foreground">R$ 4.800.000</p>
              <p className="text-xs text-muted-foreground">Acima: desenquadramento</p>
            </div>
          </div>

          {/* ── Barra de limites ── */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Posição do RBT12 nos Limites</p>
            <div className="relative h-5 bg-muted rounded-full overflow-hidden">
              {/* Zona verde: 0–3,6M */}
              <div className="absolute left-0 top-0 bottom-0 bg-green-200 dark:bg-green-900" style={{ width: "75%" }} />
              {/* Zona laranja: 3,6M–4,8M */}
              <div className="absolute top-0 bottom-0 bg-amber-300 dark:bg-amber-700" style={{ left: "75%", width: "25%" }} />
              {/* Cursor RBT12 */}
              {rbt12 > 0 && rbt12 <= limiteDesEnquadramento && (
                <div
                  className="absolute top-0 bottom-0 w-1 bg-primary rounded-full z-10"
                  style={{ left: `${Math.min((rbt12 / limiteDesEnquadramento) * 100, 99)}%` }}
                />
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>R$ 0</span>
              <span className="text-green-700 dark:text-green-400">R$ 3.600.000 — opção voluntária</span>
              <span className="text-amber-700 dark:text-amber-400">R$ 4.800.000</span>
            </div>
          </div>

          {/* ── Comparativo: Dentro vs. Fora do DAS ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
                Comparativo: IBS/CBS Dentro vs. Fora do DAS
              </p>
              {situacao === "compulsorio" && (
                <Badge variant="destructive" className="text-xs">Fora do DAS — compulsório para IBS</Badge>
              )}
            </div>

            {/* Input simulador por NF */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Simule por valor de venda da NF-e (R$):</p>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Ex: 10.000,00"
                  value={valorVenda}
                  onChange={(e) => setValorVenda(e.target.value)}
                  className="flex h-8 w-48 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="input-valor-venda"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Dentro do DAS */}
              <div
                className={`rounded-lg border-2 p-4 space-y-3 transition-colors cursor-pointer ${
                  modo === "dentro" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
                onClick={() => setModo("dentro")}
                data-testid="card-dentro-das"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dentro do DAS</p>
                  {modo === "dentro" && <Badge className="text-xs">Selecionado</Badge>}
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IBS (0,1% teste 2026)</span>
                    <span className="font-mono font-medium">{venda > 0 ? fmtMoeda(ibs_dentro) : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CBS (0,9% teste 2026)</span>
                    <span className="font-mono font-medium">{venda > 0 ? fmtMoeda(cbs_dentro) : "—"}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total IBS+CBS no DAS</span>
                    <span className="text-primary">{venda > 0 ? fmtMoeda(ibs_dentro + cbs_dentro) : "—"}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>✓ Simplicidade — tudo recolhido num único DAS</p>
                  <p>✗ Clientes da cadeia não tomam crédito de IBS/CBS</p>
                  {situacao === "compulsorio" && (
                    <p className="text-amber-600 dark:text-amber-400 font-medium">⚠ IBS deve sair do DAS — não permitido para RBT12 &gt; 3,6M</p>
                  )}
                </div>
              </div>

              {/* Fora do DAS */}
              <div
                className={`rounded-lg border-2 p-4 space-y-3 transition-colors cursor-pointer ${
                  modo === "fora" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-border hover:border-indigo-400/40"
                }`}
                onClick={() => setModo("fora")}
                data-testid="card-fora-das"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fora do DAS — Simples Híbrido</p>
                  {modo === "fora" && <Badge className="text-xs bg-indigo-600">Selecionado</Badge>}
                  {situacao === "compulsorio" && modo !== "fora" && <Badge variant="destructive" className="text-xs">Obrigatório</Badge>}
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IBS recolhido separado</span>
                    <span className="font-mono font-medium">{venda > 0 ? fmtMoeda(ibs_fora) : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CBS recolhida separada</span>
                    <span className="font-mono font-medium">{venda > 0 ? fmtMoeda(cbs_fora) : "—"}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Crédito gerado na cadeia</span>
                    <span className="text-indigo-700 dark:text-indigo-400">{venda > 0 ? fmtMoeda(creditoGerado) : "—"}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>✓ Clientes tomam crédito pleno de IBS/CBS</p>
                  <p>✓ Competitividade em vendas B2B</p>
                  <p>✗ Maior complexidade — duas guias separadas</p>
                </div>
              </div>
            </div>

            {/* Nota 2026 */}
            <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
              <strong>2026 — Fase de Testes:</strong> IBS (0,1%) e CBS (0,9%) = 1% sobre receita. Em 2027 CBS sobe para 8,8% e PIS/COFINS são extintos.
              A decisão de modalidade híbrida já vale agora e impacta 2027 em diante.
            </div>
          </div>

          {/* ── Calendário de Opção ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <p className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Janelas de Opção — Simples Híbrido
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {JANELAS_OPCAO.map((j) => (
                <div key={j.mes} className={`rounded-lg border p-3 space-y-1.5 bg-${j.cor}-50 dark:bg-${j.cor}-950/30 border-${j.cor}-200 dark:border-${j.cor}-800`}>
                  <p className={`text-xs font-bold uppercase tracking-wide text-${j.cor}-700 dark:text-${j.cor}-400`}>
                    <CalendarDays className="h-3 w-3 inline mr-1" />
                    Opção de {j.mes}
                  </p>
                  <p className="text-xs font-semibold">Prazo: {j.prazo}</p>
                  <p className="text-xs text-muted-foreground">Vigência: {j.vigencia}</p>
                  <p className="text-xs text-muted-foreground">{j.descricao}</p>
                  <Badge variant="secondary" className="text-xs">Irreversível no semestre</Badge>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <p>
                A opção pelo Simples Híbrido é <strong>semestral e irretratável</strong> no período.
                Uma vez feita a opção, não é possível voltar ao regime padrão até o semestre seguinte.
                Oriente seus clientes com antecedência.
              </p>
            </div>
          </div>

          {/* ── Checklist XML NF-e NT 2025.002 ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setShowXml(!showXml)}
            >
              <p className="text-sm font-semibold flex items-center gap-2">
                <FileCode2 className="h-4 w-4 text-primary" />
                Checklist XML NF-e Híbrido — NT 2025.002
              </p>
              {showXml
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>

            {showXml && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Campos adicionados na NF-e pelo novo leiaute (NT 2025.002). CRT=1 (Simples Nacional)
                  está <strong>dispensado da validação</strong> em 2026, mas deve adequar o leiaute do emissor.
                  Híbrido compulsório exige os campos IBS/CBS obrigatoriamente.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-3 font-medium text-muted-foreground w-8">Status</th>
                        <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Campo</th>
                        <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Descrição</th>
                        <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Local</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Novo?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CAMPOS_XML_NT2025.map((c) => (
                        <tr key={c.campo} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 pr-3">
                            {c.obrigatorio
                              ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                              : <Circle className="h-4 w-4 text-muted-foreground" />}
                          </td>
                          <td className="py-2 pr-3 font-mono text-primary font-semibold">{c.campo}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{c.descricao}</td>
                          <td className="py-2 pr-3">
                            <Badge variant="outline" className="text-xs">{c.local}</Badge>
                          </td>
                          <td className="py-2">
                            {c.novoLayout
                              ? <Badge className="text-xs bg-blue-600 hover:bg-blue-700">NT 2025.002</Badge>
                              : <Badge variant="secondary" className="text-xs">Existente</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span>Obrigatório no XML</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Condicional / opcional</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Aviso sobre sistema dual 2026 ── */}
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Sistema Dual 2026 — Coexistência Obrigatória na NF-e
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400">
              A NF-e de 2026 carrega simultaneamente os <strong>campos antigos</strong> (ICMS, PIS, COFINS)
              e os <strong>campos novos</strong> (IBS, CBS — Grupo UB por item). Ambos os blocos devem estar
              presentes no XML. O emissor precisa estar adequado ao novo leiaute da NT 2025.002.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-white dark:bg-background/40 rounded border p-2 text-xs">
                <p className="font-semibold text-muted-foreground mb-1">Campos Antigos (mantidos)</p>
                <p className="font-mono text-foreground">ICMS · PIS · COFINS · IPI</p>
                <p className="font-mono text-foreground">CST-PIS · CST-COFINS</p>
              </div>
              <div className="bg-white dark:bg-background/40 rounded border p-2 text-xs">
                <p className="font-semibold text-blue-700 dark:text-blue-400 mb-1">Campos Novos — NT 2025.002</p>
                <p className="font-mono text-foreground">IBS · CBS · pIBS · pCBS</p>
                <p className="font-mono text-foreground">vIBS · vCBS · vTotIBS · vTotCBS</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

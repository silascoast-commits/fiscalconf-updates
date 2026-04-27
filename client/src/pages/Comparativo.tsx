import { useState, useMemo } from "react";
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
  Printer,
  TrendingUp,
  TrendingDown,
  Scale,
  Info,
  CheckCircle2,
  BarChart3,
  BookOpen,
  Zap,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
type Faixa = { min: number; max: number; aliquota: number; parcela: number };
type Atividade = "comercio" | "industria" | "servicos" | "combustivel";

// ─────────────────────────────────────────────────────────────────────────────
// TABELAS SIMPLES NACIONAL — 5 Anexos (LC 123/2006)
// ─────────────────────────────────────────────────────────────────────────────
const ANEXO_I: Faixa[] = [
  { min: 0,           max: 180000,    aliquota: 4.0,  parcela: 0      },
  { min: 180000.01,   max: 360000,    aliquota: 7.3,  parcela: 5940   },
  { min: 360000.01,   max: 720000,    aliquota: 9.5,  parcela: 13860  },
  { min: 720000.01,   max: 1800000,   aliquota: 10.7, parcela: 22500  },
  { min: 1800000.01,  max: 3600000,   aliquota: 14.3, parcela: 87300  },
  { min: 3600000.01,  max: 4800000,   aliquota: 19.0, parcela: 378000 },
];
const ANEXO_II: Faixa[] = [
  { min: 0,           max: 180000,    aliquota: 4.5,  parcela: 0      },
  { min: 180000.01,   max: 360000,    aliquota: 7.8,  parcela: 5940   },
  { min: 360000.01,   max: 720000,    aliquota: 10.0, parcela: 13860  },
  { min: 720000.01,   max: 1800000,   aliquota: 11.2, parcela: 22500  },
  { min: 1800000.01,  max: 3600000,   aliquota: 14.7, parcela: 85500  },
  { min: 3600000.01,  max: 4800000,   aliquota: 30.0, parcela: 720000 },
];
const ANEXO_III: Faixa[] = [
  { min: 0,           max: 180000,    aliquota: 6.0,  parcela: 0      },
  { min: 180000.01,   max: 360000,    aliquota: 11.2, parcela: 9360   },
  { min: 360000.01,   max: 720000,    aliquota: 13.5, parcela: 17640  },
  { min: 720000.01,   max: 1800000,   aliquota: 16.0, parcela: 35640  },
  { min: 1800000.01,  max: 3600000,   aliquota: 21.0, parcela: 125640 },
  { min: 3600000.01,  max: 4800000,   aliquota: 33.0, parcela: 648000 },
];
const ANEXO_V: Faixa[] = [
  { min: 0,           max: 180000,    aliquota: 15.5, parcela: 0      },
  { min: 180000.01,   max: 360000,    aliquota: 18.0, parcela: 4500   },
  { min: 360000.01,   max: 720000,    aliquota: 19.5, parcela: 9900   },
  { min: 720000.01,   max: 1800000,   aliquota: 20.5, parcela: 17100  },
  { min: 1800000.01,  max: 3600000,   aliquota: 23.0, parcela: 62100  },
  { min: 3600000.01,  max: 4800000,   aliquota: 30.5, parcela: 540000 },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function parseMoeda(val: string): number {
  const n = parseFloat(val.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}
function formatMoeda(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatPct(val: number, dec = 2): string {
  return val.toFixed(dec).replace(".", ",") + "%";
}
function calcFaixaIdx(rbt12: number, faixas: Faixa[]): number {
  for (let i = 0; i < faixas.length; i++) if (rbt12 <= faixas[i].max) return i;
  return faixas.length - 1;
}
function calcAliquotaEfetiva(rbt12: number, faixa: Faixa): number {
  if (rbt12 === 0) return 0;
  return ((rbt12 * (faixa.aliquota / 100)) - faixa.parcela) / rbt12;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLES NACIONAL
// ─────────────────────────────────────────────────────────────────────────────
function calcSimples(rbt12: number, atividade: Atividade, fatorR: number) {
  let faixas: Faixa[];
  let anexoLabel: string;
  let anexoCod: string;

  if (atividade === "comercio" || atividade === "combustivel") {
    faixas = ANEXO_I; anexoLabel = atividade === "combustivel" ? "Anexo I — Comércio (Combustíveis)" : "Anexo I — Comércio"; anexoCod = "I";
  } else if (atividade === "industria") {
    faixas = ANEXO_II; anexoLabel = "Anexo II — Indústria"; anexoCod = "II";
  } else {
    if (fatorR >= 28) {
      faixas = ANEXO_III; anexoLabel = "Anexo III — Serviços (Fator R ≥ 28%)"; anexoCod = "III";
    } else {
      faixas = ANEXO_V; anexoLabel = "Anexo V — Serviços (Fator R < 28%)"; anexoCod = "V";
    }
  }

  const idx = calcFaixaIdx(rbt12, faixas);
  const faixa = faixas[idx];
  const aliquotaEfetiva = calcAliquotaEfetiva(rbt12, faixa);
  const tributoAnual = rbt12 * aliquotaEfetiva;

  // Economia potencial se Fator R for ajustado para ≥ 28% (só serviços no Anexo V)
  let economiaFatorR: number | null = null;
  if (atividade === "servicos" && fatorR < 28 && fatorR > 0) {
    const idxIII = calcFaixaIdx(rbt12, ANEXO_III);
    const aeIII = calcAliquotaEfetiva(rbt12, ANEXO_III[idxIII]);
    const tribIII = rbt12 * aeIII;
    economiaFatorR = tributoAnual - tribIII;
  }

  return {
    anexoLabel, anexoCod, faixaIdx: idx + 1,
    aliquotaNominal: faixa.aliquota,
    aliquotaEfetiva: aliquotaEfetiva * 100,
    tributoAnual, tributoMensal: tributoAnual / 12,
    economiaFatorR,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LUCRO PRESUMIDO
// ─────────────────────────────────────────────────────────────────────────────
type PresumidoResult = {
  baseIRPJ: number; baseCSLL: number;
  irpjPrincipal: number; irpjAdicional: number; irpjTotal: number;
  csll: number; pis: number; cofins: number;
  issOuIcms: number; issOuIcmsLabel: string;
  tributoAnual: number; tributoMensal: number; aliquotaEfetiva: number;
  presuncaoIRPJ: number; presuncaoCSLL: number;
};

function calcPresumido(rbt12: number, atividade: Atividade, aliquotaIssIcms: number): PresumidoResult {
  // RIR/2018 art. 519 §1º, III: revenda de combustíveis — 1,6% IRPJ; CSLL 12%
  const presuncaoIRPJ = atividade === "servicos" ? 32 : atividade === "combustivel" ? 1.6 : 8;
  const presuncaoCSLL = atividade === "servicos" ? 32 : 12;
  const baseIRPJ = rbt12 * (presuncaoIRPJ / 100);
  const baseCSLL = rbt12 * (presuncaoCSLL / 100);
  const irpjPrincipal = baseIRPJ * 0.15;
  const excedente = Math.max(0, baseIRPJ - 240000);
  const irpjAdicional = excedente * 0.10;
  const irpjTotal = irpjPrincipal + irpjAdicional;
  const csll = baseCSLL * 0.09;
  const pis = rbt12 * 0.0065;
  const cofins = rbt12 * 0.03;
  const issOuIcms = rbt12 * (aliquotaIssIcms / 100);
  const issOuIcmsLabel = atividade === "servicos" ? "ISS" : "ICMS";
  const tributoAnual = irpjTotal + csll + pis + cofins + issOuIcms;
  return {
    baseIRPJ, baseCSLL, irpjPrincipal, irpjAdicional, irpjTotal,
    csll, pis, cofins, issOuIcms, issOuIcmsLabel,
    tributoAnual, tributoMensal: tributoAnual / 12,
    aliquotaEfetiva: rbt12 > 0 ? (tributoAnual / rbt12) * 100 : 0,
    presuncaoIRPJ, presuncaoCSLL,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LUCRO REAL — novo
// Cálculo baseado em: lucro contábil ajustado + LALUR (adições/exclusões)
// IRPJ: 15% sobre lucro real + adicional 10% acima R$20k/mês (R$240k/ano)
// CSLL: 9% sobre base de cálculo da CSLL (≈ lucro real)
// PIS: 1,65% não-cumulativo (crédito das entradas)
// COFINS: 7,6% não-cumulativo (crédito das entradas)
// ISS/ICMS: sobre receita bruta (igual presumido)
// ─────────────────────────────────────────────────────────────────────────────
type RealResult = {
  lucroReal: number;
  baseIRPJ: number; baseCSLL: number;
  irpjPrincipal: number; irpjAdicional: number; irpjTotal: number;
  csll: number;
  pisDebito: number; pisCredito: number; pisLiquido: number;
  cofinsDebito: number; cofinsCredito: number; cofinsLiquido: number;
  issOuIcms: number; issOuIcmsLabel: string;
  tributoAnual: number; tributoMensal: number; aliquotaEfetiva: number;
  margemLucro: number;
  adicoesLALUR: number; exclusoesLALUR: number;
};

function calcReal(
  rbt12: number,
  atividade: Atividade,
  margemLucro: number,
  aliquotaIssIcms: number,
  comprasRbt12: number,  // % das compras sobre receita (para crédito PIS/COFINS)
  adicoesLALUR: number,
  exclusoesLALUR: number
): RealResult {
  const lucroContabil = rbt12 * (margemLucro / 100);
  // Base IRPJ = lucro contábil + adições - exclusões (LALUR)
  const baseIRPJ = Math.max(0, lucroContabil + adicoesLALUR - exclusoesLALUR);
  const baseCSLL = Math.max(0, lucroContabil + adicoesLALUR - exclusoesLALUR); // simplificado

  const irpjPrincipal = baseIRPJ * 0.15;
  const excedente = Math.max(0, baseIRPJ - 240000);
  const irpjAdicional = excedente * 0.10;
  const irpjTotal = irpjPrincipal + irpjAdicional;
  const csll = baseCSLL * 0.09;

  // PIS/COFINS não-cumulativo (Lucro Real obrigatório)
  const pisDebito = rbt12 * 0.0165;
  const cofinsDebito = rbt12 * 0.076;
  const baseCompras = rbt12 * (comprasRbt12 / 100);
  const pisCredito = baseCompras * 0.0165;
  const cofinsCredito = baseCompras * 0.076;
  const pisLiquido = Math.max(0, pisDebito - pisCredito);
  const cofinsLiquido = Math.max(0, cofinsDebito - cofinsCredito);

  const issOuIcms = rbt12 * (aliquotaIssIcms / 100);
  const issOuIcmsLabel = atividade === "servicos" ? "ISS" : "ICMS";

  const tributoAnual = irpjTotal + csll + pisLiquido + cofinsLiquido + issOuIcms;
  return {
    lucroReal: lucroContabil, baseIRPJ, baseCSLL,
    irpjPrincipal, irpjAdicional, irpjTotal,
    csll,
    pisDebito, pisCredito, pisLiquido,
    cofinsDebito, cofinsCredito, cofinsLiquido,
    issOuIcms, issOuIcmsLabel,
    tributoAnual, tributoMensal: tributoAnual / 12,
    aliquotaEfetiva: rbt12 > 0 ? (tributoAnual / rbt12) * 100 : 0,
    margemLucro,
    adicoesLALUR, exclusoesLALUR,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function Comparativo() {
  const [faturamento, setFaturamento]         = useState("");
  const [atividade, setAtividade]             = useState<Atividade>("comercio");
  const [fatorRPct, setFatorRPct]             = useState("");
  const [aliquotaIssIcms, setAliquotaIssIcms] = useState("3");
  // Lucro Real
  const [margemLucro, setMargemLucro]         = useState("8");
  const [comprasRbt12, setComprasRbt12]       = useState("50");
  const [adicoesStr, setAdicoesStr]           = useState("0");
  const [exclusoesStr, setExclusoesStr]       = useState("0");

  const rbt12        = useMemo(() => parseMoeda(faturamento), [faturamento]);
  const fatorR       = useMemo(() => { const n = parseFloat(fatorRPct.replace(",",".")); return isNaN(n) ? 0 : n; }, [fatorRPct]);
  const aliqNum      = useMemo(() => { const n = parseFloat(aliquotaIssIcms.replace(",",".")); return isNaN(n) ? 0 : n; }, [aliquotaIssIcms]);
  const margemNum    = useMemo(() => { const n = parseFloat(margemLucro.replace(",",".")); return isNaN(n) ? 8 : n; }, [margemLucro]);
  const comprasNum   = useMemo(() => { const n = parseFloat(comprasRbt12.replace(",",".")); return isNaN(n) ? 50 : n; }, [comprasRbt12]);
  const adicoesNum   = useMemo(() => parseMoeda(adicoesStr), [adicoesStr]);
  const exclusoesNum = useMemo(() => parseMoeda(exclusoesStr), [exclusoesStr]);

  const simples  = useMemo(() => rbt12 > 0 ? calcSimples(rbt12, atividade, fatorR) : null,  [rbt12, atividade, fatorR]);
  const presumido= useMemo(() => rbt12 > 0 ? calcPresumido(rbt12, atividade, aliqNum) : null, [rbt12, atividade, aliqNum]);
  const real     = useMemo(() => rbt12 > 0 ? calcReal(rbt12, atividade, margemNum, aliqNum, comprasNum, adicoesNum, exclusoesNum) : null, [rbt12, atividade, margemNum, aliqNum, comprasNum, adicoesNum, exclusoesNum]);

  // Classificação dos 3 regimes
  const regimes = useMemo(() => {
    if (!simples || !presumido || !real) return [];
    return [
      { label: "Simples Nacional", valor: simples.tributoAnual,  aliq: simples.aliquotaEfetiva,  cor: "emerald" },
      { label: "Lucro Presumido",  valor: presumido.tributoAnual, aliq: presumido.aliquotaEfetiva, cor: "blue"    },
      { label: "Lucro Real",       valor: real.tributoAnual,      aliq: real.aliquotaEfetiva,      cor: "violet"  },
    ].sort((a, b) => a.valor - b.valor);
  }, [simples, presumido, real]);

  const melhorRegime  = regimes[0] ?? null;
  const maxTributo    = regimes.length ? Math.max(...regimes.map(r => r.valor)) : 1;

  // Alertas
  const fatorRFronteira  = atividade === "servicos" && fatorR > 0 && fatorR >= 22 && fatorR < 28;
  const riscoExclusao    = rbt12 > 4200000; // acima de R$4,2M já está em risco real
  const jaExcluido       = rbt12 > 4800000;
  const faixa6SN         = rbt12 > 3600000 && rbt12 <= 4800000;

  const corMap: Record<string, string> = {
    emerald: "bg-emerald-500",
    blue:    "bg-blue-500",
    violet:  "bg-violet-500",
  };
  const textMap: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue:    "text-blue-600 dark:text-blue-400",
    violet:  "text-violet-600 dark:text-violet-400",
  };
  const bgMap: Record<string, string> = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/20",
    blue:    "bg-blue-50 dark:bg-blue-950/20",
    violet:  "bg-violet-50 dark:bg-violet-950/20",
  };
  const ringMap: Record<string, string> = {
    emerald: "ring-emerald-500",
    blue:    "ring-blue-500",
    violet:  "ring-violet-500",
  };

  return (
    <>
      <style>{`
        @media print {
          header, footer, nav, [data-print-hide], button, .no-print { display: none !important; }
          body { background: white !important; color: black !important; font-size: 11pt; }
          .print-container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          .bg-card, .bg-background { background: white !important; border: 1px solid #ddd !important; box-shadow: none !important; }
          .text-emerald-600 { color: #059669 !important; }
          .text-blue-600    { color: #2563eb !important; }
          .text-violet-600  { color: #7c3aed !important; }
          .text-red-600     { color: #dc2626 !important; }
          .print-container::after {
            content: "Salubre Contabilidade e Associados — FiscalConf v2.9";
            display: block; margin-top: 40px; padding-top: 12px;
            border-top: 1px solid #ccc; font-size: 9pt; color: #555; text-align: center;
          }
          .card-print-break { page-break-inside: avoid; }
        }
      `}</style>

      <div className="space-y-6 print-container">
        {/* ── Cabeçalho ── */}
        <div className="flex items-center justify-between flex-wrap gap-3" data-print-hide>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Comparativo de Regime Tributário
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Simples Nacional · Lucro Presumido · Lucro Real — análise completa lado a lado
            </p>
          </div>
          {simples && (
            <Button variant="outline" size="sm" className="gap-2 no-print" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
          )}
        </div>
        <div className="hidden print:block text-center mb-4">
          <h1 className="text-2xl font-bold">FiscalConf — Comparativo Tributário</h1>
          <p className="text-sm text-gray-500">Simples Nacional × Lucro Presumido × Lucro Real · {new Date().toLocaleDateString("pt-BR")}</p>
        </div>

        {/* ── Formulário ── */}
        <Card data-print-hide>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Dados para Comparação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Linha 1: base */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Faturamento Anual (R$)</Label>
                <Input placeholder="Ex: 1.200.000,00" value={faturamento} onChange={e => setFaturamento(e.target.value)} />
                <p className="text-xs text-muted-foreground">RBT12 — Receita Bruta 12 meses</p>
              </div>
              <div className="space-y-1.5">
                <Label>Atividade Principal</Label>
                <Select value={atividade} onValueChange={v => setAtividade(v as Atividade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comercio">Comércio (Anexo I)</SelectItem>
                    <SelectItem value="industria">Indústria (Anexo II)</SelectItem>
                    <SelectItem value="servicos">Serviços (Anexo III / V)</SelectItem>
                    <SelectItem value="combustivel">Revenda de Combustíveis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Folha / Receita — Fator R (%)</Label>
                <Input
                  placeholder="Ex: 28,00"
                  value={fatorRPct}
                  onChange={e => setFatorRPct(e.target.value)}
                  disabled={atividade !== "servicos"}
                />
                <p className={`text-xs ${fatorR >= 28 ? "text-emerald-600 font-medium" : fatorR > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {atividade !== "servicos" ? "Somente para Serviços" : fatorR >= 28 ? "✓ ≥ 28% → Anexo III" : fatorR > 0 ? `${fatorR.toFixed(1)}% → Anexo V` : "Percentual folha/RBT12"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>{atividade === "servicos" ? "Alíquota ISS (%)" : "Alíquota ICMS (%)"}</Label>
                <Input placeholder="Ex: 3" value={aliquotaIssIcms} onChange={e => setAliquotaIssIcms(e.target.value)} />
                <p className="text-xs text-muted-foreground">{atividade === "servicos" ? "ISS: 2% a 5%" : "ICMS estadual aplicável"}</p>
              </div>
            </div>

            {/* Linha 2: parâmetros Lucro Real */}
            <div className="border rounded-lg p-4 bg-violet-50/40 dark:bg-violet-950/10 border-violet-200 dark:border-violet-800 space-y-3">
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" />
                Parâmetros do Lucro Real (LALUR)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Margem de Lucro (%)</Label>
                  <Input className="text-xs" placeholder="8" value={margemLucro} onChange={e => setMargemLucro(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">Lucro contábil / receita bruta</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Compras / Receita (%)</Label>
                  <Input className="text-xs" placeholder="50" value={comprasRbt12} onChange={e => setComprasRbt12(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">Base crédito PIS/COFINS não-cumulativo</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Adições LALUR (R$)</Label>
                  <Input className="text-xs" placeholder="0" value={adicoesStr} onChange={e => setAdicoesStr(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">Provisões, multas, despesas não dedutíveis</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Exclusões LALUR (R$)</Label>
                  <Input className="text-xs" placeholder="0" value={exclusoesStr} onChange={e => setExclusoesStr(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">JCP, dividendos SN, compensação de prejuízo</p>
                </div>
              </div>
              <p className="text-[10px] text-violet-600 dark:text-violet-400">
                PIS 1,65% + COFINS 7,6% não-cumulativos. Crédito calculado sobre % de compras informado.
                IRPJ 15% + adic. 10% s/ base &gt; R$240k/ano. CSLL 9%.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── ALERTAS ── */}
        {jaExcluido && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Exclusão obrigatória:</strong> RBT12 de {formatMoeda(rbt12)} supera o limite de R$4.800.000 do Simples Nacional. A empresa deve ser desenquadrada. Apenas Lucro Presumido ou Real são aplicáveis.
            </AlertDescription>
          </Alert>
        )}

        {riscoExclusao && !jaExcluido && (
          <Alert className="border-red-400 bg-red-50 dark:bg-red-950/20">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              <strong>Risco de exclusão do Simples Nacional:</strong> Com RBT12 de {formatMoeda(rbt12)}, a empresa está a {formatMoeda(4800000 - rbt12)} do limite. Monitore mensalmente — o desenquadramento ocorre no mês seguinte ao da extrapolação (ou em janeiro do ano seguinte, se a extrapolação for ≤ 20% do limite anterior).
            </AlertDescription>
          </Alert>
        )}

        {faixa6SN && !riscoExclusao && (
          <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>6ª faixa do Simples Nacional:</strong> RBT12 acima de R$3.600.000. A alíquota nominal sobe significativamente — compare com Lucro Presumido a cada exercício.
            </AlertDescription>
          </Alert>
        )}

        {/* ── ALERTA FATOR R na fronteira ── */}
        {fatorRFronteira && simples && (
          <Alert className="border-blue-400 bg-blue-50 dark:bg-blue-950/20">
            <Zap className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Atenção — Fator R próximo de 28% (atual: {formatPct(fatorR)}):</strong>{" "}
              Aumentar o pró-labore pode elevar o Fator R para ≥ 28% e migrar do Anexo V para o Anexo III.
              {simples.economiaFatorR !== null && simples.economiaFatorR > 0 && (
                <> Economia potencial: <strong>{formatMoeda(simples.economiaFatorR)}/ano ({formatMoeda(simples.economiaFatorR / 12)}/mês)</strong>. Verifique se o custo previdenciário do pró-labore adicional é menor que a economia tributária.</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* ── Sem dados ── */}
        {!simples && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Scale className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Informe o faturamento anual para comparar os três regimes tributários.</p>
            </CardContent>
          </Card>
        )}

        {/* ── RESULTADO: 3 regimes ── */}
        {simples && presumido && real && (
          <div className="space-y-6">
            {/* Gráfico visual */}
            <Card className="card-print-break">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Comparativo Visual — Carga Tributária Anual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Simples Nacional", valor: simples.tributoAnual,  aliq: simples.aliquotaEfetiva,  cor: "emerald" },
                  { label: "Lucro Presumido",  valor: presumido.tributoAnual, aliq: presumido.aliquotaEfetiva, cor: "blue" },
                  { label: "Lucro Real",       valor: real.tributoAnual,      aliq: real.aliquotaEfetiva,      cor: "violet" },
                ].map(r => (
                  <div key={r.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{r.label}</span>
                      <span className={`font-semibold ${textMap[r.cor]}`}>{formatMoeda(r.valor)}</span>
                    </div>
                    <div className="h-8 bg-muted rounded-md overflow-hidden">
                      <div className={`h-full ${corMap[r.cor]} rounded-md transition-all duration-700 flex items-center justify-end pr-2`}
                        style={{ width: `${(r.valor / maxTributo) * 100}%` }}>
                        <span className="text-xs font-bold text-white whitespace-nowrap">{formatPct(r.aliq)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {melhorRegime && (
                  <div className="rounded-md bg-muted/50 p-3 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground">Melhor regime identificado:</span>
                    <span className={`font-bold text-base ${textMap[melhorRegime.cor]}`}>
                      {melhorRegime.label} — {formatPct(melhorRegime.aliq)} efetivo
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cards dos 3 regimes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* ── Simples Nacional ── */}
              <Card className={`card-print-break ${melhorRegime?.label === "Simples Nacional" ? "ring-2 ring-emerald-500" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Simples Nacional</CardTitle>
                    {melhorRegime?.label === "Simples Nacional" && (
                      <Badge className="bg-emerald-500 text-white text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Melhor</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{simples.anexoLabel}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Alíquota Efetiva</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatPct(simples.aliquotaEfetiva)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Nominal {formatPct(simples.aliquotaNominal)} · {simples.faixaIdx}ª faixa</p>
                  </div>
                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Tributo Anual</span><span className="font-semibold">{formatMoeda(simples.tributoAnual)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tributo Mensal</span><span className="font-semibold">{formatMoeda(simples.tributoMensal)}</span></div>
                    {atividade === "servicos" && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fator R</span>
                        <span className={fatorR >= 28 ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                          {formatPct(fatorR)} ({fatorR >= 28 ? "Anexo III" : "Anexo V"})
                        </span>
                      </div>
                    )}
                  </div>
                  {simples.economiaFatorR !== null && simples.economiaFatorR > 0 && (
                    <div className="rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2 text-xs text-blue-800 dark:text-blue-300">
                      <Zap className="h-3 w-3 inline mr-1" />
                      Fator R próximo de 28%: economia potencial de <strong>{formatMoeda(simples.economiaFatorR)}/ano</strong> se migrar para Anexo III.
                    </div>
                  )}
                  <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground space-y-0.5">
                    <p>• IRPJ, CSLL, PIS, COFINS, CPP e ISS/ICMS no DAS</p>
                    <p>• Limite RBT12: R$4.800.000</p>
                    <p>• CPP inclusa — sem guia separada de previdência</p>
                  </div>
                </CardContent>
              </Card>

              {/* ── Lucro Presumido ── */}
              <Card className={`card-print-break ${melhorRegime?.label === "Lucro Presumido" ? "ring-2 ring-blue-500" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">Lucro Presumido</CardTitle>
                    {melhorRegime?.label === "Lucro Presumido" && (
                      <Badge className="bg-blue-500 text-white text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Melhor</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Presunção IRPJ {presumido.presuncaoIRPJ}% / CSLL {presumido.presuncaoCSLL}%</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Alíquota Efetiva</p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatPct(presumido.aliquotaEfetiva)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Sobre receita bruta de {formatMoeda(rbt12)}</p>
                    {atividade === "combustivel" && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                        Presunção IRPJ 1,6% (RIR/2018 art. 519 §1º III)
                      </p>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Tributo Anual</span><span className="font-semibold">{formatMoeda(presumido.tributoAnual)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tributo Mensal</span><span className="font-semibold">{formatMoeda(presumido.tributoMensal)}</span></div>
                    <Separator className="my-1" />
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">IRPJ principal (15%)</span><span>{formatMoeda(presumido.irpjPrincipal)}</span></div>
                    {presumido.irpjAdicional > 0 && (
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">IRPJ adicional (10%)</span><span className="text-amber-600">{formatMoeda(presumido.irpjAdicional)}</span></div>
                    )}
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">CSLL (9%)</span><span>{formatMoeda(presumido.csll)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">PIS (0,65%)</span><span>{formatMoeda(presumido.pis)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">COFINS (3%)</span><span>{formatMoeda(presumido.cofins)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">{presumido.issOuIcmsLabel} ({formatPct(aliqNum)})</span><span>{formatMoeda(presumido.issOuIcms)}</span></div>
                  </div>
                  <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground space-y-0.5">
                    <p>• Base IRPJ: {formatMoeda(presumido.baseIRPJ)} ({presumido.presuncaoIRPJ}% da receita)</p>
                    {atividade === "combustivel" && (
                      <p className="text-amber-700 dark:text-amber-400 font-medium">• Combustíveis: presunção IRPJ reduzida a 1,6% (vs. 8% no comércio geral) — RIR/2018 art. 519 §1º, III</p>
                    )}
                    <p>• PIS/COFINS cumulativo (sem crédito)</p>
                    <p>• Distribuição de lucros isenta de IR para sócios</p>
                  </div>
                </CardContent>
              </Card>

              {/* ── Lucro Real ── */}
              <Card className={`card-print-break ${melhorRegime?.label === "Lucro Real" ? "ring-2 ring-violet-500" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-violet-700 dark:text-violet-400">Lucro Real</CardTitle>
                    {melhorRegime?.label === "Lucro Real" && (
                      <Badge className="bg-violet-500 text-white text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Melhor</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Margem {formatPct(margemNum)} · PIS/COFINS não-cumulativo</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Alíquota Efetiva</p>
                    <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">{formatPct(real.aliquotaEfetiva)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Lucro real: {formatMoeda(real.lucroReal)} · LALUR: +{formatMoeda(real.adicoesLALUR)} −{formatMoeda(real.exclusoesLALUR)}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Tributo Anual</span><span className="font-semibold">{formatMoeda(real.tributoAnual)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tributo Mensal</span><span className="font-semibold">{formatMoeda(real.tributoMensal)}</span></div>
                    <Separator className="my-1" />
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">IRPJ principal (15%)</span><span>{formatMoeda(real.irpjPrincipal)}</span></div>
                    {real.irpjAdicional > 0 && (
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">IRPJ adicional (10%)</span><span className="text-amber-600">{formatMoeda(real.irpjAdicional)}</span></div>
                    )}
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">CSLL (9%)</span><span>{formatMoeda(real.csll)}</span></div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">PIS 1,65% (líq.)</span>
                      <span>
                        {formatMoeda(real.pisLiquido)}
                        <span className="text-emerald-600 ml-1">−{formatMoeda(real.pisCredito)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">COFINS 7,6% (líq.)</span>
                      <span>
                        {formatMoeda(real.cofinsLiquido)}
                        <span className="text-emerald-600 ml-1">−{formatMoeda(real.cofinsCredito)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">{real.issOuIcmsLabel} ({formatPct(aliqNum)})</span><span>{formatMoeda(real.issOuIcms)}</span></div>
                  </div>
                  <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground space-y-0.5">
                    <p>• Obrigatório: receita &gt; R$78M/ano, bancos, factoring</p>
                    <p>• Apuração: trimestral ou anual (estimativa mensal)</p>
                    <p>• Pode compensar prejuízos fiscais acumulados (30% limite/ano)</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Recomendação e Análise Completa ── */}
            {melhorRegime && (
              <Card className={`card-print-break border-l-4 border-l-${melhorRegime.cor}-500`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-primary" />
                    Recomendação & Análise Estratégica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Ranking */}
                  <div className="grid grid-cols-3 gap-3">
                    {regimes.map((r, i) => (
                      <div key={r.label} className={`rounded-lg border p-3 text-center ${i === 0 ? `${bgMap[r.cor]} border-${r.cor}-300` : "bg-muted/30"}`}>
                        <div className="text-xs text-muted-foreground mb-0.5">{i === 0 ? "🥇 1º" : i === 1 ? "🥈 2º" : "🥉 3º"}</div>
                        <div className={`font-semibold text-xs ${i === 0 ? textMap[r.cor] : ""}`}>{r.label}</div>
                        <div className={`font-bold text-lg ${i === 0 ? textMap[r.cor] : "text-muted-foreground"}`}>{formatPct(r.aliq)}</div>
                        <div className="text-xs text-muted-foreground">{formatMoeda(r.valor)}/ano</div>
                        {i > 0 && (
                          <div className="text-[10px] text-red-500 mt-0.5">+{formatMoeda(r.valor - regimes[0].valor)}/ano</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Fatores adicionais */}
                  <div className="rounded bg-muted/40 p-3 space-y-2 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground text-sm flex items-center gap-1">
                      <Info className="h-3.5 w-3.5" /> Fatores adicionais a considerar:
                    </p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>No Simples Nacional, a CPP está inclusa no DAS — no Presumido e Real, recolhe-se ~20% sobre a folha separadamente.</li>
                      <li>No Lucro Presumido e Real, a distribuição de lucros para sócios é isenta de IR (art. 10 da Lei 9.249/95).</li>
                      <li>No Lucro Real com margem baixa (&lt;8% comércio, &lt;32% serviços), a carga de IRPJ/CSLL é menor que no Presumido.</li>
                      <li>No Lucro Real, créditos de PIS/COFINS não-cumulativos (1,65% + 7,6%) sobre compras reduzem significativamente a carga em empresas com alto volume de entradas tributadas.</li>
                      {atividade === "servicos" && fatorR > 0 && fatorR < 28 && (
                        <li className="text-blue-700 dark:text-blue-400 font-medium">
                          Fator R em {formatPct(fatorR)} — avaliar aumento de pró-labore para atingir 28% e migrar do Anexo V para o III.
                        </li>
                      )}
                      {riscoExclusao && (
                        <li className="text-red-600 dark:text-red-400 font-medium">
                          RBT12 próximo do limite SN (R$4,8M) — planejar migração de regime para não ser surpreendido por desenquadramento retroativo.
                        </li>
                      )}
                      {real.lucroReal < 0 && (
                        <li className="text-violet-700 dark:text-violet-400 font-medium">
                          Com margem de lucro negativa, o Lucro Real pode ser obrigatoriamente mais vantajoso — prejuízo não gera IRPJ/CSLL e pode ser compensado nos 5 anos seguintes.
                        </li>
                      )}
                    </ul>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Cálculo com base em: LC 123/2006 · Lei 9.430/1996 · RIR/2018 (Decreto 9.580) · Lei 9.718/1998. Consulte seu contador para análise completa do caso concreto.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}

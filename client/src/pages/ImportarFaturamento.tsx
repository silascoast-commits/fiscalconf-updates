import { useState, useRef, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { useCliente } from "@/contexts/ClienteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, FileSpreadsheet, FileText, Calculator, TrendingUp, TrendingDown,
  AlertTriangle, Info, CheckCircle2, Download, Printer, RefreshCw,
  BarChart3, Zap, ArrowRightLeft, Scale, Building2, Receipt, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── CONSTANTES REFORMA TRIBUTÁRIA (EC 132/2023 + LC 214/2025) ───────────────
// Fonte: gov.br/fazenda, Receita Federal, CRCSP, Escola Superior de Contabilidade

const CBS_REF = 8.8;   // % alíquota referência CBS (federal)
const IBS_REF = 17.7;  // % alíquota referência IBS (estadual/municipal)

type AnoTransicao = {
  fase: string;
  cor: string;
  cbsAliq: number;       // CBS % sobre receita bruta
  ibsAliq: number;       // IBS % sobre receita bruta
  icmsIssPerc: number;   // % do ICMS/ISS original ainda vigente (0–100)
  pisCofinsSN: boolean;  // PIS/COFINS ainda no DAS do SN?
  pisExt: boolean;       // PIS/COFINS extintos para LP/LR?
  descricao: string;
  eventos: string[];
};

const CRONOGRAMA: Record<number, AnoTransicao> = {
  2026: {
    fase: "Testes", cor: "amber",
    cbsAliq: 0.9, ibsAliq: 0.1, icmsIssPerc: 100,
    pisCofinsSN: true, pisExt: false,
    descricao: "Alíquotas simbólicas. Tributos antigos integralmente vigentes.",
    eventos: [
      "CBS 0,9% e IBS 0,1% — apenas testes operacionais (sem desembolso real)",
      "PIS, COFINS, ICMS e ISS seguem integralmente",
      "Novos campos obrigatórios no XML da NF-e (cClassTrib, CST IBS/CBS)",
    ],
  },
  2027: {
    fase: "CBS Efetiva", cor: "blue",
    cbsAliq: CBS_REF, ibsAliq: 0.1, icmsIssPerc: 100,
    pisCofinsSN: true, pisExt: true,
    descricao: "CBS plena substitui PIS/COFINS. IS instituted. ICMS/ISS inalterados.",
    eventos: [
      "PIS e COFINS extintos — substituídos pela CBS (8,8% referência federal)",
      "Imposto Seletivo (IS) entra em vigor sobre bens/serviços prejudiciais",
      "Lucro Presumido: CBS não-cumulativa — créditos sobre compras tributadas",
      "Simples Nacional: IBS/CBS destacados na NF; DAS segue com PIS/COFINS embutidos",
    ],
  },
  2028: {
    fase: "Consolidação", cor: "blue",
    cbsAliq: CBS_REF, ibsAliq: 0.1, icmsIssPerc: 100,
    pisCofinsSN: true, pisExt: true,
    descricao: "Mesmo cenário de 2027. Ano de consolidação operacional.",
    eventos: [
      "CBS segue em vigor; regras consolidadas",
      "Empresas adaptam sistemas e processos",
    ],
  },
  2029: {
    fase: "IBS 10%", cor: "orange",
    cbsAliq: CBS_REF, ibsAliq: IBS_REF * 0.1, icmsIssPerc: 90,
    pisCofinsSN: false, pisExt: true,
    descricao: "IBS (10% da alíquota plena) substitui 10% do ICMS/ISS.",
    eventos: [
      `IBS = ${(IBS_REF * 0.1).toFixed(2)}% (10% da alíquota referência ${IBS_REF}%)`,
      "ICMS e ISS reduzidos a 90% das alíquotas originais",
      "Simples Nacional: PIS/COFINS saem do DAS; CBS paga separadamente",
    ],
  },
  2030: {
    fase: "IBS 20%", cor: "orange",
    cbsAliq: CBS_REF, ibsAliq: IBS_REF * 0.2, icmsIssPerc: 80,
    pisCofinsSN: false, pisExt: true,
    descricao: "IBS (20%) substitui 20% do ICMS/ISS.",
    eventos: [
      `IBS = ${(IBS_REF * 0.2).toFixed(2)}% (20% da alíquota referência)`,
      "ICMS e ISS reduzidos a 80%",
    ],
  },
  2031: {
    fase: "IBS 40%", cor: "red",
    cbsAliq: CBS_REF, ibsAliq: IBS_REF * 0.4, icmsIssPerc: 60,
    pisCofinsSN: false, pisExt: true,
    descricao: "Aceleração da transição — IBS assume 40%.",
    eventos: [
      `IBS = ${(IBS_REF * 0.4).toFixed(2)}% (40% da alíquota referência)`,
      "ICMS e ISS reduzidos a 60%",
    ],
  },
  2032: {
    fase: "IBS 60%", cor: "red",
    cbsAliq: CBS_REF, ibsAliq: IBS_REF * 0.6, icmsIssPerc: 40,
    pisCofinsSN: false, pisExt: true,
    descricao: "IBS com 60% da alíquota plena.",
    eventos: [
      `IBS = ${(IBS_REF * 0.6).toFixed(2)}% (60% da alíquota referência)`,
      "ICMS e ISS reduzidos a 40%",
    ],
  },
  2033: {
    fase: "Novo Modelo", cor: "green",
    cbsAliq: CBS_REF, ibsAliq: IBS_REF, icmsIssPerc: 0,
    pisCofinsSN: false, pisExt: true,
    descricao: "ICMS e ISS extintos. CBS e IBS plenos. Modelo definitivo.",
    eventos: [
      "ICMS e ISS integralmente extintos",
      `IBS = ${IBS_REF}% (alíquota referência plena)`,
      `CBS = ${CBS_REF}% (alíquota referência plena)`,
      "Sistema tributário completamente renovado",
    ],
  },
};

const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

// ─── TABELAS SIMPLES NACIONAL ─────────────────────────────────────────────────
type Faixa = { min: number; max: number; aliquota: number; parcela: number };
type Dist = { IRPJ: number; CSLL: number; COFINS: number; PIS: number; CPP: number; ICMS?: number; ISS?: number };

const ANEXOS: Record<string, { faixas: Faixa[]; dist: Dist[]; label: string; temICMS: boolean; temISS: boolean }> = {
  I: {
    label: "Anexo I — Comércio",
    temICMS: true, temISS: false,
    faixas: [
      { min: 0, max: 180000, aliquota: 4.0, parcela: 0 },
      { min: 180000.01, max: 360000, aliquota: 7.3, parcela: 5940 },
      { min: 360000.01, max: 720000, aliquota: 9.5, parcela: 13860 },
      { min: 720000.01, max: 1800000, aliquota: 10.7, parcela: 22500 },
      { min: 1800000.01, max: 3600000, aliquota: 14.3, parcela: 87300 },
      { min: 3600000.01, max: 4800000, aliquota: 19.0, parcela: 378000 },
    ],
    dist: [
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 41.5, ICMS: 34.0 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 41.5, ICMS: 34.0 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 42.0, ICMS: 33.5 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 42.0, ICMS: 33.5 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 42.0, ICMS: 33.5 },
      { IRPJ: 13.5, CSLL: 10.0, COFINS: 28.27, PIS: 6.13, CPP: 42.1, ICMS: 0 },
    ],
  },
  II: {
    label: "Anexo II — Indústria",
    temICMS: true, temISS: false,
    faixas: [
      { min: 0, max: 180000, aliquota: 4.5, parcela: 0 },
      { min: 180000.01, max: 360000, aliquota: 7.8, parcela: 5940 },
      { min: 360000.01, max: 720000, aliquota: 10.0, parcela: 13860 },
      { min: 720000.01, max: 1800000, aliquota: 11.2, parcela: 22500 },
      { min: 1800000.01, max: 3600000, aliquota: 14.7, parcela: 85500 },
      { min: 3600000.01, max: 4800000, aliquota: 30.0, parcela: 720000 },
    ],
    dist: [
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 37.0, ICMS: 34.0 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 37.0, ICMS: 34.0 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 37.0, ICMS: 34.0 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 37.0, ICMS: 34.0 },
      { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 37.0, ICMS: 34.0 },
      { IRPJ: 13.5, CSLL: 10.0, COFINS: 28.27, PIS: 6.13, CPP: 42.1, ICMS: 0 },
    ],
  },
  III: {
    label: "Anexo III — Serviços (Fator R ≥ 28%)",
    temICMS: false, temISS: true,
    faixas: [
      { min: 0, max: 180000, aliquota: 6.0, parcela: 0 },
      { min: 180000.01, max: 360000, aliquota: 11.2, parcela: 9360 },
      { min: 360000.01, max: 720000, aliquota: 13.5, parcela: 17640 },
      { min: 720000.01, max: 1800000, aliquota: 16.0, parcela: 35640 },
      { min: 1800000.01, max: 3600000, aliquota: 21.0, parcela: 125640 },
      { min: 3600000.01, max: 4800000, aliquota: 33.0, parcela: 648000 },
    ],
    dist: [
      { IRPJ: 4.0, CSLL: 3.5, COFINS: 12.82, PIS: 2.78, CPP: 43.4, ISS: 33.5 },
      { IRPJ: 4.0, CSLL: 3.5, COFINS: 14.05, PIS: 3.05, CPP: 43.4, ISS: 32.0 },
      { IRPJ: 4.0, CSLL: 3.5, COFINS: 13.64, PIS: 2.96, CPP: 43.4, ISS: 32.5 },
      { IRPJ: 4.0, CSLL: 3.5, COFINS: 13.64, PIS: 2.96, CPP: 43.4, ISS: 32.5 },
      { IRPJ: 4.0, CSLL: 3.5, COFINS: 12.82, PIS: 2.78, CPP: 43.4, ISS: 33.5 },
      { IRPJ: 35.0, CSLL: 15.0, COFINS: 16.03, PIS: 2.78, CPP: 16.38, ISS: 14.9 },
    ],
  },
  V: {
    label: "Anexo V — Serviços (Fator R < 28%)",
    temICMS: false, temISS: true,
    faixas: [
      { min: 0, max: 180000, aliquota: 15.5, parcela: 0 },
      { min: 180000.01, max: 360000, aliquota: 18.0, parcela: 4500 },
      { min: 360000.01, max: 720000, aliquota: 19.5, parcela: 9900 },
      { min: 720000.01, max: 1800000, aliquota: 20.5, parcela: 17100 },
      { min: 1800000.01, max: 3600000, aliquota: 23.0, parcela: 62100 },
      { min: 3600000.01, max: 4800000, aliquota: 30.5, parcela: 540000 },
    ],
    dist: [
      { IRPJ: 25.0, CSLL: 15.0, COFINS: 14.1, PIS: 3.05, CPP: 28.85, ISS: 14.0 },
      { IRPJ: 23.0, CSLL: 15.0, COFINS: 14.1, PIS: 3.05, CPP: 27.85, ISS: 17.0 },
      { IRPJ: 24.0, CSLL: 15.0, COFINS: 14.92, PIS: 3.23, CPP: 23.85, ISS: 19.0 },
      { IRPJ: 21.0, CSLL: 15.0, COFINS: 15.74, PIS: 3.41, CPP: 23.85, ISS: 21.0 },
      { IRPJ: 23.0, CSLL: 12.5, COFINS: 14.1, PIS: 3.05, CPP: 23.85, ISS: 23.5 },
      { IRPJ: 35.0, CSLL: 15.0, COFINS: 16.03, PIS: 2.78, CPP: 16.38, ISS: 14.9 },
    ],
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function moeda(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function pct(v: number, dec = 2) { return v.toFixed(dec) + "%"; }
function num(s: string): number { const n = parseFloat(s.replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; }
function fmtNum(v: number): string { return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function getFaixa(faixas: Faixa[], rbt12: number) {
  return faixas.find(f => rbt12 >= f.min && rbt12 <= f.max) || faixas[faixas.length - 1];
}
function aliquotaEfetivaSN(rbt12: number, faixa: Faixa): number {
  if (rbt12 === 0) return faixa.aliquota / 100;
  return (rbt12 * (faixa.aliquota / 100) - faixa.parcela) / rbt12;
}

// ─── CÁLCULO SIMPLES NACIONAL ─────────────────────────────────────────────────
type ResultadoSN = {
  das: number;
  icmsIss: number;
  pisCofins: number;
  cppIrpjCsll: number;
  cbs: number;
  ibs: number;
  total: number;
  aliqEfetiva: number;
  faixaIdx: number;
  aliqNominal: number;
};

function calcSN(
  rbt12: number,
  receita: number,
  anexo: string,
  icmsIssOriginal: number, // alíquota nominal de ICMS ou ISS informada pelo usuário (%)
  ano: number,
): ResultadoSN {
  const tab = ANEXOS[anexo];
  const faixa = getFaixa(tab.faixas, rbt12);
  const faixaIdx = tab.faixas.indexOf(faixa) + 1;
  const aliqEfetiva = aliquotaEfetivaSN(rbt12, faixa);
  const das = receita * aliqEfetiva;

  const dist = tab.dist[Math.min(faixaIdx - 1, tab.dist.length - 1)];
  const pisCofinsPerc = ((dist.COFINS || 0) + (dist.PIS || 0)) / 100;
  const icmsIssPerc   = ((dist.ICMS || 0) + (dist.ISS || 0)) / 100;
  const cppIrpjCsllPerc = ((dist.CPP || 0) + (dist.IRPJ || 0) + (dist.CSLL || 0)) / 100;

  const cn = CRONOGRAMA[ano];

  // PIS/COFINS — sai do DAS em 2029+ (SN começa a pagar CBS separado)
  const pisCofinsNoDAS = cn.pisCofinsSN ? das * pisCofinsPerc : 0;
  const pisCofinsForaDAS = 0; // SN não paga CBS/IBS fora do DAS nesta modelagem base

  // ICMS/ISS — reduzido conforme transição
  const icmsIssNoDAS = das * icmsIssPerc * (cn.icmsIssPerc / 100);

  // Restante (IRPJ, CSLL, CPP)
  const cppIrpjCsll = das * cppIrpjCsllPerc;

  // DAS efetivo = soma dos componentes que ainda estão no DAS
  const dasEfetivo = cppIrpjCsll + pisCofinsNoDAS + icmsIssNoDAS;

  // CBS — a partir de 2029 o SN paga CBS separado (estimativa simplificada)
  const cbsFora = !cn.pisCofinsSN && ano >= 2029
    ? receita * (cn.cbsAliq / 100)
    : (ano >= 2027 && ano <= 2028 ? receita * (cn.cbsAliq / 100) * 0.0 : 0);
  // Nota: 2027-2028 SN ainda tem PIS/COFINS embutidos no DAS; CBS é apenas teste simbólico
  const cbs = ano === 2026 ? receita * (0.9 / 100) * 0 : cbsFora; // teste 2026 = sem efeito

  // IBS
  const ibs = ano >= 2029 ? receita * (cn.ibsAliq / 100) : receita * (cn.ibsAliq / 100) * 0;

  const total = dasEfetivo + cbs + ibs;

  return {
    das: dasEfetivo,
    icmsIss: icmsIssNoDAS,
    pisCofins: pisCofinsNoDAS,
    cppIrpjCsll,
    cbs,
    ibs,
    total,
    aliqEfetiva: total / receita,
    faixaIdx,
    aliqNominal: faixa.aliquota,
  };
}

// ─── CÁLCULO LUCRO PRESUMIDO ──────────────────────────────────────────────────
type ResultadoLP = {
  irpj: number;
  csll: number;
  pis: number;
  cofins: number;
  cbs: number;
  cbsCredito: number;
  cbsLiquida: number;
  icmsIss: number;
  ibs: number;
  ibsCredito: number;
  ibsLiquido: number;
  total: number;
  aliqEfetiva: number;
  baseIRPJ: number;
  baseCSLL: number;
  presuncaoIRPJ: number;
  presuncaoCSLL: number;
};

function calcLP(
  receita: number,
  atividade: "comercio" | "servicos",
  icmsIssAliq: number,  // % ICMS (comércio) ou ISS (serviços) — alíquota cheia do setor
  percCompras: number,  // % das compras sobre a receita (para créditos CBS/IBS)
  ano: number,
): ResultadoLP {
  const cn = CRONOGRAMA[ano];
  const presuncaoIRPJ = atividade === "servicos" ? 32 : 8;
  const presuncaoCSLL = atividade === "servicos" ? 32 : 12;
  const baseIRPJ = receita * (presuncaoIRPJ / 100);
  const baseCSLL = receita * (presuncaoCSLL / 100);

  const irpjPrincipal = baseIRPJ * 0.15;
  const irpjAdicional = Math.max(0, baseIRPJ - 240000) * 0.10; // anual
  const irpj = irpjPrincipal + irpjAdicional;
  const csll = baseCSLL * 0.09;

  // PIS/COFINS — extintos a partir de 2027
  const pis    = cn.pisExt ? 0 : receita * 0.0065;
  const cofins = cn.pisExt ? 0 : receita * 0.030;

  // CBS — substitui PIS/COFINS a partir de 2027; não-cumulativa
  const cbsBruta  = cn.pisExt ? receita * (cn.cbsAliq / 100) : 0;
  const cbsCredito = cbsBruta * (percCompras / 100);
  const cbsLiquida = Math.max(0, cbsBruta - cbsCredito);

  // ICMS/ISS — reduzido conforme transição
  const icmsIss = receita * (icmsIssAliq / 100) * (cn.icmsIssPerc / 100);

  // IBS — substitui ICMS/ISS gradualmente; não-cumulativo
  const ibsBruta   = receita * (cn.ibsAliq / 100);
  const ibsCredito = ibsBruta * (percCompras / 100);
  const ibsLiquido = Math.max(0, ibsBruta - ibsCredito);

  const total = irpj + csll + pis + cofins + cbsLiquida + icmsIss + ibsLiquido;

  return {
    irpj, csll, pis, cofins,
    cbs: cbsBruta, cbsCredito, cbsLiquida,
    icmsIss, ibs: ibsBruta, ibsCredito, ibsLiquido,
    total, aliqEfetiva: receita > 0 ? total / receita : 0,
    baseIRPJ, baseCSLL, presuncaoIRPJ, presuncaoCSLL,
  };
}

// ─── PARSE EXCEL ──────────────────────────────────────────────────────────────
const MESES_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

function parseExcelFile(buffer: ArrayBuffer): Record<string, number> {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const result: Record<string, number> = {};

  for (const row of rows) {
    if (!row || row.length < 2) continue;
    const c0 = String(row[0]).trim();
    const c1 = String(row[1]).trim();

    // Procura valor numérico na linha
    let valor = 0;
    for (let i = 1; i < row.length; i++) {
      const v = parseFloat(String(row[i]).replace(/[^\d,.-]/g, "").replace(",", "."));
      if (!isNaN(v) && v > 0) { valor = v; break; }
    }
    if (valor <= 0) continue;

    // Detecta chave mês/ano no formato MM/AAAA
    const m1 = c0.match(/^(\d{1,2})[\/\-](\d{4})$/);
    if (m1) { result[`${m1[1].padStart(2, "0")}/${m1[2]}`] = valor; continue; }

    // Detecta nome do mês + ano "Janeiro 2025" ou "Jan/25"
    const m2 = c0.toLowerCase().match(/^([\wç]+)[.\s\/\-]*(\d{2,4})$/);
    if (m2) {
      const mn = MESES_PT[m2[1]];
      if (mn) {
        const ano = m2[2].length === 2 ? `20${m2[2]}` : m2[2];
        result[`${String(mn).padStart(2, "0")}/${ano}`] = valor;
        continue;
      }
    }

    // Detecta Excel serial date (número) como mês
    if (/^\d+$/.test(c0) && Number(c0) > 40000 && Number(c0) < 55000) {
      const d = XLSX.SSF.parse_date_code(Number(c0));
      if (d) {
        const key = `${String(d.m).padStart(2, "0")}/${d.y}`;
        result[key] = valor;
      }
    }
  }
  return result;
}

// ─── MESES PARA DISPLAY ───────────────────────────────────────────────────────
function mesLabel(key: string): string {
  const [m, a] = key.split("/");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[parseInt(m) - 1]}/${a}`;
}

function sortMeses(meses: string[]): string[] {
  return [...meses].sort((a, b) => {
    const [ma, aa] = a.split("/");
    const [mb, ab] = b.split("/");
    return (Number(aa) * 12 + Number(ma)) - (Number(ab) * 12 + Number(mb));
  });
}

// ─── COR DE BADGES ────────────────────────────────────────────────────────────
const corMap: Record<string, string> = {
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  blue:  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  orange:"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  red:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function ImportarFaturamento() {
  const { clienteAtivo } = useCliente();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Dados importados ──
  const [meses, setMeses] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [importInfo, setImportInfo] = useState<{ fonte: string; qtd: number } | null>(null);

  // ── Configuração ──
  const [regime, setRegime]           = useState("simples");
  const [anexo, setAnexo]             = useState("I");
  const [atividade, setAtividade]     = useState<"comercio" | "servicos">("comercio");
  const [icmsIssAliq, setIcmsIssAliq] = useState("12"); // ICMS padrão comércio
  const [percCompras, setPercCompras] = useState("60"); // % de compras com crédito CBS/IBS

  // ── Entrada manual ──
  const [expandedManual, setExpandedManual] = useState(false);
  const mesKeys = useMemo(() => {
    const now = new Date();
    const keys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);
    }
    return keys;
  }, []);

  // ── Cálculos ──
  const rbt12 = useMemo(() => Object.values(meses).reduce((a, b) => a + b, 0), [meses]);
  const receitaMedia = rbt12 / 12;

  const projecaoSN = useMemo(() => {
    if (rbt12 === 0) return null;
    return ANOS.map(ano => ({
      ano,
      ...calcSN(rbt12, rbt12, anexo, parseFloat(icmsIssAliq) || 12, ano),
    }));
  }, [rbt12, anexo, icmsIssAliq]);

  const projecaoLP = useMemo(() => {
    if (rbt12 === 0) return null;
    return ANOS.map(ano => ({
      ano,
      ...calcLP(rbt12, atividade, parseFloat(icmsIssAliq) || 12, parseFloat(percCompras) || 60, ano),
    }));
  }, [rbt12, atividade, icmsIssAliq, percCompras]);

  // ── Upload ──
  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "pdf") {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("pdf", file);
        const res = await fetch("/api/parse-billing-pdf", { method: "POST", body: fd });
        if (!res.ok) throw new Error((await res.json()).error || "Erro no servidor");
        const data: { meses: Record<string, number>; tipo: string; confianca: number } = await res.json();
        if (Object.keys(data.meses).length === 0) {
          toast({ title: "Nenhum dado encontrado", description: "O PDF não contém dados de faturamento reconhecíveis. Use a entrada manual.", variant: "destructive" });
        } else {
          setMeses(data.meses);
          setImportInfo({ fonte: `PDF (${data.tipo}, confiança ${data.confianca}%)`, qtd: Object.keys(data.meses).length });
          toast({ title: "PDF importado", description: `${Object.keys(data.meses).length} meses extraídos (tipo: ${data.tipo}).` });
        }
      } catch (err: any) {
        toast({ title: "Erro ao processar PDF", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
      return;
    }

    if (["xlsx", "xls", "csv"].includes(ext || "")) {
      try {
        const buf = await file.arrayBuffer();
        const data = parseExcelFile(buf);
        if (Object.keys(data).length === 0) {
          toast({ title: "Nenhum dado encontrado", description: "Verifique o formato: coluna A = Mês (MM/AAAA), coluna B = Valor.", variant: "destructive" });
        } else {
          setMeses(data);
          setImportInfo({ fonte: `Excel (${file.name})`, qtd: Object.keys(data).length });
          toast({ title: "Excel importado", description: `${Object.keys(data).length} meses extraídos com sucesso.` });
        }
      } catch (err: any) {
        toast({ title: "Erro ao processar Excel", description: err.message, variant: "destructive" });
      }
      return;
    }

    toast({ title: "Formato não suportado", description: "Envie .xlsx, .xls, .csv ou .pdf", variant: "destructive" });
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (key: string, val: string) => {
    const v = num(val);
    setMeses(prev => {
      if (v <= 0) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: v };
    });
    if (!importInfo) setImportInfo({ fonte: "Entrada manual", qtd: 0 });
  };

  const clearData = () => {
    setMeses({});
    setImportInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const mesesOrdenados = useMemo(() => sortMeses(Object.keys(meses)), [meses]);

  // ── Renderização ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 print:px-0 print:py-0">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Apuração & Projeção — Reforma Tributária 2026–2033
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe Excel, PDF ou informe o faturamento dos últimos 12 meses para calcular Simples Nacional e Lucro Presumido ano a ano
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          {rbt12 > 0 && (
            <Button variant="outline" size="sm" onClick={clearData}>
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Cliente ativo */}
      {clienteAtivo && (
        <Alert className="border-primary/30 bg-primary/5">
          <Building2 className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{clienteAtivo.razaoSocial}</span>
            <Badge variant="outline" className="text-xs">{clienteAtivo.regime}</Badge>
            {clienteAtivo.anexo && <Badge variant="outline" className="text-xs">Anexo {clienteAtivo.anexo}</Badge>}
          </AlertDescription>
        </Alert>
      )}

      {/* Configuração */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Configuração da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Regime Tributário</Label>
            <Select value={regime} onValueChange={setRegime}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Simples Nacional</SelectItem>
                <SelectItem value="presumido">Lucro Presumido</SelectItem>
                <SelectItem value="ambos">Ambos (Comparativo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(regime === "simples" || regime === "ambos") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Anexo (Simples Nacional)</Label>
              <Select value={anexo} onValueChange={setAnexo}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ANEXOS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Atividade</Label>
            <Select value={atividade} onValueChange={v => setAtividade(v as any)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comercio">Comércio</SelectItem>
                <SelectItem value="servicos">Serviços</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{atividade === "servicos" ? "Alíquota ISS (%)" : "Alíquota ICMS (%)"}</Label>
            <Input className="h-8 text-xs" value={icmsIssAliq}
              onChange={e => setIcmsIssAliq(e.target.value)}
              placeholder={atividade === "servicos" ? "2 a 5" : "7, 12 ou 18"} />
          </div>

          {(regime === "presumido" || regime === "ambos") && (
            <div className="space-y-1.5">
              <Label className="text-xs">% Compras tributadas (crédito CBS/IBS)</Label>
              <Input className="h-8 text-xs" value={percCompras}
                onChange={e => setPercCompras(e.target.value)}
                placeholder="Ex: 60" />
              <p className="text-[10px] text-muted-foreground">Compras que geram crédito não-cumulativo</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload & Entrada Manual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Zona de upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Importar Excel / PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {uploading
                ? <><RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" /><p className="text-sm">Processando...</p></>
                : <>
                  <div className="flex justify-center gap-3 mb-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-500" />
                    <FileText className="h-8 w-8 text-red-500" />
                  </div>
                  <p className="text-sm font-medium">Arraste ou clique para importar</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx · .xls · .csv · .pdf</p>
                </>
              }
            </div>

            {/* Formatos aceitos */}
            <div className="rounded-lg bg-muted/40 p-3 space-y-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-xs flex items-center gap-1"><Info className="h-3 w-3" /> Formatos aceitos:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>Excel/CSV:</strong> Col. A = Mês (MM/AAAA), Col. B = Faturamento</li>
                <li><strong>PDF PGDAS-D:</strong> Extrato do Simples Nacional (Receita Federal)</li>
                <li><strong>PDF genérico:</strong> Relatórios ContaAzul, Omie, Nibo, etc.</li>
              </ul>
            </div>

            {importInfo && (
              <Alert className="border-green-400 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200 text-xs">
                  <strong>Importado:</strong> {importInfo.fonte} — {importInfo.qtd} períodos
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Resumo & Entrada manual */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Faturamento 12 Meses
              </CardTitle>
              {rbt12 > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs">{moeda(rbt12)}/ano</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Resumo importado */}
            {mesesOrdenados.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="h-7">
                      <TableHead className="text-xs py-1 px-2">Mês</TableHead>
                      <TableHead className="text-xs py-1 px-2 text-right">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mesesOrdenados.map(k => (
                      <TableRow key={k} className="h-7">
                        <TableCell className="text-xs py-1 px-2">{mesLabel(k)}</TableCell>
                        <TableCell className="text-xs py-1 px-2 text-right font-medium">{moeda(meses[k])}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="h-7 bg-muted/50">
                      <TableCell className="text-xs py-1 px-2 font-semibold">Total RBT12</TableCell>
                      <TableCell className="text-xs py-1 px-2 text-right font-bold">{moeda(rbt12)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Entrada manual */}
            <div>
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setExpandedManual(!expandedManual)}>
                {expandedManual ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                Entrada manual mês a mês
              </Button>
              {expandedManual && (
                <div className="mt-2 grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {mesKeys.map(k => (
                    <div key={k} className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">{mesLabel(k)}</Label>
                      <Input
                        className="h-7 text-xs"
                        placeholder="0,00"
                        value={meses[k] ? fmtNum(meses[k]) : ""}
                        onChange={e => handleInputChange(k, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sem dados */}
      {rbt12 === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum dado de faturamento</p>
            <p className="text-sm mt-1">Importe um arquivo ou preencha manualmente os 12 meses para gerar as projeções.</p>
          </CardContent>
        </Card>
      )}

      {/* Resultados */}
      {rbt12 > 0 && (
        <Tabs defaultValue={regime === "presumido" ? "presumido" : regime === "ambos" ? "comparativo" : "simples"}>
          <TabsList className="print:hidden">
            {(regime === "simples" || regime === "ambos") && (
              <TabsTrigger value="simples" className="text-xs">Simples Nacional</TabsTrigger>
            )}
            {(regime === "presumido" || regime === "ambos") && (
              <TabsTrigger value="presumido" className="text-xs">Lucro Presumido</TabsTrigger>
            )}
            {regime === "ambos" && (
              <TabsTrigger value="comparativo" className="text-xs">Comparativo</TabsTrigger>
            )}
            <TabsTrigger value="cronograma" className="text-xs">Cronograma</TabsTrigger>
          </TabsList>

          {/* ── SIMPLES NACIONAL ── */}
          {(regime === "simples" || regime === "ambos") && (
            <TabsContent value="simples" className="space-y-4 mt-4">
              <ProjecaoSN projecao={projecaoSN!} rbt12={rbt12} anexo={anexo} />
            </TabsContent>
          )}

          {/* ── LUCRO PRESUMIDO ── */}
          {(regime === "presumido" || regime === "ambos") && (
            <TabsContent value="presumido" className="space-y-4 mt-4">
              <ProjecaoLP projecao={projecaoLP!} rbt12={rbt12} atividade={atividade} percCompras={parseFloat(percCompras)} />
            </TabsContent>
          )}

          {/* ── COMPARATIVO ── */}
          {regime === "ambos" && projecaoSN && projecaoLP && (
            <TabsContent value="comparativo" className="space-y-4 mt-4">
              <ComparativoRegimes sn={projecaoSN} lp={projecaoLP} rbt12={rbt12} />
            </TabsContent>
          )}

          {/* ── CRONOGRAMA ── */}
          <TabsContent value="cronograma" className="space-y-4 mt-4">
            <CronogramaReforma receita={rbt12} />
          </TabsContent>
        </Tabs>
      )}

      {/* Rodapé legal */}
      <p className="text-[10px] text-muted-foreground text-center pb-4">
        Cálculos baseados em: EC 132/2023 · LC 214/2025 · LC 123/2006 · Lei 9.430/1996 · RIR/2018.
        CBS 8,8% e IBS 17,7% — alíquotas de referência (sujeitas a ajuste pelo Senado e estados).
        Consulte sempre seu contador para análise do caso concreto.
      </p>
    </div>
  );
}

// ─── SUB-COMPONENTE: PROJEÇÃO SIMPLES NACIONAL ────────────────────────────────
function ProjecaoSN({ projecao, rbt12, anexo }: {
  projecao: (ReturnType<typeof calcSN> & { ano: number })[];
  rbt12: number;
  anexo: string;
}) {
  const tab = ANEXOS[anexo];
  const faixa = getFaixa(tab.faixas, rbt12);
  const faixaIdx = tab.faixas.indexOf(faixa) + 1;
  const aliqEfAtual = aliquotaEfetivaSN(rbt12, faixa) * 100;
  const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pct = (v: number) => (v * 100).toFixed(2) + "%";

  return (
    <div className="space-y-4">
      {/* Resumo atual */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">{tab.label}</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{aliqEfAtual.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">Alíquota efetiva atual</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">RBT12</p>
            <p className="text-lg font-bold">{moeda(rbt12)}</p>
            <p className="text-xs text-muted-foreground">{faixaIdx}ª faixa · {faixa.aliquota}% nominal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">DAS anual (atual)</p>
            <p className="text-lg font-bold">{moeda(projecao[0]?.das || 0)}</p>
            <p className="text-xs text-muted-foreground">sem reforma</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Carga total 2033</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{moeda(projecao[projecao.length - 1]?.total || 0)}</p>
            <p className="text-xs text-muted-foreground">com reforma plena</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela ano a ano */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Projeção Simples Nacional — 2026 a 2033
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Ano</TableHead>
                <TableHead className="text-xs">Fase</TableHead>
                <TableHead className="text-right text-xs">DAS</TableHead>
                <TableHead className="text-right text-xs">IBS</TableHead>
                <TableHead className="text-right text-xs">CBS</TableHead>
                <TableHead className="text-right text-xs font-bold">Total</TableHead>
                <TableHead className="text-right text-xs">Alíq. Efetiva</TableHead>
                <TableHead className="text-right text-xs">Var. vs 2026</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projecao.map((r, i) => {
                const cn = CRONOGRAMA[r.ano];
                const base = projecao[0].total;
                const delta = r.total - base;
                return (
                  <TableRow key={r.ano} className={i === projecao.length - 1 ? "bg-muted/50 font-semibold" : ""}>
                    <TableCell className="text-xs font-semibold">{r.ano}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${corMap[cn.cor]}`}>{cn.fase}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">{moeda(r.das)}</TableCell>
                    <TableCell className="text-right text-xs">{r.ibs > 0 ? moeda(r.ibs) : "—"}</TableCell>
                    <TableCell className="text-right text-xs">{r.cbs > 0 ? moeda(r.cbs) : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-bold">{moeda(r.total)}</TableCell>
                    <TableCell className="text-right text-xs">{(r.aliqEfetiva * 100).toFixed(2)}%</TableCell>
                    <TableCell className={`text-right text-xs ${delta > 0 ? "text-red-600" : delta < 0 ? "text-green-600" : ""}`}>
                      {delta !== 0 ? `${delta > 0 ? "+" : ""}${moeda(delta)}` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/20">
        <Info className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
          <strong>Simples Nacional e a reforma:</strong> Em 2026 os novos campos são obrigatórios na NF-e, mas sem efeito financeiro.
          A partir de 2027 o SN destaca CBS/IBS separadamente (permanece no DAS até 2029). De 2029 em diante, o IBS substitui gradualmente a parcela de ICMS/ISS do DAS.
          Em 2033 o sistema é completamente renovado. Regulamentação específica do SN pós-2033 em definição pelo Comitê Gestor do IBS.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ─── SUB-COMPONENTE: PROJEÇÃO LUCRO PRESUMIDO ─────────────────────────────────
function ProjecaoLP({ projecao, rbt12, atividade, percCompras }: {
  projecao: (ReturnType<typeof calcLP> & { ano: number })[];
  rbt12: number;
  atividade: string;
  percCompras: number;
}) {
  const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const r2026 = projecao[0];
  const r2027 = projecao[1];
  const r2033 = projecao[projecao.length - 1];
  const impactoCBS = r2027.total - r2026.total;

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Carga atual (2026)</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{(r2026.aliqEfetiva * 100).toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">Alíquota efetiva</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Impacto CBS 2027</p>
            <p className={`text-lg font-bold ${impactoCBS > 0 ? "text-red-600" : "text-green-600"}`}>
              {impactoCBS > 0 ? "+" : ""}{moeda(impactoCBS)}
            </p>
            <p className="text-xs text-muted-foreground">vs. 2026 (PIS/COFINS extintos)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Créditos estimados 2033</p>
            <p className="text-lg font-bold text-green-600">{moeda(r2033.cbsCredito + r2033.ibsCredito)}</p>
            <p className="text-xs text-muted-foreground">{percCompras}% compras com crédito</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Carga total 2033</p>
            <p className="text-lg font-bold">{moeda(r2033.total)}</p>
            <p className="text-xs text-muted-foreground">{(r2033.aliqEfetiva * 100).toFixed(2)}% efetivo</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela detalhada */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Projeção Lucro Presumido — 2026 a 2033
            <Badge variant="outline" className="text-[10px]">{atividade === "servicos" ? "Serviços" : "Comércio"}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Ano</TableHead>
                <TableHead className="text-xs">Fase</TableHead>
                <TableHead className="text-right text-xs">IRPJ+CSLL</TableHead>
                <TableHead className="text-right text-xs">PIS/COFINS</TableHead>
                <TableHead className="text-right text-xs">CBS (líq.)</TableHead>
                <TableHead className="text-right text-xs">ICMS/ISS</TableHead>
                <TableHead className="text-right text-xs">IBS (líq.)</TableHead>
                <TableHead className="text-right text-xs font-bold">Total</TableHead>
                <TableHead className="text-right text-xs">Alíq. Ef.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projecao.map((r, i) => {
                const cn = CRONOGRAMA[r.ano];
                return (
                  <TableRow key={r.ano} className={i === projecao.length - 1 ? "bg-muted/50 font-semibold" : ""}>
                    <TableCell className="text-xs font-semibold">{r.ano}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${corMap[cn.cor]}`}>{cn.fase}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">{moeda(r.irpj + r.csll)}</TableCell>
                    <TableCell className="text-right text-xs">
                      {r.pis + r.cofins > 0 ? moeda(r.pis + r.cofins) : <span className="text-muted-foreground text-[10px]">Extintos</span>}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.cbsLiquida > 0
                        ? <span>{moeda(r.cbsLiquida)}<span className="text-green-600 text-[10px] ml-1">−{moeda(r.cbsCredito)}</span></span>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">{r.icmsIss > 0 ? moeda(r.icmsIss) : "—"}</TableCell>
                    <TableCell className="text-right text-xs">
                      {r.ibsLiquido > 0
                        ? <span>{moeda(r.ibsLiquido)}<span className="text-green-600 text-[10px] ml-1">−{moeda(r.ibsCredito)}</span></span>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold">{moeda(r.total)}</TableCell>
                    <TableCell className="text-right text-xs">{(r.aliqEfetiva * 100).toFixed(2)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-[10px] text-muted-foreground mt-2">
            Créditos CBS/IBS calculados sobre {percCompras}% de compras tributadas.
            Presunção IRPJ: {atividade === "servicos" ? "32%" : "8%"} · CSLL: {atividade === "servicos" ? "32%" : "12%"}.
          </p>
        </CardContent>
      </Card>

      {/* Alertas estratégicos */}
      {r2027.total > r2026.total && (
        <Alert className="border-red-400 bg-red-50 dark:bg-red-950/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-xs text-red-800 dark:text-red-200">
            <strong>Atenção 2027:</strong> A CBS ({CBS_REF}%) é significativamente maior que PIS+COFINS (3,65%) do regime cumulativo.
            Para {atividade === "servicos" ? "serviços" : "comércio"} com {percCompras}% de compras tributadas, o impacto líquido é de <strong>+{moeda(impactoCBS)}/ano</strong>.
            Revise sua política de preços e mapeie todos os créditos disponíveis.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="border-blue-400 bg-blue-50 dark:bg-blue-950/20">
        <Zap className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
          <strong>Oportunidade — créditos CBS/IBS:</strong> A não-cumulatividade plena permite creditar CBS/IBS sobre todas as compras tributadas
          (bens, serviços, imóveis para uso na atividade). Quanto maior o percentual de compras com crédito, menor a carga efetiva.
          Mapeie sua cadeia de fornecedores para maximizar os créditos.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ─── SUB-COMPONENTE: COMPARATIVO DE REGIMES ───────────────────────────────────
function ComparativoRegimes({ sn, lp, rbt12 }: {
  sn: (ReturnType<typeof calcSN> & { ano: number })[];
  lp: (ReturnType<typeof calcLP> & { ano: number })[];
  rbt12: number;
}) {
  const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const maxVal = Math.max(...sn.map(r => r.total), ...lp.map(r => r.total));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            Comparativo Simples Nacional × Lucro Presumido — 2026–2033
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Gráfico de barras */}
          <div className="space-y-3">
            {ANOS.map((ano, i) => {
              const r_sn = sn[i];
              const r_lp = lp[i];
              const melhor = r_sn.total <= r_lp.total ? "sn" : "lp";
              const cn = CRONOGRAMA[ano];
              return (
                <div key={ano} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold w-10">{ano}</span>
                    <Badge className={`text-[10px] ${corMap[cn.cor]}`}>{cn.fase}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      Economia: <strong>{moeda(Math.abs(r_sn.total - r_lp.total))}</strong> com {melhor === "sn" ? "Simples" : "Presumido"}
                    </span>
                  </div>
                  <div className="flex gap-1 items-center">
                    <span className="text-[10px] text-muted-foreground w-16">SN</span>
                    <div className="flex-1 bg-muted rounded h-5 overflow-hidden">
                      <div
                        className={`h-full rounded flex items-center justify-end pr-1 transition-all ${melhor === "sn" ? "bg-emerald-500" : "bg-emerald-300"}`}
                        style={{ width: `${(r_sn.total / maxVal) * 100}%` }}
                      >
                        <span className="text-[10px] text-white font-bold">{moeda(r_sn.total)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 items-center">
                    <span className="text-[10px] text-muted-foreground w-16">LP</span>
                    <div className="flex-1 bg-muted rounded h-5 overflow-hidden">
                      <div
                        className={`h-full rounded flex items-center justify-end pr-1 transition-all ${melhor === "lp" ? "bg-blue-500" : "bg-blue-300"}`}
                        style={{ width: `${(r_lp.total / maxVal) * 100}%` }}
                      >
                        <span className="text-[10px] text-white font-bold">{moeda(r_lp.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Tabela comparativa */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Ano</TableHead>
                <TableHead className="text-right text-xs text-emerald-700">Simples Nacional</TableHead>
                <TableHead className="text-right text-xs text-blue-700">Lucro Presumido</TableHead>
                <TableHead className="text-right text-xs">Diferença</TableHead>
                <TableHead className="text-right text-xs">Melhor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ANOS.map((ano, i) => {
                const r_sn = sn[i];
                const r_lp = lp[i];
                const diff = r_lp.total - r_sn.total;
                const melhor = diff > 0 ? "SN" : "LP";
                const corMelhor = diff > 0 ? "emerald" : "blue";
                return (
                  <TableRow key={ano}>
                    <TableCell className="text-xs font-semibold">{ano}</TableCell>
                    <TableCell className="text-right text-xs">{moeda(r_sn.total)}</TableCell>
                    <TableCell className="text-right text-xs">{moeda(r_lp.total)}</TableCell>
                    <TableCell className={`text-right text-xs font-semibold ${diff > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {diff > 0 ? `-${moeda(diff)} LP` : `+${moeda(Math.abs(diff))} SN`}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={`text-[10px] ${corMelhor === "emerald" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                        {melhor}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-[10px] text-muted-foreground">
            Comparativo estimado. SN: não inclui CPP separada (inclusa no DAS). LP: não inclui folha de pagamento (INSS patronal).
            O custo previdenciário pode ser determinante — analise com seu contador.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── SUB-COMPONENTE: CRONOGRAMA REFORMA ───────────────────────────────────────
function CronogramaReforma({ receita }: { receita: number }) {
  const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Cronograma Oficial da Reforma — EC 132/2023 + LC 214/2025
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ANOS.map(ano => {
            const cn = CRONOGRAMA[ano];
            return (
              <div key={ano} className="rounded-lg border overflow-hidden">
                <div className={`px-4 py-2 flex items-center justify-between ${cn.cor === "green" ? "bg-green-100 dark:bg-green-950/30" : cn.cor === "amber" ? "bg-amber-100 dark:bg-amber-950/30" : cn.cor === "red" ? "bg-red-100 dark:bg-red-950/30" : cn.cor === "orange" ? "bg-orange-100 dark:bg-orange-950/30" : "bg-blue-100 dark:bg-blue-950/30"}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg">{ano}</span>
                    <Badge className={`${corMap[cn.cor]}`}>{cn.fase}</Badge>
                  </div>
                  <div className="flex gap-4 text-xs font-medium">
                    <span>CBS: <strong>{cn.cbsAliq}%</strong></span>
                    <span>IBS: <strong>{cn.ibsAliq.toFixed(2)}%</strong></span>
                    <span>ICMS/ISS: <strong>{cn.icmsIssPerc}%</strong></span>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <p className="text-xs text-muted-foreground">{cn.descricao}</p>
                  <ul className="space-y-1">
                    {cn.eventos.map((e, i) => (
                      <li key={i} className="text-xs flex gap-2">
                        <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        {e}
                      </li>
                    ))}
                  </ul>
                  {receita > 0 && (
                    <div className="flex gap-6 mt-2 pt-2 border-t text-xs">
                      <span>CBS bruta: <strong>{moeda(receita * cn.cbsAliq / 100)}</strong></span>
                      <span>IBS bruto: <strong>{moeda(receita * cn.ibsAliq / 100)}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CalendarDays, Info, Printer, Upload, Trash2, ImageIcon, Eraser } from "lucide-react";
import { useLogo, salvarLogo, arquivoParaLogo } from "@/lib/logo";
import { useToast } from "@/hooks/use-toast";

// ─── Escalas / cenários ───────────────────────────────────────────────────────
// Divisor mensal = jornada semanal × 5  (44h→220 · 40h→200 · 36h→180 · 30h→150)
// Base: CF art. 7º XIII; Súmula 431 TST; IRR TST Tema 2 (divisor não muda pelo sábado livre).
type EscalaId = "6x1_44" | "5x2_44" | "5x2_40" | "4x3_36" | "custom";

// 0=dom … 6=sáb
type Escala = {
  id: EscalaId;
  nome: string;
  sub: string;
  semanal: number;
  trabalha: boolean[]; // dias da semana trabalhados
  folgaComoRepouso: boolean; // folga extra (além do domingo) conta como repouso no DSR?
};

const ESCALAS: Escala[] = [
  {
    id: "6x1_44",
    nome: "6x1 · 44h",
    sub: "Regra atual (CF art. 7º XIII)",
    semanal: 44,
    trabalha: [false, true, true, true, true, true, true],
    folgaComoRepouso: false,
  },
  {
    id: "5x2_44",
    nome: "5x2 · 44h",
    sub: "Atual com sábado compensado",
    semanal: 44,
    trabalha: [false, true, true, true, true, true, false],
    folgaComoRepouso: false,
  },
  {
    id: "5x2_40",
    nome: "5x2 · 40h",
    sub: "Fim da 6x1 — 2 dias de repouso",
    semanal: 40,
    trabalha: [false, true, true, true, true, true, false],
    folgaComoRepouso: true,
  },
  {
    id: "4x3_36",
    nome: "4x3 · 36h",
    sub: "Fim da 6x1 — proposta 36h",
    semanal: 36,
    trabalha: [false, true, true, true, true, false, false],
    folgaComoRepouso: true,
  },
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// ─── Feriados nacionais ───────────────────────────────────────────────────────
function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDias(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function feriadosNacionais(ano: number): Record<string, string> {
  const p = pascoa(ano);
  return {
    [`${ano}-01-01`]: "Confraternização Universal",
    [iso(addDias(p, -2))]: "Sexta-feira Santa",
    [`${ano}-04-21`]: "Tiradentes",
    [`${ano}-05-01`]: "Dia do Trabalho",
    [`${ano}-09-07`]: "Independência",
    [`${ano}-10-12`]: "N. Sra. Aparecida",
    [`${ano}-11-02`]: "Finados",
    [`${ano}-11-15`]: "Proclamação da República",
    [`${ano}-11-20`]: "Consciência Negra (Lei 14.759/2023)",
    [`${ano}-12-25`]: "Natal",
  };
}
function pontosFacultativos(ano: number): Record<string, string> {
  const p = pascoa(ano);
  return {
    [iso(addDias(p, -48))]: "Carnaval (ponto facultativo)",
    [iso(addDias(p, -47))]: "Carnaval (ponto facultativo)",
    [iso(addDias(p, 60))]: "Corpus Christi (ponto facultativo)",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseMoeda(s: string) {
  if (!s) return 0;
  const limpo = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return parseFloat(limpo) || 0;
}
/** Aceita "2:30", "2h30", "2,5" ou "2.5" → horas decimais */
function parseHoras(s: string): number {
  if (!s) return 0;
  const t = s.trim().toLowerCase().replace("h", ":");
  if (t.includes(":")) {
    const [h, m] = t.split(":");
    return (parseInt(h) || 0) + (parseInt(m) || 0) / 60;
  }
  return parseFloat(t.replace(",", ".")) || 0;
}
function fmtHoras(h: number) {
  const tot = Math.round(h * 60);
  return `${Math.floor(tot / 60)}:${String(tot % 60).padStart(2, "0")}`;
}

type TipoDia = "trabalho" | "folga" | "repouso" | "feriado";
type Dia = { data: string; dia: number; dow: number; tipo: TipoDia; nomeFeriado?: string };

function montarMes(ano: number, mes: number, trabalha: boolean[], feriados: Set<string>, nomes: Record<string, string>): Dia[] {
  const qtd = new Date(ano, mes + 1, 0).getDate();
  const out: Dia[] = [];
  for (let d = 1; d <= qtd; d++) {
    const dt = new Date(ano, mes, d);
    const data = iso(dt);
    const dow = dt.getDay();
    let tipo: TipoDia;
    if (feriados.has(data)) tipo = "feriado";
    else if (dow === 0) tipo = "repouso";
    else tipo = trabalha[dow] ? "trabalho" : "folga";
    out.push({ data, dia: d, dow, tipo, nomeFeriado: nomes[data] });
  }
  return out;
}

/** Contagem para o DSR: úteis × domingos/feriados (Lei 605/49; Súmula 172 TST) */
function contarDias(dias: Dia[], folgaComoRepouso: boolean) {
  let uteis = 0, repouso = 0;
  for (const d of dias) {
    if (d.tipo === "trabalho") uteis++;
    else if (d.tipo === "folga") folgaComoRepouso ? repouso++ : uteis++;
    else repouso++;
  }
  return { uteis, repouso };
}

const COR_TIPO: Record<TipoDia, string> = {
  trabalho: "bg-card",
  folga: "bg-muted/60",
  repouso: "bg-sky-50 dark:bg-sky-950/30",
  feriado: "bg-amber-50 dark:bg-amber-950/30",
};
const LABEL_TIPO: Record<TipoDia, string> = {
  trabalho: "Trabalho",
  folga: "Folga",
  repouso: "DSR",
  feriado: "Feriado",
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function HoraExtra() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [funcionario, setFuncionario] = useState("");
  const [salario, setSalario] = useState("");
  const [adicionais, setAdicionais] = useState("");
  const [pct50, setPct50] = useState("50");
  const [pct100, setPct100] = useState("100");

  const [escalaId, setEscalaId] = useState<EscalaId>("6x1_44");
  const [customSemanal, setCustomSemanal] = useState("40");
  const [customTrabalha, setCustomTrabalha] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [folgaRepouso, setFolgaRepouso] = useState<boolean | null>(null); // null = padrão da escala

  // Horas extras por data: { "2026-11-03": "2:00" }
  const [horas, setHoras] = useState<Record<string, string>>({});
  // Override manual do percentual por data
  const [overridePct, setOverridePct] = useState<Record<string, "50" | "100">>({});
  // Feriados adicionados/removidos manualmente (estaduais/municipais)
  const [feriadoManual, setFeriadoManual] = useState<Record<string, boolean>>({});

  const logo = useLogo();
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const escala: Escala = useMemo(() => {
    if (escalaId !== "custom") return ESCALAS.find(e => e.id === escalaId)!;
    return {
      id: "custom",
      nome: "Personalizada",
      sub: "",
      semanal: parseFloat(customSemanal.replace(",", ".")) || 0,
      trabalha: customTrabalha,
      folgaComoRepouso: true,
    };
  }, [escalaId, customSemanal, customTrabalha]);

  const folgaComoRepouso = folgaRepouso ?? escala.folgaComoRepouso;
  const divisor = escala.semanal * 5;

  const { nomes, feriadosSet } = useMemo(() => {
    const nac = feriadosNacionais(ano);
    const fac = pontosFacultativos(ano);
    const nomes = { ...fac, ...nac };
    const set = new Set(Object.keys(nac));
    for (const [d, on] of Object.entries(feriadoManual)) {
      if (on) set.add(d);
      else set.delete(d);
    }
    return { nomes, feriadosSet: set };
  }, [ano, feriadoManual]);

  const dias = useMemo(
    () => montarMes(ano, mes, escala.trabalha, feriadosSet, nomes),
    [ano, mes, escala.trabalha, feriadosSet, nomes],
  );

  function pctDoDia(d: Dia): "50" | "100" {
    if (overridePct[d.data]) return overridePct[d.data];
    return d.tipo === "repouso" || d.tipo === "feriado" ? "100" : "50";
  }

  // ── Cálculo ──
  const salarioBase = parseMoeda(salario) + parseMoeda(adicionais);
  const a50 = (parseFloat(pct50.replace(",", ".")) || 0) / 100;
  const a100 = (parseFloat(pct100.replace(",", ".")) || 0) / 100;

  function calcular(divisorX: number, diasX: Dia[], folgaRep: boolean) {
    const valorHora = divisorX > 0 ? salarioBase / divisorX : 0;
    let h50 = 0, h100 = 0;
    for (const d of dias) {
      const h = parseHoras(horas[d.data] || "");
      if (!h) continue;
      if (pctDoDia(d) === "100") h100 += h;
      else h50 += h;
    }
    const v50 = h50 * valorHora * (1 + a50);
    const v100 = h100 * valorHora * (1 + a100);
    const { uteis, repouso } = contarDias(diasX, folgaRep);
    const dsr = uteis > 0 ? ((v50 + v100) / uteis) * repouso : 0;
    return { valorHora, h50, h100, v50, v100, uteis, repouso, dsr, total: v50 + v100 + dsr };
  }

  const r = calcular(divisor, dias, folgaComoRepouso);

  const comparativo = ESCALAS.map(e => {
    const dE = montarMes(ano, mes, e.trabalha, feriadosSet, nomes);
    return { e, divisor: e.semanal * 5, ...calcular(e.semanal * 5, dE, e.folgaComoRepouso) };
  });

  function toggleFeriado(d: Dia) {
    const atual = feriadosSet.has(d.data);
    setFeriadoManual(m => ({ ...m, [d.data]: !atual }));
  }
  function togglePct(d: Dia) {
    const atual = pctDoDia(d);
    setOverridePct(o => ({ ...o, [d.data]: atual === "50" ? "100" : "50" }));
  }
  function mudarMes(delta: number) {
    let m = mes + delta, a = ano;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMes(m);
    setAno(a);
  }
  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Envie uma imagem PNG, JPG ou SVG.", variant: "destructive" });
      return;
    }
    try {
      salvarLogo(await arquivoParaLogo(f));
      toast({ title: "Logo atualizado", description: "Aparece no cabeçalho e nos relatórios impressos." });
    } catch {
      toast({ title: "Não foi possível ler a imagem", variant: "destructive" });
    }
  }

  const primeiroDow = dias[0]?.dow ?? 0;
  const inputCls = "w-full text-sm px-3 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-6">
      {/* Cabeçalho com logo */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {logo ? (
            <img src={logo} alt="Logo" className="h-14 w-auto max-w-[180px] object-contain" />
          ) : (
            <div className="h-14 w-14 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground print:hidden">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary print:hidden" /> Hora Extra 50% e 100% + DSR
            </h1>
            <p className="text-sm text-muted-foreground">
              {MESES[mes]}/{ano} · {escala.nome} · divisor {divisor}
              {funcionario && <> · {funcionario}</>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="h-4 w-4" /> {logo ? "Trocar logo" : "Enviar meu logo"}
          </Button>
          {logo && (
            <Button variant="ghost" size="sm" onClick={() => salvarLogo(null)} title="Remover logo">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* ── Parâmetros ── */}
        <div className="space-y-4 print:hidden">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Funcionário e salário</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-xs text-muted-foreground">Nome (opcional)
                <input className={inputCls} value={funcionario} onChange={e => setFuncionario(e.target.value)} />
              </label>
              <label className="block text-xs text-muted-foreground">Salário base (R$)
                <input className={inputCls} inputMode="decimal" placeholder="2.500,00" value={salario} onChange={e => setSalario(e.target.value)} />
              </label>
              <label className="block text-xs text-muted-foreground">Adicionais fixos na base (R$)
                <input className={inputCls} inputMode="decimal" placeholder="insalubridade, periculosidade…" value={adicionais} onChange={e => setAdicionais(e.target.value)} />
                <span className="text-[10px]">Súmulas 132 e 139 TST</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-muted-foreground">Adicional dia útil (%)
                  <input className={inputCls} inputMode="decimal" value={pct50} onChange={e => setPct50(e.target.value)} />
                </label>
                <label className="block text-xs text-muted-foreground">Adicional DSR/feriado (%)
                  <input className={inputCls} inputMode="decimal" value={pct100} onChange={e => setPct100(e.target.value)} />
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">Mínimo legal 50% (CF art. 7º XVI) e 100% em domingo/feriado não compensado (Lei 605/49 art. 9º; Súmula 146 TST). Ajuste se a convenção coletiva prever percentuais maiores.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Escala e divisor</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[...ESCALAS, { id: "custom" as EscalaId, nome: "Personalizada", sub: "Defina horas e dias", semanal: 0, trabalha: [], folgaComoRepouso: true }].map(e => (
                <button
                  key={e.id}
                  onClick={() => { setEscalaId(e.id); setFolgaRepouso(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    escalaId === e.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.nome}</span>
                    {e.id !== "custom" && <Badge variant="secondary" className="text-[10px]">÷ {e.semanal * 5}</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{e.sub}</div>
                </button>
              ))}

              {escalaId === "custom" && (
                <div className="space-y-2 pt-1">
                  <label className="block text-xs text-muted-foreground">Jornada semanal (h)
                    <input className={inputCls} inputMode="decimal" value={customSemanal} onChange={e => setCustomSemanal(e.target.value)} />
                  </label>
                  <div className="text-xs text-muted-foreground">Dias trabalhados</div>
                  <div className="flex flex-wrap gap-1">
                    {DIAS_SEMANA.map((n, i) => (
                      <button
                        key={n}
                        disabled={i === 0}
                        onClick={() => setCustomTrabalha(t => t.map((v, j) => (j === i ? !v : v)))}
                        className={`px-2 py-1 rounded text-xs border ${customTrabalha[i] ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"} disabled:opacity-40`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t mt-2">
                <div className="text-xs text-muted-foreground mb-1">Folga além do domingo, no DSR, conta como:</div>
                <div className="flex gap-1">
                  {[
                    { v: false, l: "Dia útil não trabalhado" },
                    { v: true, l: "Repouso remunerado" },
                  ].map(o => (
                    <button
                      key={String(o.v)}
                      onClick={() => setFolgaRepouso(o.v)}
                      className={`flex-1 px-2 py-1.5 rounded text-[11px] border ${folgaComoRepouso === o.v ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
                    >{o.l}</button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Regra atual: sábado compensado é dia útil. Nos cenários de fim da 6x1 a folga é tratada como repouso — confirme o texto final da norma/convenção.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Calendário + resultados ── */}
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Calendário — lance as horas extras do dia</CardTitle>
                <div className="flex items-center gap-1 print:hidden">
                  <Button variant="ghost" size="sm" onClick={() => mudarMes(-1)}>‹</Button>
                  <span className="text-sm font-medium w-32 text-center">{MESES[mes]} {ano}</span>
                  <Button variant="ghost" size="sm" onClick={() => mudarMes(1)}>›</Button>
                  <Button variant="ghost" size="sm" title="Limpar horas do mês" onClick={() => {
                    setHoras(h => Object.fromEntries(Object.entries(h).filter(([k]) => !k.startsWith(`${ano}-${String(mes + 1).padStart(2, "0")}`))));
                  }}><Eraser className="h-4 w-4" /></Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground print:hidden">
                Digite as horas como 2:30 ou 2,5. Clique no número do dia para marcar/desmarcar feriado (estadual/municipal) e no selo % para trocar entre 50 e 100.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="grid grid-cols-7 gap-1 min-w-[620px]">
                  {DIAS_SEMANA.map(n => (
                    <div key={n} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{n}</div>
                  ))}
                  {Array.from({ length: primeiroDow }).map((_, i) => <div key={`v${i}`} />)}
                  {dias.map(d => {
                    const pct = pctDoDia(d);
                    const temHora = parseHoras(horas[d.data] || "") > 0;
                    return (
                      <div key={d.data} className={`rounded-lg border p-1.5 space-y-1 ${COR_TIPO[d.tipo]}`} title={d.nomeFeriado}>
                        <div className="flex items-center justify-between">
                          <button onClick={() => toggleFeriado(d)} className="text-xs font-semibold hover:text-primary" title="Marcar/desmarcar feriado">{d.dia}</button>
                          <span className="text-[9px] uppercase text-muted-foreground">{LABEL_TIPO[d.tipo]}</span>
                        </div>
                        {d.nomeFeriado && (
                          <div className="text-[9px] leading-tight text-amber-700 dark:text-amber-400 truncate">{d.nomeFeriado}</div>
                        )}
                        <div className="flex items-center gap-1">
                          <input
                            value={horas[d.data] || ""}
                            onChange={e => setHoras(h => ({ ...h, [d.data]: e.target.value }))}
                            placeholder="0:00"
                            className="w-full min-w-0 text-xs px-1.5 py-1 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <button
                            onClick={() => togglePct(d)}
                            className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                              pct === "100" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            } ${temHora ? "" : "opacity-50"}`}
                            title="Trocar percentual"
                          >{pct}%</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border bg-card" /> Trabalho</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border bg-muted" /> Folga</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border bg-sky-100 dark:bg-sky-900" /> DSR (domingo)</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border bg-amber-100 dark:bg-amber-900" /> Feriado</span>
              </div>
            </CardContent>
          </Card>

          {/* Resultado */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Resultado — {MESES[mes]}/{ano}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-4 mb-4">
                <Kpi titulo="Valor hora normal" valor={fmtMoeda(r.valorHora)} sub={`${fmtMoeda(salarioBase)} ÷ ${divisor}`} />
                <Kpi titulo={`HE ${pct50}%`} valor={fmtMoeda(r.v50)} sub={`${fmtHoras(r.h50)} h × ${fmtMoeda(r.valorHora * (1 + a50))}`} />
                <Kpi titulo={`HE ${pct100}%`} valor={fmtMoeda(r.v100)} sub={`${fmtHoras(r.h100)} h × ${fmtMoeda(r.valorHora * (1 + a100))}`} />
                <Kpi titulo="DSR s/ HE" valor={fmtMoeda(r.dsr)} sub={`÷ ${r.uteis} úteis × ${r.repouso} DSR/fer.`} />
              </div>
              <table className="w-full text-sm">
                <tbody className="[&_td]:py-1.5 [&_tr]:border-b">
                  <tr><td>Salário + adicionais fixos</td><td className="text-right">{fmtMoeda(salarioBase)}</td></tr>
                  <tr><td>Divisor ({escala.semanal}h semanais × 5)</td><td className="text-right">{divisor}</td></tr>
                  <tr><td>Hora extra {pct50}% — {fmtHoras(r.h50)} h</td><td className="text-right">{fmtMoeda(r.v50)}</td></tr>
                  <tr><td>Hora extra {pct100}% — {fmtHoras(r.h100)} h</td><td className="text-right">{fmtMoeda(r.v100)}</td></tr>
                  <tr><td>DSR sobre horas extras ({fmtMoeda(r.v50 + r.v100)} ÷ {r.uteis} × {r.repouso})</td><td className="text-right">{fmtMoeda(r.dsr)}</td></tr>
                  <tr className="font-bold"><td>Total a pagar</td><td className="text-right text-primary">{fmtMoeda(r.total)}</td></tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Comparativo das escalas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Comparativo: atual × fim da escala 6x1</CardTitle>
              <p className="text-[11px] text-muted-foreground">Mesmas horas e percentuais lançados, mesmo salário (redução de jornada sem redução salarial). Muda o divisor e a contagem de dias do DSR.</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-[11px] text-muted-foreground border-b">
                    <th className="text-left py-1.5">Escala</th>
                    <th className="text-right">Divisor</th>
                    <th className="text-right">Valor hora</th>
                    <th className="text-right">HE 50% + 100%</th>
                    <th className="text-right">Úteis / DSR</th>
                    <th className="text-right">DSR</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativo.map(c => (
                    <tr key={c.e.id} className={`border-b ${c.e.id === escalaId ? "bg-primary/5 font-medium" : ""}`}>
                      <td className="py-1.5">{c.e.nome}<div className="text-[10px] text-muted-foreground">{c.e.sub}</div></td>
                      <td className="text-right">{c.divisor}</td>
                      <td className="text-right">{fmtMoeda(c.valorHora)}</td>
                      <td className="text-right">{fmtMoeda(c.v50 + c.v100)}</td>
                      <td className="text-right">{c.uteis} / {c.repouso}</td>
                      <td className="text-right">{fmtMoeda(c.dsr)}</td>
                      <td className="text-right font-semibold">{fmtMoeda(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Fundamentação */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Fundamentação e fórmulas</CardTitle></CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p><b>Valor hora</b> = (salário + adicionais fixos) ÷ divisor. <b>Divisor</b> = jornada semanal × 5: 44h → 220, 40h → 200, 36h → 180, 30h → 150 (CF art. 7º XIII; Súmula 431 TST; IRR TST Tema 2 — o sábado livre não altera o divisor).</p>
              <p><b>HE 50%</b> = horas × valor hora × 1,5 (CF art. 7º XVI). <b>HE 100%</b> = horas × valor hora × 2, para trabalho em domingo/feriado sem folga compensatória (Lei 605/49 art. 9º; Súmula 146 TST).</p>
              <p><b>DSR sobre HE</b> = (total de HE do mês ÷ dias úteis) × (domingos + feriados) (Lei 605/49 art. 7º; Súmula 172 TST). Desde 20/03/2023 o DSR majorado pelas HE repercute em férias, 13º, aviso e FGTS (OJ 394 SDI-1, redação do IRR TST 10169-57.2013).</p>
              <p><b>Fim da escala 6x1:</b> os cenários 5x2·40h e 4x3·36h simulam a redução de jornada proposta (PECs em tramitação no Congresso). Antes de aplicar em folha, confirme a norma vigente, a regra de transição e a convenção coletiva da categoria.</p>
              <p>Feriados nacionais já marcados (inclui Consciência Negra — Lei 14.759/2023). Carnaval e Corpus Christi são pontos facultativos: clique no dia para marcar se forem feriado no seu município/convenção.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ titulo, valor, sub }: { titulo: string; valor: string; sub: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] text-muted-foreground">{titulo}</div>
      <div className="text-lg font-bold">{valor}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

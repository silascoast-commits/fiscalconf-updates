import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCliente } from "@/contexts/ClienteContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, AlertTriangle, Copy, Scale, Landmark, Flame, CalendarClock, FileCode2, Download, DatabaseZap,
  ListChecks, ExternalLink, GitBranch, Info, RefreshCw, ShieldCheck, Ban, Calculator, Settings2, Save, BadgeCheck,
} from "lucide-react";
import {
  formatarNcm, formatarNbs, formatarCapituloNbs, LC116_GRUPOS, FONTES_OFICIAIS, TRATAMENTO_LABEL,
  type ResultadoReforma, type TipoCodigo, type Tratamento, type AnoTransicao,
} from "@shared/reformaTributaria";
import { CATEGORIAS_IS, CONFIG_PADRAO, type ConfiguracoesFiscais } from "@shared/configuracoes";
import { DESTINO_LABEL, REGIME_LABEL, type Destino, type RegimeVendedor, type Adquirente, type ResultadoSimulacao } from "@shared/simulacao";

// ─── Tipos da API ────────────────────────────────────────────────────────────
interface InfoBase {
  origem: "embutida" | "atualizada"; versaoTabela: string; extraidoEm: string; publicacaoMaisRecente: string;
  totalClassificacoes: number; vinculosNcm: number; vinculosNbs: number;
}
interface RespostaReforma extends ResultadoReforma {
  cClassTribDescricao: string; cstDescricao: string; legislacaoUrl: string | null; documentosAceitos: string[];
  alternativasDescricao: Record<string, string>; cronograma: AnoTransicao[];
  documentoFiscal: { campo: string; valor: string; obs?: string }[]; base: InfoBase;
}
interface LinhaLote {
  entrada: string; tipo: TipoCodigo; codigoFormatado: string; valido: boolean; capitulo: { codigo: string; descricao: string } | null;
  descricao: string; tratamento: Tratamento; descricaoTratamento: string; reducao: number; cst: string; cClassTrib: string;
  cClassTribDescricao: string; fonte: string; condicional: boolean; alternativas: string[]; impostoSeletivo: string | null;
  aliquota2033: number; fundamento: string;
}

// ─── Utilidades ──────────────────────────────────────────────────────────────
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0;
const numStr = (v: number) => String(v).replace(".", ",");
const dataBR = (d: string) => (d ? d.split("-").reverse().join("/") : "—");

function corTratamento(t: Tratamento) {
  if (t === "reducao_100" || t === "isencao" || t === "imunidade" || t === "suspensao") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (t.startsWith("reducao") || t === "diferimento") return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (t === "monofasico" || t === "especifico") return "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300";
  return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
}

const FONTE_INFO: Record<string, { label: string; cls: string }> = {
  oficial: { label: "Tabela oficial SVRS", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  complementar: { label: "Base complementar", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  regra_geral: { label: "Regra geral", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
};

function Chip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const { toast } = useToast();
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="codigo-fiscal text-base font-semibold">{value}</span>
        <button aria-label={`Copiar ${label}`} className="text-muted-foreground hover:text-foreground"
          onClick={() => { navigator.clipboard.writeText(value); toast({ title: "Copiado!", duration: 1200 }); }}>
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5 leading-snug break-words">{sub}</div>}
    </div>
  );
}

function resumoTexto(r: RespostaReforma) {
  const cap = r.capitulo ? ` — Cap. ${r.tipo === "NBS" ? formatarCapituloNbs(r.capitulo.codigo) : r.capitulo.codigo}: ${r.capitulo.descricao}` : "";
  const linhas = [
    `${r.tipo} ${r.codigoFormatado}${cap}`,
    `Enquadramento: ${r.regra.descricao}`,
    `Tratamento IBS/CBS: ${r.descricaoTratamento}`,
    `CST IBS/CBS: ${r.regra.cst} — ${r.cstDescricao}`,
    `cClassTrib: ${r.regra.cClassTrib} — ${r.cClassTribDescricao}`,
    `Fonte: ${FONTE_INFO[r.fonte].label}`,
    `Fundamento: ${r.regra.fundamento}`,
  ];
  if (r.is) linhas.push(`Imposto Seletivo (2027+): ${r.is.categoria} — ${r.is.aliquota}`);
  if (r.regra.condicional) linhas.push("ATENÇÃO: enquadramento condicional — conferir descrição/condição.");
  return linhas.join("\n");
}

// ─── Base oficial e configurações centrais ───────────────────────────────────
function PainelBase() {
  const { toast } = useToast();
  const { data: info } = useQuery<InfoBase>({ queryKey: ["/api/reforma/base"] });
  const atualizar = useMutation({
    mutationFn: () => apiRequest("POST", "/api/reforma/base/atualizar").then(r => r.json()),
    onSuccess: (d: any) => {
      queryClient.invalidateQueries();
      toast({ title: "Tabela oficial atualizada", description: `Publicação ${dataBR(d.atual.publicacaoMaisRecente)} · ${d.atual.vinculosNcm} NCM · ${d.atual.vinculosNbs} NBS` });
    },
    onError: (e: any) => toast({ title: "Falha ao atualizar", description: String(e.message).replace(/^\d+: /, ""), variant: "destructive" }),
  });
  if (!info) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-2.5 text-sm">
      <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0" />
      <span className="min-w-0">
        <strong>Tabela oficial cClassTrib (SVRS)</strong> — publicação de {dataBR(info.publicacaoMaisRecente)} ·{" "}
        {info.totalClassificacoes} classificações · {info.vinculosNcm.toLocaleString("pt-BR")} NCMs · {info.vinculosNbs} NBS
        <span className="text-muted-foreground"> · {info.origem === "atualizada" ? `baixada em ${dataBR(info.extraidoEm)}` : `embutida no sistema (${info.versaoTabela || dataBR(info.extraidoEm)})`}</span>
      </span>
      <Button size="sm" variant="outline" className="ml-auto" disabled={atualizar.isPending} onClick={() => atualizar.mutate()}>
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${atualizar.isPending ? "animate-spin" : ""}`} />
        {atualizar.isPending ? "Baixando..." : "Atualizar tabela oficial"}
      </Button>
    </div>
  );
}

function PainelConfiguracoes({ cfg, onChange }: { cfg: ConfiguracoesFiscais; onChange: (c: ConfiguracoesFiscais) => void }) {
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [cbs, setCbs] = useState(numStr(cfg.aliquotaReferenciaCbs));
  const [ibs, setIbs] = useState(numStr(cfg.aliquotaReferenciaIbs));
  const [is, setIs] = useState<Record<string, string>>({});
  useEffect(() => {
    setCbs(numStr(cfg.aliquotaReferenciaCbs)); setIbs(numStr(cfg.aliquotaReferenciaIbs));
    setIs(Object.fromEntries(Object.entries(cfg.premissasIS).map(([k, v]) => [k, numStr(v)])));
  }, [cfg]);
  const montar = (c = cbs, i = ibs): ConfiguracoesFiscais => ({
    aliquotaReferenciaCbs: num(c) || CONFIG_PADRAO.aliquotaReferenciaCbs,
    aliquotaReferenciaIbs: num(i) || CONFIG_PADRAO.aliquotaReferenciaIbs,
    premissasIS: Object.fromEntries(Object.entries(is).map(([k, v]) => [k, num(v)])),
  });
  const salvar = useMutation({
    mutationFn: (c: ConfiguracoesFiscais) => apiRequest("PUT", "/api/configuracoes", c).then(r => r.json()),
    onSuccess: (c: ConfiguracoesFiscais) => { queryClient.setQueryData(["/api/configuracoes"], c); onChange(c); toast({ title: "Configuração salva para todo o sistema" }); },
  });
  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="ref-cbs">Alíquota de referência CBS (%)</Label>
            <Input id="ref-cbs" inputMode="decimal" value={cbs} onChange={e => { setCbs(e.target.value); onChange(montar(e.target.value, ibs)); }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ref-ibs">Alíquota de referência IBS (%)</Label>
            <Input id="ref-ibs" inputMode="decimal" value={ibs} onChange={e => { setIbs(e.target.value); onChange(montar(cbs, e.target.value)); }} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAberto(v => !v)}><Settings2 className="h-4 w-4 mr-1.5" />Premissas IS</Button>
            <Button className="flex-1" disabled={salvar.isPending} onClick={() => salvar.mutate(montar())}><Save className="h-4 w-4 mr-1.5" />Salvar padrão</Button>
          </div>
        </div>
        {aberto && (
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Percentuais de Imposto Seletivo usados nas simulações e no Simulador. São premissas: as alíquotas serão fixadas em lei ordinária (bens minerais limitados a 0,25%).</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(CATEGORIAS_IS).map(([k, label]) => (
                <div key={k} className="space-y-1">
                  <Label htmlFor={`is-${k}`} className="text-xs">{label} (%)</Label>
                  <Input id={`is-${k}`} inputMode="decimal" value={is[k] ?? ""} onChange={e => setIs({ ...is, [k]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Alíquotas de referência são estimativas até a Resolução do Senado Federal. Editar sem salvar vale só para esta consulta; "Salvar padrão" grava para todo o sistema.</p>
      </CardContent>
    </Card>
  );
}

// ─── Simulação da operação ───────────────────────────────────────────────────
function PainelSimulacao({ r, cfg }: { r: RespostaReforma; cfg: ConfiguracoesFiscais }) {
  const { clienteAtivo } = useCliente();
  const [valor, setValor] = useState("1.000,00");
  const [ano, setAno] = useState("2033");
  const [destino, setDestino] = useState<Destino>("mercado_interno");
  const [regime, setRegime] = useState<RegimeVendedor>(clienteAtivo?.regime === "Simples Nacional" ? "simples_das" : "regular");
  const [adquirente, setAdquirente] = useState<Adquirente>("contribuinte");
  const [aliqDas, setAliqDas] = useState("4,00");
  const [aliqIS, setAliqIS] = useState("");

  const { data: sim } = useQuery<ResultadoSimulacao & { cClassTribDescricao: string }>({
    queryKey: ["simular", r.tipo, r.codigo, valor, ano, destino, regime, adquirente, aliqDas, aliqIS, cfg.aliquotaReferenciaCbs, cfg.aliquotaReferenciaIbs],
    queryFn: () => apiRequest("POST", "/api/reforma/simular", {
      tipo: r.tipo, codigo: r.codigo, valor: num(valor), ano: Number(ano), destino, regimeVendedor: regime, adquirente,
      aliquotaDasIbsCbs: num(aliqDas), aliquotaIS: aliqIS === "" ? null : num(aliqIS), cbs: cfg.aliquotaReferenciaCbs, ibs: cfg.aliquotaReferenciaIbs,
    }).then(x => x.json()),
  });

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" />Simulação da operação</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><Label className="text-xs" htmlFor="sim-valor">Valor da operação (R$)</Label><Input id="sim-valor" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Ano</Label>
            <Select value={ano} onValueChange={setAno}><SelectTrigger aria-label="Ano"><SelectValue /></SelectTrigger>
              <SelectContent>{[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-xs">Destino</Label>
            <Select value={destino} onValueChange={v => setDestino(v as Destino)}><SelectTrigger aria-label="Destino"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(DESTINO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-xs">Comprador</Label>
            <Select value={adquirente} onValueChange={v => setAdquirente(v as Adquirente)}><SelectTrigger aria-label="Comprador"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="contribuinte">Contribuinte (B2B — toma crédito)</SelectItem><SelectItem value="consumidor_final">Consumidor final</SelectItem></SelectContent></Select></div>
          <div className="space-y-1 lg:col-span-2"><Label className="text-xs">Regime do vendedor</Label>
            <Select value={regime} onValueChange={v => setRegime(v as RegimeVendedor)}><SelectTrigger aria-label="Regime do vendedor"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(REGIME_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
          {regime === "simples_das" && (
            <div className="space-y-1"><Label className="text-xs" htmlFor="sim-das">IBS+CBS dentro do DAS (%)</Label><Input id="sim-das" inputMode="decimal" value={aliqDas} onChange={e => setAliqDas(e.target.value)} /></div>
          )}
          {r.is && (
            <div className="space-y-1"><Label className="text-xs" htmlFor="sim-is">Alíquota IS (%) — vazio = premissa</Label><Input id="sim-is" inputMode="decimal" placeholder="premissa" value={aliqIS} onChange={e => setAliqIS(e.target.value)} /></div>
          )}
        </div>

        {sim && !sim.aplicavel && <Alert><Info className="h-4 w-4" /><AlertDescription className="text-sm">{sim.motivo}</AlertDescription></Alert>}
        {sim?.aplicavel && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Chip label="cClassTrib da operação" value={sim.cClassTrib} sub={sim.cClassTribDescricao} />
              <Chip label={`IBS ${pct(sim.aliquotaIbs)} + CBS ${pct(sim.aliquotaCbs)}`} value={brl(sim.valorIbs + sim.valorCbs)} sub={`IBS ${brl(sim.valorIbs)} · CBS ${brl(sim.valorCbs)} · base ${brl(sim.baseCalculo)}`} />
              <Chip label="Imposto Seletivo" value={brl(sim.valorIS)} sub={sim.valorIS ? "Integra a base do IBS/CBS" : "Não incide"} />
              <Chip label="Custo líquido do comprador" value={brl(sim.custoLiquidoAdquirente)} sub={`Crédito apropriado: ${brl(sim.creditoAdquirente)}`} />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Regime do vendedor</TableHead><TableHead>Tributos na nota</TableHead><TableHead>Crédito do comprador</TableHead><TableHead>Custo líquido</TableHead></TableRow></TableHeader>
                <TableBody>
                  {sim.comparativo.map(c => (
                    <TableRow key={c.regime} className={c.regime === regime ? "bg-primary/5" : ""}>
                      <TableCell className="text-sm">{c.label}</TableCell>
                      <TableCell className="codigo-fiscal">{brl(c.tributos)}</TableCell>
                      <TableCell className="codigo-fiscal">{brl(c.credito)}</TableCell>
                      <TableCell className="codigo-fiscal font-semibold">{brl(c.custoLiquido)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        {sim && sim.observacoes.length > 0 && <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">{sim.observacoes.map((o, i) => <li key={i}>{o}</li>)}</ul>}
      </CardContent>
    </Card>
  );
}

// ─── Painel de resultado ─────────────────────────────────────────────────────
function PainelResultado({ r, cfg, regimeSimples }: { r: RespostaReforma; cfg: ConfiguracoesFiscais; regimeSimples: boolean }) {
  const { toast } = useToast();
  const monofasico = r.regra.tratamento === "monofasico";
  const especifico = r.regra.tratamento === "especifico";
  const cron = r.cronograma;
  const capLabel = r.capitulo ? (r.tipo === "NBS" ? formatarCapituloNbs(r.capitulo.codigo) : r.capitulo.codigo) : "";

  const salvarNcm = useMutation({
    mutationFn: async () => {
      const obs = `${r.descricaoTratamento}. ${r.regra.fundamento}${r.is ? ` | IS 2027: ${r.is.categoria}` : ""}`.slice(0, 500);
      const existente = await fetch(`/api/ncms/${r.codigo}`).then(x => (x.ok ? x.json() : null)).catch(() => null);
      if (existente?.id) {
        await apiRequest("PATCH", `/api/ncms/${existente.id}`, { cClassTribSimples: r.regra.cClassTrib, cClassTribPresumido: r.regra.cClassTrib, observacoes: obs });
        return "atualizado";
      }
      await apiRequest("POST", "/api/ncms", {
        codigo: r.codigo, descricao: r.regra.descricao.slice(0, 200),
        cClassTribSimples: r.regra.cClassTrib, cClassTribPresumido: r.regra.cClassTrib, observacoes: obs,
      });
      return "cadastrado";
    },
    onSuccess: (acao) => { queryClient.invalidateQueries({ queryKey: ["/api/ncms"] }); toast({ title: `NCM ${r.codigoFormatado} ${acao} com o cClassTrib ${r.regra.cClassTrib}` }); },
    onError: () => toast({ title: "Não foi possível gravar na base de NCMs", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="codigo-fiscal text-2xl font-bold">{r.codigoFormatado || "—"}</span>
                <Badge variant="outline">{r.tipo}</Badge>
                <Badge className={corTratamento(r.regra.tratamento)} variant="secondary">{r.descricaoTratamento}</Badge>
                <Badge className={FONTE_INFO[r.fonte].cls} variant="secondary">{FONTE_INFO[r.fonte].label}</Badge>
                {r.regra.condicional && <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Condicional</Badge>}
                {r.is && <Badge variant="secondary" className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Imposto Seletivo</Badge>}
              </div>
              {r.capitulo && <p className="text-sm text-muted-foreground mt-1">Capítulo {capLabel} — {r.capitulo.descricao}</p>}
              <p className="text-sm font-medium mt-1 break-words">{r.regra.descricao}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(resumoTexto(r)); toast({ title: "Resumo copiado" }); }}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />Copiar resumo
              </Button>
              {r.tipo === "NCM" && r.valido && (
                <Button size="sm" variant="outline" disabled={salvarNcm.isPending} onClick={() => salvarNcm.mutate()}>
                  <DatabaseZap className="h-3.5 w-3.5 mr-1.5" />Gravar na base de NCMs
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Chip label="CST IBS/CBS" value={r.regra.cst} sub={r.cstDescricao} />
            <Chip label="cClassTrib" value={r.regra.cClassTrib} sub={r.cClassTribDescricao} />
            <Chip label="Redução de alíquota" value={monofasico || especifico ? "—" : r.regra.reducaoCbs != null ? `IBS ${r.regra.reducao}% · CBS ${r.regra.reducaoCbs}%` : `${r.regra.reducao}%`}
              sub={monofasico ? "Alíquota ad rem por unidade" : especifico ? "Alíquotas/base próprias do regime" : r.regra.anexo || "LC 214/2025"} />
            <Chip label="Alíquota efetiva 2033 (est.)" value={monofasico || especifico ? "Regime próprio" : pct(cron[cron.length - 1].total)}
              sub={`Referência ${pct(cfg.aliquotaReferenciaCbs + cfg.aliquotaReferenciaIbs)} (CBS ${pct(cfg.aliquotaReferenciaCbs)} + IBS ${pct(cfg.aliquotaReferenciaIbs)})`} />
          </div>

          <div className="flex items-start gap-2 text-sm rounded-md bg-muted/40 px-3 py-2">
            <Landmark className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span className="min-w-0 break-words">
              <span className="font-medium">Fundamento legal:</span> {r.regra.fundamento}
              {r.legislacaoUrl && <a href={r.legislacaoUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-primary hover:underline">ver artigo<ExternalLink className="h-3 w-3" /></a>}
              {r.documentosAceitos.length > 0 && <span className="block text-xs text-muted-foreground mt-0.5">Aceito em: {r.documentosAceitos.join(", ")}</span>}
            </span>
          </div>
        </CardContent>
      </Card>

      {(r.alertas.length > 0 || regimeSimples) && (
        <div className="space-y-2">
          {r.alertas.map((a, i) => (
            <Alert key={i} className="border-amber-300/60 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">{a}</AlertDescription>
            </Alert>
          ))}
          {regimeSimples && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Cliente do <strong>Simples Nacional</strong>: recolhendo IBS/CBS no DAS, o valor segue as tabelas da LC 123/2006 e o comprador só se credita do que foi recolhido no DAS. CST e cClassTrib continuam obrigatórios. Compare na simulação abaixo a opção de recolher fora do DAS.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {(r.oficiais.length > 0 || r.vedados.length > 0) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" />Correlação na tabela oficial (SVRS) para {r.codigoFormatado}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {r.oficiais.map(o => (
              <div key={o.cClassTrib} className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="codigo-fiscal font-semibold">{o.cClassTrib}</span>
                  <Badge variant="secondary" className={corTratamento(o.redIbs >= 100 ? "reducao_100" : o.redIbs > 0 ? "reducao_60" : "integral")}>
                    {o.redIbs === o.redCbs ? `Redução ${o.redIbs}%` : `IBS −${o.redIbs}% · CBS −${o.redCbs}%`}
                  </Badge>
                  {o.porCondicaoDoAdquirente && <Badge variant="outline">depende do adquirente/prestador</Badge>}
                  {o.cClassTrib === r.regra.cClassTrib && <Badge>Enquadramento sugerido</Badge>}
                </div>
                <p className="text-muted-foreground">{o.nome}</p>
                {o.itemAnexo && <p className="break-words"><span className="font-medium">Item do anexo:</span> {o.itemAnexo}</p>}
                {o.condicao && <p><span className="font-medium">Condição:</span> {o.condicao}</p>}
                {o.excecao && <p className="break-words"><span className="font-medium">Exceção:</span> {o.excecao}</p>}
                {o.observacao && <p className="text-xs text-muted-foreground">{o.observacao}</p>}
              </div>
            ))}
            {r.vedados.map(o => (
              <div key={`v${o.cClassTrib}`} className="rounded-md border border-red-300/60 bg-red-50/60 dark:bg-red-950/20 p-3 text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2"><Ban className="h-4 w-4 text-red-600" /><span className="codigo-fiscal font-semibold">{o.cClassTrib}</span><span className="font-medium text-red-700 dark:text-red-400">VEDADO para este código</span></div>
                <p className="text-muted-foreground">{o.nome}</p>
                {o.excecao && <p className="break-words"><span className="font-medium">Motivo:</span> {o.excecao}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {r.fonte !== "oficial" && (r.regra.condicoes?.length || 0) > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Condições para o enquadramento</CardTitle></CardHeader>
            <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{r.regra.condicoes!.map((c, i) => <li key={i}>{c}</li>)}</ul></CardContent>
          </Card>
        )}
        {(r.regra.alternativas?.length || 0) > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="h-4 w-4" />Outros cClassTrib possíveis</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {r.regra.alternativas!.map((a, i) => (
                <div key={i} className="text-sm border-l-2 border-primary/40 pl-3">
                  <span className="codigo-fiscal font-semibold">{a.cClassTrib}</span>
                  <span className="text-muted-foreground"> — {r.alternativasDescricao[a.cClassTrib]}</span>
                  <div className="text-xs mt-0.5 break-words">Quando: {a.quando}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className={r.is ? "border-rose-300/70" : ""}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4 text-rose-500" />Imposto Seletivo (IS) — a partir de 2027</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {r.tipo === "NBS" ? (
              <p className="text-muted-foreground">Entre os serviços, o IS alcança apenas <strong>concursos de prognósticos e fantasy sport</strong> (LC 214/2025, art. 409, §1º). Não incide sobre telecomunicações nem energia elétrica.</p>
            ) : r.is ? (
              <>
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" variant="secondary">{r.is.categoria}</Badge>
                  {r.is.condicional && <Badge variant="outline">Conferir subitem</Badge>}
                  <Badge variant="outline">Base complementar</Badge>
                </div>
                <p>{r.is.descricao}</p>
                <p><span className="font-medium">Alíquota:</span> {r.is.aliquota}</p>
                <p className="text-xs text-muted-foreground">{r.is.fundamento}</p>
                <ul className="list-disc pl-5 space-y-0.5 text-xs">{r.is.observacoes.map((o, i) => <li key={i}>{o}</li>)}</ul>
              </>
            ) : (
              <p className="text-muted-foreground">Não sujeito ao Imposto Seletivo. Bens alcançados: veículos, embarcações e aeronaves, produtos fumígenos, bebidas alcoólicas, bebidas açucaradas e bens minerais.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileCode2 className="h-4 w-4" />Parametrização do documento fiscal</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {r.documentoFiscal.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-1.5 text-xs text-muted-foreground w-1/2">{c.campo}</TableCell>
                    <TableCell className="py-1.5"><span className="codigo-fiscal text-sm font-medium break-all">{c.valor}</span>{c.obs && <div className="text-[11px] text-muted-foreground">{c.obs}</div>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {r.valido && <PainelSimulacao r={r} cfg={cfg} />}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4" />Transição 2026–2033 para este {r.tipo === "NCM" ? "produto" : "serviço"}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {monofasico || especifico ? (
            <p className="text-sm text-muted-foreground">
              {monofasico
                ? "Combustíveis: alíquotas específicas (R$ por litro/kg/m³), uniformes nacionalmente. Não se aplica a alíquota percentual de referência."
                : "Regime específico: base de cálculo e alíquotas próprias, definidas para preservar a carga atual do setor."}
            </p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Ano</TableHead><TableHead>CBS</TableHead><TableHead>IBS</TableHead><TableHead>Total</TableHead><TableHead>Tributos atuais</TableHead><TableHead className="hidden md:table-cell">Observação</TableHead></TableRow></TableHeader>
              <TableBody>
                {cron.map(a => (
                  <TableRow key={a.ano}>
                    <TableCell className="font-semibold">{a.ano}</TableCell>
                    <TableCell className="codigo-fiscal">{pct(a.cbs)}</TableCell>
                    <TableCell className="codigo-fiscal">{pct(a.ibs)}</TableCell>
                    <TableCell className="codigo-fiscal font-semibold">{pct(a.total)}</TableCell>
                    <TableCell className="text-xs">{a.tributosAntigos}</TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden md:table-cell">{a.obs}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {r.subregras.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tratamentos dentro de {r.codigoFormatado}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead>Tratamento</TableHead><TableHead>cClassTrib</TableHead></TableRow></TableHeader>
              <TableBody>
                {r.subregras.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="codigo-fiscal">{r.tipo === "NCM" ? formatarNcm(s.codigo) : formatarNbs(s.codigo)}</TableCell>
                    <TableCell className="text-sm">{s.descricao}</TableCell>
                    <TableCell><Badge variant="secondary" className={corTratamento(s.tratamento)}>{TRATAMENTO_LABEL[s.tratamento]}</Badge></TableCell>
                    <TableCell className="codigo-fiscal">{s.cClassTrib}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Consulta individual ─────────────────────────────────────────────────────
function ConsultaIndividual({ tipo, cfg, regimeSimples }: { tipo: TipoCodigo; cfg: ConfiguracoesFiscais; regimeSimples: boolean }) {
  const [codigo, setCodigo] = useState("");
  const [consultado, setConsultado] = useState("");
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [lc116, setLc116] = useState("");
  const fmt = tipo === "NCM" ? formatarNcm : formatarNbs;
  useEffect(() => { const t = setTimeout(() => setBuscaDebounced(busca), 250); return () => clearTimeout(t); }, [busca]);

  const digitos = consultado.replace(/\D/g, "");
  const { data: resultado, isFetching } = useQuery<RespostaReforma>({
    queryKey: [`/api/reforma/${tipo.toLowerCase()}/${digitos}?cbs=${cfg.aliquotaReferenciaCbs}&ibs=${cfg.aliquotaReferenciaIbs}`],
    enabled: digitos.length >= 2,
  });
  const { data: sugestoes = [] } = useQuery<{ codigo: string; descricao: string; origem: string }[]>({
    queryKey: [`/api/reforma-busca/${tipo.toLowerCase()}?q=${encodeURIComponent(buscaDebounced)}`],
    enabled: buscaDebounced.trim().length >= 3,
  });
  const consultar = (c = codigo) => { if (c.replace(/\D/g, "").length >= 2) setConsultado(c); };
  const grupo = LC116_GRUPOS.find(g => g.item === lc116);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 grid gap-4 md:grid-cols-2">
          <form className="space-y-1.5" onSubmit={e => { e.preventDefault(); consultar(); }}>
            <Label htmlFor={`cod-${tipo}`}>Código {tipo}</Label>
            <div className="flex gap-2">
              <Input id={`cod-${tipo}`} className="codigo-fiscal" value={codigo} placeholder={tipo === "NCM" ? "0000.00.00" : "1.0000.00.00"}
                onChange={e => setCodigo(fmt(e.target.value))} data-testid={`input-reforma-${tipo.toLowerCase()}`} />
              <Button type="submit" disabled={isFetching}><Search className="h-4 w-4 mr-1.5" />Consultar</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tipo === "NCM" ? "8 dígitos. Também aceita posição (4) ou subposição (6) para ver os tratamentos do grupo." : "9 dígitos (1.XXXX.XX.XX). Aceita capítulo (1.XX) para visão geral."}
            </p>
            {tipo === "NBS" && (
              <div className="space-y-1.5 pt-2">
                <Label>Não sabe a NBS? Escolha o item da lista do ISS (LC 116/2003)</Label>
                <Select value={lc116} onValueChange={v => { setLc116(v); const g = LC116_GRUPOS.find(x => x.item === v); if (g) { const f = formatarNbs(g.nbs); setCodigo(f); consultar(f); } }}>
                  <SelectTrigger aria-label="Item da LC 116"><SelectValue placeholder="Item da LC 116" /></SelectTrigger>
                  <SelectContent>{LC116_GRUPOS.map(g => <SelectItem key={g.item} value={g.item}>{g.item} — {g.descricao}</SelectItem>)}</SelectContent>
                </Select>
                {grupo && <p className="text-xs text-muted-foreground">Capítulo NBS {formatarCapituloNbs(grupo.nbs)}. {grupo.obs ? `${grupo.obs}. ` : ""}Correlação aproximada por grupo: localize o código de 9 dígitos na tabela NBS para o enquadramento final.</p>}
              </div>
            )}
          </form>
          <div className="space-y-1.5">
            <Label htmlFor={`busca-${tipo}`}>Ou busque pela descrição (inclui os itens dos anexos oficiais)</Label>
            <Input id={`busca-${tipo}`} value={busca} onChange={e => setBusca(e.target.value)}
              placeholder={tipo === "NCM" ? "ex.: pão francês, cerveja, fertilizante, absorvente" : "ex.: contábil, hospedagem, consultoria financeira"} />
            {sugestoes.length > 0 && busca.length >= 3 && (
              <div className="max-h-64 overflow-auto rounded-md border divide-y">
                {sugestoes.map((s, i) => (
                  <button key={i} type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 flex gap-2"
                    onClick={() => { const f = fmt(s.codigo); setCodigo(f); consultar(f); setBusca(""); }}>
                    <span className="codigo-fiscal font-medium shrink-0">{tipo === "NBS" && s.codigo.length === 3 ? formatarCapituloNbs(s.codigo) : fmt(s.codigo)}</span>
                    <span className="text-muted-foreground truncate">{s.descricao}</span>
                    {s.origem === "oficial" && <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">oficial</Badge>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {resultado && <PainelResultado r={resultado} cfg={cfg} regimeSimples={regimeSimples} />}
    </div>
  );
}

// ─── Consulta em lote ────────────────────────────────────────────────────────
function ConsultaLote({ cfg }: { cfg: ConfiguracoesFiscais }) {
  const { toast } = useToast();
  const [texto, setTexto] = useState("");
  const lote = useMutation({
    mutationFn: (codigos: string[]) => apiRequest("POST", "/api/reforma/lote", { codigos, cbs: cfg.aliquotaReferenciaCbs, ibs: cfg.aliquotaReferenciaIbs }).then(r => r.json() as Promise<LinhaLote[]>),
    onError: () => toast({ title: "Erro ao classificar", variant: "destructive" }),
  });
  const linhas = lote.data || [];
  const processar = () => lote.mutate(texto.split(/[\n;,\t]+/).map(s => s.trim()).filter(s => s.replace(/\D/g, "").length >= 4));

  const exportar = () => {
    const cab = ["Tipo", "Codigo", "Capitulo", "Enquadramento", "Tratamento", "Reducao_%", "CST_IBS_CBS", "cClassTrib", "Descricao_cClassTrib", "Fonte", "Alternativas", "Aliq_2033_est_%", "Imposto_Seletivo", "Condicional", "Fundamento"];
    const rows = linhas.map(r => [r.tipo, r.codigoFormatado, r.capitulo?.descricao || "", r.descricao, r.descricaoTratamento, r.reducao, r.cst, r.cClassTrib, r.cClassTribDescricao,
      FONTE_INFO[r.fonte]?.label || r.fonte, r.alternativas.join(" "),
      r.tratamento === "monofasico" || r.tratamento === "especifico" ? "regime proprio" : r.aliquota2033.toFixed(2).replace(".", ","),
      r.impostoSeletivo || "", r.condicional ? "SIM" : "", r.fundamento]);
    const csv = [cab, ...rows].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `reforma-ncm-nbs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-3">
          <Label htmlFor="lote">Cole os códigos NCM e/ou NBS (um por linha, ou separados por vírgula/ponto e vírgula)</Label>
          <Textarea id="lote" rows={7} className="codigo-fiscal" value={texto} onChange={e => setTexto(e.target.value)} placeholder={"1006.30.21\n2203.00.00\n3004.90.99\n1.1301.10.00\n1.0303.11.00"} />
          <p className="text-xs text-muted-foreground">Dica: copie a coluna de NCM do cadastro de produtos do ERP ou do SPED (até 5.000 códigos). O tipo é detectado automaticamente (NBS = 9 dígitos começando com 1).</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={processar} disabled={lote.isPending}><ListChecks className="h-4 w-4 mr-1.5" />{lote.isPending ? "Classificando..." : "Classificar"}</Button>
            {linhas.length > 0 && <Button variant="outline" onClick={exportar}><Download className="h-4 w-4 mr-1.5" />Exportar CSV (Excel)</Button>}
          </div>
        </CardContent>
      </Card>
      {linhas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {linhas.length} código(s) · {linhas.filter(l => l.tratamento !== "integral").length} com tratamento diferenciado · {linhas.filter(l => l.fonte === "oficial").length} pela tabela oficial · {linhas.filter(l => l.impostoSeletivo).length} com IS · {linhas.filter(l => l.condicional).length} condicionais
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Enquadramento</TableHead><TableHead>Tratamento</TableHead><TableHead>CST</TableHead><TableHead>cClassTrib</TableHead><TableHead>Fonte</TableHead><TableHead>IS</TableHead></TableRow></TableHeader>
              <TableBody>
                {linhas.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="codigo-fiscal whitespace-nowrap">{r.codigoFormatado} <Badge variant="outline" className="ml-1 text-[10px]">{r.tipo}</Badge>{!r.valido && <div className="text-[10px] text-amber-600">incompleto</div>}</TableCell>
                    <TableCell className="text-sm max-w-xs">{r.descricao.slice(0, 120)}{r.condicional && <span className="text-amber-600"> ⚠</span>}</TableCell>
                    <TableCell><Badge variant="secondary" className={corTratamento(r.tratamento)}>{r.descricaoTratamento}</Badge></TableCell>
                    <TableCell className="codigo-fiscal">{r.cst}</TableCell>
                    <TableCell className="codigo-fiscal">{r.cClassTrib}</TableCell>
                    <TableCell><Badge variant="secondary" className={FONTE_INFO[r.fonte]?.cls}>{FONTE_INFO[r.fonte]?.label}</Badge></TableCell>
                    <TableCell className="text-xs">{r.impostoSeletivo || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function ConsultaReforma() {
  const { clienteAtivo } = useCliente();
  const { data: cfgSalva } = useQuery<ConfiguracoesFiscais>({ queryKey: ["/api/configuracoes"] });
  const [cfg, setCfg] = useState<ConfiguracoesFiscais>(CONFIG_PADRAO);
  useEffect(() => { if (cfgSalva) setCfg(cfgSalva); }, [cfgSalva]);
  const regimeSimples = clienteAtivo?.regime === "Simples Nacional";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cfgEstavel = useMemo(() => cfg, [cfg.aliquotaReferenciaCbs, cfg.aliquotaReferenciaIbs, JSON.stringify(cfg.premissasIS)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2"><Scale className="h-5 w-5 text-primary" />Reforma Tributária por NCM / NBS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enquadramento no IBS/CBS pela <strong>tabela oficial de classificação tributária (SVRS)</strong>, com base complementar para o que a tabela não correlaciona por código, Imposto Seletivo, simulação da operação e transição 2026–2033 — <span className="font-medium">EC 132/2023</span> e <span className="font-medium">LC 214/2025</span>.
        </p>
      </div>

      <PainelBase />
      {cfgSalva && <PainelConfiguracoes cfg={cfgSalva} onChange={setCfg} />}

      <Tabs defaultValue="ncm">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ncm">Produto (NCM)</TabsTrigger>
          <TabsTrigger value="nbs">Serviço (NBS)</TabsTrigger>
          <TabsTrigger value="lote">Em lote</TabsTrigger>
        </TabsList>
        <TabsContent value="ncm" className="mt-4"><ConsultaIndividual tipo="NCM" cfg={cfgEstavel} regimeSimples={regimeSimples} /></TabsContent>
        <TabsContent value="nbs" className="mt-4"><ConsultaIndividual tipo="NBS" cfg={cfgEstavel} regimeSimples={regimeSimples} /></TabsContent>
        <TabsContent value="lote" className="mt-4"><ConsultaLote cfg={cfgEstavel} /></TabsContent>
      </Tabs>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Quer conferir o cClassTrib das notas de fornecedores e das suas emissões? Use a <Link href="/conferencia" className="font-medium text-primary hover:underline">Conferência NF-e</Link>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-5 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground text-sm">Fontes oficiais para conferência</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {FONTES_OFICIAIS.map(f => (
              <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground underline-offset-2 hover:underline">{f.nome}<ExternalLink className="h-3 w-3" /></a>
            ))}
          </div>
          <p>
            <strong>Como o enquadramento é feito:</strong> 1) tabela oficial de correlação cClassTrib × NCM/NBS publicada pelo SVRS (vínculo por código <em>e</em> descrição do item do anexo); 2) base complementar FiscalConf para classificações que a tabela não vincula por código (medicamentos, combustíveis, livros, educação, saúde, bares e restaurantes, Imposto Seletivo); 3) regra geral. A responsabilidade pela classificação fiscal é do contribuinte — grave o enquadramento validado na base de NCMs: ele tem prioridade na Configuração NF-e.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

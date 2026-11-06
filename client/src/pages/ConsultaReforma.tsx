import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCliente } from "@/contexts/ClienteContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, AlertTriangle, Copy, Scale, Landmark, Flame, CalendarClock, FileCode2,
  Download, DatabaseZap, ListChecks, ExternalLink, GitBranch, Info,
} from "lucide-react";
import {
  consultarReforma, buscarPorDescricao, cronogramaTransicao, camposDocumentoFiscal, detectarTipo,
  formatarNcm, formatarNbs, ALIQ_REF_PADRAO, FONTES_OFICIAIS, TRATAMENTO_LABEL,
  type ResultadoReforma, type TipoCodigo, type Tratamento,
} from "@shared/reformaTributaria";
import { mapCClassTrib, mapCSTIbsCbs } from "@shared/classificacaoTributaria";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

function corTratamento(t: Tratamento) {
  if (t === "reducao_100" || t === "isencao" || t === "imunidade") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (t.startsWith("reducao")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (t === "monofasico" || t === "especifico") return "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300";
  return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
}

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
      {sub && <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

function resumoTexto(r: ResultadoReforma) {
  const linhas = [
    `${r.tipo} ${r.codigoFormatado}${r.capitulo ? ` — Cap. ${r.tipo === "NBS" ? r.capitulo.codigo[0] + "." + r.capitulo.codigo.slice(1) : r.capitulo.codigo}: ${r.capitulo.descricao}` : ""}`,
    `Enquadramento: ${r.regra.descricao}`,
    `Tratamento IBS/CBS: ${r.descricaoTratamento}${r.regra.reducao && r.regra.reducao < 100 ? ` (${r.regra.reducao}%)` : ""}`,
    `CST IBS/CBS: ${r.regra.cst} — ${mapCSTIbsCbs(r.regra.cst)}`,
    `cClassTrib: ${r.regra.cClassTrib} — ${mapCClassTrib(r.regra.cClassTrib)}`,
    `Fundamento: ${r.regra.fundamento}`,
  ];
  if (r.is) linhas.push(`Imposto Seletivo (2027+): ${r.is.categoria} — ${r.is.aliquota} — ${r.is.fundamento}`);
  if (r.regra.condicional) linhas.push("ATENÇÃO: enquadramento condicional — conferir anexo legal.");
  return linhas.join("\n");
}

// ─── Painel de resultado ─────────────────────────────────────────────────────
function PainelResultado({ r, refAliq, valor, regimeSimples }: {
  r: ResultadoReforma; refAliq: { cbs: number; ibs: number }; valor: number; regimeSimples: boolean;
}) {
  const { toast } = useToast();
  const cron = cronogramaTransicao(r.regra.reducao, r.regra.tratamento, r.tipo, refAliq);
  const campos = camposDocumentoFiscal(r);
  const monofasico = r.regra.tratamento === "monofasico";
  const especifico = r.regra.tratamento === "especifico";

  const salvarNcm = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ncms", {
      codigo: r.codigo,
      descricao: r.regra.descricao.slice(0, 200),
      cClassTribSimples: r.regra.cClassTrib,
      cClassTribPresumido: r.regra.cClassTrib,
      observacoes: `${r.descricaoTratamento}. ${r.regra.fundamento}${r.is ? ` | IS 2027: ${r.is.categoria}` : ""}`,
    }).then(x => x.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ncms"] }); toast({ title: `NCM ${r.codigoFormatado} cadastrado com o cClassTrib ${r.regra.cClassTrib}` }); },
    onError: () => toast({ title: "Não foi possível cadastrar", description: "O NCM pode já existir na base — edite-o em NCMs.", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="codigo-fiscal text-2xl font-bold">{r.codigoFormatado || "—"}</span>
                <Badge variant="outline">{r.tipo}</Badge>
                <Badge className={corTratamento(r.regra.tratamento)} variant="secondary">{r.descricaoTratamento}</Badge>
                {r.regra.condicional && <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Condicional</Badge>}
                {r.is && <Badge variant="secondary" className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Imposto Seletivo</Badge>}
              </div>
              {r.capitulo && <p className="text-sm text-muted-foreground mt-1">Capítulo {r.tipo === "NBS" ? `${r.capitulo.codigo[0]}.${r.capitulo.codigo.slice(1)}` : r.capitulo.codigo} — {r.capitulo.descricao}</p>}
              <p className="text-sm font-medium mt-1">{r.regra.descricao}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(resumoTexto(r)); toast({ title: "Resumo copiado" }); }}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />Copiar resumo
              </Button>
              {r.tipo === "NCM" && r.valido && (
                <Button size="sm" variant="outline" disabled={salvarNcm.isPending} onClick={() => salvarNcm.mutate()}>
                  <DatabaseZap className="h-3.5 w-3.5 mr-1.5" />Cadastrar na base de NCMs
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Chip label="CST IBS/CBS" value={r.regra.cst} sub={mapCSTIbsCbs(r.regra.cst)} />
            <Chip label="cClassTrib" value={r.regra.cClassTrib} sub={mapCClassTrib(r.regra.cClassTrib)} />
            <Chip label="Redução de alíquota" value={monofasico || especifico ? "—" : `${r.regra.reducao}%`}
              sub={monofasico ? "Alíquota ad rem por unidade" : especifico ? "Alíquotas próprias do regime" : r.regra.anexo || "LC 214/2025"} />
            <Chip label="Alíquota efetiva 2033 (est.)" value={monofasico || especifico ? "Regime próprio" : pct(cron[cron.length - 1].total)}
              sub={`Referência ${pct(refAliq.cbs + refAliq.ibs)} (CBS ${pct(refAliq.cbs)} + IBS ${pct(refAliq.ibs)})`} />
          </div>

          <div className="flex items-start gap-2 text-sm rounded-md bg-muted/40 px-3 py-2">
            <Landmark className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span><span className="font-medium">Fundamento legal:</span> {r.regra.fundamento}</span>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
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
                Cliente do <strong>Simples Nacional</strong>: se recolher IBS/CBS dentro do DAS, o valor segue as tabelas da LC 123/2006 e o adquirente apropria crédito apenas do montante recolhido no DAS. CST e cClassTrib continuam obrigatórios no documento. Avalie a opção pelo recolhimento fora do DAS (regime regular) para clientes B2B.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Condições */}
        {(r.regra.condicoes?.length || 0) > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Condições para o enquadramento</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {r.regra.condicoes!.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Alternativas */}
        {(r.regra.alternativas?.length || 0) > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="h-4 w-4" />Outros cClassTrib possíveis</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {r.regra.alternativas!.map((a, i) => (
                <div key={i} className="text-sm border-l-2 border-primary/40 pl-3">
                  <span className="codigo-fiscal font-semibold">{a.cClassTrib}</span>
                  <span className="text-muted-foreground"> — {mapCClassTrib(a.cClassTrib)}</span>
                  <div className="text-xs mt-0.5">Quando: {a.quando}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Imposto Seletivo */}
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
                </div>
                <p>{r.is.descricao}</p>
                <p><span className="font-medium">Alíquota:</span> {r.is.aliquota}</p>
                <p className="text-xs text-muted-foreground">{r.is.fundamento}</p>
                <ul className="list-disc pl-5 space-y-0.5 text-xs">{r.is.observacoes.map((o, i) => <li key={i}>{o}</li>)}</ul>
              </>
            ) : (
              <p className="text-muted-foreground">Não sujeito ao Imposto Seletivo pela base atual. Bens alcançados: veículos, embarcações e aeronaves, produtos fumígenos, bebidas alcoólicas, bebidas açucaradas e bens minerais.</p>
            )}
          </CardContent>
        </Card>

        {/* Documento fiscal */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileCode2 className="h-4 w-4" />Parametrização do documento fiscal</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {campos.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-1.5 text-xs text-muted-foreground w-1/2">{c.campo}</TableCell>
                    <TableCell className="py-1.5">
                      <span className="codigo-fiscal text-sm font-medium">{c.valor}</span>
                      {c.obs && <div className="text-[11px] text-muted-foreground">{c.obs}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Cronograma */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4" />Transição 2026–2033 para este {r.tipo === "NCM" ? "produto" : "serviço"}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {monofasico || especifico ? (
            <p className="text-sm text-muted-foreground">
              {monofasico
                ? "Combustíveis: alíquotas específicas (R$ por litro/kg/m³), uniformes nacionalmente, fixadas para CBS por lei e para IBS pelo Comitê Gestor. Não se aplica a alíquota percentual de referência."
                : "Regime específico: base de cálculo e alíquotas próprias, definidas para preservar a carga tributária atual do setor. Não se aplica a alíquota de referência."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ano</TableHead><TableHead>CBS</TableHead><TableHead>IBS</TableHead><TableHead>Total</TableHead>
                  {valor > 0 && <TableHead>Sobre {brl(valor)}</TableHead>}
                  <TableHead>Tributos atuais</TableHead><TableHead className="hidden md:table-cell">Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cron.map(a => (
                  <TableRow key={a.ano}>
                    <TableCell className="font-semibold">{a.ano}</TableCell>
                    <TableCell className="codigo-fiscal">{pct(a.cbs)}</TableCell>
                    <TableCell className="codigo-fiscal">{pct(a.ibs)}</TableCell>
                    <TableCell className="codigo-fiscal font-semibold">{pct(a.total)}</TableCell>
                    {valor > 0 && <TableCell className="codigo-fiscal">{brl(valor * a.total / 100)}{r.is && a.isVigente ? " + IS" : ""}</TableCell>}
                    <TableCell className="text-xs">{a.tributosAntigos}</TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden md:table-cell">{a.obs}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            Alíquotas de referência são estimativas — os valores definitivos serão fixados por Resolução do Senado Federal. Cálculo "por fora", sem o efeito do IS na base.
          </p>
        </CardContent>
      </Card>

      {/* Subregras */}
      {r.subregras.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tratamentos dentro de {r.codigoFormatado}</CardTitle></CardHeader>
          <CardContent>
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
function ConsultaIndividual({ tipo, refAliq, valor, regimeSimples }: { tipo: TipoCodigo; refAliq: { cbs: number; ibs: number }; valor: number; regimeSimples: boolean }) {
  const [codigo, setCodigo] = useState("");
  const [consultado, setConsultado] = useState("");
  const [busca, setBusca] = useState("");
  const fmt = tipo === "NCM" ? formatarNcm : formatarNbs;
  const resultado = useMemo(() => consultado ? consultarReforma(consultado, tipo) : null, [consultado, tipo]);
  const sugestoes = useMemo(() => buscarPorDescricao(busca, tipo), [busca, tipo]);

  const consultar = (c = codigo) => { if (c.replace(/\D/g, "").length >= 2) setConsultado(c); };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 grid gap-4 md:grid-cols-2">
          <form className="space-y-1.5" onSubmit={e => { e.preventDefault(); consultar(); }}>
            <Label htmlFor={`cod-${tipo}`}>Código {tipo}</Label>
            <div className="flex gap-2">
              <Input id={`cod-${tipo}`} className="codigo-fiscal" value={codigo} placeholder={tipo === "NCM" ? "0000.00.00" : "1.0000.00.00"}
                onChange={e => setCodigo(fmt(e.target.value))} data-testid={`input-reforma-${tipo.toLowerCase()}`} />
              <Button type="submit"><Search className="h-4 w-4 mr-1.5" />Consultar</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tipo === "NCM" ? "8 dígitos. Também aceita posição (4) ou subposição (6) para ver os tratamentos do grupo." : "9 dígitos (1.XXXX.XX.XX). Aceita capítulo (1.XX) para visão geral."}
            </p>
          </form>
          <div className="space-y-1.5">
            <Label htmlFor={`busca-${tipo}`}>Ou busque pela descrição</Label>
            <Input id={`busca-${tipo}`} value={busca} onChange={e => setBusca(e.target.value)}
              placeholder={tipo === "NCM" ? "ex.: cerveja, arroz, medicamento, veículo" : "ex.: educação, saúde, contábil, restaurante"} />
            {sugestoes.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-md border divide-y">
                {sugestoes.map((s, i) => (
                  <button key={i} type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 flex gap-2"
                    onClick={() => { const f = fmt(s.codigo); setCodigo(f); consultar(f); setBusca(""); }}>
                    <span className="codigo-fiscal font-medium shrink-0">{fmt(s.codigo)}</span>
                    <span className="text-muted-foreground truncate">{s.descricao}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {resultado && <PainelResultado r={resultado} refAliq={refAliq} valor={valor} regimeSimples={regimeSimples} />}
    </div>
  );
}

// ─── Consulta em lote ────────────────────────────────────────────────────────
function ConsultaLote({ refAliq }: { refAliq: { cbs: number; ibs: number } }) {
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<ResultadoReforma[]>([]);

  const processar = () => {
    const codigos = texto.split(/[\n;,\t]+/).map(s => s.trim()).filter(s => s.replace(/\D/g, "").length >= 4);
    setLinhas(codigos.slice(0, 1000).map(c => consultarReforma(c, detectarTipo(c))));
  };

  const exportar = () => {
    const cab = ["Tipo", "Codigo", "Capitulo", "Enquadramento", "Tratamento", "Reducao_%", "CST_IBS_CBS", "cClassTrib", "Descricao_cClassTrib", "Aliq_2033_est_%", "Imposto_Seletivo", "Condicional", "Fundamento"];
    const rows = linhas.map(r => {
      const final = cronogramaTransicao(r.regra.reducao, r.regra.tratamento, r.tipo, refAliq).at(-1)!;
      return [r.tipo, r.codigoFormatado, r.capitulo?.descricao || "", r.regra.descricao, r.descricaoTratamento, r.regra.reducao,
        r.regra.cst, r.regra.cClassTrib, mapCClassTrib(r.regra.cClassTrib),
        r.regra.tratamento === "monofasico" || r.regra.tratamento === "especifico" ? "regime proprio" : final.total.toFixed(2).replace(".", ","),
        r.is ? r.is.categoria : "", r.regra.condicional ? "SIM" : "", r.regra.fundamento];
    });
    const csv = [cab, ...rows].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reforma-ncm-nbs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-3">
          <Label htmlFor="lote">Cole os códigos NCM e/ou NBS (um por linha, ou separados por vírgula/ponto e vírgula)</Label>
          <Textarea id="lote" rows={7} className="codigo-fiscal" value={texto} onChange={e => setTexto(e.target.value)}
            placeholder={"1006.30.21\n2203.00.00\n3004.90.99\n1.2201.10.00\n1.1301.10.00"} />
          <p className="text-xs text-muted-foreground">Dica: copie a coluna de NCM do cadastro de produtos do ERP ou do relatório do SPED. O tipo é detectado automaticamente (NBS = 9 dígitos começando com 1).</p>
          <div className="flex gap-2">
            <Button onClick={processar}><ListChecks className="h-4 w-4 mr-1.5" />Classificar</Button>
            {linhas.length > 0 && <Button variant="outline" onClick={exportar}><Download className="h-4 w-4 mr-1.5" />Exportar CSV (Excel)</Button>}
          </div>
        </CardContent>
      </Card>

      {linhas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {linhas.length} código(s) · {linhas.filter(l => l.regra.reducao > 0 || l.regra.tratamento !== "integral").length} com tratamento diferenciado · {linhas.filter(l => l.is).length} com IS · {linhas.filter(l => l.regra.condicional).length} condicionais
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Código</TableHead><TableHead>Enquadramento</TableHead><TableHead>Tratamento</TableHead><TableHead>CST</TableHead><TableHead>cClassTrib</TableHead><TableHead>IS</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="codigo-fiscal whitespace-nowrap">
                      {r.codigoFormatado} <Badge variant="outline" className="ml-1 text-[10px]">{r.tipo}</Badge>
                      {!r.valido && <div className="text-[10px] text-amber-600">incompleto</div>}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs">{r.regra.descricao}{r.regra.condicional && <span className="text-amber-600"> ⚠</span>}</TableCell>
                    <TableCell><Badge variant="secondary" className={corTratamento(r.regra.tratamento)}>{r.descricaoTratamento}</Badge></TableCell>
                    <TableCell className="codigo-fiscal">{r.regra.cst}</TableCell>
                    <TableCell className="codigo-fiscal">{r.regra.cClassTrib}</TableCell>
                    <TableCell className="text-xs">{r.is ? r.is.categoria : "—"}</TableCell>
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
  const [cbs, setCbs] = useState(String(ALIQ_REF_PADRAO.cbs).replace(".", ","));
  const [ibs, setIbs] = useState(String(ALIQ_REF_PADRAO.ibs).replace(".", ","));
  const [valor, setValor] = useState("");
  const refAliq = { cbs: num(cbs) || ALIQ_REF_PADRAO.cbs, ibs: num(ibs) || ALIQ_REF_PADRAO.ibs };
  const regimeSimples = clienteAtivo?.regime === "Simples Nacional";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2"><Scale className="h-5 w-5 text-primary" />Reforma Tributária por NCM / NBS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informe o NCM do produto ou a NBS do serviço e obtenha o enquadramento no IBS/CBS (CST, cClassTrib, redução, anexo e fundamento legal), a incidência do Imposto Seletivo e a transição 2026–2033 — conforme <span className="font-medium">EC 132/2023</span> e <span className="font-medium">LC 214/2025</span>.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ref-cbs">Alíquota de referência CBS (%)</Label>
            <Input id="ref-cbs" inputMode="decimal" value={cbs} onChange={e => setCbs(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ref-ibs">Alíquota de referência IBS (%)</Label>
            <Input id="ref-ibs" inputMode="decimal" value={ibs} onChange={e => setIbs(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="valor-op">Valor da operação (opcional)</Label>
            <Input id="valor-op" inputMode="decimal" placeholder="ex.: 1.000,00" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ncm">
        <TabsList>
          <TabsTrigger value="ncm">Produto (NCM)</TabsTrigger>
          <TabsTrigger value="nbs">Serviço (NBS)</TabsTrigger>
          <TabsTrigger value="lote">Em lote</TabsTrigger>
        </TabsList>
        <TabsContent value="ncm" className="mt-4"><ConsultaIndividual tipo="NCM" refAliq={refAliq} valor={num(valor)} regimeSimples={regimeSimples} /></TabsContent>
        <TabsContent value="nbs" className="mt-4"><ConsultaIndividual tipo="NBS" refAliq={refAliq} valor={num(valor)} regimeSimples={regimeSimples} /></TabsContent>
        <TabsContent value="lote" className="mt-4"><ConsultaLote refAliq={refAliq} /></TabsContent>
      </Tabs>

      <Card>
        <CardContent className="pt-5 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground text-sm">Fontes oficiais para conferência</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {FONTES_OFICIAIS.map(f => (
              <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground underline-offset-2 hover:underline">
                {f.nome}<ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
          <p>
            O enquadramento é feito pelo código mais específico da base (posição, subposição ou item). Os anexos da LC 214/2025 listam produtos por NCM <em>e descrição</em>: itens marcados como <strong>condicionais</strong> exigem a conferência da descrição exata. A responsabilidade pela classificação fiscal é do contribuinte. Cadastre o enquadramento validado na base de NCMs: ele tem prioridade sobre a base automática na Configuração NF-e.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

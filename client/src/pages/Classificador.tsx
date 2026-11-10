import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCliente } from "@/contexts/ClienteContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ListChecks, Download, Save, ShieldCheck, Info, RefreshCw, Upload, FileCode2, Database, Brain, AlertTriangle, Search } from "lucide-react";

// ─── tipos da API ────────────────────────────────────────────────────────────
type Situacao = "OPERACAO" | "MEMORIA" | "AUTOMATICO" | "CONFIRMADO" | "VERDE" | "AMARELO" | "VERMELHO" | "INEXISTENTE" | "INVALIDO";
interface Opcao { cClassTrib: string; cst: string; nome: string; anexo: string | null; reducao: number; itens: string[]; condicoes: string[]; excecoes: string[]; pontos: number; motivos: string[] }
interface Resultado {
  entrada: { ncm: string; descricao?: string; codigo?: string; cfop?: string; origem?: string };
  ncm: string; ncmFormatado: string; ncmDescricao: string | null; zeroCorrigido: boolean;
  situacao: Situacao; cst: string | null; cClassTrib: string | null; nome: string | null;
  reducao: number | null; aliquota2026: number | null; baseLegal: string; motivo: string;
  opcoes: Opcao[]; alertas: { tipo: string; texto: string }[];
  auditoria: { cstNota: string; cClassTribNota: string; ok: boolean; problemas: string[] } | null;
}
interface StatusBase { origem: string; versao: { ncm: string; classTrib: string; geradoEm: string }; totais: { ncm: number; classTrib: number; ncmComRegra: number } }
interface Resposta { base: StatusBase; operacao: any; resultados: Resultado[]; erros?: string[]; notas?: number }

type Status = Situacao | "RESOLVIDO";
type Escolha = string; // cClassTrib escolhido manualmente

const SIT: Record<Status, { rotulo: string; cls: string; ajuda: string }> = {
  OPERACAO:    { rotulo: "OPERAÇÃO",    cls: "bg-violet-600 text-white",  ajuda: "O CST vem da operação (CFOP)" },
  MEMORIA:     { rotulo: "SALVO",       cls: "bg-sky-700 text-white",     ajuda: "Decisão salva anteriormente para este produto/NCM" },
  AUTOMATICO:  { rotulo: "AUTOMÁTICO",  cls: "bg-teal-600 text-white",    ajuda: "Havia mais de uma opção e o sistema decidiu pela descrição, perfil ou destinatário" },
  CONFIRMADO:  { rotulo: "CONFIRMADO",  cls: "bg-emerald-700 text-white", ajuda: "Um enquadramento e a descrição confere com o anexo" },
  VERDE:       { rotulo: "INTEGRAL",    cls: "bg-emerald-500 text-white", ajuda: "Não consta nos anexos: tributação integral" },
  AMARELO:     { rotulo: "CONFERIR",    cls: "bg-amber-400 text-black",   ajuda: "Um enquadramento; confira a condição" },
  VERMELHO:    { rotulo: "ESCOLHER",    cls: "bg-red-600 text-white",     ajuda: "Mais de um enquadramento; escolha" },
  RESOLVIDO:   { rotulo: "RESOLVIDO",   cls: "bg-blue-600 text-white",    ajuda: "Você escolheu nesta tela" },
  INEXISTENTE: { rotulo: "NCM INEXISTENTE", cls: "bg-rose-950 text-white", ajuda: "NCM fora da tabela vigente: a nota será rejeitada" },
  INVALIDO:    { rotulo: "INVÁLIDO",    cls: "bg-zinc-800 text-white",    ajuda: "NCM sem 8 dígitos" },
};
const ORDEM: Status[] = ["VERMELHO", "INEXISTENTE", "AMARELO", "INVALIDO", "RESOLVIDO", "AUTOMATICO", "CONFIRMADO", "MEMORIA", "VERDE", "OPERACAO"];
const PRONTOS: Status[] = ["OPERACAO", "MEMORIA", "AUTOMATICO", "CONFIRMADO", "VERDE", "AMARELO", "RESOLVIDO"];
const POR_PAGINA = 300;

const DESTINATARIOS = [
  { v: "geral", l: "Contribuinte ou consumidor final" },
  { v: "orgao_publico", l: "Órgão da administração pública" },
  { v: "produtor_rural_contribuinte", l: "Produtor rural contribuinte" },
  { v: "produtor_rural_nao_contribuinte", l: "Produtor rural não contribuinte / TAC" },
];
const PERFIS = [
  { v: "geral", l: "Geral / não sei" },
  { v: "alimentos", l: "Supermercado, alimentos, bebidas" },
  { v: "agro", l: "Agropecuária, insumos agrícolas" },
  { v: "saude", l: "Saúde, hospitalar, farmácia" },
  { v: "higiene_limpeza", l: "Higiene e limpeza" },
  { v: "pet", l: "Pet shop" },
];

const pct = (v: number | null) => v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const lerLocal = (k: string, padrao: string) => { try { return localStorage.getItem(k) || padrao; } catch { return padrao; } };
const gravarLocal = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignora */ } };

export default function Classificador() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { clienteAtivo } = useCliente();
  const clienteId = clienteAtivo?.id ?? null;
  const chaveCtx = `classif-ctx-${clienteId ?? 0}`;

  // contexto
  const [cfop, setCfop] = useState("");
  const [destinatario, setDestinatario] = useState("geral");
  const [perfil, setPerfil] = useState("geral");
  useEffect(() => {
    try {
      const c = JSON.parse(lerLocal(chaveCtx, "{}"));
      setCfop(c.cfop ?? (clienteAtivo as any)?.cfopPadrao ?? "");
      setDestinatario(c.destinatario ?? "geral");
      setPerfil(c.perfil ?? "geral");
    } catch { /* ignora */ }
  }, [chaveCtx]);
  const contexto = { cfop: cfop || undefined, destinatario, perfil };
  useEffect(() => { gravarLocal(chaveCtx, JSON.stringify({ cfop, destinatario, perfil })); }, [cfop, destinatario, perfil, chaveCtx]);

  // fonte
  const [fonte, setFonte] = useState<"lista" | "xml" | "importados">("lista");
  const [texto, setTexto] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [tipoImportados, setTipoImportados] = useState("saida");
  const csvRef = useRef<HTMLInputElement>(null);

  // resultado
  const [resp, setResp] = useState<Resposta | null>(null);
  const [escolhas, setEscolhas] = useState<Record<number, Escolha>>({});
  const [filtro, setFiltro] = useState<Status | "TODOS" | "PROBLEMAS">("TODOS");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);
  const [escopo, setEscopo] = useState<"produto" | "ncm">("produto");
  const [regime, setRegime] = useState<"simples" | "presumido" | "ambos">("ambos");

  const { data: base, refetch: refetchBase } = useQuery<StatusBase>({ queryKey: ["/api/classificador/base"] });

  const receber = (d: Resposta) => {
    setResp(d); setEscolhas({}); setFiltro("TODOS"); setLimite(POR_PAGINA); setBusca("");
    if (d.erros?.length) toast({ title: `${d.erros.length} arquivo(s) não lidos`, description: d.erros.slice(0, 3).join(" · "), variant: "destructive" });
  };
  const erro = (e: Error) => toast({ title: "Não foi possível classificar", description: e.message.replace(/^\d+: /, ""), variant: "destructive" });

  const classificar = useMutation({
    mutationFn: async (): Promise<Resposta> => {
      if (fonte === "lista") return (await apiRequest("POST", "/api/classificador", { texto, contexto, clienteId })).json();
      if (fonte === "importados") return (await apiRequest("POST", "/api/classificador/xml-importados", { clienteId, tipo: tipoImportados, contexto })).json();
      const fd = new FormData();
      arquivos.forEach(f => fd.append("xmlFiles", f));
      fd.append("contexto", JSON.stringify(contexto));
      if (clienteId) fd.append("clienteId", String(clienteId));
      const r = await fetch("/api/classificador/xml", { method: "POST", body: fd });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
      return r.json();
    },
    onSuccess: receber, onError: erro,
  });

  const atualizarBase = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/classificador/base/atualizar")).json(),
    onSuccess: () => { refetchBase(); toast({ title: "Bases oficiais atualizadas", description: "NCM (Siscomex) e cClassTrib/anexos (SVRS) recarregados." }); },
    onError: (e: Error) => toast({ title: "Atualização automática falhou", description: e.message.replace(/^\d+: /, ""), variant: "destructive" }),
  });
  const ncmFileRef = useRef<HTMLInputElement>(null);
  const ctFileRef = useRef<HTMLInputElement>(null);
  const importarBase = useMutation({
    mutationFn: async () => {
      const n = ncmFileRef.current?.files?.[0]; const c = ctFileRef.current?.files?.[0];
      if (!n || !c) throw new Error("Selecione os dois arquivos.");
      const fd = new FormData(); fd.append("ncm", n); fd.append("classtrib", c);
      const r = await fetch("/api/classificador/base/importar", { method: "POST", body: fd });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
      return r.json();
    },
    onSuccess: () => { refetchBase(); toast({ title: "Bases importadas dos arquivos" }); },
    onError: (e: Error) => toast({ title: "Importação falhou", description: e.message, variant: "destructive" }),
  });

  // linhas finais (aplica escolhas manuais)
  const linhas = useMemo(() => (resp?.resultados || []).map((r, i) => {
    const esc = escolhas[i];
    if (!esc) return { i, r, status: r.situacao as Status, cClassTrib: r.cClassTrib, cst: r.cst, reducao: r.reducao, aliq: r.aliquota2026, base: r.baseLegal };
    const o = r.opcoes.find(x => x.cClassTrib === esc);
    const red = esc === "000001" ? 0 : (o?.reducao ?? 0);
    return { i, r, status: "RESOLVIDO" as Status, cClassTrib: esc, cst: o?.cst || (esc === "000001" ? "000" : esc.slice(0, 3)), reducao: red, aliq: Math.round((1 - red / 100) * 1000) / 1000, base: o ? `${o.anexo || ""} · escolha manual` : "Tributação integral · escolha manual" };
  }), [resp, escolhas]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = {}; let problemas = 0;
    linhas.forEach(l => { c[l.status] = (c[l.status] || 0) + 1; if (l.r.auditoria && !l.r.auditoria.ok) problemas++; });
    return { c, problemas };
  }, [linhas]);
  const temAuditoria = linhas.some(l => l.r.auditoria);

  const visiveis = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return linhas
      .filter(l => filtro === "TODOS" || (filtro === "PROBLEMAS" ? l.r.auditoria && !l.r.auditoria.ok : l.status === filtro))
      .filter(l => !b || l.r.ncm.includes(b.replace(/\D/g, "") || "~") || (l.r.entrada.descricao || "").toLowerCase().includes(b) || (l.r.entrada.codigo || "").toLowerCase().includes(b));
  }, [linhas, filtro, busca]);

  const prontos = linhas.filter(l => l.cClassTrib && l.r.ncm && PRONTOS.includes(l.status));

  const salvarDecisoes = useMutation({
    mutationFn: async () => {
      const itens = Object.entries(escolhas).map(([i, ct]) => {
        const r = resp!.resultados[Number(i)];
        return { ncm: r.ncm, descricao: r.entrada.descricao || undefined, cClassTrib: ct, escopo, justificativa: "Escolha manual no classificador" };
      }).filter(x => x.ncm);
      if (!itens.length) throw new Error("Nenhuma escolha manual nesta tela.");
      return (await apiRequest("POST", "/api/classificador/decisoes", { clienteId, itens })).json();
    },
    onSuccess: (d: any) => toast({ title: `${d.salvas} decisão(ões) salvas`, description: `Na próxima classificação ${clienteAtivo ? "deste cliente" : ""} elas são aplicadas sozinhas.` }),
    onError: (e: Error) => toast({ title: "Não foi possível salvar", description: e.message.replace(/^\d+: /, ""), variant: "destructive" }),
  });

  const salvarCadastro = useMutation({
    mutationFn: async () => {
      const itens = prontos.map(l => ({ ncm: l.r.ncm, cClassTrib: l.cClassTrib!, baseLegal: l.base, descricao: l.r.entrada.descricao || undefined }));
      return (await apiRequest("POST", "/api/classificador/salvar", { regime, itens })).json();
    },
    onSuccess: (d: any) => { qc.invalidateQueries({ queryKey: ["/api/ncms"] }); toast({ title: "Cadastro de NCMs atualizado", description: `${d.criados} criado(s), ${d.atualizados} atualizado(s).` }); },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  function exportar(soProblemas: boolean) {
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const cab = ["Código", "Descrição", "NCM", "Descrição NCM oficial", "Situação", "CST IBS/CBS", "cClassTrib", "Redução", "Alíquota 2026 (CBS+IBS teste)", "Base legal", "Motivo", "Alertas", "cClassTrib na nota", "Problemas na nota", "Origem"];
    const fonteL = soProblemas ? linhas.filter(l => l.r.auditoria && !l.r.auditoria.ok || ["VERMELHO", "INEXISTENTE", "INVALIDO"].includes(l.status)) : linhas;
    const csv = [cab.map(q).join(";"), ...fonteL.map(l => [
      l.r.entrada.codigo, l.r.entrada.descricao, l.r.ncmFormatado, l.r.ncmDescricao, SIT[l.status].rotulo, l.cst, l.cClassTrib,
      pct(l.reducao), pct(l.aliq), l.base, l.r.motivo, l.r.alertas.map(a => a.texto).join(" | "),
      l.r.auditoria?.cClassTribNota, l.r.auditoria?.problemas.join(" | "), l.r.entrada.origem,
    ].map(q).join(";"))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = soProblemas ? "classificacao_pendencias.csv" : "classificacao_ibs_cbs.csv";
    a.click(); URL.revokeObjectURL(a.href);
  }

  function lerArquivoLista(f?: File) {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setTexto(String(rd.result || ""));
    rd.readAsText(f, "utf-8");
  }

  const podeClassificar = fonte === "lista" ? !!texto.trim() : fonte === "xml" ? arquivos.length > 0 : true;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> Classificador IBS/CBS</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            CST e cClassTrib de cada produto pela tabela oficial da SVRS e pelos anexos da LC 214/2025. Lê a descrição do produto, aprende com as suas decisões e audita os XMLs das notas.
          </p>
        </div>
        <details className="text-xs border rounded-lg px-3 py-2 bg-muted/30 max-w-md">
          <summary className="cursor-pointer flex items-center gap-1.5 font-medium"><Database className="h-3.5 w-3.5" /> Bases oficiais {base ? `· ${base.origem === "atualizada" ? "atualizadas" : "do sistema"}` : ""}</summary>
          {base && (
            <div className="mt-2 space-y-1 text-muted-foreground">
              <p><b>NCM:</b> {base.totais.ncm.toLocaleString("pt-BR")} códigos — {base.versao.ncm}</p>
              <p><b>cClassTrib:</b> {base.totais.classTrib} códigos, {base.totais.ncmComRegra.toLocaleString("pt-BR")} NCMs com regra de anexo — {base.versao.classTrib}</p>
              <p>Gerada em {new Date(base.versao.geradoEm).toLocaleString("pt-BR")}</p>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => atualizarBase.mutate()} disabled={atualizarBase.isPending}>
              <RefreshCw className={`h-3 w-3 mr-1 ${atualizarBase.isPending ? "animate-spin" : ""}`} /> {atualizarBase.isPending ? "Baixando…" : "Atualizar agora"}
            </Button>
          </div>
          <div className="mt-2 border-t pt-2 space-y-1">
            <p className="text-muted-foreground">Sem internet no servidor? Importe os arquivos: o JSON da NCM (Portal Único Siscomex) e a página de Classificação Tributária salva da SVRS.</p>
            <input ref={ncmFileRef} type="file" accept=".json" className="block text-[11px]" aria-label="Arquivo NCM" />
            <input ref={ctFileRef} type="file" accept=".html,.htm,.json" className="block text-[11px]" aria-label="Arquivo cClassTrib" />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => importarBase.mutate()} disabled={importarBase.isPending}><Upload className="h-3 w-3 mr-1" /> Importar arquivos</Button>
          </div>
        </details>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cl-cfop" className="text-xs">CFOP da operação (opcional)</Label>
              <Input id="cl-cfop" value={cfop} onChange={e => setCfop(e.target.value)} placeholder="ex.: 5102" maxLength={5} className="font-mono h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cl-dest" className="text-xs">Para quem vende</Label>
              <select id="cl-dest" className="w-full h-9 text-sm border rounded-md px-2 bg-background" value={destinatario} onChange={e => setDestinatario(e.target.value)}>
                {DESTINATARIOS.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cl-perfil" className="text-xs">Ramo da empresa {clienteAtivo ? `(${clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial})` : ""}</Label>
              <select id="cl-perfil" className="w-full h-9 text-sm border rounded-md px-2 bg-background" value={perfil} onChange={e => setPerfil(e.target.value)}>
                {PERFIS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
            O ramo ajuda a decidir casos ambíguos (ex.: arroz como alimento ou como semente). O destinatário troca códigos automaticamente (órgão público, produtor rural). O contexto fica salvo por cliente.
          </p>

          <div className="flex flex-wrap gap-1 border-b">
            {([["lista", "Colar lista / CSV", ListChecks], ["xml", "Arquivos XML de NF-e", FileCode2], ["importados", "XMLs já importados", Database]] as const).map(([k, l, Icon]) => (
              <button key={k} onClick={() => setFonte(k)} className={`px-3 py-2 text-sm flex items-center gap-1.5 border-b-2 -mb-px ${fonte === k ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"}`}>
                <Icon className="h-4 w-4" /> {l}
              </button>
            ))}
          </div>

          {fonte === "lista" && (
            <div className="space-y-1.5">
              <Textarea value={texto} onChange={e => setTexto(e.target.value)} spellCheck={false}
                placeholder={"Cole do Excel: código, descrição e NCM em qualquer ordem, ou um NCM por linha.\nA1\tArroz tipo 1 5kg\t1006.30.21\nB2\tDesinfetante pinho uso doméstico\t3808.94.19\n19021100 Macarrão com ovos"}
                className="font-mono text-xs min-h-[170px]" data-testid="classificador-texto" />
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span>{texto.split(/\r?\n/).filter(l => l.trim()).length} linha(s). Com a descrição do produto o sistema resolve muito mais casos sozinho.</span>
                <input ref={csvRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={e => lerArquivoLista(e.target.files?.[0])} />
                <button className="underline text-primary" onClick={() => csvRef.current?.click()}>Abrir arquivo CSV/TXT</button>
              </div>
            </div>
          )}
          {fonte === "xml" && (
            <div className="space-y-2">
              <input type="file" multiple accept=".xml" onChange={e => setArquivos(Array.from(e.target.files || []))} className="text-sm" data-testid="classificador-xml" />
              <p className="text-[11px] text-muted-foreground">
                Até 500 XMLs de NF-e/NFC-e. Cada item é classificado e o CST/cClassTrib que saiu na nota é conferido: código inexistente, CST incompatível, NCM fora do anexo, divergência com a sugestão ou nota sem o grupo IBS/CBS.
                {arquivos.length > 0 && <b className="text-foreground"> {arquivos.length} arquivo(s) selecionado(s).</b>}
              </p>
            </div>
          )}
          {fonte === "importados" && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <select className="h-9 text-sm border rounded-md px-2 bg-background" value={tipoImportados} onChange={e => setTipoImportados(e.target.value)} aria-label="Tipo de nota">
                <option value="saida">Notas de saída</option><option value="entrada">Notas de entrada</option><option value="todos">Todas</option>
              </select>
              <span className="text-[11px] text-muted-foreground">Usa os XMLs importados na tela XML NF-e {clienteAtivo ? "deste cliente" : "(todos os clientes)"}. Itens repetidos são agrupados.</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => classificar.mutate()} disabled={!podeClassificar || classificar.isPending} className="min-w-40" data-testid="classificador-executar">
              {classificar.isPending ? "Classificando…" : "Classificar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resp?.operacao && !resp.operacao.tributavel && (
        <div className="rounded-lg border border-violet-300 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800 px-4 py-3 text-sm flex gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-violet-600" />
          <div><b>CFOP {resp.operacao.cfop}: {resp.operacao.descricao} → CST {resp.operacao.cst} / cClassTrib {resp.operacao.cClassTrib}.</b> <span className="text-muted-foreground">{resp.operacao.baseLegal}. Os itens abaixo seguem a operação.</span></div>
        </div>
      )}

      {resp && linhas.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Itens", linhas.length, ""],
              ["Resolvidos sem você", linhas.filter(l => ["OPERACAO", "MEMORIA", "AUTOMATICO", "CONFIRMADO", "VERDE"].includes(l.status)).length, "text-emerald-700 dark:text-emerald-400"],
              ["Para conferir ou escolher", (contagem.c.AMARELO || 0) + (contagem.c.VERMELHO || 0), "text-amber-700 dark:text-amber-400"],
              [temAuditoria ? "Notas com problema" : "NCM a corrigir", temAuditoria ? contagem.problemas : (contagem.c.INEXISTENTE || 0) + (contagem.c.INVALIDO || 0), "text-red-700 dark:text-red-400"],
            ].map(([t, v, cls]) => (
              <div key={String(t)} className="border rounded-lg px-4 py-3 bg-card">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t}</div>
                <div className={`text-2xl font-semibold tabular-nums ${cls}`}>{Number(v).toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={() => { setFiltro("TODOS"); setLimite(POR_PAGINA); }} className={`text-xs px-3 py-1.5 rounded-full border ${filtro === "TODOS" ? "bg-foreground text-background" : "bg-background"}`}>Todos · {linhas.length}</button>
            {temAuditoria && <button onClick={() => setFiltro("PROBLEMAS")} className={`text-xs px-3 py-1.5 rounded-full font-medium bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 ${filtro === "PROBLEMAS" ? "ring-2 ring-offset-2 ring-foreground" : ""}`}>Problemas na nota · {contagem.problemas}</button>}
            {ORDEM.filter(s => contagem.c[s]).map(s => (
              <button key={s} title={SIT[s].ajuda} onClick={() => { setFiltro(s); setLimite(POR_PAGINA); }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium ${SIT[s].cls} ${filtro === s ? "ring-2 ring-offset-2 ring-foreground" : "opacity-90"}`}>
                {SIT[s].rotulo} · {contagem.c[s]}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar NCM, produto, código" className="h-8 pl-7 text-xs w-56" aria-label="Buscar" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center border rounded-lg px-3 py-2 bg-muted/30">
            <Button variant="outline" size="sm" onClick={() => exportar(false)}><Download className="h-4 w-4 mr-1" /> Exportar tudo (Excel)</Button>
            <Button variant="outline" size="sm" onClick={() => exportar(true)}><AlertTriangle className="h-4 w-4 mr-1" /> Exportar pendências</Button>
            <span className="mx-1 h-5 w-px bg-border" />
            <select className="text-xs border rounded px-2 py-1.5 bg-background" value={escopo} onChange={e => setEscopo(e.target.value as any)} aria-label="Alcance da decisão">
              <option value="produto">Lembrar por produto (NCM + descrição)</option>
              <option value="ncm">Lembrar para o NCM inteiro</option>
            </select>
            <Button size="sm" variant="secondary" onClick={() => salvarDecisoes.mutate()} disabled={!Object.keys(escolhas).length || salvarDecisoes.isPending}>
              <Brain className="h-4 w-4 mr-1" /> Lembrar {Object.keys(escolhas).length} escolha(s)
            </Button>
            <span className="mx-1 h-5 w-px bg-border" />
            <select className="text-xs border rounded px-2 py-1.5 bg-background" value={regime} onChange={e => setRegime(e.target.value as any)} aria-label="Regime para o cadastro">
              <option value="ambos">Cadastro: Simples e Presumido</option><option value="simples">Cadastro: Simples</option><option value="presumido">Cadastro: Presumido</option>
            </select>
            <Button size="sm" onClick={() => salvarCadastro.mutate()} disabled={!prontos.length || salvarCadastro.isPending}><Save className="h-4 w-4 mr-1" /> Gravar {prontos.length} no cadastro de NCMs</Button>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs min-w-[1100px]">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Produto</th>
                  <th className="px-3 py-2 font-semibold">NCM</th>
                  <th className="px-3 py-2 font-semibold">Situação</th>
                  <th className="px-3 py-2 font-semibold">CST · cClassTrib</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Redução · 2026</th>
                  <th className="px-3 py-2 font-semibold min-w-[260px]">Por quê</th>
                  <th className="px-3 py-2 font-semibold min-w-[220px]">Decisão</th>
                  {temAuditoria && <th className="px-3 py-2 font-semibold min-w-[220px]">Na nota</th>}
                </tr>
              </thead>
              <tbody>
                {visiveis.slice(0, limite).map(l => {
                  const r = l.r;
                  const editavel = r.ncm && r.situacao !== "INEXISTENTE" && r.situacao !== "OPERACAO" && (r.opcoes.length > 0 || r.situacao === "MEMORIA");
                  return (
                    <tr key={l.i} className="border-t align-top">
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="font-medium">{r.entrada.descricao || <span className="text-muted-foreground">sem descrição</span>}</div>
                        {(r.entrada.codigo || r.entrada.origem) && <div className="text-[10px] text-muted-foreground">{[r.entrada.codigo, r.entrada.origem].filter(Boolean).join(" · ")}</div>}
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="font-mono whitespace-nowrap">{r.ncmFormatado}</div>
                        {r.ncmDescricao && <div className="text-[10px] text-muted-foreground line-clamp-2" title={r.ncmDescricao}>{r.ncmDescricao.split(" › ").slice(-2).join(" › ")}</div>}
                      </td>
                      <td className="px-3 py-2"><Badge className={`${SIT[l.status].cls} text-[10px] whitespace-nowrap pointer-events-none`} title={SIT[l.status].ajuda}>{SIT[l.status].rotulo}</Badge></td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {l.cClassTrib ? <>{l.cst} · <b>{l.cClassTrib}</b></> : "—"}
                        {l.cClassTrib && <div className="font-sans text-[10px] text-muted-foreground whitespace-normal max-w-[200px]">{l.base}</div>}
                      </td>
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{l.reducao !== null ? `${pct(l.reducao)} · ${pct(l.aliq)}` : "—"}</td>
                      <td className="px-3 py-2">
                        <div>{r.motivo}</div>
                        {r.alertas.map((a, k) => <div key={k} className={`text-[10px] mt-0.5 ${a.tipo === "aviso" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>• {a.texto}</div>)}
                      </td>
                      <td className="px-3 py-2">
                        {editavel && (
                          <select className={`w-full text-xs border rounded px-2 py-1 bg-background ${l.status === "VERMELHO" ? "border-red-500" : ""}`}
                            value={escolhas[l.i] || ""} aria-label={`Decisão para ${r.ncmFormatado}`}
                            onChange={e => setEscolhas(p => { const n = { ...p }; if (e.target.value) n[l.i] = e.target.value; else delete n[l.i]; return n; })}>
                            <option value="">{l.status === "VERMELHO" ? "— escolha —" : "Manter resultado"}</option>
                            {r.opcoes.map(o => <option key={o.cClassTrib} value={o.cClassTrib}>{o.cClassTrib} · {o.anexo || o.nome.slice(0, 30)} · {o.reducao === 100 ? "alíquota zero" : `−${o.reducao}%`}{o.pontos > 0 ? ` (${o.pontos} pts)` : ""}</option>)}
                            <option value="000001">000001 · Tributação integral</option>
                          </select>
                        )}
                        {l.status === "VERMELHO" && r.opcoes.slice(0, 3).map(o => (
                          <div key={o.cClassTrib} className="text-[10px] text-muted-foreground mt-1" title={o.itens.join(" | ")}>
                            <b>{o.cClassTrib}</b>: {o.itens[0]?.slice(0, 110)}{o.excecoes[0] ? ` — exceto: ${o.excecoes[0].slice(0, 80)}` : ""}
                          </div>
                        ))}
                      </td>
                      {temAuditoria && (
                        <td className="px-3 py-2">
                          {r.auditoria ? (
                            <>
                              <div className="font-mono">{r.auditoria.cstNota || "—"} · {r.auditoria.cClassTribNota || "—"}</div>
                              {r.auditoria.ok
                                ? <div className="text-[10px] text-emerald-700 dark:text-emerald-400">Confere</div>
                                : r.auditoria.problemas.map((p, k) => <div key={k} className="text-[10px] text-red-700 dark:text-red-400">• {p}</div>)}
                            </>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {!visiveis.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum item neste filtro.</td></tr>}
              </tbody>
            </table>
          </div>
          {visiveis.length > limite && (
            <div className="text-center"><Button variant="outline" size="sm" onClick={() => setLimite(x => x + POR_PAGINA)}>Mostrar mais ({visiveis.length - limite} restantes)</Button></div>
          )}
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        Fontes: tabela NCM vigente (Portal Único Siscomex) e tabela de Classificação Tributária com os anexos da LC 214/2025 (Portal DF-e SVRS).
        "Automático" e "Confirmado" usam a descrição do produto e o contexto informado: confira por amostragem. Alíquota 2026 = CBS 0,9% + IBS 0,1% do ano-teste, com a redução aplicada.
      </p>
    </div>
  );
}

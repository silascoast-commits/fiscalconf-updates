import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCliente } from "@/contexts/ClienteContext";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  FileCode2, Upload, TrendingDown, TrendingUp, AlertCircle, CheckCircle2,
  Trash2, Eye, Download, Filter, RefreshCw, FileX, Info, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownLeft, BarChart3, DollarSign, Layers
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const [y, m, d] = (s.split("T")[0] || s).split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}
function fmtCnpj(c: string | null | undefined) {
  if (!c) return "—";
  const d = c.replace(/\D/g, "");
  if (d.length !== 14) return c;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}
function tipoLabel(tipo: string) {
  return tipo === "entrada"
    ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 gap-1 text-xs"><ArrowDownLeft className="h-3 w-3"/>Entrada</Badge>
    : <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 gap-1 text-xs"><ArrowUpRight className="h-3 w-3"/>Saída</Badge>;
}
function situacaoBadge(s: string) {
  if (s === "cancelada") return <Badge variant="destructive" className="text-xs">Cancelada</Badge>;
  if (s === "denegada")  return <Badge className="bg-orange-100 text-orange-700 text-xs">Denegada</Badge>;
  return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">Importada</Badge>;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface XmlNota {
  id: number;
  clienteId: number | null;
  tipo: string;
  chaveAcesso: string | null;
  modelo: string | null;
  serie: string | null;
  numero: string | null;
  dataEmissao: string | null;
  emitCnpj: string | null;
  emitRazao: string | null;
  destCnpj: string | null;
  destRazao: string | null;
  valorNota: number;
  baseCalcIcms: number;
  valorIcms: number;
  valorIpi: number;
  valorPis: number;
  valorCofins: number;
  valorIbs: number;
  valorCbs: number;
  valorSt: number;
  valorFrete: number;
  valorDesc: number;
  valorProd: number;
  itens: string | null;
  situacao: string;
  nomeArquivo: string | null;
  importadoEm: string;
}

interface Dashboard {
  totalEntradas: number; totalSaidas: number; totalNotas: number;
  valorEntradas: number; valorSaidas: number;
  icmsEntradas: number; icmsSaidas: number;
  pisEntradas: number; pisSaidas: number;
  cofinsEntradas: number; cofinsSaidas: number;
  ibsEntradas: number; ibsSaidas: number;
  cbsEntradas: number; cbsSaidas: number;
  creditoIbs: number; creditoCbs: number;
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function XmlImport() {
  const { clienteAtivo } = useCliente();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ importados: number; erros: number; erros_det: any[] } | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "entrada" | "saida">("todos");
  const [filtroSituacao, setFiltroSituacao] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [notaDetalhe, setNotaDetalhe] = useState<XmlNota | null>(null);
  const [expandedItems, setExpandedItems] = useState(false);

  const clienteId = clienteAtivo?.id;

  // Queries
  const { data: notas = [], isLoading: loadingNotas, refetch } = useQuery<XmlNota[]>({
    queryKey: ["/api/xml-importacoes", clienteId],
    queryFn: () => {
      const url = clienteId ? `/api/xml-importacoes?clienteId=${clienteId}` : "/api/xml-importacoes";
      return apiRequest("GET", url).then(r => r.json());
    },
  });

  const { data: dash } = useQuery<Dashboard>({
    queryKey: ["/api/xml-dashboard", clienteId],
    queryFn: () => {
      const url = clienteId ? `/api/xml-dashboard?clienteId=${clienteId}` : "/api/xml-dashboard";
      return apiRequest("GET", url).then(r => r.json());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/xml-importacoes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/xml-importacoes"] });
      qc.invalidateQueries({ queryKey: ["/api/xml-dashboard"] });
      toast({ title: "Nota removida com sucesso" });
    },
  });

  // Upload
  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".xml"));
    if (arr.length === 0) {
      toast({ title: "Nenhum arquivo XML selecionado", variant: "destructive" });
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      arr.forEach(f => fd.append("xmlFiles", f));
      if (clienteId) fd.append("clienteId", String(clienteId));
      if (clienteAtivo?.cnpj) fd.append("clienteCnpj", clienteAtivo.cnpj);

      const res = await fetch("/api/xml-import", { method: "POST", body: fd });
      const data = await res.json();
      setUploadResult({ importados: data.importados, erros: data.totalErros, erros_det: data.erros });
      toast({
        title: `${data.importados} nota(s) importada(s)`,
        description: data.totalErros > 0 ? `${data.totalErros} arquivo(s) com erro` : "Importação concluída",
        variant: data.totalErros > 0 ? "destructive" : "default",
      });
      qc.invalidateQueries({ queryKey: ["/api/xml-importacoes"] });
      qc.invalidateQueries({ queryKey: ["/api/xml-dashboard"] });
    } catch (e: any) {
      toast({ title: "Erro ao importar", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  // Drag & Drop
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    uploadFiles(e.dataTransfer.files);
  }, [clienteId, clienteAtivo]);

  // Filtros
  const notasFiltradas = notas.filter(n => {
    if (filtroTipo !== "todos" && n.tipo !== filtroTipo) return false;
    if (filtroSituacao !== "todos" && n.situacao !== filtroSituacao) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const match = [n.emitRazao, n.destRazao, n.numero, n.chaveAcesso, n.emitCnpj, n.destCnpj, n.nomeArquivo]
        .some(f => (f || "").toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Exportar CSV
  function exportarCsv() {
    const header = ["Tipo","Situação","NF-e Nº","Série","Data Emissão","Emitente","CNPJ Emit","Destinatário","CNPJ Dest","Valor Nota","Base ICMS","ICMS","IPI","PIS","COFINS","IBS","CBS","ST","Frete","Desc","Produtos","Chave Acesso","Arquivo"];
    const rows = notasFiltradas.map(n => [
      n.tipo, n.situacao, n.numero||"", n.serie||"", fmtDate(n.dataEmissao),
      n.emitRazao||"", fmtCnpj(n.emitCnpj),
      n.destRazao||"", fmtCnpj(n.destCnpj),
      n.valorNota, n.baseCalcIcms, n.valorIcms, n.valorIpi,
      n.valorPis, n.valorCofins, n.valorIbs, n.valorCbs,
      n.valorSt, n.valorFrete, n.valorDesc, n.valorProd,
      n.chaveAcesso||"", n.nomeArquivo||""
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `xml-notas-fiscais-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  const itens = notaDetalhe?.itens ? (() => { try { return JSON.parse(notaDetalhe.itens); } catch { return []; } })() : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-primary" />
            Importação XML NF-e
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Importe XMLs de NF-e (modelo 55/65) — entradas e saídas processadas automaticamente
          </p>
        </div>
        {clienteAtivo && (
          <Badge variant="outline" className="gap-1 text-xs">
            Empresa ativa: <span className="font-semibold">{clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial}</span>
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="importar">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="importar"><Upload className="h-3.5 w-3.5 mr-1.5"/>Importar</TabsTrigger>
          <TabsTrigger value="notas"><Layers className="h-3.5 w-3.5 mr-1.5"/>Notas ({notas.length})</TabsTrigger>
          <TabsTrigger value="dashboard"><BarChart3 className="h-3.5 w-3.5 mr-1.5"/>Dashboard</TabsTrigger>
        </TabsList>

        {/* ── ABA IMPORTAR ─────────────────────────────────────────────── */}
        <TabsContent value="importar" className="space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            data-testid="xml-dropzone"
            className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all select-none
              ${dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/30"}
              ${uploading ? "pointer-events-none opacity-60" : ""}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              multiple
              className="hidden"
              data-testid="xml-file-input"
              onChange={e => e.target.files && uploadFiles(e.target.files)}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                <p className="font-medium">Processando XMLs...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className={`p-4 rounded-full transition-colors ${dragging ? "bg-primary/10" : "bg-muted"}`}>
                  <Upload className={`h-8 w-8 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="font-semibold text-base">Arraste XMLs aqui ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Aceita múltiplos arquivos NF-e modelo 55 e 65 (.xml)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tamanho máximo: 10 MB por arquivo
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Resultado do Upload */}
          {uploadResult && (
            <Card className={uploadResult.erros > 0 ? "border-destructive/50" : "border-emerald-500/50"}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  {uploadResult.erros > 0
                    ? <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    : <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  }
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {uploadResult.importados} nota(s) importada(s) com sucesso
                      {uploadResult.erros > 0 && ` · ${uploadResult.erros} erro(s)`}
                    </p>
                    {uploadResult.erros_det?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {uploadResult.erros_det.map((e: any, i: number) => (
                          <li key={i} className="text-xs text-destructive flex gap-1">
                            <FileX className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span><strong>{e.arquivo}</strong>: {e.erro}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info box */}
          <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-3">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <p><strong>Classificação automática:</strong> NF-e com CFOP iniciando em 1, 2 ou 3 é classificada como <strong>Entrada</strong>; CFOP 5, 6 ou 7 como <strong>Saída</strong>.</p>
                  <p><strong>Empresa ativa:</strong> se o CNPJ do destinatário coincidir com o CNPJ da empresa selecionada no seletor de empresas, a nota é classificada como entrada.</p>
                  <p><strong>IBS/CBS:</strong> extraídos dos grupos <code>gIBS</code> e <code>gCBS</code> (NF-e 4.x — Reforma Tributária LC 214/2025).</p>
                  <p><strong>Chave de acesso:</strong> extraída automaticamente do atributo <code>Id</code> da NF-e (44 dígitos).</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA NOTAS ────────────────────────────────────────────────── */}
        <TabsContent value="notas" className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Buscar por emitente, número, CNPJ, chave..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="h-8 text-xs w-64"
              data-testid="xml-busca-input"
            />
            <Select value={filtroTipo} onValueChange={(v: any) => setFiltroTipo(v)}>
              <SelectTrigger className="h-8 text-xs w-32" data-testid="xml-filtro-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
              <SelectTrigger className="h-8 text-xs w-36" data-testid="xml-filtro-situacao">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas situações</SelectItem>
                <SelectItem value="importado">Importadas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
                <SelectItem value="denegada">Denegadas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={exportarCsv} data-testid="xml-export-csv">
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
          </div>

          {/* Tabela */}
          {loadingNotas ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Carregando notas...
            </div>
          ) : notasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <FileCode2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma nota encontrada.</p>
              <p className="text-xs">Importe XMLs na aba "Importar".</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>NF-e Nº</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Emitente</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">ICMS</TableHead>
                    <TableHead className="text-right">IBS+CBS</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notasFiltradas.map(n => (
                    <TableRow key={n.id} className="text-xs hover:bg-accent/30">
                      <TableCell>{tipoLabel(n.tipo)}</TableCell>
                      <TableCell>{situacaoBadge(n.situacao)}</TableCell>
                      <TableCell className="font-mono">
                        {n.numero ? `${n.serie || "0"}-${n.numero}` : "—"}
                        <div className="text-[10px] text-muted-foreground">Mod.{n.modelo || "55"}</div>
                      </TableCell>
                      <TableCell>{fmtDate(n.dataEmissao)}</TableCell>
                      <TableCell className="max-w-[140px]">
                        <div className="truncate font-medium">{n.emitRazao || "—"}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{fmtCnpj(n.emitCnpj)}</div>
                      </TableCell>
                      <TableCell className="max-w-[140px]">
                        <div className="truncate">{n.destRazao || "—"}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{fmtCnpj(n.destCnpj)}</div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{moeda(n.valorNota)}</TableCell>
                      <TableCell className="text-right text-orange-600 dark:text-orange-400">{moeda(n.valorIcms)}</TableCell>
                      <TableCell className="text-right text-purple-600 dark:text-purple-400">
                        {moeda((n.valorIbs||0) + (n.valorCbs||0))}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => setNotaDetalhe(n)}
                            data-testid={`btn-detalhe-${n.id}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(n.id)}
                            data-testid={`btn-delete-${n.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {notasFiltradas.length > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              {notasFiltradas.length} nota(s) exibida(s)
            </p>
          )}
        </TabsContent>

        {/* ── ABA DASHBOARD ────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4">
          {!dash || dash.totalNotas === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <BarChart3 className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma nota importada ainda.</p>
              <p className="text-xs">Importe XMLs para visualizar o dashboard.</p>
            </div>
          ) : (
            <>
              {/* Cards resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground">Total NF-e</p>
                    <p className="text-2xl font-bold">{dash.totalNotas}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-emerald-600">{dash.totalEntradas} entradas</span>
                      <span className="text-xs text-blue-600">{dash.totalSaidas} saídas</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownLeft className="h-3 w-3 text-emerald-500"/>Total Entradas</p>
                    <p className="text-lg font-bold text-emerald-600">{moeda(dash.valorEntradas)}</p>
                    <p className="text-xs text-muted-foreground">{dash.totalEntradas} notas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUpRight className="h-3 w-3 text-blue-500"/>Total Saídas</p>
                    <p className="text-lg font-bold text-blue-600">{moeda(dash.valorSaidas)}</p>
                    <p className="text-xs text-muted-foreground">{dash.totalSaidas} notas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground">Saldo (Saídas − Entradas)</p>
                    <p className={`text-lg font-bold ${(dash.valorSaidas - dash.valorEntradas) >= 0 ? "text-blue-600" : "text-destructive"}`}>
                      {moeda(dash.valorSaidas - dash.valorEntradas)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela de impostos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Apuração de Impostos por Tipo de Nota
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Tributo</TableHead>
                        <TableHead className="text-right text-emerald-600">Entradas (crédito)</TableHead>
                        <TableHead className="text-right text-blue-600">Saídas (débito)</TableHead>
                        <TableHead className="text-right">Saldo Apurado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {[
                        { label: "ICMS",   ent: dash.icmsEntradas,   sai: dash.icmsSaidas },
                        { label: "PIS",    ent: dash.pisEntradas,    sai: dash.pisSaidas },
                        { label: "COFINS", ent: dash.cofinsEntradas, sai: dash.cofinsSaidas },
                        { label: "IBS (Reforma Tributária)", ent: dash.ibsEntradas, sai: dash.ibsSaidas },
                        { label: "CBS (Reforma Tributária)", ent: dash.cbsEntradas, sai: dash.cbsSaidas },
                      ].map(row => {
                        const saldo = row.sai - row.ent;
                        return (
                          <TableRow key={row.label}>
                            <TableCell className="font-medium">{row.label}</TableCell>
                            <TableCell className="text-right text-emerald-600">{moeda(row.ent)}</TableCell>
                            <TableCell className="text-right text-blue-600">{moeda(row.sai)}</TableCell>
                            <TableCell className={`text-right font-semibold ${saldo > 0 ? "text-destructive" : "text-emerald-600"}`}>
                              {saldo > 0 ? `Pagar ${moeda(saldo)}` : `Crédito ${moeda(Math.abs(saldo))}`}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Card créditos IBS/CBS LC 214/2025 */}
              {(dash.creditoIbs > 0 || dash.creditoCbs > 0) && (
                <Card className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4" />
                      Créditos de Entradas — IBS/CBS (LC 214/2025 Art. 28–47)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Crédito IBS (Entradas)</p>
                        <p className="text-lg font-bold text-purple-600">{moeda(dash.creditoIbs)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Crédito CBS (Entradas)</p>
                        <p className="text-lg font-bold text-purple-600">{moeda(dash.creditoCbs)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Créditos</p>
                        <p className="text-xl font-bold text-purple-700">{moeda(dash.creditoIbs + dash.creditoCbs)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Os créditos de IBS e CBS nas entradas podem ser utilizados para abater o débito gerado nas saídas (não-cumulatividade plena, LC 214/2025 Art. 46).
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialog Detalhe NF-e ───────────────────────────────────────── */}
      <Dialog open={!!notaDetalhe} onOpenChange={v => !v && setNotaDetalhe(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileCode2 className="h-4 w-4 text-primary" />
              Detalhe NF-e — {notaDetalhe?.numero ? `Nº ${notaDetalhe.numero}` : "Sem número"}
              {notaDetalhe && tipoLabel(notaDetalhe.tipo)}
            </DialogTitle>
          </DialogHeader>

          {notaDetalhe && (
            <div className="space-y-4 text-sm">
              {/* Dados gerais */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-3">
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Emitente</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3">
                      <p className="font-semibold">{notaDetalhe.emitRazao || "—"}</p>
                      <p className="text-xs font-mono text-muted-foreground">{fmtCnpj(notaDetalhe.emitCnpj)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Destinatário</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3">
                      <p className="font-semibold">{notaDetalhe.destRazao || "—"}</p>
                      <p className="text-xs font-mono text-muted-foreground">{fmtCnpj(notaDetalhe.destCnpj)}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="space-y-3">
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Identificação</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3 space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Modelo</span><span className="font-mono">{notaDetalhe.modelo || "55"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Série / Nº</span><span className="font-mono">{notaDetalhe.serie||"0"} / {notaDetalhe.numero||"—"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Emissão</span><span>{fmtDate(notaDetalhe.dataEmissao)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Situação</span>{situacaoBadge(notaDetalhe.situacao)}</div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Arquivo</span><span className="truncate max-w-[120px]">{notaDetalhe.nomeArquivo||"—"}</span></div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Totais</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3 space-y-1 text-xs">
                      {[
                        ["Valor Produtos", notaDetalhe.valorProd],
                        ["Valor Frete",    notaDetalhe.valorFrete],
                        ["Desconto",       notaDetalhe.valorDesc],
                        ["Base ICMS",      notaDetalhe.baseCalcIcms],
                        ["ICMS",           notaDetalhe.valorIcms],
                        ["IPI",            notaDetalhe.valorIpi],
                        ["PIS",            notaDetalhe.valorPis],
                        ["COFINS",         notaDetalhe.valorCofins],
                        ["IBS",            notaDetalhe.valorIbs],
                        ["CBS",            notaDetalhe.valorCbs],
                        ["ST",             notaDetalhe.valorSt],
                      ].map(([label, val]) => (
                        <div key={label as string} className="flex justify-between">
                          <span className="text-muted-foreground">{label as string}</span>
                          <span className="font-mono">{moeda(val as number)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t pt-1 font-semibold">
                        <span>Valor Total</span>
                        <span>{moeda(notaDetalhe.valorNota)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Chave de acesso */}
              {notaDetalhe.chaveAcesso && (
                <Card>
                  <CardContent className="pt-3 pb-3 px-4">
                    <p className="text-xs text-muted-foreground mb-1">Chave de Acesso (44 dígitos)</p>
                    <p className="font-mono text-xs break-all bg-muted px-2 py-1 rounded">{notaDetalhe.chaveAcesso}</p>
                  </CardContent>
                </Card>
              )}

              {/* Itens */}
              {itens.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs">Itens da NF-e ({itens.length})</CardTitle>
                      <Button
                        variant="ghost" size="sm" className="h-6 text-xs gap-1"
                        onClick={() => setExpandedItems(v => !v)}
                      >
                        {expandedItems ? <><ChevronUp className="h-3 w-3"/>Recolher</> : <><ChevronDown className="h-3 w-3"/>Expandir</>}
                      </Button>
                    </div>
                  </CardHeader>
                  {expandedItems && (
                    <CardContent className="px-0 pb-0 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[10px]">
                            <TableHead>#</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>NCM</TableHead>
                            <TableHead>CFOP</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">V.Unit</TableHead>
                            <TableHead className="text-right">V.Total</TableHead>
                            <TableHead>CST ICMS</TableHead>
                            <TableHead className="text-right">ICMS</TableHead>
                            <TableHead className="text-right">IBS</TableHead>
                            <TableHead className="text-right">CBS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-[10px]">
                          {itens.map((item: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{i+1}</TableCell>
                              <TableCell className="max-w-[160px]">
                                <div className="truncate">{item.descricao || "—"}</div>
                                {item.cProd && <div className="text-muted-foreground">Cód: {item.cProd}</div>}
                              </TableCell>
                              <TableCell className="font-mono">{item.ncm || "—"}</TableCell>
                              <TableCell className="font-mono">{item.cfop || "—"}</TableCell>
                              <TableCell className="text-right font-mono">{item.qCom?.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono">{moeda(item.vUnitCom||0)}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">{moeda(item.vTotal||0)}</TableCell>
                              <TableCell className="font-mono">{item.cstIcms || "—"}</TableCell>
                              <TableCell className="text-right font-mono">{moeda(item.vIcms||0)}</TableCell>
                              <TableCell className="text-right font-mono text-purple-600">{moeda(item.vIbs||0)}</TableCell>
                              <TableCell className="text-right font-mono text-purple-600">{moeda(item.vCbs||0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

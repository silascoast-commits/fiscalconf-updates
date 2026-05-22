import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Users,
  Plus,
  Search,
  Building2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  TrendingUp,
  Settings,
  SearchCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  Upload,
  Download,
  FileText,
  X,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

type Cliente = {
  id: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  regime: "simples" | "presumido" | "real";
  anexo?: string;
  atividade?: string;
  responsavel?: string;
  email?: string;
  telefone?: string;
  faturamentoMeses?: string; // JSON string: { jan, fev, ..., dez }
  honorario?: number;        // honorário mensal para cobranças
  ncmPrincipal?: string;
  cfopPadrao?: string;
  observacoes?: string;
  ativo: number;
  criadoEm: string;
  atualizadoEm: string;
  rbt12?: number;
};

type AnotacaoCliente = {
  id: number;
  clienteId: number;
  texto: string;
  tipo: string;
  criadoEm: string;
};

type FaturamentoMeses = {
  jan: number; fev: number; mar: number; abr: number;
  mai: number; jun: number; jul: number; ago: number;
  set: number; out: number; nov: number; dez: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MESES: { key: keyof FaturamentoMeses; label: string }[] = [
  { key: "jan", label: "Jan" }, { key: "fev", label: "Fev" },
  { key: "mar", label: "Mar" }, { key: "abr", label: "Abr" },
  { key: "mai", label: "Mai" }, { key: "jun", label: "Jun" },
  { key: "jul", label: "Jul" }, { key: "ago", label: "Ago" },
  { key: "set", label: "Set" }, { key: "out", label: "Out" },
  { key: "nov", label: "Nov" }, { key: "dez", label: "Dez" },
];

const EMPTY_FATURAMENTO: FaturamentoMeses = {
  jan: 0, fev: 0, mar: 0, abr: 0, mai: 0, jun: 0,
  jul: 0, ago: 0, set: 0, out: 0, nov: 0, dez: 0,
};

const LIMITE_ATENCAO = 3_000_000;
const LIMITE_HIBRIDO = 3_600_000;
const LIMITE_DESENQUADRAMENTO = 4_800_000;

const REGIME_LABELS: Record<string, string> = {
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
};

const REGIME_COLORS: Record<string, string> = {
  simples: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  presumido: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  real: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

const TIPO_ANOTACAO_COLORS: Record<string, string> = {
  geral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  alerta: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  decisao: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  reuniao: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

const TIPO_ANOTACAO_LABELS: Record<string, string> = {
  geral: "Geral",
  alerta: "Alerta",
  decisao: "Decisão",
  reuniao: "Reunião",
};

const ANEXOS = ["I", "II", "III", "IV", "V"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFaturamento(raw?: string): FaturamentoMeses {
  try {
    if (!raw) return { ...EMPTY_FATURAMENTO };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_FATURAMENTO, ...parsed };
  } catch {
    return { ...EMPTY_FATURAMENTO };
  }
}

function calcRbt12(f: FaturamentoMeses): number {
  return Object.values(f).reduce((a, b) => a + (Number(b) || 0), 0);
}

function formatCnpj(v: string): string {
  const d = v.replace(/\D/g, "").substring(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function getAlerta(rbt12?: number): { label: string; cls: string } | null {
  if (!rbt12) return null;
  if (rbt12 > LIMITE_DESENQUADRAMENTO)
    return { label: "Desenquadramento", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" };
  if (rbt12 > LIMITE_HIBRIDO)
    return { label: "Híbrido Compulsório", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" };
  if (rbt12 > LIMITE_ATENCAO)
    return { label: "Atenção", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" };
  return null;
}

// ── CSV Parser ────────────────────────────────────────────────────────────────

type ParsedCsvRow = {
  cnpj: string;
  razaoSocial: string;
  regime: "simples" | "presumido" | "real";
  anexo?: string;
  faturamentoMeses?: string;
};

function normalizeRegime(raw: string): "simples" | "presumido" | "real" | null {
  const s = raw.trim().toLowerCase();
  if (["simples", "simples nacional", "sn"].includes(s)) return "simples";
  if (["presumido", "lucro presumido", "lp"].includes(s)) return "presumido";
  if (["real", "lucro real", "lr"].includes(s)) return "real";
  return null;
}

function parseCsv(text: string): ParsedCsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  // Detect separator (count semicolons vs commas in first line)
  const firstLine = lines[0];
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";

  // Detect header
  let startIdx = 0;
  const lower = firstLine.toLowerCase();
  if (lower.includes("cnpj") || lower.includes("razao") || lower.includes("razão")) {
    startIdx = 1;
  }

  const rows: ParsedCsvRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));
    // cnpj;razaoSocial;regime;anexo;jan;fev;mar;abr;mai;jun;jul;ago;set;out;nov;dez
    const [cnpjRaw = "", razaoSocial = "", regimeRaw = "", anexo = "",
           jan = "", fev = "", mar = "", abr = "",
           mai = "", jun = "", jul = "", ago = "",
           set = "", out = "", nov = "", dez = ""] = cols;

    const cnpj = cnpjRaw.replace(/\D/g, "");
    const regime = normalizeRegime(regimeRaw);
    if (!regime) continue;
    if (cnpj.length !== 14) continue;
    if (!razaoSocial) continue;

    const mesesObj: Record<string, number> = {};
    const mesesKeys = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    const mesesVals = [jan, fev, mar, abr, mai, jun, jul, ago, set, out, nov, dez];
    let hasFat = false;
    mesesKeys.forEach((k, idx) => {
      const v = parseFloat(mesesVals[idx].replace(",", "."));
      if (!isNaN(v) && v > 0) {
        mesesObj[k] = v;
        hasFat = true;
      }
    });

    rows.push({
      cnpj,
      razaoSocial,
      regime,
      anexo: anexo || undefined,
      faturamentoMeses: hasFat ? JSON.stringify(mesesObj) : undefined,
    });
  }

  return rows;
}

// ── ImportarCsvDialog ─────────────────────────────────────────────────────────

function ImportarCsvDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedCsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ importados: number; erros: any[] } | null>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setFileName("");
      setRows([]);
      setResult(null);
    }
  }, [open]);

  const processFile = (file: File) => {
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const resp = await apiRequest("POST", "/api/clientes/importar", { clientes: rows });
      const data = await resp.json();
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/clientes"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      if (data.importados > 0) {
        toast({ title: `${data.importados} cliente(s) importado(s) com sucesso!` });
        onSuccess();
      }
    } catch {
      toast({ title: "Erro ao importar clientes", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      "cnpj;razaoSocial;regime;anexo;jan;fev;mar;abr;mai;jun;jul;ago;set;out;nov;dez",
      "11222333000181;Empresa Alpha Ltda;simples;III;50000;52000;48000;51000;53000;49000;55000;54000;50000;52000;51000;53000",
      "22333444000182;Beta Comércio SA;presumido;;80000;82000;79000;84000;85000;83000;87000;86000;84000;85000;83000;88000",
      "33444555000183;Gama Serviços ME;simples;II;15000;16000;14000;15500;16500;15000;17000;16000;15000;16000;15500;17000",
    ].join("\n");
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importacao-clientes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const preview = rows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar Clientes via CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Área de upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent/30"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFile}
            />
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            {fileName ? (
              <p className="text-sm font-medium">{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground mt-1">Aceita .csv e .txt — separador ; ou ,</p>
              </>
            )}
          </div>

          {/* Template download */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Colunas: cnpj; razaoSocial; regime; anexo; jan…dez
            </p>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={downloadTemplate}>
              <Download className="h-3 w-3" />
              Baixar modelo CSV
            </Button>
          </div>

          {/* Preview */}
          {rows.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Preview — {rows.length} cliente(s) encontrado(s)
              </p>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">CNPJ</th>
                      <th className="text-left px-3 py-2 font-medium">Razão Social</th>
                      <th className="text-left px-3 py-2 font-medium">Regime</th>
                      <th className="text-left px-3 py-2 font-medium">Anexo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 font-mono">{formatCnpj(row.cnpj)}</td>
                        <td className="px-3 py-1.5 truncate max-w-[160px]">{row.razaoSocial}</td>
                        <td className="px-3 py-1.5 capitalize">{row.regime}</td>
                        <td className="px-3 py-1.5">{row.anexo || "—"}</td>
                      </tr>
                    ))}
                    {rows.length > 5 && (
                      <tr className="border-t bg-muted/30">
                        <td colSpan={4} className="px-3 py-1.5 text-center text-muted-foreground">
                          + {rows.length - 5} linha(s) adicionais não exibidas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resultado */}
          {result && (
            <div className="space-y-2">
              <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 p-3">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  {result.importados} cliente(s) importado(s) com sucesso
                </p>
              </div>
              {result.erros.length > 0 && (
                <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                    {result.erros.length} erro(s):
                  </p>
                  {result.erros.map((e: any, i: number) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400">
                      Linha {e.linha} ({e.cnpj}): {e.erro}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? "Fechar" : "Cancelar"}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={rows.length === 0 || importing}
            >
              {importing ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</>
              ) : (
                <>Importar {rows.length > 0 ? `${rows.length} clientes` : ""}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── PgdasSection ─────────────────────────────────────────────────────────────

type PgdasImportacao = {
  id: number; clienteId: number; cnpj: string; periodoApuracao: string;
  rpa: number; rbt12: number; rba: number; rbaa: number;
  dasTotal: number; dasIrpj: number; dasCsll: number; dasCofins: number;
  dasPis: number; dasInss: number; dasIcms: number; dasIss: number;
  vencimento: string | null; atividade: string | null; anexoDetectado: string | null;
  receitasMeses: string | null; pago: number; importadoEm: string;
};

function PgdasSection({ clienteId }: { clienteId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: pgdasList = [] } = useQuery<PgdasImportacao[]>({
    queryKey: ["/api/clientes", clienteId, "pgdas"],
    queryFn: () => apiRequest("GET", `/api/clientes/${clienteId}/pgdas`).then(r => r.json()),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const resp = await fetch(`/api/clientes/${clienteId}/pgdas`, {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro ao processar");
      qc.invalidateQueries({ queryKey: ["/api/clientes", clienteId, "pgdas"] });
      qc.invalidateQueries({ queryKey: ["/api/clientes"] });
      toast({ title: `PGDAS ${data.pgdas.periodoApuracao} importado!`, description: `DAS: R$ ${data.pgdas.dasTotal?.toFixed(2)} | RBT12: R$ ${data.pgdas.rbt12?.toLocaleString("pt-BR")}` });
      setExpanded(true);
    } catch (err: any) {
      toast({ title: "Erro ao importar PGDAS", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const togglePago = async (p: PgdasImportacao) => {
    await apiRequest("PATCH", `/api/pgdas/${p.id}/pago`, { pago: p.pago ? 0 : 1 });
    qc.invalidateQueries({ queryKey: ["/api/clientes", clienteId, "pgdas"] });
  };

  const deletePgdas = async (id: number) => {
    await apiRequest("DELETE", `/api/pgdas/${id}`);
    qc.invalidateQueries({ queryKey: ["/api/clientes", clienteId, "pgdas"] });
  };

  const fmt = (v: number) => v?.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const fmtBR = (v: number) => v?.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  // Alertas de limite RBT12
  const latest = pgdasList[pgdasList.length - 1];
  const rbt12Alert = latest?.rbt12 >= 4_320_000 ? "critico" : latest?.rbt12 >= 3_240_000 ? "atencao" : null;

  return (
    <div className="space-y-3">
      <Separator />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-sm">PGDAS-D</span>
          {pgdasList.length > 0 && (
            <Badge variant="secondary">{pgdasList.length} apurações</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setExpanded(e => !e)}>
            {expanded ? "Ocultar" : "Ver histórico"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Importando...</>
            ) : (
              <><Upload className="w-3 h-3 mr-1" />Importar PGDAS PDF</>
            )}
          </Button>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Alerta RBT12 */}
      {rbt12Alert && (
        <Alert variant={rbt12Alert === "critico" ? "destructive" : "default"} className={rbt12Alert === "atencao" ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950" : ""}>
          <AlertDescription className="text-xs">
            {rbt12Alert === "critico"
              ? `⚠️ RBT12 de R$ ${fmt(latest.rbt12)} está acima de R$ 4,32M — risco de ultrapassar R$ 4,8M e ser desenquadrado do Simples Nacional!`
              : `⚠️ RBT12 de R$ ${fmt(latest.rbt12)} está acima de R$ 3,24M — monitorar aproximação do limite de R$ 3,6M (Sistema Híbrido).`
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Última apuração em destaque */}
      {latest && (
        <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              Última apuração: {latest.periodoApuracao}
              {latest.anexoDetectado && <Badge variant="outline" className="ml-2 text-xs">Anexo {latest.anexoDetectado}</Badge>}
            </span>
            <Badge
              className={`cursor-pointer text-xs ${latest.pago ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"}`}
              onClick={() => togglePago(latest)}
            >
              {latest.pago ? "DAS Pago" : "DAS Pendente"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white dark:bg-gray-800 rounded p-2 text-center">
              <div className="text-gray-500">Receita do PA</div>
              <div className="font-bold text-blue-700">R$ {fmt(latest.rpa)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded p-2 text-center">
              <div className="text-gray-500">RBT12</div>
              <div className="font-bold text-purple-700">R$ {fmt(latest.rbt12)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded p-2 text-center">
              <div className="text-gray-500">DAS Total</div>
              <div className="font-bold text-green-700">R$ {fmt(latest.dasTotal)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded p-2 text-center">
              <div className="text-gray-500">Vencimento</div>
              <div className="font-bold">{latest.vencimento || "-"}</div>
            </div>
          </div>
          {/* Breakdown tributos */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 text-xs text-center">
            {[{k:"IRPJ",v:latest.dasIrpj},{k:"CSLL",v:latest.dasCsll},{k:"COFINS",v:latest.dasCofins},{k:"PIS",v:latest.dasPis},{k:"CPP",v:latest.dasInss},{k:"ICMS",v:latest.dasIcms},{k:"ISS",v:latest.dasIss}].map(t => (
              <div key={t.k} className="bg-white dark:bg-gray-800 rounded p-1">
                <div className="text-gray-400">{t.k}</div>
                <div className="font-medium">{fmtBR(t.v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico */}
      {expanded && pgdasList.length > 1 && (
        <div className="space-y-1">
          {[...pgdasList].reverse().slice(1).map(p => (
            <div key={p.id} className="flex items-center justify-between rounded border px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.periodoApuracao}</span>
                {p.anexoDetectado && <Badge variant="outline" className="text-xs">Anexo {p.anexoDetectado}</Badge>}
                <Badge className={`text-xs ${p.pago ? "bg-green-600" : "bg-red-500"} cursor-pointer`} onClick={() => togglePago(p)}>
                  {p.pago ? "Pago" : "Pendente"}
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <span>RPA: <b>R$ {fmt(p.rpa)}</b></span>
                <span>DAS: <b>R$ {fmt(p.dasTotal)}</b></span>
                <span>RBT12: <b>R$ {fmt(p.rbt12)}</b></span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => deletePgdas(p.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pgdasList.length === 0 && (
        <p className="text-xs text-gray-400 italic">Nenhum PGDAS importado. Clique em "Importar PGDAS PDF" para adicionar.</p>
      )}
    </div>
  );
}

// ── AnotacoesSection ──────────────────────────────────────────────────────────

function AnotacoesSection({ clienteId }: { clienteId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [novoTexto, setNovoTexto] = useState("");
  const [novoTipo, setNovoTipo] = useState("geral");

  const { data: anotacoes = [], isLoading } = useQuery<AnotacaoCliente[]>({
    queryKey: [`/api/clientes/${clienteId}/anotacoes`],
  });

  const createMutation = useMutation({
    mutationFn: (data: { texto: string; tipo: string }) =>
      apiRequest("POST", `/api/clientes/${clienteId}/anotacoes`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}/anotacoes`] });
      setNovoTexto("");
      setNovoTipo("geral");
    },
    onError: () => toast({ title: "Erro ao salvar anotação", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/anotacoes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}/anotacoes`] });
    },
    onError: () => toast({ title: "Erro ao deletar anotação", variant: "destructive" }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTexto.trim()) return;
    createMutation.mutate({ texto: novoTexto.trim(), tipo: novoTipo });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Anotações / Log
        </p>
      </div>

      {/* Lista de anotações */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : anotacoes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          Nenhuma anotação. Registre decisões, orientações e reuniões aqui.
        </p>
      ) : (
        <div className="space-y-2">
          {anotacoes.map(anot => (
            <div
              key={anot.id}
              className="flex items-start gap-2 rounded-md border bg-background px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span
                    className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      TIPO_ANOTACAO_COLORS[anot.tipo] || TIPO_ANOTACAO_COLORS.geral
                    }`}
                  >
                    {TIPO_ANOTACAO_LABELS[anot.tipo] || anot.tipo}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatDate(anot.criadoEm)}</span>
                </div>
                <p className="text-xs break-words">{anot.texto}</p>
              </div>
              <button
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                onClick={() => deleteMutation.mutate(anot.id)}
                disabled={deleteMutation.isPending}
                title="Deletar anotação"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input para nova anotação */}
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <Input
          value={novoTexto}
          onChange={e => setNovoTexto(e.target.value)}
          placeholder="Nova anotação..."
          className="text-xs h-8 flex-1"
        />
        <select
          value={novoTipo}
          onChange={e => setNovoTipo(e.target.value)}
          className="border rounded-md px-2 py-1 text-xs bg-background h-8"
        >
          <option value="geral">Geral</option>
          <option value="alerta">Alerta</option>
          <option value="decisao">Decisão</option>
          <option value="reuniao">Reunião</option>
        </select>
        <Button
          type="submit"
          size="sm"
          className="h-8 text-xs px-3"
          disabled={!novoTexto.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Adicionar"}
        </Button>
      </form>
    </div>
  );
}

// ── ClienteForm ────────────────────────────────────────────────────────────────

type FormState = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  regime: "simples" | "presumido" | "real";
  anexo: string;
  atividade: string;
  responsavel: string;
  email: string;
  telefone: string;
  honorario: string;
  ncmPrincipal: string;
  cfopPadrao: string;
  observacoes: string;
  faturamento: FaturamentoMeses;
};

function buildInitialForm(c?: Cliente | null): FormState {
  return {
    cnpj: c?.cnpj ?? "",
    razaoSocial: c?.razaoSocial ?? "",
    nomeFantasia: c?.nomeFantasia ?? "",
    regime: c?.regime ?? "simples",
    anexo: c?.anexo ?? "",
    atividade: c?.atividade ?? "",
    responsavel: c?.responsavel ?? "",
    email: c?.email ?? "",
    telefone: c?.telefone ?? "",
    honorario: c?.honorario ? String(c.honorario) : "",
    ncmPrincipal: c?.ncmPrincipal ?? "",
    cfopPadrao: c?.cfopPadrao ?? "",
    observacoes: c?.observacoes ?? "",
    faturamento: parseFaturamento(c?.faturamentoMeses),
  };
}

function ClienteForm({
  cliente,
  onSave,
  onClose,
  isSaving,
}: {
  cliente?: Cliente | null;
  onSave: (data: Omit<Cliente, "id" | "ativo" | "criadoEm" | "atualizadoEm" | "rbt12">) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => buildInitialForm(cliente));

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const setFat = (mes: keyof FaturamentoMeses, v: string) =>
    setForm(f => ({ ...f, faturamento: { ...f.faturamento, [mes]: parseFloat(v) || 0 } }));

  const rbt12 = calcRbt12(form.faturamento);
  const alerta = getAlerta(rbt12 > 0 ? rbt12 : undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cnpjRaw = form.cnpj.replace(/\D/g, "");
    if (cnpjRaw.length !== 14) return;
    onSave({
      cnpj: form.cnpj,
      razaoSocial: form.razaoSocial,
      nomeFantasia: form.nomeFantasia || undefined,
      regime: form.regime,
      anexo: form.anexo || undefined,
      atividade: form.atividade || undefined,
      responsavel: form.responsavel || undefined,
      email: form.email || undefined,
      telefone: form.telefone || undefined,
      honorario: form.honorario ? parseFloat(form.honorario.replace(",", ".")) : undefined,
      ncmPrincipal: form.ncmPrincipal || undefined,
      cfopPadrao: form.cfopPadrao || undefined,
      observacoes: form.observacoes || undefined,
      faturamentoMeses: JSON.stringify(form.faturamento),
    });
  };

  // ── Consulta CNPJ Receita Federal ──
  const [cnpjStatus, setCnpjStatus] = useState<"idle" | "loading" | "ok" | "erro">("idle");
  const [cnpjMsg, setCnpjMsg] = useState("");

  const consultarCnpj = useCallback(async () => {
    const cnpjRaw = form.cnpj.replace(/\D/g, "");
    if (cnpjRaw.length !== 14) {
      setCnpjStatus("erro");
      setCnpjMsg("Digite o CNPJ completo (14 dígitos) antes de consultar.");
      return;
    }
    setCnpjStatus("loading");
    setCnpjMsg("");
    try {
      const resp = await apiRequest("GET", `/api/cnpj/${cnpjRaw}`);
      if (!resp.ok) {
        const err = await resp.json();
        setCnpjStatus("erro");
        setCnpjMsg(err.error ?? "CNPJ não encontrado na Receita Federal.");
        return;
      }
      const data = await resp.json();
      if (data.razaoSocial) set("razaoSocial", data.razaoSocial);
      if (data.nomeFantasia) set("nomeFantasia", data.nomeFantasia);
      if (data.email) set("email", data.email);
      if (data.telefone) set("telefone", data.telefone);
      if (data.atividadePrincipal) set("atividade", data.atividadePrincipal);
      setCnpjStatus("ok");
      setCnpjMsg(`Situação: ${data.situacao} · ${data.tipo} · ${data.porte}${data.abertura ? " · Abertura: " + data.abertura : ""}`);
      toast({ title: "Dados preenchidos automaticamente", description: data.razaoSocial });
    } catch {
      setCnpjStatus("erro");
      setCnpjMsg("Serviço temporariamente indisponível. Preencha manualmente.");
    }
  }, [form.cnpj]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Seção 1: Identificação */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Identificação
        </p>

        {/* CNPJ + botão Receita Federal */}
        <div className="space-y-1.5">
          <Label>CNPJ <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            <Input
              data-testid="form-cliente-cnpj"
              placeholder="00.000.000/0000-00"
              value={form.cnpj}
              onChange={e => {
                set("cnpj", formatCnpj(e.target.value));
                setCnpjStatus("idle");
                setCnpjMsg("");
              }}
              className="codigo-fiscal flex-1"
              disabled={!!cliente}
              required
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="whitespace-nowrap gap-1.5 text-xs"
              onClick={consultarCnpj}
              disabled={cnpjStatus === "loading" || !!cliente}
              data-testid="btn-consultar-cnpj"
            >
              {cnpjStatus === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SearchCheck className="h-3.5 w-3.5" />
              )}
              {cnpjStatus === "loading" ? "Consultando..." : "Consultar Receita Federal"}
            </Button>
          </div>
          {cnpjStatus === "ok" && (
            <div className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{cnpjMsg}</span>
            </div>
          )}
          {cnpjStatus === "erro" && (
            <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
              <XCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{cnpjMsg}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Razão Social <span className="text-destructive">*</span></Label>
            <Input
              data-testid="form-cliente-razao"
              placeholder="Preenchido automaticamente"
              value={form.razaoSocial}
              onChange={e => set("razaoSocial", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nome Fantasia</Label>
            <Input
              data-testid="form-cliente-fantasia"
              placeholder="Preenchido automaticamente"
              value={form.nomeFantasia}
              onChange={e => set("nomeFantasia", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Seção 2: Regime */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Regime Tributário
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Regime <span className="text-destructive">*</span></Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={form.regime}
              onChange={e => set("regime", e.target.value as FormState["regime"])}
              data-testid="form-cliente-regime"
            >
              <option value="simples">Simples Nacional</option>
              <option value="presumido">Lucro Presumido</option>
              <option value="real">Lucro Real</option>
            </select>
          </div>
          {form.regime === "simples" && (
            <div className="space-y-1.5">
              <Label>Anexo</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.anexo}
                onChange={e => set("anexo", e.target.value)}
                data-testid="form-cliente-anexo"
              >
                <option value="">— Selecione —</option>
                {ANEXOS.map(a => (
                  <option key={a} value={a}>Anexo {a}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Atividade Principal</Label>
            <Input
              placeholder="Ex: Comércio varejista"
              value={form.atividade}
              onChange={e => set("atividade", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Seção 3: Faturamento */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Faturamento — Últimos 12 Meses
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {MESES.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0"
                value={form.faturamento[key] || ""}
                onChange={e => setFat(key, e.target.value)}
                className="text-sm h-8 px-2"
              />
            </div>
          ))}
        </div>

        {/* RBT12 em tempo real */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">RBT12 Calculado</span>
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(rbt12)}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                rbt12 > LIMITE_DESENQUADRAMENTO
                  ? "bg-red-500"
                  : rbt12 > LIMITE_HIBRIDO
                  ? "bg-orange-500"
                  : rbt12 > LIMITE_ATENCAO
                  ? "bg-yellow-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min((rbt12 / LIMITE_DESENQUADRAMENTO) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0</span>
            <span>3,6M</span>
            <span>4,8M</span>
          </div>
          {alerta && rbt12 > 0 && (
            <Alert className="py-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs ml-1">
                {alerta.label === "Desenquadramento" && "RBT12 acima de R$ 4,8M — risco de desenquadramento do Simples Nacional."}
                {alerta.label === "Híbrido Compulsório" && "RBT12 acima de R$ 3,6M — sublimite ultrapassado, possível Híbrido Compulsório."}
                {alerta.label === "Atenção" && "RBT12 acima de R$ 3,0M — atenção ao sublimite estadual."}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <Separator />

      {/* Seção 4: Contato */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Contato
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              placeholder="financeiro@empresa.com.br"
              value={form.email}
              onChange={e => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              placeholder="(11) 99999-9999"
              value={form.telefone}
              onChange={e => set("telefone", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Input
              placeholder="Nome do sócio/responsável"
              value={form.responsavel}
              onChange={e => set("responsavel", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Honorário Mensal (R$)</Label>
            <Input
              type="text"
              placeholder="Ex: 350,00"
              value={form.honorario}
              onChange={e => set("honorario", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Seção 5: Fiscal */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dados Fiscais
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>NCM Principal</Label>
            <Input
              placeholder="Ex: 62034200"
              value={form.ncmPrincipal}
              onChange={e => set("ncmPrincipal", e.target.value.replace(/\D/g, "").substring(0, 8))}
              className="codigo-fiscal"
            />
          </div>
          <div className="space-y-1.5">
            <Label>CFOP Padrão</Label>
            <Input
              placeholder="Ex: 5102"
              value={form.cfopPadrao}
              onChange={e => set("cfopPadrao", e.target.value.replace(/\D/g, "").substring(0, 4))}
              className="codigo-fiscal"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Input
            placeholder="Informações adicionais do cliente..."
            value={form.observacoes}
            onChange={e => set("observacoes", e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving} data-testid="button-salvar-cliente">
          {isSaving ? "Salvando..." : cliente ? "Atualizar Cliente" : "Cadastrar Cliente"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── ClienteCard ───────────────────────────────────────────────────────────────

function ClienteCard({
  cliente,
  onEdit,
  onDelete,
}: {
  cliente: Cliente;
  onEdit: (c: Cliente) => void;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const fat = parseFaturamento(cliente.faturamentoMeses);
  const rbt12 = cliente.rbt12 ?? calcRbt12(fat);
  const alerta = getAlerta(rbt12 > 0 ? rbt12 : undefined);
  const barPct = Math.min((rbt12 / LIMITE_DESENQUADRAMENTO) * 100, 100);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <div
            className="flex items-start gap-4 p-4 cursor-pointer hover:bg-accent/30 transition-colors select-none"
            data-testid={`card-cliente-${cliente.id}`}
          >
            <div className="mt-0.5 text-muted-foreground shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              {/* Linha principal */}
              <div className="flex items-start gap-2 flex-wrap">
                <span className="font-semibold text-sm leading-tight">
                  {cliente.razaoSocial}
                </span>
                {alerta && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${alerta.cls}`}
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {alerta.label}
                  </span>
                )}
              </div>

              {/* Linha secundária */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground codigo-fiscal">{cliente.cnpj}</span>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${REGIME_COLORS[cliente.regime]}`}
                >
                  {REGIME_LABELS[cliente.regime]}
                  {cliente.anexo ? ` — Anexo ${cliente.anexo}` : ""}
                </span>
                {rbt12 > 0 && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    RBT12: {formatCurrency(rbt12)}
                  </span>
                )}
              </div>

              {cliente.nomeFantasia && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{cliente.nomeFantasia}</p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={e => { e.stopPropagation(); onEdit(cliente); }}
                data-testid={`button-edit-cliente-${cliente.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={e => { e.stopPropagation(); onDelete(cliente.id); }}
                data-testid={`button-delete-cliente-${cliente.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              {open
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t bg-muted/20 px-4 py-4 space-y-4">
            {/* Grid dos 12 meses */}
            {Object.values(fat).some(v => v > 0) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Faturamento Mensal</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-x-4 gap-y-1">
                  {MESES.map(({ key, label }) => (
                    <div key={key} className="flex flex-col items-center">
                      <span className="text-[9px] uppercase text-muted-foreground">{label}</span>
                      <span className="text-[11px] font-medium tabular-nums">
                        {fat[key] > 0 ? formatCurrency(fat[key]).replace("R$\xa0", "") : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Barra visual RBT12 */}
            {rbt12 > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">RBT12: {formatCurrency(rbt12)}</span>
                  <span className="text-muted-foreground">{barPct.toFixed(1)}% do limite</span>
                </div>
                <div className="relative w-full h-3 rounded-full bg-muted overflow-visible">
                  {/* Marcadores */}
                  <div className="absolute top-0 bottom-0" style={{ left: `${(LIMITE_ATENCAO / LIMITE_DESENQUADRAMENTO) * 100}%`, borderLeft: "2px dashed #eab308", opacity: 0.7 }} />
                  <div className="absolute top-0 bottom-0" style={{ left: `${(LIMITE_HIBRIDO / LIMITE_DESENQUADRAMENTO) * 100}%`, borderLeft: "2px dashed #f97316", opacity: 0.7 }} />
                  <div
                    className={`h-full rounded-full transition-all ${
                      rbt12 > LIMITE_DESENQUADRAMENTO
                        ? "bg-red-500"
                        : rbt12 > LIMITE_HIBRIDO
                        ? "bg-orange-500"
                        : rbt12 > LIMITE_ATENCAO
                        ? "bg-yellow-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>0</span>
                  <span>3,0M</span>
                  <span>3,6M</span>
                  <span>4,8M</span>
                </div>
              </div>
            )}

            {/* Contato / Fiscal resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {cliente.responsavel && (
                <div>
                  <span className="text-muted-foreground block">Responsável</span>
                  <span className="font-medium">{cliente.responsavel}</span>
                </div>
              )}
              {cliente.email && (
                <div>
                  <span className="text-muted-foreground block">E-mail</span>
                  <span className="font-medium break-all">{cliente.email}</span>
                </div>
              )}
              {cliente.ncmPrincipal && (
                <div>
                  <span className="text-muted-foreground block">NCM Principal</span>
                  <span className="font-medium codigo-fiscal">{cliente.ncmPrincipal}</span>
                </div>
              )}
              {cliente.cfopPadrao && (
                <div>
                  <span className="text-muted-foreground block">CFOP Padrão</span>
                  <span className="font-medium codigo-fiscal">{cliente.cfopPadrao}</span>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8"
                onClick={() => onEdit(cliente)}
              >
                <Pencil className="h-3 w-3" /> Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(cliente.id)}
              >
                <Trash2 className="h-3 w-3" /> Excluir
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs h-8 ml-auto"
                onClick={() => {
                  // Futuramente navegar para /clientes/:id/configuracoes
                }}
              >
                <Settings className="h-3 w-3" /> Ver Configurações Fiscais
              </Button>
            </div>

            <Separator />

            {/* PGDAS-D */}
            <PgdasSection clienteId={cliente.id} />

            {/* Anotações / Log */}
            <AnotacoesSection clienteId={cliente.id} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type FiltroAtivo = "todos" | "simples" | "presumido" | "real" | "alertas";

export default function Clientes() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<FiltroAtivo>("todos");
  // undefined = dialog fechado; null = novo cliente; Cliente = editando
  const [editing, setEditing] = useState<Cliente | null | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) =>
      apiRequest("POST", "/api/clientes", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clientes"] });
      setEditing(undefined);
      toast({ title: "Cliente cadastrado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao cadastrar cliente", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      apiRequest("PUT", `/api/clientes/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clientes"] });
      setEditing(undefined);
      toast({ title: "Cliente atualizado!" });
    },
    onError: () => toast({ title: "Erro ao atualizar cliente", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clientes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clientes"] });
      toast({ title: "Cliente removido" });
    },
    onError: () => toast({ title: "Erro ao remover cliente", variant: "destructive" }),
  });

  const handleSave = (data: unknown) => {
    if (editing?.id) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const handleDelete = (id: number) => {
    if (confirm("Deseja realmente excluir este cliente?")) {
      deleteMutation.mutate(id);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Filtros
  const filtered = useMemo(() => {
    let list = clientes;

    if (search.trim()) {
      const q = search.toLowerCase().replace(/\D/g, "");
      const qText = search.toLowerCase();
      list = list.filter(c =>
        c.razaoSocial.toLowerCase().includes(qText) ||
        (c.nomeFantasia?.toLowerCase().includes(qText)) ||
        c.cnpj.replace(/\D/g, "").includes(q)
      );
    }

    if (filtro === "simples") list = list.filter(c => c.regime === "simples");
    else if (filtro === "presumido") list = list.filter(c => c.regime === "presumido");
    else if (filtro === "real") list = list.filter(c => c.regime === "real");
    else if (filtro === "alertas") {
      list = list.filter(c => {
        const rbt12 = c.rbt12 ?? calcRbt12(parseFaturamento(c.faturamentoMeses));
        return rbt12 > LIMITE_ATENCAO;
      });
    }

    return list;
  }, [clientes, search, filtro]);

  const totalAlertas = useMemo(() =>
    clientes.filter(c => {
      const rbt12 = c.rbt12 ?? calcRbt12(parseFaturamento(c.faturamentoMeses));
      return rbt12 > LIMITE_ATENCAO;
    }).length,
  [clientes]);

  const filtros: { key: FiltroAtivo; label: string; count?: number }[] = [
    { key: "todos", label: "Todos", count: clientes.length },
    { key: "simples", label: "Simples", count: clientes.filter(c => c.regime === "simples").length },
    { key: "presumido", label: "Presumido", count: clientes.filter(c => c.regime === "presumido").length },
    { key: "real", label: "Lucro Real", count: clientes.filter(c => c.regime === "real").length },
    { key: "alertas", label: "Com Alertas", count: totalAlertas },
  ];

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Clientes</h1>
            <p className="text-sm text-muted-foreground">
              Gestão de clientes e monitoramento de enquadramento
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="gap-2"
            data-testid="button-importar-csv"
          >
            <Upload className="h-4 w-4" /> Importar CSV
          </Button>
          <Button
            onClick={() => setEditing(null)}
            className="gap-2"
            data-testid="button-novo-cliente"
          >
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search-cliente"
          placeholder="Buscar por razão social ou CNPJ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filtros rápidos */}
      <div className="flex gap-2 flex-wrap">
        {filtros.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filtro === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent border-border text-foreground"
            }`}
            data-testid={`filtro-${f.key}`}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={`ml-1.5 text-[10px] ${filtro === f.key ? "opacity-80" : "text-muted-foreground"}`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
          {search || filtro !== "todos" ? (
            <>
              <p className="text-sm font-medium">Nenhum cliente encontrado</p>
              <p className="text-xs mt-1">Tente ajustar o filtro ou a busca</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Nenhum cliente cadastrado</p>
              <p className="text-xs mt-1">Cadastre seu primeiro cliente para começar</p>
              <Button
                variant="outline"
                className="mt-4 gap-2"
                onClick={() => setEditing(null)}
              >
                <Plus className="h-4 w-4" /> Cadastrar Primeiro Cliente
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(cliente => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          ))}
          <p className="text-xs text-muted-foreground text-center pt-1">
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""} exibido{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Dialog Novo / Editar */}
      <Dialog
        open={editing !== undefined}
        onOpenChange={open => !open && setEditing(undefined)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {editing?.id ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          {editing !== undefined && (
            <ClienteForm
              cliente={editing}
              onSave={handleSave}
              onClose={() => setEditing(undefined)}
              isSaving={isSaving}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Importar CSV */}
      <ImportarCsvDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => setImportOpen(false)}
      />
    </div>
  );
}

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Receipt,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Users,
  ChevronDown,
  AlertTriangle,
  Loader2,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type Cliente = {
  id: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  honorario?: number;
  ativo: number;
};

type Cobranca = {
  id: number;
  clienteId: number;
  valor: number;
  mesReferencia: number;
  anoReferencia: number;
  vencimento?: string;
  descricao: string;
  status: "pendente" | "pago" | "cancelado";
  criadoEm: string;
  cliente?: { razaoSocial: string; nomeFantasia?: string; cnpj: string; email?: string } | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  pendente: { label: "Pendente", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300", icon: Clock },
  pago:     { label: "Pago",     cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 },
  cancelado:{ label: "Cancelado",cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300", icon: XCircle },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, "");
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

// ── Nova Cobrança (individual) ────────────────────────────────────────────────

function NovaCobrancaDialog({
  open,
  onClose,
  clientes,
}: {
  open: boolean;
  onClose: () => void;
  clientes: Cliente[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();

  const [clienteId, setClienteId] = useState("");
  const [valor, setValor] = useState("");
  const [mes, setMes] = useState(String(now.getMonth() + 1));
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [vencimento, setVencimento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  // Preenche o honorário ao selecionar o cliente
  const handleClienteChange = (id: string) => {
    setClienteId(id);
    const cli = clientes.find(c => c.id === parseInt(id));
    if (cli?.honorario) setValor(String(cli.honorario));
  };

  const reset = () => {
    setClienteId(""); setValor(""); setMes(String(now.getMonth() + 1));
    setAno(String(now.getFullYear())); setVencimento(""); setDescricao("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !valor || !descricao) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/cobrancas", {
        clienteId: parseInt(clienteId),
        valor: parseFloat(valor.replace(",", ".")),
        mesReferencia: parseInt(mes),
        anoReferencia: parseInt(ano),
        vencimento: vencimento || undefined,
        descricao,
      });
      qc.invalidateQueries({ queryKey: ["/api/cobrancas"] });
      toast({ title: "Cobrança criada com sucesso!" });
      reset();
      onClose();
    } catch {
      toast({ title: "Erro ao criar cobrança", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Nova Cobrança Individual
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          {/* Cliente */}
          <div className="space-y-1.5">
            <Label>Cliente <span className="text-destructive">*</span></Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={clienteId}
              onChange={e => handleClienteChange(e.target.value)}
              required
            >
              <option value="">— Selecione o cliente —</option>
              {clientes.filter(c => c.ativo !== 0).map(c => (
                <option key={c.id} value={c.id}>
                  {c.nomeFantasia || c.razaoSocial}
                  {c.honorario ? ` — ${formatCurrency(c.honorario)}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Mês / Ano / Valor */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Mês *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={mes} onChange={e => setMes(e.target.value)}>
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano *</Label>
              <Input type="number" value={ano} onChange={e => setAno(e.target.value)} min={2020} max={2100} required />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={valor}
                onChange={e => setValor(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Vencimento */}
          <div className="space-y-1.5">
            <Label>Vencimento</Label>
            <Input
              placeholder="Ex: 10/06/2026"
              value={vencimento}
              onChange={e => setVencimento(e.target.value)}
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label>Descrição dos serviços *</Label>
            <Textarea
              placeholder="Ex: Honorários contábeis referentes a maio/2026 — escrituração fiscal, folha de pagamento e obrigações acessórias."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={4}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : "Criar Cobrança"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Cobrança em Lote ──────────────────────────────────────────────────────────

function LoteDialog({
  open,
  onClose,
  clientes,
}: {
  open: boolean;
  onClose: () => void;
  clientes: Cliente[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();

  const [mes, setMes] = useState(String(now.getMonth() + 1));
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [vencimento, setVencimento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [useAll, setUseAll] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<{ criados: number; erros: any[] } | null>(null);

  const clientesAtivos = clientes.filter(c => c.ativo !== 0);
  const comHonorario = clientesAtivos.filter(c => (c.honorario ?? 0) > 0);
  const semHonorario = clientesAtivos.filter(c => !c.honorario || c.honorario <= 0);

  const toggleCliente = (id: number) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao) return;
    setSaving(true);
    try {
      const clienteIds = useAll ? undefined : Array.from(selecionados);
      const resp = await apiRequest("POST", "/api/cobrancas/lote", {
        mesReferencia: parseInt(mes),
        anoReferencia: parseInt(ano),
        vencimento: vencimento || undefined,
        descricao,
        clienteIds,
      });
      const data = await resp.json();
      setResultado(data);
      qc.invalidateQueries({ queryKey: ["/api/cobrancas"] });
      toast({ title: `${data.criados} cobrança(s) gerada(s)!` });
    } catch {
      toast({ title: "Erro ao gerar lote", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setResultado(null); setDescricao(""); setSelecionados(new Set()); setUseAll(true);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Gerar Cobranças em Lote
          </DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 p-4">
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                {resultado.criados} cobrança(s) gerada(s) com sucesso!
              </p>
            </div>
            {resultado.erros.length > 0 && (
              <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 border-red-200 p-3 space-y-1">
                <p className="text-xs font-semibold text-red-700">Não geradas ({resultado.erros.length}):</p>
                {resultado.erros.map((e: any, i: number) => (
                  <p key={i} className="text-xs text-red-600">{e.razaoSocial}: {e.erro}</p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => { reset(); onClose(); }}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleEnviar} className="space-y-4">
            {/* Mês / Ano */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Mês *</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={mes} onChange={e => setMes(e.target.value)}>
                  {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Ano *</Label>
                <Input type="number" value={ano} onChange={e => setAno(e.target.value)} min={2020} max={2100} required />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento</Label>
                <Input placeholder="Ex: 10/06/2026" value={vencimento} onChange={e => setVencimento(e.target.value)} />
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label>Descrição dos serviços *</Label>
              <Textarea
                placeholder="Ex: Honorários contábeis — escrituração fiscal, obrigações acessórias e assessoria tributária."
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                rows={3}
                required
              />
            </div>

            {/* Seleção de clientes */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium">Clientes</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUseAll(true)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${useAll ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background"}`}
                  >
                    Todos ativos ({comHonorario.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseAll(false)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${!useAll ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background"}`}
                  >
                    Selecionar
                  </button>
                </div>
              </div>

              {semHonorario.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {semHonorario.length} cliente(s) sem honorário cadastrado serão ignorados. Cadastre o honorário em cada cliente para incluí-los no lote.
                  </AlertDescription>
                </Alert>
              )}

              {!useAll && (
                <div className="border rounded-md max-h-44 overflow-y-auto divide-y">
                  {clientesAtivos.map(c => (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors">
                      <input
                        type="checkbox"
                        checked={selecionados.has(c.id)}
                        onChange={() => toggleCliente(c.id)}
                        className="h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{c.nomeFantasia || c.razaoSocial}</span>
                        <span className="text-xs text-muted-foreground">{formatCnpj(c.cnpj)}</span>
                      </div>
                      {c.honorario ? (
                        <span className="text-xs font-semibold text-emerald-700">{formatCurrency(c.honorario)}</span>
                      ) : (
                        <span className="text-xs text-red-500">Sem honorário</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
              <Button type="submit" disabled={saving || (!useAll && selecionados.size === 0)}>
                {saving
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                  : <><Send className="h-4 w-4 mr-2" />Gerar Cobranças</>
                }
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Card de uma cobrança ──────────────────────────────────────────────────────

function CobrancaCard({ cob, onDelete }: { cob: Cobranca; onDelete: (id: number) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const st = STATUS_CONFIG[cob.status] || STATUS_CONFIG.pendente;
  const StatusIcon = st.icon;

  const ciclarStatus = async () => {
    const next = cob.status === "pendente" ? "pago" : cob.status === "pago" ? "cancelado" : "pendente";
    try {
      await apiRequest("PATCH", `/api/cobrancas/${cob.id}`, { status: next });
      qc.invalidateQueries({ queryKey: ["/api/cobrancas"] });
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const abrirCarta = () => {
    window.open(`/api/cobrancas/${cob.id}/carta`, "_blank");
  };

  const mesNome = MESES[(cob.mesReferencia - 1)] || "";
  const nomeCliente = cob.cliente?.nomeFantasia || cob.cliente?.razaoSocial || `Cliente #${cob.clienteId}`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4">
          {/* Ícone */}
          <div className="h-9 w-9 rounded-lg bg-pink-50 dark:bg-pink-950/30 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5 text-pink-600" />
          </div>

          {/* Info principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{nomeCliente}</span>
              <span className="text-xs text-muted-foreground">
                {mesNome}/{cob.anoReferencia}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{cob.descricao}</p>
            {cob.vencimento && (
              <p className="text-xs text-muted-foreground mt-0.5">Vence: {cob.vencimento}</p>
            )}
          </div>

          {/* Valor */}
          <div className="text-right shrink-0">
            <p className="font-bold text-base">{formatCurrency(cob.valor)}</p>
            {cob.cliente?.cnpj && (
              <p className="text-[10px] text-muted-foreground font-mono">{formatCnpj(cob.cliente.cnpj)}</p>
            )}
          </div>

          {/* Status (clicável) */}
          <button
            onClick={ciclarStatus}
            title="Clique para alternar status"
            className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 ${st.cls}`}
          >
            <StatusIcon className="h-3 w-3" />
            {st.label}
          </button>

          {/* Ações */}
          <div className="flex gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={abrirCarta}
            >
              <FileText className="h-3.5 w-3.5" />
              Carta
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(cob.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Cobrancas() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();

  const [novaOpen, setNovaOpen] = useState(false);
  const [loteOpen, setLoteOpen] = useState(false);
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroAno, setFiltroAno] = useState(String(now.getFullYear()));
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const { data: clientes = [] } = useQuery<Cliente[]>({ queryKey: ["/api/clientes"] });

  const qParams = new URLSearchParams();
  if (filtroMes !== "todos") qParams.set("mes", filtroMes);
  if (filtroAno) qParams.set("ano", filtroAno);

  const { data: cobrancas = [], isLoading } = useQuery<Cobranca[]>({
    queryKey: ["/api/cobrancas", filtroMes, filtroAno],
    queryFn: () => apiRequest("GET", `/api/cobrancas?${qParams}`).then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/cobrancas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cobrancas"] });
      toast({ title: "Cobrança removida" });
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
  });

  const handleDelete = (id: number) => {
    if (confirm("Deseja realmente excluir esta cobrança?")) deleteMutation.mutate(id);
  };

  const filtered = useMemo(() => {
    if (filtroStatus === "todos") return cobrancas;
    return cobrancas.filter(c => c.status === filtroStatus);
  }, [cobrancas, filtroStatus]);

  const totais = useMemo(() => ({
    total: filtered.reduce((s, c) => s + c.valor, 0),
    pendente: filtered.filter(c => c.status === "pendente").reduce((s, c) => s + c.valor, 0),
    pago: filtered.filter(c => c.status === "pago").reduce((s, c) => s + c.valor, 0),
  }), [filtered]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-pink-100 dark:bg-pink-950/30 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5 text-pink-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Cobranças</h1>
            <p className="text-sm text-muted-foreground">Honorários mensais — carta de cobrança com PIX</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => setLoteOpen(true)} className="gap-2">
            <Users className="h-4 w-4" /> Gerar Lote
          </Button>
          <Button onClick={() => setNovaOpen(true)} className="gap-2 bg-pink-600 hover:bg-pink-700">
            <Plus className="h-4 w-4" /> Nova Cobrança
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Mês</Label>
          <select
            className="border rounded-md px-3 py-1.5 text-sm bg-background h-9"
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value)}
          >
            <option value="todos">Todos os meses</option>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ano</Label>
          <Input
            type="number"
            className="w-24 h-9 text-sm"
            value={filtroAno}
            onChange={e => setFiltroAno(e.target.value)}
            min={2020}
            max={2100}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["todos","pendente","pago","cancelado"].map(s => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
                filtroStatus === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent border-border"
              }`}
            >
              {s === "todos" ? "Todos" : STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total no período", value: totais.total, cls: "text-foreground" },
            { label: "Pendente", value: totais.pendente, cls: "text-yellow-700 dark:text-yellow-400" },
            { label: "Recebido", value: totais.pago, cls: "text-emerald-700 dark:text-emerald-400" },
          ].map(r => (
            <div key={r.label} className="rounded-lg border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className={`text-lg font-bold ${r.cls}`}>{formatCurrency(r.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="text-sm font-medium">Nenhuma cobrança encontrada</p>
          <p className="text-xs mt-1">Crie uma cobrança individual ou gere o lote do mês</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button variant="outline" onClick={() => setLoteOpen(true)} className="gap-2">
              <Users className="h-4 w-4" /> Gerar Lote
            </Button>
            <Button onClick={() => setNovaOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Cobrança
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(cob => (
            <CobrancaCard key={cob.id} cob={cob} onDelete={handleDelete} />
          ))}
          <p className="text-xs text-muted-foreground text-center pt-1">
            {filtered.length} cobrança{filtered.length !== 1 ? "s" : ""} · {formatCurrency(totais.total)} total
          </p>
        </div>
      )}

      <NovaCobrancaDialog open={novaOpen} onClose={() => setNovaOpen(false)} clientes={clientes} />
      <LoteDialog open={loteOpen} onClose={() => setLoteOpen(false)} clientes={clientes} />
    </div>
  );
}

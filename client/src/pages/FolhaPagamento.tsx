import { useState, useMemo, useEffect } from "react";
import {
  Users,
  Plus,
  Trash2,
  Printer,
  Building2,
  ChevronDown,
  CheckCircle2,
  Clock,
  Pencil,
  X,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCliente } from "@/contexts/ClienteContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoCalculo = "diaria" | "fixo" | "hora";

interface Colaborador {
  id: string;
  nome: string;
  funcao: string;
  tipoCalculo: TipoCalculo;
  quantidade: number; // dias ou horas
  valorUnitario: number; // valor por dia, hora ou fixo mensal
  observacao: string;
  pago: boolean;
}

interface FolhaData {
  colaboradores: Colaborador[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ANOS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);

function storageKey(clienteId: number, mes: number, ano: number) {
  return `folha_${clienteId}_${ano}_${String(mes).padStart(2, "0")}`;
}

function calcTotal(c: Colaborador): number {
  if (c.tipoCalculo === "fixo") return c.valorUnitario;
  return c.quantidade * c.valorUnitario;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Formulário de colaborador ─────────────────────────────────────────────────

interface FormColaborador extends Omit<Colaborador, "id" | "pago"> {}

const FORM_VAZIO: FormColaborador = {
  nome: "",
  funcao: "",
  tipoCalculo: "diaria",
  quantidade: 0,
  valorUnitario: 0,
  observacao: "",
};

function ColaboradorForm({
  inicial,
  onSalvar,
  onCancelar,
}: {
  inicial?: FormColaborador;
  onSalvar: (d: FormColaborador) => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState<FormColaborador>(inicial ?? FORM_VAZIO);

  function set(field: keyof FormColaborador, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    onSalvar(form);
  }

  const total =
    form.tipoCalculo === "fixo"
      ? form.valorUnitario
      : (form.quantidade || 0) * (form.valorUnitario || 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-xl bg-muted/30">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Nome *</Label>
          <Input
            placeholder="Nome do colaborador"
            value={form.nome}
            onChange={(e) => set("nome", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Função / Serviço</Label>
          <Input
            placeholder="Ex.: Diarista, Pintor, Jardineiro"
            value={form.funcao}
            onChange={(e) => set("funcao", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo de cálculo</Label>
          <select
            value={form.tipoCalculo}
            onChange={(e) => set("tipoCalculo", e.target.value as TipoCalculo)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="diaria">Por dia trabalhado</option>
            <option value="hora">Por hora trabalhada</option>
            <option value="fixo">Valor fixo mensal</option>
          </select>
        </div>

        {form.tipoCalculo !== "fixo" && (
          <div className="space-y-1.5">
            <Label>{form.tipoCalculo === "diaria" ? "Dias trabalhados" : "Horas trabalhadas"}</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="0"
              value={form.quantidade || ""}
              onChange={(e) => set("quantidade", parseFloat(e.target.value) || 0)}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>
            {form.tipoCalculo === "diaria"
              ? "Valor por dia (R$)"
              : form.tipoCalculo === "hora"
              ? "Valor por hora (R$)"
              : "Valor mensal (R$)"}
          </Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="0,00"
            value={form.valorUnitario || ""}
            onChange={(e) => set("valorUnitario", parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Observação (opcional)</Label>
        <Input
          placeholder="Detalhes do serviço, período, etc."
          value={form.observacao}
          onChange={(e) => set("observacao", e.target.value)}
        />
      </div>

      {total > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Total a pagar:</span>
          <span className="font-semibold text-foreground text-base">{formatBRL(total)}</span>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
          <X className="h-4 w-4 mr-1" /> Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={!form.nome.trim()}>
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
      </div>
    </form>
  );
}

// ─── Linha de colaborador ─────────────────────────────────────────────────────

function ColaboradorRow({
  colab,
  onTogglePago,
  onEditar,
  onRemover,
}: {
  colab: Colaborador;
  onTogglePago: () => void;
  onEditar: () => void;
  onRemover: () => void;
}) {
  const total = calcTotal(colab);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
        colab.pago
          ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40"
          : "bg-card border-border"
      }`}
    >
      {/* Status pago */}
      <button
        onClick={onTogglePago}
        title={colab.pago ? "Marcar como não pago" : "Marcar como pago"}
        className={`shrink-0 transition-colors ${
          colab.pago ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-emerald-600"
        }`}
      >
        {colab.pago ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Clock className="h-5 w-5" />
        )}
      </button>

      {/* Dados */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium text-sm ${colab.pago ? "line-through text-muted-foreground" : ""}`}>
            {colab.nome}
          </span>
          {colab.funcao && (
            <Badge variant="secondary" className="text-xs">
              {colab.funcao}
            </Badge>
          )}
          {colab.pago && (
            <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Pago
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
          {colab.tipoCalculo === "fixo" ? (
            <span>Valor fixo mensal</span>
          ) : (
            <span>
              {colab.quantidade}{" "}
              {colab.tipoCalculo === "diaria" ? (colab.quantidade === 1 ? "dia" : "dias") : (colab.quantidade === 1 ? "hora" : "horas")}
              {" "}× {formatBRL(colab.valorUnitario)}
            </span>
          )}
          {colab.observacao && <span className="truncate max-w-xs">· {colab.observacao}</span>}
        </div>
      </div>

      {/* Total */}
      <div className="text-right shrink-0">
        <span className={`font-semibold text-sm ${colab.pago ? "text-muted-foreground line-through" : "text-foreground"}`}>
          {formatBRL(total)}
        </span>
      </div>

      {/* Ações */}
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEditar} title="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemover} title="Remover">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FolhaPagamento() {
  const { clienteAtivo, clientes, setClienteAtivo } = useCliente();
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(hoje.getMonth() + 1); // 1-12
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [seletorEmpresaAberto, setSeletorEmpresaAberto] = useState(false);
  const [buscaEmpresa, setBuscaEmpresa] = useState("");

  // Carregar dados do localStorage ao mudar empresa/mês/ano
  useEffect(() => {
    if (!clienteAtivo) {
      setColaboradores([]);
      return;
    }
    const raw = localStorage.getItem(storageKey(clienteAtivo.id, mesSel, anoSel));
    if (raw) {
      try {
        const data: FolhaData = JSON.parse(raw);
        setColaboradores(data.colaboradores || []);
      } catch {
        setColaboradores([]);
      }
    } else {
      setColaboradores([]);
    }
  }, [clienteAtivo, mesSel, anoSel]);

  // Salvar no localStorage sempre que colaboradores mudam
  useEffect(() => {
    if (!clienteAtivo) return;
    const data: FolhaData = { colaboradores };
    localStorage.setItem(storageKey(clienteAtivo.id, mesSel, anoSel), JSON.stringify(data));
  }, [colaboradores, clienteAtivo, mesSel, anoSel]);

  function adicionarColaborador(form: FormColaborador) {
    const novo: Colaborador = { ...form, id: genId(), pago: false };
    setColaboradores((prev) => [...prev, novo]);
    setMostrarForm(false);
  }

  function salvarEdicao(id: string, form: FormColaborador) {
    setColaboradores((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...form } : c))
    );
    setEditandoId(null);
  }

  function removerColaborador(id: string) {
    setColaboradores((prev) => prev.filter((c) => c.id !== id));
  }

  function togglePago(id: string) {
    setColaboradores((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pago: !c.pago } : c))
    );
  }

  const totais = useMemo(() => {
    const totalGeral = colaboradores.reduce((s, c) => s + calcTotal(c), 0);
    const totalPago = colaboradores.filter((c) => c.pago).reduce((s, c) => s + calcTotal(c), 0);
    const totalPendente = totalGeral - totalPago;
    return { totalGeral, totalPago, totalPendente };
  }, [colaboradores]);

  const empresasFiltradas = clientes.filter((c) => {
    const q = buscaEmpresa.toLowerCase();
    return (
      c.razaoSocial.toLowerCase().includes(q) ||
      (c.nomeFantasia || "").toLowerCase().includes(q) ||
      c.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    );
  });

  function handleImprimir() {
    window.print();
  }

  const periodoLabel = `${MESES[mesSel - 1]}/${anoSel}`;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Folha de Pagamento</h1>
            <p className="text-sm text-muted-foreground">
              Controle de pagamentos para prestadores e colaboradores sem vínculo empregatício
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleImprimir} className="shrink-0">
          <Printer className="h-4 w-4 mr-1.5" />
          Imprimir
        </Button>
      </div>

      {/* Cabeçalho para impressão */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">Folha de Pagamento — {periodoLabel}</h1>
        {clienteAtivo && (
          <p className="text-sm text-gray-600 mt-1">
            {clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial} · CNPJ: {clienteAtivo.cnpj}
          </p>
        )}
      </div>

      {/* Filtros: empresa + mês + ano */}
      <Card className="print:hidden">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Seletor de empresa */}
            <div className="flex-1 min-w-[220px] space-y-1.5 relative">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Empresa</Label>
              <button
                onClick={() => { setSeletorEmpresaAberto((v) => !v); setBuscaEmpresa(""); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  clienteAtivo
                    ? "border-primary/50 bg-primary/5 text-foreground hover:bg-primary/10"
                    : "border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <Building2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 text-left truncate">
                  {clienteAtivo ? (clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial) : "Selecionar empresa..."}
                </span>
                {clienteAtivo && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setClienteAtivo(null); }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${seletorEmpresaAberto ? "rotate-180" : ""}`} />
              </button>

              {seletorEmpresaAberto && (
                <div className="absolute top-full left-0 mt-1 w-full min-w-[280px] bg-card border rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-3 pt-3 pb-2 border-b">
                    <Input
                      autoFocus
                      placeholder="Buscar por nome ou CNPJ..."
                      value={buscaEmpresa}
                      onChange={(e) => setBuscaEmpresa(e.target.value)}
                      className="text-sm h-8"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {empresasFiltradas.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                        Nenhuma empresa encontrada
                      </div>
                    ) : (
                      empresasFiltradas.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setClienteAtivo(c); setSeletorEmpresaAberto(false); }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex items-start gap-3 ${
                            clienteAtivo?.id === c.id ? "bg-primary/5 border-l-2 border-primary" : ""
                          }`}
                        >
                          <Building2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {c.nomeFantasia || c.razaoSocial}
                            </div>
                            {c.nomeFantasia && (
                              <div className="text-[11px] text-muted-foreground truncate">{c.razaoSocial}</div>
                            )}
                            <div className="text-[11px] text-muted-foreground font-mono">{c.cnpj}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mês */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Mês</Label>
              <select
                value={mesSel}
                onChange={(e) => setMesSel(Number(e.target.value))}
                className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {MESES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* Ano */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Ano</Label>
              <select
                value={anoSel}
                onChange={(e) => setAnoSel(Number(e.target.value))}
                className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ANOS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sem empresa selecionada */}
      {!clienteAtivo && (
        <Card>
          <CardContent className="py-14 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">Selecione uma empresa para visualizar ou lançar a folha.</p>
          </CardContent>
        </Card>
      )}

      {clienteAtivo && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-3 print:gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total geral</div>
                <div className="text-2xl font-bold text-foreground">{formatBRL(totais.totalGeral)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {colaboradores.length} colaborador{colaboradores.length !== 1 ? "es" : ""}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Já pago</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatBRL(totais.totalPago)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {colaboradores.filter((c) => c.pago).length} pago{colaboradores.filter((c) => c.pago).length !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pendente</div>
                <div className={`text-2xl font-bold ${totais.totalPendente > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {formatBRL(totais.totalPendente)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {colaboradores.filter((c) => !c.pago).length} pendente{colaboradores.filter((c) => !c.pago).length !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de colaboradores */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between print:hidden">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Colaboradores — {periodoLabel}
              </CardTitle>
              <Button
                size="sm"
                onClick={() => { setMostrarForm(true); setEditandoId(null); }}
                disabled={mostrarForm}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </CardHeader>

            {/* Cabeçalho para impressão */}
            <div className="hidden print:flex items-center justify-between px-6 py-3 border-b">
              <span className="font-semibold text-sm">Colaboradores — {periodoLabel}</span>
              <span className="text-sm text-gray-600">
                {clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial}
              </span>
            </div>

            <CardContent className="pt-0 space-y-3">
              {/* Formulário novo colaborador */}
              {mostrarForm && !editandoId && (
                <>
                  <Separator />
                  <ColaboradorForm
                    onSalvar={adicionarColaborador}
                    onCancelar={() => setMostrarForm(false)}
                  />
                </>
              )}

              {/* Lista vazia */}
              {colaboradores.length === 0 && !mostrarForm && (
                <div className="py-10 text-center">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum colaborador lançado para {periodoLabel}.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 print:hidden"
                    onClick={() => setMostrarForm(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar primeiro colaborador
                  </Button>
                </div>
              )}

              {/* Linhas */}
              {colaboradores.map((colab) => (
                <div key={colab.id}>
                  {editandoId === colab.id ? (
                    <ColaboradorForm
                      inicial={{
                        nome: colab.nome,
                        funcao: colab.funcao,
                        tipoCalculo: colab.tipoCalculo,
                        quantidade: colab.quantidade,
                        valorUnitario: colab.valorUnitario,
                        observacao: colab.observacao,
                      }}
                      onSalvar={(form) => salvarEdicao(colab.id, form)}
                      onCancelar={() => setEditandoId(null)}
                    />
                  ) : (
                    <ColaboradorRow
                      colab={colab}
                      onTogglePago={() => togglePago(colab.id)}
                      onEditar={() => { setEditandoId(colab.id); setMostrarForm(false); }}
                      onRemover={() => removerColaborador(colab.id)}
                    />
                  )}
                </div>
              ))}

              {/* Totalizador rodapé */}
              {colaboradores.length > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between px-1 pt-1 print:pt-2">
                    <span className="text-sm text-muted-foreground font-medium">
                      Total — {colaboradores.length} colaborador{colaboradores.length !== 1 ? "es" : ""}
                    </span>
                    <span className="text-lg font-bold text-foreground">{formatBRL(totais.totalGeral)}</span>
                  </div>
                  {totais.totalPago > 0 && (
                    <div className="flex items-center justify-between px-1 text-sm">
                      <span className="text-emerald-600 dark:text-emerald-400">Pago</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatBRL(totais.totalPago)}</span>
                    </div>
                  )}
                  {totais.totalPendente > 0 && (
                    <div className="flex items-center justify-between px-1 text-sm">
                      <span className="text-amber-600 dark:text-amber-400">Pendente</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{formatBRL(totais.totalPendente)}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Aviso rodapé */}
          <p className="text-xs text-muted-foreground text-center print:hidden">
            Este sistema é destinado a pagamentos informais sem vínculo empregatício registrado. Não há cálculo de INSS, IRRF ou outros encargos.
          </p>
        </>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCliente } from "@/contexts/ClienteContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search, AlertTriangle, CheckCircle2, Copy, ChevronDown,
  FileText, Building2, User, ArrowLeftRight, Info, Link2,
  CreditCard, MinusCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Tabela CFOP mais usados
const CFOPS_COMUNS = [
  { codigo: "5102", descricao: "Venda (mesmo estado)" },
  { codigo: "5101", descricao: "Venda produção própria (mesmo estado)" },
  { codigo: "5405", descricao: "Venda com ST (mesmo estado)" },
  { codigo: "5910", descricao: "Bonificação/Brinde (mesmo estado)" },
  { codigo: "6102", descricao: "Venda (outro estado)" },
  { codigo: "6108", descricao: "Venda p/ não contribuinte (outro estado)" },
  { codigo: "6405", descricao: "Venda com ST (outro estado)" },
  { codigo: "7102", descricao: "Exportação" },
  { codigo: "1102", descricao: "Compra (mesmo estado)" },
  { codigo: "2102", descricao: "Compra (outro estado)" },
  { codigo: "1202", descricao: "Devolução de venda (mesmo estado)" },
  { codigo: "5202", descricao: "Devolução de compra (mesmo estado)" },
];

function formatNcm(value: string) {
  const digits = value.replace(/\D/g, "").substring(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copiado!", duration: 1500 }); }}
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function CodigoChip({ label, value, variant = "default" }: { label: string; value: string; variant?: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[90px]">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1">
        <span className={`codigo-fiscal text-sm font-semibold ${
          variant === "primary" ? "text-primary" :
          variant === "success" ? "text-emerald-600 dark:text-emerald-400" :
          variant === "warning" ? "text-amber-600 dark:text-amber-400" :
          "text-foreground"
        }`}>{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

export default function Consulta() {
  const { toast } = useToast();
  const { clienteAtivo, clientes } = useCliente();
  const [ncm, setNcm] = useState("");
  const [cfop, setCfop] = useState("");
  const [modalidade, setModalidade] = useState<"B2B" | "B2C">("B2B");
  const [regime, setRegime] = useState<"Simples" | "Presumido">("Simples");
  const [showCfopList, setShowCfopList] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [consultaId, setConsultaId] = useState<number | null>(null);
  const [clienteSelecionado, setClienteSelecionado] = useState<string>("");
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Pré-preenche regime e CFOP padrão quando o cliente ativo muda
  useEffect(() => {
    if (!clienteAtivo) return;
    const r = clienteAtivo.regime === "Simples Nacional" ? "Simples" : "Presumido";
    setRegime(r as "Simples" | "Presumido");
    if (clienteAtivo.cfopPadrao) setCfop(clienteAtivo.cfopPadrao);
    if (clienteAtivo.ncmPrincipal) setNcm(formatNcm(clienteAtivo.ncmPrincipal));
    // Vincula automaticamente ao cliente ativo
    setClienteSelecionado(String(clienteAtivo.id));
  }, [clienteAtivo?.id]);

  const consultaMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/consulta", data).then(r => r.json()),
    onSuccess: (data) => {
      setResultado(data.config);
      setConsultaId(data.id);
      setClienteSelecionado("");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    },
    onError: () => toast({ title: "Erro na consulta", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ncm || !cfop) return toast({ title: "Preencha NCM e CFOP", variant: "destructive" });
    consultaMutation.mutate({ ncm: ncm.replace(/\D/g, ""), cfop, modalidade, regime });
  };

  const handleSalvarParaCliente = async () => {
    if (!clienteSelecionado || !resultado) return;
    const cid = parseInt(clienteSelecionado);
    if (isNaN(cid)) return;
    const cliente = clientes.find(c => c.id === cid);
    if (!cliente) return;

    setSalvandoCliente(true);
    try {
      await apiRequest("POST", `/api/clientes/${cid}/configs`, {
        clienteId: cid,
        ncm: ncm.replace(/\D/g, ""),
        cfop,
        modalidade,
        descricao: `Consulta NCM ${ncm.replace(/\D/g, "")} / CFOP ${cfop} (${regime})`,
        resultado: JSON.stringify(resultado),
        criadoEm: new Date().toISOString(),
      });
      toast({
        title: `Configuração salva no histórico do cliente ${cliente.razaoSocial}`,
      });
      setClienteSelecionado("");
    } catch {
      toast({ title: "Erro ao salvar configuração", variant: "destructive" });
    } finally {
      setSalvandoCliente(false);
    }
  };

  const res = resultado;

  return (
    <div className="space-y-6">
      {/* Header da página */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Configuração Fiscal NF-e</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informe o NCM, CFOP e modalidade para obter a configuração tributária completa conforme a Reforma Tributária 2026.
        </p>
      </div>

      {/* Banner empresa ativa */}
      {clienteAtivo && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-primary">{clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial}</span>
          <span className="text-muted-foreground text-xs">— Regime e CFOP padrão pré-preenchidos automaticamente</span>
          <Badge variant="secondary" className={`ml-auto text-[10px] px-1.5 ${
            clienteAtivo.regime === "Simples Nacional"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          }`}>
            {clienteAtivo.regime}
          </Badge>
        </div>
      )}

      {/* Formulário */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* NCM */}
              <div className="space-y-1.5">
                <Label htmlFor="ncm" className="text-sm font-medium">NCM <span className="text-destructive">*</span></Label>
                <Input
                  id="ncm"
                  data-testid="input-ncm"
                  placeholder="0000.00.00"
                  value={ncm}
                  onChange={e => setNcm(formatNcm(e.target.value))}
                  className="codigo-fiscal"
                />
                <p className="text-xs text-muted-foreground">8 dígitos — Nomenclatura Comum do Mercosul</p>
              </div>

              {/* CFOP */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="cfop" className="text-sm font-medium">CFOP <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <Input
                    id="cfop"
                    data-testid="input-cfop"
                    placeholder="5102"
                    value={cfop}
                    onChange={e => setCfop(e.target.value.replace(/\D/g, "").substring(0, 4))}
                    className="codigo-fiscal"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowCfopList(v => !v)}
                    data-testid="button-cfop-list"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${showCfopList ? "rotate-180" : ""}`} />
                  </Button>
                </div>
                {showCfopList && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {CFOPS_COMUNS.map(c => (
                      <button
                        key={c.codigo}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-3 transition-colors"
                        onClick={() => { setCfop(c.codigo); setShowCfopList(false); }}
                        data-testid={`cfop-option-${c.codigo}`}
                      >
                        <span className="codigo-fiscal font-semibold text-primary w-12">{c.codigo}</span>
                        <span className="text-muted-foreground text-xs">{c.descricao}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">4 dígitos — Código Fiscal de Operações e Prestações</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Modalidade B2B/B2C */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Modalidade</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["B2B", "B2C"] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModalidade(m)}
                      data-testid={`button-${m.toLowerCase()}`}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        modalidade === m
                          ? m === "B2B"
                            ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-400"
                            : "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-400"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {m === "B2B" ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      {m}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {modalidade === "B2B" ? "Empresa → Empresa (CNPJ)" : "Empresa → Consumidor final (CPF)"}
                </p>
              </div>

              {/* Regime */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Regime Tributário</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Simples", "Presumido"] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRegime(r)}
                      data-testid={`button-regime-${r.toLowerCase()}`}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        regime === r
                          ? r === "Simples"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-400"
                            : "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-400"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {r === "Simples" ? "Simples Nacional" : "Lucro Presumido"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {regime === "Simples" ? "CSOSN + DAS unificado" : "CST + PIS/COFINS + IRPJ/CSLL"}
                </p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={consultaMutation.isPending}
              className="w-full gap-2"
              data-testid="button-consultar"
            >
              <Search className="h-4 w-4" />
              {consultaMutation.isPending ? "Processando..." : "Gerar Configuração Fiscal"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Resultado */}
      {res && (
        <div ref={resultRef} className="space-y-4 slide-in">
          {/* Cabeçalho do resultado */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Configuração Gerada</h2>
            <Badge className={modalidade === "B2B" ? "badge-b2b" : "badge-b2c"}>{res.resumo.modalidade}</Badge>
            <Badge className={regime === "Simples" ? "badge-simples" : "badge-presumido"}>{res.resumo.regime}</Badge>
            {!res.ncmCadastrado && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">NCM não cadastrado</Badge>
            )}
          </div>

          {/* Grid principal de configurações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Resumo da operação */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Operação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <CodigoChip label="NCM" value={res.resumo.ncm} variant="primary" />
                  <CodigoChip label="CFOP" value={res.resumo.cfop} variant="primary" />
                </div>
                <div className="text-xs text-muted-foreground bg-muted rounded p-2">
                  {res.resumo.cfopDescricao}
                </div>
                <div className="text-xs">
                  <span className="font-medium">Documento:</span>{" "}
                  <span className="text-muted-foreground">{res.resumo.tipoDocumento}</span>
                </div>
                {res.cfopEspelho && (
                  <div className="flex items-center gap-2 text-xs bg-accent rounded p-2">
                    <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">CFOP espelho:</span>
                    <span className="codigo-fiscal text-primary font-semibold">{res.cfopEspelho.cfop}</span>
                    <span className="text-muted-foreground">— {res.cfopEspelho.descricao}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ICMS */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">ICMS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {res.icms.csosn ? (
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    <CodigoChip label="CSOSN" value={res.icms.csosn} variant="success" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    <CodigoChip label="CST ICMS" value={res.icms.cst} variant="success" />
                  </div>
                )}
                <div className="text-xs text-muted-foreground bg-muted rounded p-2">
                  {res.icms.csosnDescricao || res.icms.cstDescricao}
                </div>
                <div className="text-xs text-muted-foreground">Regime: {res.icms.regime}</div>
              </CardContent>
            </Card>

            {/* PIS/COFINS */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">PIS / COFINS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <CodigoChip label="CST PIS" value={res.pisCofins.cstPis} />
                  <CodigoChip label="CST COFINS" value={res.pisCofins.cstCofins} />
                </div>
                <div className="text-xs text-muted-foreground bg-muted rounded p-2">
                  {res.pisCofins.cstPisDescricao}
                </div>
              </CardContent>
            </Card>

            {/* 🔑 Chave Fiscal — cClassTrib + CST + NCM */}
            <Card className="border-purple-400/40 bg-purple-50/50 dark:bg-purple-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  🔑 Chave Fiscal 2026 — cClassTrib + CST + NCM
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-2.5 text-center border border-purple-200 dark:border-purple-700">
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-1">NCM</div>
                    <div className="font-mono font-bold text-sm text-purple-800 dark:text-purple-200">{res.resumo.ncm || "—"}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Classif. produto</div>
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-2.5 text-center border border-purple-200 dark:border-purple-700">
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-1">CST IBS/CBS</div>
                    <div className="font-mono font-bold text-sm text-purple-800 dark:text-purple-200">{res.ibsCbs.cstIbsCbs || "—"}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Situação trib.</div>
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-2.5 text-center border border-purple-200 dark:border-purple-700">
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-1">cClassTrib</div>
                    <div className="font-mono font-bold text-sm text-purple-800 dark:text-purple-200">{res.ibsCbs.cClassTrib || "—"}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">6 dígitos</div>
                  </div>
                </div>
                <div className="text-xs bg-purple-100/60 dark:bg-purple-900/20 rounded-lg p-2.5 border border-purple-200/60 dark:border-purple-700/40">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-500 text-base leading-none mt-0.5">⚠️</span>
                    <div className="space-y-1">
                      <p className="font-medium text-purple-800 dark:text-purple-200">Atenção: NCM sozinho não define a tributação</p>
                      <p className="text-muted-foreground">A combinação <strong>NCM + CST + cClassTrib</strong> é obrigatória no XML da NF-e desde 1º/jan/2026 (NT NF-e 1.33 + LC 214/2025 Art. 348). Classificação incorreta pode gerar autuação e perda da dispensa de recolhimento do IBS/CBS.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* IBS/CBS — Nova Era 2026 */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
                  ⚡ IBS / CBS — Reforma Tributária 2026
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <CodigoChip label="CST IBS/CBS" value={res.ibsCbs.cstIbsCbs} variant="primary" />
                  <CodigoChip label="cClassTrib" value={res.ibsCbs.cClassTrib} variant="primary" />
                </div>
                <div className="text-xs text-muted-foreground bg-primary/10 rounded p-2">
                  {res.ibsCbs.cClassTribDescricao}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-card rounded p-2 text-center border">
                    <div className="text-muted-foreground">IBS</div>
                    <div className="codigo-fiscal font-semibold text-primary">{res.ibsCbs.aliquotaIbs}</div>
                  </div>
                  <div className="bg-card rounded p-2 text-center border">
                    <div className="text-muted-foreground">CBS</div>
                    <div className="codigo-fiscal font-semibold text-primary">{res.ibsCbs.aliquotaCbs}</div>
                  </div>
                  <div className="bg-card rounded p-2 text-center border border-primary/30">
                    <div className="text-muted-foreground">Total</div>
                    <div className="codigo-fiscal font-semibold text-primary">{res.ibsCbs.aliquotaTotal}</div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">{res.ibsCbs.observacao}</p>

                {/* Crédito gerado para o DESTINATÁRIO — LC 214/2025 Art. 28 */}
                <div className="border-t pt-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Crédito gerado para o destinatário — LC 214/2025</p>
                  {modalidade === "B2B" ? (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700 p-2.5">
                        <CreditCard className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-emerald-800 dark:text-emerald-300">
                          <span className="font-semibold">Operação B2B: gera crédito para o adquirente.</span>
                          {" "}O destinatário (pessoa jurídica) pode deduzir os valores de IBS e CBS desta NF-e
                          do seu próprio débito apurado nas saídas (não-cumulatividade plena — Art. 28, LC 214/2025).
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded border p-2 text-center bg-card">
                          <div className="text-[10px] text-muted-foreground">Créd. IBS</div>
                          <div className="font-semibold text-emerald-600 codigo-fiscal">{res.ibsCbs.aliquotaIbs}</div>
                          <div className="text-[9px] text-muted-foreground">por unidade de base de cálculo</div>
                        </div>
                        <div className="rounded border p-2 text-center bg-card">
                          <div className="text-[10px] text-muted-foreground">Créd. CBS</div>
                          <div className="font-semibold text-emerald-600 codigo-fiscal">{res.ibsCbs.aliquotaCbs}</div>
                          <div className="text-[9px] text-muted-foreground">por unidade de base de cálculo</div>
                        </div>
                        <div className="rounded border border-emerald-200 p-2 text-center bg-emerald-50 dark:bg-emerald-900/20">
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400">Créd. Total</div>
                          <div className="font-bold text-emerald-700 dark:text-emerald-400 codigo-fiscal">{res.ibsCbs.aliquotaTotal}</div>
                          <div className="text-[9px] text-emerald-600">destacado na NF-e</div>
                        </div>
                      </div>
                      {regime === "Simples" && (
                        <div className="flex items-start gap-2 rounded bg-amber-50 dark:bg-amber-900/10 border border-amber-200 p-2 text-xs">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span className="text-amber-800 dark:text-amber-300">
                            <strong>Simples Nacional:</strong> o crédito gerado para o destinatário é <strong>proporcional</strong> — calculado com base na alíquota de CBS/IBS dentro do DAS (Art. 144, LC 214/2025). Menor que o crédito de fornecedor Lucro Presumido/Real.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg bg-muted p-2.5">
                      <MinusCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-xs text-muted-foreground">
                        <strong>Operação B2C (consumidor final):</strong> não gera crédito de IBS/CBS para o destinatário.
                        Aplica-se regime diferenciado sem aproveitamento de crédito (Art. 46, LC 214/2025).
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* cBenef + cEST */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* cBenef */}
            <Card className={res.cBenef.obrigatorio && !res.cBenef.codigo ? "border-amber-300 dark:border-amber-700" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  cBenef
                  {res.cBenef.obrigatorio && (
                    <Badge variant={res.cBenef.codigo ? "default" : "outline"}
                      className={res.cBenef.codigo ? "" : "text-amber-600 border-amber-400 text-xs"}>
                      {res.cBenef.codigo ? "configurado" : "obrigatório"}
                    </Badge>
                  )}
                  {!res.cBenef.obrigatorio && (
                    <Badge variant="secondary" className="text-xs">não exigido</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {res.cBenef.codigo ? (
                  <div className="flex items-center gap-2">
                    <span className="codigo-fiscal text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {res.cBenef.codigo}
                    </span>
                    <CopyButton text={res.cBenef.codigo} />
                  </div>
                ) : (
                  <span className="codigo-fiscal text-sm text-muted-foreground">—</span>
                )}
                <p className="text-xs text-muted-foreground">{res.cBenef.descricao}</p>
                <p className="text-xs text-muted-foreground">Formato: UF + 8 dígitos (ex: SP12345678) — cadastrado no SEFAZ estadual</p>
              </CardContent>
            </Card>

            {/* cEST */}
            <Card className={res.cEst.obrigatorio && !res.cEst.codigo ? "border-amber-300 dark:border-amber-700" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  cEST
                  {res.cEst.obrigatorio && (
                    <Badge variant={res.cEst.codigo ? "default" : "outline"}
                      className={res.cEst.codigo ? "" : "text-amber-600 border-amber-400 text-xs"}>
                      {res.cEst.codigo ? "configurado" : "obrigatório"}
                    </Badge>
                  )}
                  {!res.cEst.obrigatorio && (
                    <Badge variant="secondary" className="text-xs">não exigido</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {res.cEst.codigo ? (
                  <div className="flex items-center gap-2">
                    <span className="codigo-fiscal text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {res.cEst.codigo}
                    </span>
                    <CopyButton text={res.cEst.codigo} />
                  </div>
                ) : (
                  <span className="codigo-fiscal text-sm text-muted-foreground">—</span>
                )}
                <p className="text-xs text-muted-foreground">{res.cEst.descricao}</p>
                <p className="text-xs text-muted-foreground">7 dígitos — Convênio ICMS 52/2017 (Subst. Tributária)</p>
              </CardContent>
            </Card>
          </div>

          {/* IPI */}
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">IPI</span>
                  <span className="codigo-fiscal text-sm text-foreground font-semibold">
                    {typeof res.ipi.aliquota === "number" ? `${res.ipi.aliquota}%` : res.ipi.aliquota}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{res.ipi.observacao}</span>
              </div>
            </CardContent>
          </Card>

          {/* Alertas */}
          {res.alertas.length > 0 && (
            <div className="space-y-2">
              {res.alertas.map((alerta: string, i: number) => (
                <Alert key={i} className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-amber-800 dark:text-amber-300 text-sm ml-2">
                    {alerta}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {!res.ncmCadastrado && (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-300 text-sm ml-2">
                Para resultados mais precisos com alíquotas de IPI e cClassTrib específicas, cadastre o NCM <strong>{res.resumo.ncm}</strong> na aba <strong>NCMs</strong>.
              </AlertDescription>
            </Alert>
          )}

          {/* Vincular ao cliente (opcional) */}
          {clientes.length > 0 && (
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <Link2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Vincular ao cliente (opcional)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Salva esta configuração no histórico fiscal do cliente selecionado.
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                      <Select
                        value={clienteSelecionado}
                        onValueChange={setClienteSelecionado}
                      >
                        <SelectTrigger className="flex-1 min-w-[180px]">
                          <SelectValue placeholder="Selecionar cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              <span className="font-medium">{c.razaoSocial}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{c.cnpj}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleSalvarParaCliente}
                        disabled={!clienteSelecionado || salvandoCliente}
                        variant="outline"
                        className="gap-2 whitespace-nowrap shrink-0"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {salvandoCliente ? "Salvando..." : "Salvar para cliente"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Search, Copy, CheckCircle2, AlertTriangle, Info,
  ExternalLink, Hash, Tag, ArrowRightLeft, BookOpen, Layers, FileSearch,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── CST IBS/CBS ──────────────────────────────────────────────────────────────

interface CstEntry {
  codigo: string;
  descricao: string;
  detalhe: string;
  tipo: "integral" | "reduzida" | "zero" | "isencao" | "imunidade" | "diferimento";
  exemplos?: string[];
}

const CST_IBS_CBS: CstEntry[] = [
  {
    codigo: "000",
    descricao: "Tributação integral",
    detalhe: "Regime geral sem benefício — alíquota cheia de IBS e CBS aplicada sobre a base de cálculo integral.",
    tipo: "integral",
    exemplos: ["Comércio varejista geral", "Serviços gerais sem benefício", "Indústria sem redução"],
  },
  {
    codigo: "010",
    descricao: "Tributação integral com crédito presumido",
    detalhe: "Alíquota cheia com direito a crédito presumido concedido por legislação específica.",
    tipo: "integral",
    exemplos: ["Atividades com crédito presumido regulamentado"],
  },
  {
    codigo: "020",
    descricao: "Tributação integral — alíquota ad rem",
    detalhe: "Alíquota expressa em valor fixo por unidade (R$/litro, R$/kg) em vez de percentual.",
    tipo: "integral",
    exemplos: ["Combustíveis no regime monofásico", "Bebidas no regime específico"],
  },
  {
    codigo: "040",
    descricao: "Redução de alíquota — 30%",
    detalhe: "Redução de 30% sobre a alíquota de referência do IBS + CBS. Aplicável a serviços essenciais.",
    tipo: "reduzida",
    exemplos: ["Serviços de saúde", "Serviços de educação básica", "Transporte coletivo de passageiros"],
  },
  {
    codigo: "041",
    descricao: "Redução 30% + crédito presumido",
    detalhe: "Redução de 30% combinada com crédito presumido específico regulamentado.",
    tipo: "reduzida",
    exemplos: ["Serviços de saúde com benefício adicional regulamentado"],
  },
  {
    codigo: "050",
    descricao: "Redução de alíquota — 60%",
    detalhe: "Redução de 60% sobre a alíquota de referência. Cesta básica nacional e medicamentos essenciais.",
    tipo: "reduzida",
    exemplos: ["Alimentos da cesta básica nacional", "Medicamentos da lista essencial (RENAME)", "Produtos de higiene pessoal listados"],
  },
  {
    codigo: "051",
    descricao: "Redução 60% + crédito presumido",
    detalhe: "Redução de 60% combinada com crédito presumido regulamentado.",
    tipo: "reduzida",
    exemplos: ["Medicamentos com benefício de crédito presumido"],
  },
  {
    codigo: "060",
    descricao: "Alíquota zero — redução 100%",
    detalhe: "Tributação a zero. Difere da isenção: o adquirente mantém direito ao crédito de entrada.",
    tipo: "zero",
    exemplos: ["Produtos agropecuários in natura", "Insumos agropecuários", "Produtos pesqueiros básicos"],
  },
  {
    codigo: "061",
    descricao: "Alíquota zero + crédito presumido",
    detalhe: "Alíquota zero com crédito presumido para cadeias agroindustriais.",
    tipo: "zero",
    exemplos: ["Insumos agrícolas com crédito presumido na cadeia"],
  },
  {
    codigo: "070",
    descricao: "Diferimento total",
    detalhe: "Recolhimento integralmente transferido para etapa posterior da cadeia. Não há crédito na operação.",
    tipo: "diferimento",
    exemplos: ["Transferência entre estabelecimentos do mesmo contribuinte", "Remessa para industrialização"],
  },
  {
    codigo: "080",
    descricao: "Diferimento parcial",
    detalhe: "Parte do IBS/CBS é diferida e parte recolhida normalmente. Percentual definido em legislação específica.",
    tipo: "diferimento",
    exemplos: ["Operações com diferimento parcial regulamentado"],
  },
  {
    codigo: "090",
    descricao: "Isenção",
    detalhe: "Operação isenta de IBS/CBS. NÃO gera crédito para o adquirente (diferente da alíquota zero).",
    tipo: "isencao",
    exemplos: ["Exportação de serviços para o exterior", "Operações isentas por lei específica"],
  },
  {
    codigo: "100",
    descricao: "Imunidade constitucional",
    detalhe: "Protegida por imunidade da EC 132/2023. Não incide IBS/CBS por mandamento constitucional.",
    tipo: "imunidade",
    exemplos: ["Livros, jornais e periódicos", "Templos de qualquer culto", "Partidos políticos e entidades sindicais"],
  },
  {
    codigo: "200",
    descricao: "Tributação com redução (código simplificado)",
    detalhe: "Código de situação para operações com redução de alíquota. Usar cClassTrib para detalhar o percentual.",
    tipo: "reduzida",
    exemplos: ["Qualquer operação com redução — especificar via cClassTrib"],
  },
  {
    codigo: "400",
    descricao: "Isenção (código simplificado)",
    detalhe: "Código de isenção no formato simplificado (NT NF-e 1.33). Usar cClassTrib para detalhar a base legal.",
    tipo: "isencao",
    exemplos: ["Isenção identificada via cClassTrib específico"],
  },
];

// ─── cClassTrib ───────────────────────────────────────────────────────────────

interface ClassTribEntry {
  codigo: string;
  descricao: string;
  cst: string;
  reducao: string;
  setor: string;
  baseLegal: string;
}

const C_CLASS_TRIB: ClassTribEntry[] = [
  { codigo: "000001", descricao: "Tributação integral — operação comercial geral", cst: "000", reducao: "0%", setor: "Comércio/Indústria", baseLegal: "Art. 1º LC 214/2025" },
  { codigo: "000002", descricao: "Tributação integral — prestação de serviços geral", cst: "000", reducao: "0%", setor: "Serviços gerais", baseLegal: "Art. 1º LC 214/2025" },
  { codigo: "000003", descricao: "Tributação integral — operação industrial", cst: "000", reducao: "0%", setor: "Indústria", baseLegal: "Art. 1º LC 214/2025" },
  { codigo: "040001", descricao: "Saúde — serviços médicos e hospitalares", cst: "040", reducao: "30%", setor: "Saúde", baseLegal: "Art. 127 LC 214/2025" },
  { codigo: "040002", descricao: "Saúde — planos de saúde", cst: "040", reducao: "30%", setor: "Saúde", baseLegal: "Art. 127 LC 214/2025" },
  { codigo: "040003", descricao: "Educação — estabelecimentos de ensino", cst: "040", reducao: "30%", setor: "Educação", baseLegal: "Art. 128 LC 214/2025" },
  { codigo: "040004", descricao: "Transporte coletivo urbano de passageiros", cst: "040", reducao: "30%", setor: "Transporte", baseLegal: "Art. 129 LC 214/2025" },
  { codigo: "040005", descricao: "Transporte coletivo intermunicipal", cst: "040", reducao: "30%", setor: "Transporte", baseLegal: "Art. 129 LC 214/2025" },
  { codigo: "050001", descricao: "Cesta básica — alimentos básicos (arroz, feijão, farinha)", cst: "050", reducao: "60%", setor: "Alimentação", baseLegal: "Art. 125 §1º LC 214/2025" },
  { codigo: "050002", descricao: "Cesta básica — carnes e proteínas básicas", cst: "050", reducao: "60%", setor: "Alimentação", baseLegal: "Art. 125 §1º LC 214/2025" },
  { codigo: "050003", descricao: "Medicamentos — lista essencial (RENAME)", cst: "050", reducao: "60%", setor: "Medicamentos", baseLegal: "Art. 126 LC 214/2025" },
  { codigo: "050004", descricao: "Higiene pessoal — produtos listados em decreto", cst: "050", reducao: "60%", setor: "Higiene", baseLegal: "Decreto regulamentador" },
  { codigo: "060001", descricao: "Agropecuário — produtos in natura (animal/vegetal)", cst: "060", reducao: "100%", setor: "Agronegócio", baseLegal: "Art. 124 LC 214/2025" },
  { codigo: "060002", descricao: "Agropecuário — insumos agrícolas", cst: "060", reducao: "100%", setor: "Agronegócio", baseLegal: "Art. 124 LC 214/2025" },
  { codigo: "060003", descricao: "Pesca — produtos pesqueiros in natura", cst: "060", reducao: "100%", setor: "Agronegócio/Pesca", baseLegal: "Art. 124 LC 214/2025" },
  { codigo: "070001", descricao: "Diferimento total — transferência entre estabelecimentos", cst: "070", reducao: "100% (diferido)", setor: "Indústria/Comércio", baseLegal: "Art. 34 LC 214/2025" },
  { codigo: "090001", descricao: "Isenção — exportação de serviços ao exterior", cst: "090", reducao: "100% (isento)", setor: "Exportação", baseLegal: "Art. 8º LC 214/2025" },
  { codigo: "100001", descricao: "Imunidade — livros, jornais e periódicos", cst: "100", reducao: "Imunidade const.", setor: "Cultura/Publicações", baseLegal: "EC 132/2023 + CF/88" },
  { codigo: "100002", descricao: "Imunidade — templos de qualquer culto", cst: "100", reducao: "Imunidade const.", setor: "Religioso", baseLegal: "EC 132/2023 + CF/88" },
];

// ─── cIndOp ───────────────────────────────────────────────────────────────────

const C_IND_OP = [
  {
    valor: "1",
    nome: "Operação Onerosa",
    descricao: "Operação realizada mediante contraprestação financeira — o destinatário paga pelo bem ou serviço.",
    exemplos: ["Venda de mercadorias", "Prestação de serviços remunerada", "Locação paga"],
    credito: "Gera crédito de IBS/CBS para o adquirente em operações B2B.",
    cor: "emerald" as const,
  },
  {
    valor: "0",
    nome: "Operação Não Onerosa",
    descricao: "Operação sem contraprestação financeira — bonificação, brinde, doação ou amostra grátis.",
    exemplos: ["Bonificação em mercadoria", "Brinde ao cliente", "Amostra grátis", "Doação"],
    credito: "Não gera crédito de IBS/CBS para o destinatário (ausência de pagamento).",
    cor: "amber" as const,
  },
];

// ─── NBS ──────────────────────────────────────────────────────────────────────

interface NbsEntry {
  codigo: string;
  descricao: string;
  setor: string;
  correlacaoLc116?: string;
  observacao?: string;
}

const NBS_CODIGOS: NbsEntry[] = [
  { codigo: "1.01.01.10", descricao: "Construção civil de edifícios residenciais", setor: "Construção Civil", correlacaoLc116: "7.02" },
  { codigo: "1.01.01.20", descricao: "Construção civil de obras de infraestrutura", setor: "Construção Civil", correlacaoLc116: "7.02" },
  { codigo: "1.02.01.00", descricao: "Serviços de demolição", setor: "Construção Civil", correlacaoLc116: "7.04" },
  { codigo: "1.03.01.10", descricao: "Limpeza e conservação de prédios e imóveis", setor: "Limpeza/Conservação", correlacaoLc116: "7.10" },
  { codigo: "1.05.01.10", descricao: "Saúde humana — consultas médicas", setor: "Saúde", correlacaoLc116: "4.01", observacao: "CST 040 — redução 30%" },
  { codigo: "1.05.01.20", descricao: "Serviços hospitalares e ambulatoriais", setor: "Saúde", correlacaoLc116: "4.02", observacao: "CST 040 — redução 30%" },
  { codigo: "1.05.01.30", descricao: "Diagnóstico por imagem e laboratorial", setor: "Saúde", correlacaoLc116: "4.02", observacao: "CST 040 — redução 30%" },
  { codigo: "1.05.02.10", descricao: "Planos de saúde — administração de benefícios", setor: "Saúde", correlacaoLc116: "4.22", observacao: "CST 040 — redução 30%" },
  { codigo: "1.06.01.10", descricao: "Educação — ensino fundamental e médio", setor: "Educação", correlacaoLc116: "8.01", observacao: "CST 040 — redução 30%" },
  { codigo: "1.06.01.20", descricao: "Educação — ensino superior", setor: "Educação", correlacaoLc116: "8.02", observacao: "CST 040 — redução 30%" },
  { codigo: "1.06.01.30", descricao: "Serviços de educação infantil", setor: "Educação", correlacaoLc116: "8.01", observacao: "CST 040 — redução 30%" },
  { codigo: "1.07.01.10", descricao: "Transporte coletivo urbano de passageiros", setor: "Transporte", correlacaoLc116: "16.01", observacao: "CST 040 — redução 30%" },
  { codigo: "1.07.01.20", descricao: "Transporte intermunicipal/interestadual de passageiros", setor: "Transporte", correlacaoLc116: "16.01", observacao: "CST 040 — redução 30%" },
  { codigo: "1.07.02.10", descricao: "Transporte de cargas — rodoviário", setor: "Transporte", correlacaoLc116: "16.01" },
  { codigo: "1.07.02.20", descricao: "Transporte de cargas — ferroviário", setor: "Transporte", correlacaoLc116: "16.01" },
  { codigo: "1.08.01.10", descricao: "Serviços financeiros — intermediação de crédito", setor: "Financeiro", correlacaoLc116: "15.01", observacao: "Regime específico LC 214/2025" },
  { codigo: "1.08.01.20", descricao: "Serviços financeiros — gestão de fundos e carteiras", setor: "Financeiro", correlacaoLc116: "15.14", observacao: "Regime específico LC 214/2025" },
  { codigo: "1.09.01.10", descricao: "TI — desenvolvimento de software", setor: "TI/Tecnologia", correlacaoLc116: "1.07" },
  { codigo: "1.09.01.20", descricao: "TI — suporte e manutenção de sistemas", setor: "TI/Tecnologia", correlacaoLc116: "1.07" },
  { codigo: "1.09.01.30", descricao: "Hospedagem de dados (hosting/cloud)", setor: "TI/Tecnologia", correlacaoLc116: "1.03" },
  { codigo: "1.10.01.10", descricao: "Serviços advocatícios e jurídicos", setor: "Jurídico", correlacaoLc116: "17.14" },
  { codigo: "1.10.01.20", descricao: "Serviços de contabilidade e auditoria", setor: "Contabilidade", correlacaoLc116: "17.20" },
  { codigo: "1.10.01.30", descricao: "Consultoria empresarial e tributária", setor: "Consultoria", correlacaoLc116: "17.20" },
  { codigo: "1.11.01.10", descricao: "Publicidade e propaganda", setor: "Publicidade", correlacaoLc116: "17.06" },
  { codigo: "1.11.01.20", descricao: "Pesquisa de mercado", setor: "Publicidade/Marketing", correlacaoLc116: "17.07" },
  { codigo: "1.12.01.10", descricao: "Locação de imóveis urbanos", setor: "Imobiliário", correlacaoLc116: "3.01", observacao: "Verificar incidência IBS municipal" },
  { codigo: "1.13.01.10", descricao: "Segurança privada — vigilância", setor: "Segurança", correlacaoLc116: "11.02" },
  { codigo: "1.14.01.10", descricao: "Serviços culturais — shows e espetáculos", setor: "Cultura/Entretenimento", correlacaoLc116: "12.01" },
  { codigo: "1.15.01.10", descricao: "Alimentação — restaurantes e bares", setor: "Alimentação", correlacaoLc116: "9.01" },
  { codigo: "1.16.01.10", descricao: "Hotelaria e hospedagem", setor: "Hotelaria", correlacaoLc116: "9.01" },
];

// ─── Utilitários ──────────────────────────────────────────────────────────────

const TIPO_CFG: Record<CstEntry["tipo"], { label: string; color: string }> = {
  integral:    { label: "Integral",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  reduzida:    { label: "Reduzida",    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  zero:        { label: "Alíq. Zero",  color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  isencao:     { label: "Isenção",     color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  imunidade:   { label: "Imunidade",   color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  diferimento: { label: "Diferimento", color: "bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-300" },
};

function CopyBtn({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copiado!", duration: 1200 }); }}
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function AnalisteFiscal() {
  const [busca, setBusca] = useState("");
  const [tabAtiva, setTabAtiva] = useState("cst");

  const q = busca.toLowerCase().trim();

  const cstFiltrado = useMemo(() =>
    !q ? CST_IBS_CBS : CST_IBS_CBS.filter(c =>
      c.codigo.includes(q) || c.descricao.toLowerCase().includes(q) ||
      c.detalhe.toLowerCase().includes(q) || (c.exemplos || []).some(e => e.toLowerCase().includes(q))
    ), [q]);

  const classTribFiltrado = useMemo(() =>
    !q ? C_CLASS_TRIB : C_CLASS_TRIB.filter(c =>
      c.codigo.includes(q) || c.descricao.toLowerCase().includes(q) ||
      c.setor.toLowerCase().includes(q) || c.cst.includes(q)
    ), [q]);

  const nbsFiltrado = useMemo(() =>
    !q ? NBS_CODIGOS : NBS_CODIGOS.filter(n =>
      n.codigo.includes(q) || n.descricao.toLowerCase().includes(q) ||
      n.setor.toLowerCase().includes(q) || (n.correlacaoLc116 || "").includes(q)
    ), [q]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-semibold">Analista Fiscal — Novos Códigos 2026</h1>
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] px-2">LC 214/2025</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Sistema de consulta dos novos códigos fiscais da Reforma Tributária: CST IBS/CBS, cClassTrib, cIndOp e NBS (Nomenclatura Brasileira de Serviços).
        </p>
      </div>

      {/* Alerta NT 1.33 */}
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs ml-2">
          <strong>Vigência 01/01/2026 (NT NF-e 1.33):</strong> campos obrigatórios por lei no XML das NF-e, NFS-e e NFC-e — mesmo com validação técnica suspensa. Preenchimento incorreto anula a dispensa de recolhimento do IBS/CBS (Art. 348, LC 214/2025).
        </AlertDescription>
      </Alert>

      {/* Busca global */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar código, descrição, setor, correlação LC 116..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="cst" className="text-xs gap-1.5">
            <Hash className="h-3.5 w-3.5" /> CST IBS/CBS
            <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{cstFiltrado.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="classtrib" className="text-xs gap-1.5">
            <Layers className="h-3.5 w-3.5" /> cClassTrib
            <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{classTribFiltrado.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="cindop" className="text-xs gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" /> cIndOp
          </TabsTrigger>
          <TabsTrigger value="nbs" className="text-xs gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> NBS Serviços
            <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{nbsFiltrado.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ── CST IBS/CBS ────────────────────────────────────────────────────── */}
        <TabsContent value="cst" className="mt-4 space-y-3">
          {cstFiltrado.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum CST encontrado para "{busca}"</p>
          ) : (
            cstFiltrado.map(cst => {
              const cfg = TIPO_CFG[cst.tipo];
              return (
                <Card key={cst.codigo} className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 text-center">
                        <div className="font-mono font-black text-2xl text-primary leading-none">{cst.codigo}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">CST</div>
                        <CopyBtn text={cst.codigo} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm">{cst.descricao}</span>
                          <Badge className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>{cfg.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{cst.detalhe}</p>
                        {cst.exemplos && (
                          <div className="flex flex-wrap gap-1">
                            {cst.exemplos.map((ex, i) => (
                              <span key={i} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{ex}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="py-3 px-4 flex gap-2 text-xs text-blue-800 dark:text-blue-200">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
              <span>
                <strong>Como usar o CST:</strong> sempre em conjunto com o <strong>cClassTrib</strong> (6 dígitos). Os 3 primeiros dígitos do cClassTrib derivam do CST.
                Não faça de-para direto do CST do PIS/COFINS — as tributações podem divergir. Tabela completa: <strong>consumo.tributos.gov.br</strong>.
              </span>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── cClassTrib ──────────────────────────────────────────────────────── */}
        <TabsContent value="classtrib" className="mt-4">
          <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800 text-xs text-purple-800 dark:text-purple-200 flex gap-2">
            <Layers className="h-4 w-4 shrink-0 mt-0.5 text-purple-500" />
            <span>
              <strong>Estrutura do cClassTrib:</strong> 6 dígitos. Primeiros 3 correspondem ao CST; últimos 3 detalham o produto/operação.
              Exemplo: <code className="bg-purple-100 dark:bg-purple-900/40 px-1 rounded font-mono">050001</code> = CST 050 (redução 60%) + cesta básica.
              <strong> Um mesmo NCM pode ter múltiplos cClassTribs</strong> — analisar sempre a descrição do produto.
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">cClassTrib</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Descrição</th>
                  <th className="text-left px-3 py-2.5 font-semibold hidden sm:table-cell">CST</th>
                  <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Redução</th>
                  <th className="text-left px-3 py-2.5 font-semibold hidden lg:table-cell">Setor</th>
                  <th className="text-left px-3 py-2.5 font-semibold hidden xl:table-cell">Base Legal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {classTribFiltrado.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhum cClassTrib encontrado para "{busca}"</td></tr>
                ) : (
                  classTribFiltrado.map(c => (
                    <tr key={c.codigo} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-primary text-sm">{c.codigo}</span>
                          <CopyBtn text={c.codigo} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-medium">{c.descricao}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded font-semibold">{c.cst}</span>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">{c.reducao}</td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{c.setor}</span>
                      </td>
                      <td className="px-3 py-2.5 hidden xl:table-cell text-muted-foreground">{c.baseLegal}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Tabela parcial de referência — lista completa disponível no Anexo VIII da IN (correlação LC 116/2003 → NBS/cClassTrib) em <strong>consumo.tributos.gov.br</strong>.
          </p>
        </TabsContent>

        {/* ── cIndOp ──────────────────────────────────────────────────────────── */}
        <TabsContent value="cindop" className="mt-4 space-y-4">
          <Card className="border-slate-200 bg-slate-50/50 dark:bg-slate-950/20">
            <CardContent className="py-3 px-4 flex gap-2 text-xs text-slate-700 dark:text-slate-300">
              <Tag className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>cIndOp (Indicador de Operação):</strong> Novo campo da LC 214/2025 e NT NF-e 1.33. Distingue operações onerosas (com pagamento) de não onerosas (bonificações, brindes, amostras).
                Crítico para determinar se há geração de crédito de IBS/CBS para o destinatário.
              </span>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {C_IND_OP.map(op => (
              <Card key={op.valor} className={
                op.cor === "emerald"
                  ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20"
              }>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-mono font-black text-xl border-2 ${
                      op.cor === "emerald"
                        ? "border-emerald-400 text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "border-amber-400 text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300"
                    }`}>
                      {op.valor}
                    </div>
                    <div>
                      <div className="font-semibold">{op.nome}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">cIndOp = {op.valor}</div>
                    </div>
                    <CopyBtn text={op.valor} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <p className="text-xs text-muted-foreground">{op.descricao}</p>
                  <Separator />
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Exemplos</p>
                    <div className="flex flex-wrap gap-1">
                      {op.exemplos.map((ex, i) => (
                        <span key={i} className="text-[11px] bg-background border rounded px-2 py-0.5">{ex}</span>
                      ))}
                    </div>
                  </div>
                  <div className={`rounded-lg p-2.5 text-xs ${
                    op.cor === "emerald"
                      ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200"
                      : "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200"
                  }`}>
                    <strong>Impacto no crédito:</strong> {op.credito}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-primary" />
                Combinações Práticas: CFOP × cIndOp
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">CFOP</th>
                      <th className="text-left px-3 py-2 font-semibold">Operação</th>
                      <th className="text-left px-3 py-2 font-semibold">cIndOp</th>
                      <th className="text-left px-3 py-2 font-semibold">Gera Crédito?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { cfop: "5102", operacao: "Venda de mercadoria", cindop: "1", credito: "Sim (B2B)" },
                      { cfop: "5910", operacao: "Bonificação / Brinde", cindop: "0", credito: "Não" },
                      { cfop: "5911", operacao: "Amostra grátis", cindop: "0", credito: "Não" },
                      { cfop: "6102", operacao: "Venda outro estado", cindop: "1", credito: "Sim (B2B)" },
                      { cfop: "7102", operacao: "Exportação", cindop: "1", credito: "Isenção — CST 090" },
                      { cfop: "1102", operacao: "Compra de mercadoria", cindop: "1", credito: "Crédito de entrada" },
                    ].map(r => (
                      <tr key={r.cfop + r.operacao} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono font-semibold text-primary">{r.cfop}</td>
                        <td className="px-3 py-2">{r.operacao}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            r.cindop === "1" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}>{r.cindop}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.credito}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NBS ─────────────────────────────────────────────────────────────── */}
        <TabsContent value="nbs" className="mt-4">
          <Card className="mb-4 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="py-3 px-4 flex gap-2 text-xs text-blue-800 dark:text-blue-200">
              <BookOpen className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
              <span>
                <strong>NBS — Nomenclatura Brasileira de Serviços:</strong> Substitui os códigos variáveis das NFS-e municipais, padronizando a classificação de serviços em todo o Brasil — o "RG do serviço".
                Correlacionado ao Anexo VIII com os subitens da LC 116/2003. Para NFS-e: combine NBS + cIndOp + cClassTrib.
                Homologação: <strong>consumo.tributos.gov.br</strong>
              </span>
            </CardContent>
          </Card>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">Código NBS</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Descrição</th>
                  <th className="text-left px-3 py-2.5 font-semibold hidden sm:table-cell">Setor</th>
                  <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Correlação LC 116</th>
                  <th className="text-left px-3 py-2.5 font-semibold hidden lg:table-cell">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nbsFiltrado.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nenhum código NBS encontrado para "{busca}"</td></tr>
                ) : (
                  nbsFiltrado.map(n => (
                    <tr key={n.codigo} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-primary">{n.codigo}</span>
                          <CopyBtn text={n.codigo} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-medium">{n.descricao}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px]">{n.setor}</span>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        {n.correlacaoLc116
                          ? <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{n.correlacaoLc116}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        {n.observacao ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            n.observacao.includes("30%") ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : n.observacao.includes("Regime")? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-muted text-muted-foreground"
                          }`}>{n.observacao}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Lista parcial de referência — tabela completa no Anexo VIII da IN RFB. Suporte: <strong>atendimento.nfs-e@rfb.gov.br</strong>
          </p>
        </TabsContent>
      </Tabs>

      {/* Rodapé */}
      <Card className="border-dashed">
        <CardContent className="py-3 px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Homologação</p>
                <p className="text-muted-foreground">Ambiente de testes: <strong>consumo.tributos.gov.br</strong></p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Período Educativo 2026</p>
                <p className="text-muted-foreground">Penalidades suspensas até o 1º dia do 4º mês após publicação do regulamento final</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ExternalLink className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Suporte NFS-e</p>
                <p className="text-muted-foreground">atendimento.nfs-e@rfb.gov.br · Simples Nacional: inclusão prevista em 2027</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

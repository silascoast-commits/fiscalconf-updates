import { useState } from "react";
import { useCliente } from "@/contexts/ClienteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MapPin, AlertTriangle, CheckCircle2, Clock, ArrowRight,
  Zap, TrendingDown, BarChart3, ChevronDown, ChevronUp,
  Calendar, Info, Target
} from "lucide-react";

// ─── DADOS DAS 4 FASES ────────────────────────────────────────────────────────

const FASES = [
  {
    fase: 1,
    label: "FASE 1 · TESTE",
    periodo: "2026",
    cor: "amber",
    bgCard: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
    bgBadge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    bgLine: "bg-amber-400",
    titulo: "Ano de Ensaio",
    resumo: "Alíquotas simbólicas. CBS 0,9% + IBS 0,1% apenas informativos na NF-e. Impacto zero no caixa, mas obrigação nova no sistema.",
    tipo: "ANO DE PREPARAÇÃO",
  },
  {
    fase: 2,
    label: "FASE 2 · ENTRADA CBS",
    periodo: "2027 – 2028",
    cor: "blue",
    bgCard: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
    bgBadge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    bgLine: "bg-blue-500",
    titulo: "CBS Entra Pra Valer",
    resumo: "PIS e Cofins extintos. CBS ~8,8% vigente. Split Payment operacional. Imposto Seletivo começa. IBS ainda em 0,1%.",
    tipo: "MARCO OPERACIONAL",
  },
  {
    fase: 3,
    label: "FASE 3 · COEXISTÊNCIA",
    periodo: "2029 – 2032",
    cor: "orange",
    bgCard: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800",
    bgBadge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    bgLine: "bg-orange-500",
    titulo: "Dois Sistemas Simultâneos",
    resumo: "ICMS e ISS reduzidos 10% ao ano. IBS sobe no mesmo ritmo. Empresa contabiliza dois sistemas ao mesmo tempo.",
    tipo: "ANO CRÍTICO DE DECISÃO",
  },
  {
    fase: 4,
    label: "FASE 4 · CONSOLIDAÇÃO",
    periodo: "2033",
    cor: "red",
    bgCard: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
    bgBadge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    bgLine: "bg-red-500",
    titulo: "Fim do ICMS e ISS",
    resumo: "ICMS e ISS extintos. Sistema 100% IBS + CBS + Imposto Seletivo. Novo ciclo de planejamento começa.",
    tipo: "MARCO FINAL",
  },
];

// ─── LINHA DO TEMPO DETALHADA ─────────────────────────────────────────────────

const ANOS: {
  ano: number;
  fase: number;
  tag: string;
  tagColor: string;
  headline: string;
  descricao: string;
  ibs: string;
  cbs: string;
  icmsIss: string;
  critico: boolean;
  acaoContador: string;
  bullets: string[];
}[] = [
  {
    ano: 2026,
    fase: 1,
    tag: "INÍCIO",
    tagColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    headline: "CBS a 0,9% e IBS a 0,1% — apenas para testar o sistema.",
    descricao: "Empresas começam a emitir notas já destacando CBS e IBS em alíquotas simbólicas. O valor pode ser compensado contra PIS/Cofins: impacto zero no caixa, mas obrigação nova no sistema. cClassTrib obrigatório no XML.",
    ibs: "0,1%",
    cbs: "0,9%",
    icmsIss: "100%",
    critico: true,
    acaoContador: "Reconfigurar ERP, validar XML, preencher cClassTrib e CST IBS/CBS, treinar equipe e clientes.",
    bullets: [
      "CBS 0,9% e IBS 0,1% informativos — sem recolhimento efetivo para Lucro Presumido e Real",
      "Simples Nacional: IBS/CBS NÃO destacado em 2026 (Art. 348 LC 214/2025)",
      "NT 1.33: validação técnica suspensa, mas obrigatoriedade legal permanece",
      "PIS, COFINS, ICMS e ISS seguem normalmente",
      "Novos campos: cClassTrib + CST IBS/CBS obrigatórios no XML",
    ],
  },
  {
    ano: 2027,
    fase: 2,
    tag: "MARCO CRÍTICO",
    tagColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    headline: "PIS e Cofins extintos. CBS assume na alíquota cheia.",
    descricao: "O ano mais impactante da transição. CBS entra na alíquota cheia (~8,8%). Split Payment vira operacional — imposto retido na fonte no ato do pagamento. Imposto Seletivo começa nos setores específicos.",
    ibs: "0,1%",
    cbs: "~8,8%",
    icmsIss: "100%",
    critico: true,
    acaoContador: "Revisar fluxo de caixa, precificação, contratos e prazos. Ano de venda de consultoria.",
    bullets: [
      "PIS e COFINS extintos definitivamente",
      "CBS ~8,8% — alíquota de referência (sujeita a regulamentação)",
      "IPI zerado exceto Zona Franca de Manaus",
      "Imposto Seletivo (bebidas alcoólicas, cigarros, veículos, etc.)",
      "Split Payment ativado — imposto retido no ato do pagamento pelo banco/adquirente",
      "ICMS e ISS ainda 100% vigentes",
      "Simples Nacional passa a destacar IBS/CBS a partir deste ano",
    ],
  },
  {
    ano: 2028,
    fase: 2,
    tag: "MONITORAMENTO",
    tagColor: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    headline: "Ano de calibragem do novo sistema.",
    descricao: "Governo avalia arrecadação de CBS e calibra alíquotas. ICMS e ISS ainda permanecem integrais. Empresas começam a acumular créditos de CBS.",
    ibs: "0,1%",
    cbs: "~8,8%",
    icmsIss: "100%",
    critico: false,
    acaoContador: "Otimizar aproveitamento de créditos de CBS. Estruturar controles de não-cumulatividade plena.",
    bullets: [
      "CBS operando em regime pleno — acúmulo de créditos",
      "IBS ainda em 0,1% (preparatório)",
      "ICMS e ISS seguem integralmente",
      "Governo pode ajustar alíquota CBS com base na arrecadação real",
    ],
  },
  {
    ano: 2029,
    fase: 3,
    tag: "VIRADA",
    tagColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    headline: "ICMS e ISS começam a cair. IBS começa a subir.",
    descricao: "Começa a substituição gradual. ICMS e ISS são reduzidos a 90% da alíquota original. IBS sobe para ~10% do pleno. Empresas passam a operar dois sistemas ao mesmo tempo.",
    ibs: "1,77%",
    cbs: "8,8%",
    icmsIss: "90%",
    critico: false,
    acaoContador: "Operar sistema duplo. Retificar memórias de cálculo. Revisar apurações mensais.",
    bullets: [
      "ICMS e ISS: 90% da alíquota original",
      "IBS: ~10% do pleno (1,77%)",
      "CBS: plena",
      "Sistema duplo ICMS/ISS + IBS/CBS simultaneamente",
    ],
  },
  {
    ano: 2030,
    fase: 3,
    tag: "TRANSIÇÃO LINEAR",
    tagColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    headline: "ICMS e ISS a 80%. IBS a 20%.",
    descricao: "Redução linear segue. A cada ano ICMS/ISS caem 10% e IBS sobe 10%. Empresas precisam manter controle apurado para não errar em nenhum dos dois sistemas.",
    ibs: "3,54%",
    cbs: "8,8%",
    icmsIss: "80%",
    critico: false,
    acaoContador: "Auditar memórias de cálculo. Revisar preço de venda considerando transição.",
    bullets: [
      "ICMS e ISS: 80% da alíquota original",
      "IBS: ~20% do pleno (3,54%)",
      "Dois sistemas em operação simultânea",
    ],
  },
  {
    ano: 2031,
    fase: 3,
    tag: "REVISÃO ESTRATÉGICA",
    tagColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    headline: "Meio do caminho — ICMS/ISS a 70%, IBS a 30%.",
    descricao: "Ponto de revisão de planejamento tributário. Empresas que adiaram decisões começam a sentir. Boa hora para reavaliar regime tributário, estrutura societária e localização geográfica.",
    ibs: "5,31%",
    cbs: "8,8%",
    icmsIss: "70%",
    critico: false,
    acaoContador: "Revisão ampla de planejamento tributário. Avaliar estrutura societária e localização geográfica.",
    bullets: [
      "ICMS e ISS: 70% da alíquota original",
      "IBS: ~30% do pleno (5,31%)",
      "Momento estratégico: reavaliação de regime, estrutura e geografia",
    ],
  },
  {
    ano: 2032,
    fase: 3,
    tag: "PREPARAÇÃO FINAL",
    tagColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    headline: "ICMS/ISS a 60%. IBS a 40%. Último ano completo com os velhos impostos.",
    descricao: "Último ano completo com ICMS e ISS vivos. Todas as preparações para 2033 precisam estar concluídas: sistemas, contratos, precificação, fluxo de caixa.",
    ibs: "7,08%",
    cbs: "8,8%",
    icmsIss: "60%",
    critico: false,
    acaoContador: "Checklist final de adaptação. Auditoria de todos os créditos acumulados.",
    bullets: [
      "ICMS e ISS: 60% da alíquota original",
      "IBS: ~40% do pleno (7,08%)",
      "Prazo final para preparação total do sistema para 2033",
    ],
  },
  {
    ano: 2033,
    fase: 4,
    tag: "MARCO FINAL",
    tagColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    headline: "Fim do ICMS e do ISS. Novo sistema 100% ativo.",
    descricao: "ICMS e ISS são oficialmente extintos. O Brasil passa a operar com um sistema único de tributação do consumo: CBS + IBS + Imposto Seletivo.",
    ibs: "17,7%",
    cbs: "8,8%",
    icmsIss: "EXTINTOS",
    critico: true,
    acaoContador: "Encerramento de créditos residuais. Abrir novo ciclo de planejamento tributário 100% IBS+CBS+IS.",
    bullets: [
      "ICMS e ISS extintos oficialmente",
      "IBS: alíquota plena (~17,7%)",
      "CBS: alíquota plena (~8,8%)",
      "Imposto Seletivo plenamente vigente",
      "Sistema único de tributação do consumo no Brasil",
    ],
  },
];

// ─── HELPER ───────────────────────────────────────────────────────────────────

function FaseBadge({ fase }: { fase: number }) {
  const f = FASES.find(f => f.fase === fase)!;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${f.bgBadge}`}>{f.label}</span>;
}

// ─── COMPONENTE CARD ANO ──────────────────────────────────────────────────────

function CardAno({ item, defaultOpen }: { item: typeof ANOS[0]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const fase = FASES.find(f => f.fase === item.fase)!;
  const isCurrent = item.ano === 2026;

  return (
    <div className={`rounded-xl border-2 transition-all ${fase.bgCard} ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}>
      {/* Header clicável */}
      <button
        className="w-full text-left p-4 flex items-start gap-4"
        onClick={() => setOpen(v => !v)}
      >
        {/* Ano */}
        <div className="flex flex-col items-center shrink-0 w-14">
          <span className={`text-3xl font-black leading-none ${item.critico ? "text-primary" : "text-muted-foreground"}`}>
            {item.ano}
          </span>
          {item.critico && (
            <span className="text-[9px] font-bold text-primary mt-0.5">CRÍTICO</span>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <FaseBadge fase={item.fase} />
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.tagColor}`}>{item.tag}</span>
            {isCurrent && (
              <Badge className="text-[9px] px-1.5 py-0 bg-primary text-primary-foreground">VOCÊ ESTÁ AQUI</Badge>
            )}
          </div>
          <p className="text-sm font-semibold leading-snug">{item.headline}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="font-mono">IBS <strong className="text-foreground">{item.ibs}</strong></span>
            <span className="font-mono">CBS <strong className="text-foreground">{item.cbs}</strong></span>
            <span className="font-mono">ICMS/ISS <strong className={item.icmsIss === "EXTINTOS" ? "text-red-500" : "text-foreground"}>{item.icmsIss}</strong></span>
          </div>
        </div>

        {/* Toggle */}
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expansão */}
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <Separator />
          <p className="text-sm text-muted-foreground">{item.descricao}</p>
          <ul className="space-y-1">
            {item.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
            <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-primary mb-0.5">AÇÃO DO CONTADOR</p>
              <p className="text-xs text-foreground">{item.acaoContador}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function MapaTransicao() {
  const { clienteAtivo } = useCliente();
  const [vistaAtiva, setVistaAtiva] = useState<"linha" | "fases">("linha");

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Mapa Visual da Transição
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            8 anos · 4 fases · Linha do tempo completa 2026 → 2033 · EC 132/2023 + LC 214/2025
          </p>
        </div>
        {clienteAtivo && (
          <Badge variant="outline" className="text-xs px-3 py-1">
            {clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial} · {clienteAtivo.regime}
          </Badge>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Tributos substituídos", value: "5", sub: "PIS · COFINS · ICMS · ISS · IPI", icon: TrendingDown, color: "text-red-500" },
          { label: "Novos tributos", value: "3", sub: "CBS · IBS · Imposto Seletivo", icon: BarChart3, color: "text-blue-500" },
          { label: "Anos de transição", value: "8", sub: "2026 → 2033", icon: Clock, color: "text-primary" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-8 w-8 shrink-0 ${color}`} />
              <div>
                <div className="text-2xl font-black leading-none">{value}</div>
                <div className="text-xs font-semibold mt-0.5">{label}</div>
                <div className="text-[11px] text-muted-foreground">{sub}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerta anos críticos */}
      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Atenção estratégica — 3 anos mais críticos</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            <strong>2026 (preparação)</strong>, <strong>2027 (CBS + Split Payment)</strong> e <strong>2033 (consolidação)</strong>.
            Cliente despreparado sangra caixa. Contador preparado vende consultoria, retém base e justifica reajuste de honorários.
          </p>
        </div>
      </div>

      {/* Toggle de vista */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={vistaAtiva === "linha" ? "default" : "outline"}
          onClick={() => setVistaAtiva("linha")}
        >
          <Calendar className="h-4 w-4 mr-1.5" />
          Linha do Tempo (Ano a Ano)
        </Button>
        <Button
          size="sm"
          variant={vistaAtiva === "fases" ? "default" : "outline"}
          onClick={() => setVistaAtiva("fases")}
        >
          <BarChart3 className="h-4 w-4 mr-1.5" />
          Visão por Fases
        </Button>
      </div>

      {/* LINHA DO TEMPO */}
      {vistaAtiva === "linha" && (
        <div className="space-y-3">
          {ANOS.map((item) => (
            <CardAno key={item.ano} item={item} defaultOpen={item.ano === 2026} />
          ))}
        </div>
      )}

      {/* VISÃO POR FASES */}
      {vistaAtiva === "fases" && (
        <div className="space-y-4">
          {FASES.map((fase) => {
            const anosNaFase = ANOS.filter(a => a.fase === fase.fase);
            return (
              <Card key={fase.fase} className={`border-2 ${fase.bgCard}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-4xl font-black text-${fase.cor}-500 dark:text-${fase.cor}-400 leading-none`}>{fase.fase}</span>
                    <div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fase.bgBadge}`}>{fase.label}</span>
                      <CardTitle className="text-base mt-1">{fase.titulo} <span className="text-sm font-normal text-muted-foreground">— {fase.periodo}</span></CardTitle>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px]">{fase.tipo}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{fase.resumo}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {anosNaFase.map(a => (
                      <div key={a.ano} className="flex items-start gap-3 rounded-lg bg-background/60 p-3">
                        <span className={`text-xl font-black shrink-0 ${a.critico ? "text-primary" : "text-muted-foreground"}`}>{a.ano}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{a.headline}</p>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            <span>IBS <strong>{a.ibs}</strong></span>
                            <span>CBS <strong>{a.cbs}</strong></span>
                            <span>ICMS/ISS <strong>{a.icmsIss}</strong></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* O que o contador faz em cada fase */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            O que o contador faz em cada fase
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { num: 1, ano: "2026", titulo: "Teste", acao: "Atualize sistema emissor, preencha cClassTrib, treine clientes, revise contratos. Custo operacional, impacto zero no caixa." },
            { num: 2, ano: "2027", titulo: "CBS + Split", acao: "Rode simulações de caixa, renegocie prazos, reveja precificação. Ano de venda de consultoria." },
            { num: 3, ano: "2028", titulo: "Otimização", acao: "Mapeie créditos de CBS, estruture aproveitamento, audite apurações." },
            { num: 4, ano: "2029–2032", titulo: "Coexistência", acao: "Opere dois sistemas simultâneos. Revise planejamento tributário e estrutura societária em 2031." },
            { num: 5, ano: "2033", titulo: "Consolidação", acao: "Encerre créditos residuais. Abra novo ciclo de planejamento com sistema 100% IBS+CBS+IS." },
          ].map(({ num, ano, titulo, acao }) => (
            <div key={num} className="flex items-start gap-3">
              <div className="shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{num}</span>
              </div>
              <div>
                <span className="text-sm font-semibold">{ano} · {titulo}</span>
                <p className="text-xs text-muted-foreground">{acao}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pb-2">
        Base legal: EC 132/2023 · LC 214/2025 · Alíquotas de referência sujeitas a regulamentação complementar
      </p>
    </div>
  );
}

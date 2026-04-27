import { useState } from "react";
import { useCliente } from "@/contexts/ClienteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Copy, Check, Search, ChevronDown, ChevronUp,
  Lightbulb, MessageSquare, FileText, Settings, BarChart3,
  Zap, Users, Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type Bloco = "entendimento" | "impacto" | "comunicacao" | "operacional";

interface Prompt {
  id: number;
  num: string;
  titulo: string;
  quando: string;
  dica: string;
  bloco: Bloco;
  templateFn: (vars: TemplateVars) => string;
}

interface TemplateVars {
  nome: string;
  regime: string;
  anexo: string;
  cnpj: string;
  faturamento: string;
  atividade: string;
  cnae: string;   // campo futuro — vazio se não disponível
  setor: string;  // derivado de atividade
  uf: string;     // campo futuro — vazio se não disponível
}

// ─── BLOCOS ───────────────────────────────────────────────────────────────────

const BLOCOS: { id: Bloco; label: string; icon: React.ElementType; cor: string; badgeCor: string }[] = [
  {
    id: "entendimento",
    label: "A · Entendimento",
    icon: BookOpen,
    cor: "text-blue-600 dark:text-blue-400",
    badgeCor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  {
    id: "impacto",
    label: "B · Impacto",
    icon: BarChart3,
    cor: "text-orange-600 dark:text-orange-400",
    badgeCor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  {
    id: "comunicacao",
    label: "C · Comunicação",
    icon: MessageSquare,
    cor: "text-emerald-600 dark:text-emerald-400",
    badgeCor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  {
    id: "operacional",
    label: "D · Operacional",
    icon: Settings,
    cor: "text-purple-600 dark:text-purple-400",
    badgeCor: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
];

// ─── 15 PROMPTS ───────────────────────────────────────────────────────────────

const PROMPTS: Prompt[] = [
  // ── BLOCO A ─────────────────────────────────────────────
  {
    id: 1, num: "01", bloco: "entendimento",
    titulo: "CBS explicado em linguagem de cliente",
    quando: "Cliente pergunta \"o que é essa tal CBS?\"",
    dica: "Peça para adaptar a explicação ao setor do cliente (comércio, serviço, indústria).",
    templateFn: (v) => `Você é um contador experiente explicando a Reforma Tributária para um cliente leigo.

Explique o que é a CBS (Contribuição sobre Bens e Serviços) em no máximo 200 palavras, usando:
- Linguagem simples, sem jargão técnico
- Uma analogia do dia a dia
- Comparação com PIS e Cofins (que ela substitui)
- Como isso afeta o preço final dos produtos/serviços
${v.setor ? `- Adapte a explicação ao setor: ${v.setor}` : ""}

Formato: texto corrido, tom didático, como se fosse uma conversa no WhatsApp.`,
  },
  {
    id: 2, num: "02", bloco: "entendimento",
    titulo: "IBS vs ICMS e ISS — o que muda",
    quando: "Cliente quer entender a diferença dos impostos antigos e o novo",
    dica: "Peça a saída em formato Markdown para colar direto em relatórios.",
    templateFn: () => `Monte uma tabela comparativa entre:
- ICMS (estadual atual)
- ISS (municipal atual)
- IBS (novo imposto unificado da Reforma Tributária)

Colunas da tabela:
1. Quem recolhe
2. Alíquota média
3. Base de cálculo
4. Forma de apuração
5. Creditamento
6. Principais mudanças práticas para o contribuinte

Depois da tabela, escreva um parágrafo de 3 linhas resumindo a MAIOR mudança do ponto de vista prático.`,
  },
  {
    id: 3, num: "03", bloco: "entendimento",
    titulo: "Split Payment descomplicado",
    quando: "Cliente não entende como vai pagar imposto \"dividido\"",
    dica: "Guarde a resposta — serve como roteiro de reunião.",
    templateFn: () => `Explique o mecanismo de Split Payment da Reforma Tributária em 3 partes:

1. O QUE É: definição em 2 frases.
2. COMO FUNCIONA NA PRÁTICA: passo a passo de uma venda de R$ 1.000,00 com alíquota de 26,5%, mostrando exatamente para onde vai cada centavo e em que momento.
3. O QUE MUDA PARA O CLIENTE: impacto no fluxo de caixa e na rotina do financeiro da empresa.

Tom: didático, objetivo, como se estivesse explicando para um dono de empresa de médio porte que nunca ouviu falar disso.`,
  },
  {
    id: 4, num: "04", bloco: "entendimento",
    titulo: "Cronograma de transição 2026–2033",
    quando: "Cliente quer saber quando tudo isso começa de verdade",
    dica: "Transforme o resultado em infográfico no Canva para enviar aos clientes.",
    templateFn: () => `Monte um cronograma visual (em texto, formato de linha do tempo) da transição da Reforma Tributária, ano a ano, de 2026 até 2033.

Para cada ano, informe:
- Ano
- O que acontece (alíquotas de teste, extinção de tributos antigos, obrigações acessórias novas)
- Ação recomendada para o contador

Ao final, destaque os 3 anos mais críticos para a rotina do escritório contábil e explique por quê.`,
  },

  // ── BLOCO B ─────────────────────────────────────────────
  {
    id: 5, num: "05", bloco: "impacto",
    titulo: "Simulação de carga tributária comparativa",
    quando: "Cliente quer saber se vai pagar mais ou menos imposto",
    dica: "Use esse prompt como serviço pago — consultoria de impacto tributário.",
    templateFn: (v) => `Simule a carga tributária do meu cliente antes e depois da Reforma Tributária.

Dados do cliente:
- Nome: ${v.nome || "[NOME DA EMPRESA]"}
- Regime atual: ${v.regime || "[Simples Nacional / Lucro Presumido / Lucro Real]"}${v.anexo ? `\n- Anexo do Simples: ${v.anexo}` : ""}
- Atividade principal: ${v.atividade || "[descrever]"}${v.cnae ? ` | CNAE: ${v.cnae}` : ""}
- Setor: ${v.setor || "[Comércio / Serviço / Indústria]"}
- Faturamento anual (últimos 12 meses): ${v.faturamento || "R$ [valor]"}
- UF e município da sede: ${v.uf || "[cidade/UF]"}

Calcule:
1. Carga tributária ATUAL (PIS, Cofins, ICMS, ISS, IPI conforme aplicável)
2. Carga tributária com IBS + CBS na alíquota padrão de referência (26,5% combinado)
3. Diferença em R$ e em %
4. Recomendação estratégica: vale migrar de regime? adiar investimentos? antecipar compras?

Apresente em formato de relatório executivo de 1 página.`,
  },
  {
    id: 6, num: "06", bloco: "impacto",
    titulo: "Análise por setor de atuação",
    quando: "Cliente quer saber como o setor dele será afetado",
    dica: "Crie um relatório por setor e ofereça como brinde na captação.",
    templateFn: (v) => `Faça uma análise do impacto da Reforma Tributária no setor de ${v.setor || "[SETOR DO CLIENTE — ex: restaurantes, e-commerce, clínica médica, transportadora, agronegócio]"}.

Estruture a resposta em:
1. Cenário atual do setor (regime mais comum, carga típica)
2. O que muda com IBS + CBS
3. Regime diferenciado ou específico aplicável (se houver)
4. 3 oportunidades que a reforma abre para esse setor
5. 3 riscos ou cuidados que o contador deve alertar o cliente
6. Ação imediata recomendada (o que fazer nos próximos 90 dias)

Use dados da LC 214/2025 sempre que possível.`,
  },
  {
    id: 7, num: "07", bloco: "impacto",
    titulo: "Simples Nacional — aderir ao IBS/CBS?",
    quando: "Cliente no Simples precisa decidir se opta pelo regime regular do IBS/CBS",
    dica: "Esse é um dos prompts que mais gera receita de consultoria.",
    templateFn: (v) => `Analise se o meu cliente do Simples Nacional deve OPTAR pelo regime regular do IBS e CBS (fora do Simples) ou MANTER tudo dentro do Simples.

Dados:
- Nome: ${v.nome || "[NOME DA EMPRESA]"}
- Faturamento anual: ${v.faturamento || "R$ [valor]"}
- Anexo atual do Simples: ${v.anexo || "[I/II/III/IV/V]"}
- Perfil dos clientes: [pessoa física / empresas do Lucro Real / misto]
- % de vendas para empresas que aproveitam crédito: [%]

Responda:
1. Recomendação clara (OPTAR ou MANTER) com justificativa
2. Cálculo comparativo resumido
3. Riscos da escolha recomendada
4. Prazo e forma de formalizar a opção
5. Quando reavaliar essa decisão

Tom: consultivo, decisório, como um parecer técnico.`,
  },
  {
    id: 8, num: "08", bloco: "impacto",
    titulo: "Aproveitamento de créditos no Lucro Real",
    quando: "Cliente do Lucro Real quer maximizar créditos no período de transição",
    dica: "Transforme esse plano em proposta de consultoria recorrente.",
    templateFn: (v) => `Monte um plano de aproveitamento de créditos tributários para ${v.nome ? `a empresa ${v.nome}` : "um cliente"} do Lucro Real durante o período de transição da Reforma Tributária.

Considere:
- Saldos credores de PIS e Cofins ao final da transição
- Créditos de ICMS acumulados
- Novos créditos de IBS e CBS (regra de não-cumulatividade plena)
- Timing ideal de compras e investimentos

Entregue:
1. Estratégia geral em 5 linhas
2. 7 ações práticas numeradas, em ordem de prioridade
3. Erros comuns a evitar
4. Documentos que precisam ser organizados AGORA

Formato: plano de ação executivo.`,
  },

  // ── BLOCO C ─────────────────────────────────────────────
  {
    id: 9, num: "09", bloco: "comunicacao",
    titulo: "E-mail explicativo para clientes",
    quando: "Disparo em massa para a base do escritório",
    dica: "Peça 3 versões com tons diferentes (formal, próximo, urgente).",
    templateFn: (v) => `Escreva um e-mail do escritório de contabilidade para a base de clientes sobre a Reforma Tributária.

Requisitos:
- Assunto que gera abertura (máx. 50 caracteres)
- Saudação cordial e personalizável
- 3 parágrafos curtos:
  (1) o que está acontecendo
  (2) o que MUDA para a empresa do cliente
  (3) o que o escritório já está fazendo para proteger o cliente
- CTA claro: agendar reunião de 30 minutos
- Assinatura profissional
- Tom: seguro, técnico, humano — nunca alarmista

Tamanho total: 250 a 300 palavras.`,
  },
  {
    id: 10, num: "10", bloco: "comunicacao",
    titulo: "FAQ de dúvidas recorrentes",
    quando: "Criar material de apoio para enviar aos clientes",
    dica: "Esse FAQ pode virar lead magnet na sua captação.",
    templateFn: () => `Crie um FAQ com as 10 dúvidas mais comuns que empresários fazem ao contador sobre a Reforma Tributária.

Para cada dúvida:
- Pergunta na voz do cliente (coloquial)
- Resposta em até 4 linhas
- Linguagem simples, sem jargão
- Quando pertinente, incluir o "faça isso agora"

No final, adicione a frase: "Qualquer dúvida adicional, responda este material que um contador do nosso time retorna em até 1 dia útil."

Formato: lista numerada pronta para virar PDF.`,
  },
  {
    id: 11, num: "11", bloco: "comunicacao",
    titulo: "Post de LinkedIn posicionando autoridade",
    quando: "Publicar conteúdo que gere confiança e atraia clientes",
    dica: "Rode esse prompt 1x por semana com temas diferentes e alimente seu feed por meses.",
    templateFn: () => `Escreva um post de LinkedIn, em primeira pessoa, de um contador comentando UM ponto específico da Reforma Tributária: [tema escolhido — ex: Split Payment, cClassTrib, fim do PIS/Cofins, Simples Nacional híbrido].

Estrutura obrigatória:
- Linha 1: gancho que para o scroll (pergunta ou afirmação forte)
- Linhas 2–3: contexto do problema
- Linhas 4–7: a informação técnica simplificada
- Linhas 8–9: o que o empresário deve fazer
- Linha final: CTA suave (comentar ou enviar DM)

Regras:
- 150 a 180 palavras
- Parágrafos de no máximo 2 linhas
- Sem emojis em excesso (máximo 2)
- Tom: autoridade + proximidade`,
  },
  {
    id: 12, num: "12", bloco: "comunicacao",
    titulo: "Roteiro de reunião com o cliente",
    quando: "Cliente aceitou a reunião — você precisa conduzir com segurança",
    dica: "Use o mesmo prompt como base para oferecer consultoria paga de diagnóstico.",
    templateFn: (v) => `Monte um roteiro de reunião de 30 minutos entre o contador e o dono de uma empresa para alinhar os impactos da Reforma Tributária.

Dados do cliente:
- Nome: ${v.nome || "[NOME DA EMPRESA]"}
- Regime: ${v.regime || "[regime]"}
- Setor: ${v.setor || "[setor]"}
- Porte (faturamento): ${v.faturamento || "[faturamento]"}

Entregue:
1. Agenda minuto a minuto (0–30 min)
2. 5 perguntas-chave para fazer ao cliente
3. 3 pontos técnicos que o contador DEVE explicar
4. Encaminhamentos finais (próximos passos e prazos)
5. Modelo de ata resumida para enviar ao cliente após a reunião

Tom: executivo, direto, profissional.`,
  },

  // ── BLOCO D ─────────────────────────────────────────────
  {
    id: 13, num: "13", bloco: "operacional",
    titulo: "Ajustes no sistema emissor de NF-e",
    quando: "Chegou a hora de parametrizar o ERP do cliente",
    dica: "Esse checklist é ouro — cobre por projeto de adaptação.",
    templateFn: (v) => `Liste todos os ajustes que precisam ser feitos no sistema emissor de notas fiscais de ${v.nome ? `a empresa ${v.nome}` : "um cliente"} para se adequar ao IBS e à CBS.

Organize em:
1. CADASTROS (produtos, CFOP, NCM, CST, cClassTrib, cBenef, CEST)
2. PARÂMETROS FISCAIS (alíquotas, regimes, regras de crédito)
3. LAYOUT DA NOTA (novos campos obrigatórios — NT NF-e 1.33)
4. INTEGRAÇÕES (contas a pagar, contas a receber, contabilidade)
5. TESTES OBRIGATÓRIOS antes do go-live

Para cada item, indique:
- O que ajustar
- Prazo recomendado
- Risco se não for feito

Formato: checklist operacional pronto para executar.`,
  },
  {
    id: 14, num: "14", bloco: "operacional",
    titulo: "Revisão de cláusulas contratuais",
    quando: "Contratos antigos precisam de cláusula de reajuste tributário",
    dica: "Ofereça esse serviço em parceria com um advogado — divide honorários.",
    templateFn: () => `Aja como um contador trabalhando em conjunto com um advogado tributarista. Liste as cláusulas contratuais que empresas devem revisar por causa da Reforma Tributária.

Para cada cláusula:
- Nome da cláusula
- Por que precisa ser revisada
- Sugestão de nova redação (texto pronto para o advogado adaptar)
- Risco caso o contrato fique como está

Cubra no mínimo:
1. Cláusula de reajuste tributário (gross-up)
2. Cláusula de repasse de tributos
3. Cláusula de responsabilidade por Split Payment
4. Cláusula de renegociação em caso de mudança fiscal relevante
5. Cláusula de fornecimento continuado

Aviso final: recomende validação jurídica antes do uso.`,
  },
  {
    id: 15, num: "15", bloco: "operacional",
    titulo: "Checklist de adaptação do escritório",
    quando: "O SEU escritório precisa estar pronto antes de atender clientes",
    dica: "Esse é o único prompt que o contador usa em si mesmo. Priorize.",
    templateFn: () => `Monte um checklist de adaptação do ESCRITÓRIO DE CONTABILIDADE à Reforma Tributária (não do cliente — do próprio escritório).

Cubra:
1. CAPACITAÇÃO DA EQUIPE (o que estudar, em qual ordem)
2. ATUALIZAÇÃO DE SISTEMAS (ERPs, conciliadores, emissores)
3. REVISÃO DE PROCESSOS INTERNOS (fechamento, apuração, entrega de obrigações)
4. COMUNICAÇÃO COM A BASE DE CLIENTES (cronograma de avisos)
5. NOVOS SERVIÇOS QUE PODEM SER OFERECIDOS (consultoria, diagnóstico, adequação)
6. REVISÃO DE HONORÁRIOS (justificativa para reajuste)

Para cada item, adicione:
- Prazo ideal
- Responsável sugerido
- Entregável concreto

Formato: checklist executável em 90 dias.`,
  },
];

// ─── CARD DE PROMPT ───────────────────────────────────────────────────────────

function CardPrompt({ prompt, vars }: { prompt: Prompt; vars: TemplateVars }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const bloco = BLOCOS.find(b => b.id === prompt.bloco)!;

  const texto = prompt.templateFn(vars);

  function copiar() {
    navigator.clipboard.writeText(texto).then(() => {
      setCopied(true);
      toast({ title: `Prompt ${prompt.num} copiado!`, description: "Cole no Claude.ai e preencha os campos em [colchetes] se houver." });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border bg-card transition-all hover:border-primary/30">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-black text-primary">{prompt.num}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bloco.badgeCor}`}>
              {bloco.label}
            </span>
          </div>
          <p className="text-sm font-semibold">{prompt.titulo}</p>
          <p className="text-xs text-muted-foreground italic mt-0.5">{prompt.quando}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1"
            onClick={(e) => { e.stopPropagation(); copiar(); }}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <Separator />
          {/* Preview do prompt */}
          <div className="rounded-lg bg-muted/50 border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">PROMPT GERADO</span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={copiar}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-foreground max-h-60 overflow-y-auto">
              {texto}
            </pre>
          </div>
          {/* Dica */}
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2.5">
            <Lightbulb className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300"><strong>Dica:</strong> {prompt.dica}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function KitPrompts() {
  const { clienteAtivo } = useCliente();
  const [blocoAtivo, setBlocoAtivo] = useState<Bloco | "todos">("todos");
  const [busca, setBusca] = useState("");

  // Calcular faturamento anual total a partir dos 12 meses (JSON)
  const calcFaturamento = () => {
    if (!clienteAtivo?.faturamentoMeses) return "";
    try {
      const meses = JSON.parse(clienteAtivo.faturamentoMeses);
      const total = Object.values(meses).reduce((acc: number, v) => acc + (Number(v) || 0), 0);
      return total > 0 ? `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "";
    } catch { return ""; }
  };

  // Variáveis de template preenchidas com o cliente ativo
  const vars: TemplateVars = {
    nome: clienteAtivo?.nomeFantasia || clienteAtivo?.razaoSocial || "",
    regime: clienteAtivo?.regime === "simples" ? "Simples Nacional" : clienteAtivo?.regime === "presumido" ? "Lucro Presumido" : clienteAtivo?.regime === "real" ? "Lucro Real" : clienteAtivo?.regime || "",
    anexo: clienteAtivo?.anexo || "",
    cnpj: clienteAtivo?.cnpj || "",
    faturamento: calcFaturamento(),
    atividade: clienteAtivo?.atividade || "",
    cnae: "",
    setor: clienteAtivo?.atividade || "",
    uf: "",
  };

  const temCliente = !!clienteAtivo;

  const promptsFiltrados = PROMPTS.filter(p => {
    const matchBloco = blocoAtivo === "todos" || p.bloco === blocoAtivo;
    const matchBusca = !busca || p.titulo.toLowerCase().includes(busca.toLowerCase()) || p.quando.toLowerCase().includes(busca.toLowerCase());
    return matchBloco && matchBusca;
  });

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Kit de Prompts — Reforma Tributária
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            15 prompts prontos para o contador · Baseados na LC 214/2025 · Preenchimento automático com cliente ativo
          </p>
        </div>
        {clienteAtivo && (
          <Badge variant="outline" className="text-xs px-3 py-1">
            <Building2 className="h-3 w-3 mr-1.5" />
            {clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial} · {clienteAtivo.regime}
          </Badge>
        )}
      </div>

      {/* Banner cliente ativo / sem cliente */}
      {temCliente ? (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-3">
          <Zap className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Preenchimento automático ativo — {clienteAtivo!.nomeFantasia || clienteAtivo!.razaoSocial}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Os prompts já incluem nome, regime{vars.cnae ? ", CNAE" : ""}{vars.faturamento ? ", faturamento" : ""} e UF da empresa ativa. Copie e cole diretamente.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 flex items-center gap-3">
          <Users className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Selecione uma empresa no topo para preencher automaticamente nome, regime e dados do cliente nos prompts.
          </p>
        </div>
      )}

      {/* Busca e filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prompt..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={blocoAtivo === "todos" ? "default" : "outline"}
            onClick={() => setBlocoAtivo("todos")}
          >
            Todos (15)
          </Button>
          {BLOCOS.map(b => {
            const count = PROMPTS.filter(p => p.bloco === b.id).length;
            return (
              <Button
                key={b.id}
                size="sm"
                variant={blocoAtivo === b.id ? "default" : "outline"}
                onClick={() => setBlocoAtivo(b.id)}
              >
                <b.icon className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">{b.label.split(" · ")[1]}</span>
                <span className="sm:hidden">{b.label.split(" · ")[0]}</span>
                <span className="ml-1 text-[10px] opacity-70">({count})</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Instruções */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
              <div><strong>Selecione a empresa</strong> no topo — os dados são preenchidos automaticamente nos prompts.</div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
              <div><strong>Clique no prompt</strong> para ver o texto gerado e <strong>Copiar</strong> com um clique.</div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
              <div><strong>Cole no Claude.ai</strong> e preencha os campos em [colchetes] que ainda faltarem.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de prompts */}
      {promptsFiltrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum prompt encontrado para "{busca}"
        </div>
      ) : (
        <div className="space-y-2">
          {/* Separadores por bloco quando "todos" */}
          {blocoAtivo === "todos" ? (
            BLOCOS.map(bloco => {
              const prompts = promptsFiltrados.filter(p => p.bloco === bloco.id);
              if (!prompts.length) return null;
              return (
                <div key={bloco.id} className="space-y-2">
                  <div className="flex items-center gap-2 pt-2">
                    <bloco.icon className={`h-4 w-4 ${bloco.cor}`} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${bloco.cor}`}>
                      Bloco {bloco.label}
                    </span>
                    <Separator className="flex-1" />
                  </div>
                  {prompts.map(p => <CardPrompt key={p.id} prompt={p} vars={vars} />)}
                </div>
              );
            })
          ) : (
            promptsFiltrados.map(p => <CardPrompt key={p.id} prompt={p} vars={vars} />)
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pb-2">
        Prompts baseados na LC 214/2025 · Não substituem o julgamento profissional do contador habilitado
      </p>
    </div>
  );
}

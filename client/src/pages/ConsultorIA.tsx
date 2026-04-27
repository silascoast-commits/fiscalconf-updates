import { useState, useRef, useEffect } from "react";
import { useCliente } from "@/contexts/ClienteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  BotMessageSquare, Send, User, Sparkles, RefreshCw, BookOpen,
  ChevronRight, Lightbulb, AlertTriangle, CheckCircle2, Copy, Check,
  MessageSquare, FileText, BarChart3, ClipboardList
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Base de conhecimento ─────────────────────────────────────────────────────

const CONHECIMENTO_BASE = `
=== REFORMA TRIBUTÁRIA — BASE DE CONHECIMENTO COMPLETA ===

CRONOGRAMA DE TRANSIÇÃO (EC 132/2023 + LC 214/2025):
- 2026: CBS 0,9% + IBS 0,1% — MERAMENTE INFORMATIVOS nas NF-e. NÃO somam ao valor da nota. Não há recolhimento (Art. 348 LC 214/2025), MAS a informação é OBRIGATÓRIA no XML sob pena de autuação. Validação técnica suspensa (NT 1.33 da NF-e), mas obrigatoriedade legal permanece.
- 2027: CBS em vigor (alíquota cheia ~8,8%); extinção PIS/COFINS; IPI zerado (exceto ZFM)
- 2028: estrutura mantida
- 2029: IBS 1,77% | ICMS/ISS 90%
- 2030: IBS 3,54% | ICMS/ISS 80%
- 2031: IBS 5,31% | ICMS/ISS 70%
- 2032: IBS 7,08% | ICMS/ISS 60%
- 2033: IBS 17,7% pleno | extinção total ICMS e ISS

A NOVA CHAVE FISCAL — cClassTrib + CST + NCM (Nota Técnica NF-e 1.32/1.33):
- cClassTrib: código de 6 dígitos. Primeiros 3 ligados ao CST; últimos 3 = detalhamento/tipo da operação
- CST IBS/CBS: define regime geral, isenção, redução, diferimento, imunidade
- NCM: POR SI SÓ NÃO DETERMINA A TRIBUTAÇÃO — mesma NCM pode ter cClassTribs diferentes
- Exemplo crítico: NCM do sal pode ser: agropecuário + cesta básica + medicamentos = cClassTribs distintos
- A combinação CORRETA é condição essencial para dispensa do recolhimento (Art. 348)
- Informação incorreta = sujeição ao recolhimento normal + risco de autuação

SIMPLES NACIONAL EM 2026:
- IBS/CBS NÃO deve ser destacado na NF-e em 2026 para optantes do Simples Nacional
- cClassTrib e CST do IBS/CBS: campo deve constar no layout mas NÃO preenchido para SN em 2026
- Tributação para SN começa em 2027 (Art. 348 LC 214/2025)
- Exceções: SN com excesso de sublimite, MEI, tributação monofásica — regulamentação futura

NOTAS FISCAIS DE SERVIÇO (NFS-e):
- IBS na NFS-e: meramente informativo em 2026 (alíquota 0,1%)
- NFS-e migrará para padrão nacional; prefeituras poderão aderir ao layout nacional
- Comitê Gestor do IBS definirá alíquotas por município — ainda em organização

SPLIT PAYMENT:
- Recolhimento automático no momento da liquidação financeira
- Operacionalizado via sistema bancário integrado ao fisco
- Entrada gradual junto com IBS/CBS a partir de 2027

NÃO-CUMULATIVIDADE PLENA (Arts. 28–47 LC 214/2025):
- Crédito amplo de IBS/CBS nas ENTRADAS de bens/serviços
- B2B: gera crédito para o adquirente
- B2C: NÃO gera crédito
- Simples Nacional: crédito proporcional ao percentual de tributação no SN (Art. 144)
- Ativo imobilizado: gera crédito; observar CST e cClassTrib do bem adquirido
- CFOP 1604 (recuperação CIAP): tributação normal, CST 001 (tributação integral)

REGRAS ESPECÍFICAS cClassTrib:
- Redução 60% de alíquota: produtos da cesta básica, medicamentos essenciais
- Redução 100% (alíquota zero): produtos agropecuários básicos
- Redução 30%: serviços de educação, saúde, transporte coletivo
- Tributação integral: CST 001 = regime geral sem benefício
- Isenção: CST específico de isenção

OBRIGAÇÕES ACESSÓRIAS 2026:
- SPED Fiscal, EFD-Contribuições: ainda SEM atualização para campos IBS/CBS/cClassTrib
- XML da NF-e: DEVE conter os campos — tags gIBS e gCBS (NF-e 4.x)
- DANF: recomenda-se informar nos dados adicionais (boa prática, não obrigatório por hora)
- Escrituração contábil (SPED): aguardar regulamentação

IMPOSTO SELETIVO (IS):
- "Imposto do pecado" — bens e serviços prejudiciais à saúde/meio ambiente
- Cigarros, bebidas alcoólicas, veículos poluentes, etc.
- Não substitui nenhum tributo existente — adicional

REGIMES DIFERENCIADOS E REDUÇÃO DE ALÍQUOTA:
- Saúde: médicos, hospitais, planos de saúde — redução
- Educação: estabelecimentos de ensino — redução
- Transporte coletivo: redução
- Agronegócio: alíquota zero para produtos in natura
- Combustíveis: regime específico (monofásico)
- Serviços financeiros: regime específico

LUCRO PRESUMIDO:
- IBS/CBS em 2026: informar no XML (meramente informativo)
- A partir de 2027: recolhe CBS cheia; IBS gradual conforme tabela de transição
- Mantém PIS/COFINS até extinção (final 2026/início 2027)
- Crédito amplo de IBS/CBS nas entradas (não-cumulatividade plena)

LUCRO REAL:
- Mesma lógica do Presumido para IBS/CBS
- EFD-Contribuições: sem campos específicos para IBS/CBS ainda
- Escrituração de entradas: acompanhar CST/cClassTrib dos fornecedores já em 2026 (impacto nos créditos futuros)

RISCOS E CUIDADOS:
1. NÃO fazer "de-para" direto CST PIS/COFINS → CST IBS/CBS: tributações podem diferir
2. Mesmo NCM pode ter múltiplos cClassTribs — analisar DESCRIÇÃO do produto
3. Informação ausente/incorreta = perda da dispensa de recolhimento em 2026
4. A NT 1.33 tirou a VALIDAÇÃO técnica, NÃO a obrigatoriedade legal
5. Fornecedores com CST incorreto em 2026 = créditos futuros em risco (a partir de 2027)
`;

// ─── Prompts rápidos categorizados ───────────────────────────────────────────
const PROMPTS_RAPIDOS = [
  {
    categoria: "Chave Fiscal",
    cor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    itens: [
      "O que é a nova Chave Fiscal (cClassTrib + CST + NCM)?",
      "Como preencher cClassTrib na NF-e em 2026?",
      "Posso ser autuado por CST incorreto em 2026?",
      "Por que o NCM sozinho não determina a tributação?",
    ]
  },
  {
    categoria: "Simples Nacional",
    cor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    itens: [
      "Simples Nacional deve destacar IBS/CBS na NF-e em 2026?",
      "Quando o Simples Nacional começa a recolher IBS/CBS?",
      "Como funciona o crédito proporcional do SN (Art. 144)?",
    ]
  },
  {
    categoria: "Lucro Presumido",
    cor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    itens: [
      "Como ficará a carga tributária no Lucro Presumido com a reforma?",
      "Simule: Lucro Presumido, comércio, R$ 3 milhões/ano",
      "Crédito de entradas IBS/CBS — como funciona no Presumido?",
    ]
  },
  {
    categoria: "Operacional 2026",
    cor: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    itens: [
      "Checklist de adequação para emissão de NF-e em 2026",
      "IBS/CBS soma ao valor da nota fiscal em 2026?",
      "Como preparar os sistemas ERP para 2026?",
    ]
  },
];

// ─── Lógica do Consultor ──────────────────────────────────────────────────────

interface Mensagem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function gerarResposta(pergunta: string, clienteInfo?: string): string {
  const p = pergunta.toLowerCase();

  // ── Chave Fiscal / cClassTrib ──────────────────────────────────────────────
  if (p.includes("cclasstrib") || p.includes("classtrib") || p.includes("chave fiscal") || p.includes("classe trib")) {
    return `## Chave Fiscal: cClassTrib + CST + NCM

A **Chave Fiscal** é a nova lógica de classificação tributária para o IBS e CBS, introduzida pela LC 214/2025 e detalhada nas Notas Técnicas NF-e 1.32 e 1.33.

### Estrutura

| Componente | Dígitos | Função |
|---|---|---|
| **cClassTrib** | 6 dígitos | Identificação completa da tributação |
| → Primeiros 3 | 1–3 | Vinculados ao CST (situação tributária) |
| → Últimos 3 | 4–6 | Detalhamento do tipo de operação/produto |
| **CST IBS/CBS** | variável | Regime geral, isenção, redução, diferimento |
| **NCM** | 8 dígitos | Classificação do produto (por si só NÃO define tributação) |

### Ponto crítico
O NCM sozinho **não determina a tributação**. Um mesmo NCM pode ter múltiplos cClassTribs. Exemplo clássico: o **sal** pode ser classificado como produto agropecuário, medicamento ou cesta básica — cada um com cClassTrib e alíquota diferente.

### Por que isso importa em 2026?
A informação correta desta combinação é **condição essencial para a dispensa do recolhimento** do IBS/CBS em 2026 (Art. 348, LC 214/2025). A NT 1.33 suspendeu apenas a **validação técnica** na emissão — a **obrigatoriedade legal** permanece. Classificação errada = risco de autuação.

### Onde consultar a tabela cClassTrib?
Portal da **Conformidade Fácil** (público, gratuito) — disponibiliza a tabela completa de combinações CST + cClassTrib por produto/serviço.

**Próximo passo sugerido:** mapeie os principais produtos/serviços dos seus clientes e confira o cClassTrib correto na tabela antes de janeiro/2026.`;
  }

  // ── Simples Nacional ──────────────────────────────────────────────────────
  if (p.includes("simples nacional") || p.includes("simples nac") || (p.includes("simples") && !p.includes("simples assim"))) {
    return `## IBS/CBS no Simples Nacional — 2026

### O que NÃO se aplica ao SN em 2026
Conforme **NT 1.33 da NF-e** e **Art. 348 da LC 214/2025**:

- O IBS/CBS **não deve ser destacado** na NF-e de optantes do Simples Nacional em 2026
- O campo cClassTrib/CST do IBS/CBS: deve constar no **layout do XML**, mas **não preenchido**
- A tributação efetiva do SN pelo IBS/CBS começa somente **em 2027**

### Por que 2027 e não 2026?
O Art. 348 da LC 214/2025 estabelece que contribuintes do Simples Nacional estão dispensados do recolhimento em 2026 (ano de teste). O regime específico do SN para IBS/CBS será regulamentado em **nota técnica futura**.

### Exceções (aguardar regulamentação específica):
- SN com excesso de sublimite
- MEI
- Tributação monofásica (combustíveis, etc.)

### Crédito para o adquirente (B2B)
Quando o fornecedor for SN, o crédito de IBS/CBS para o destinatário é **proporcional** ao percentual de tributação do SN — não é crédito integral (Art. 144, LC 214/2025).

${clienteInfo ? `\n> **Nota:** Com o cliente ativo selecionado (${clienteInfo}), verifique o regime para aplicar as regras corretas.` : ""}

**Aviso:** Simulação baseada em alíquotas de referência. Cálculo definitivo depende de regulamentação complementar.

**Próximo passo sugerido:** oriente seus clientes SN a atualizar sistemas ERP para incluir os campos no layout XML sem preenchê-los — evita problemas técnicos de emissão.`;
  }

  // ── NF-e 2026 / Operacional ───────────────────────────────────────────────
  if (p.includes("checklist") || p.includes("adequa") || p.includes("preparar") || p.includes("erp") || p.includes("sistema")) {
    return `## Checklist Operacional — Adequação NF-e para 2026

### 1. Mapeamento de produtos e serviços
- [ ] Revisar catálogo de NCMs de todos os clientes
- [ ] Identificar o **cClassTrib correto** para cada NCM (não usar NCM como único critério)
- [ ] Verificar se algum NCM tem múltiplos cClassTribs possíveis (sal, medicamentos, agro)
- [ ] Documentar as regras de classificação por cliente

### 2. Atualização dos sistemas ERP/emissor
- [ ] Confirmar com o fornecedor de ERP a versão do layout NF-e 4.x (tags gIBS e gCBS)
- [ ] Testar emissão em **ambiente de homologação** antes de virar o ano
- [ ] Simples Nacional: configurar campos no layout sem preenchimento dos valores
- [ ] Demais regimes: configurar cálculo CBS 0,9% + IBS 0,1% como **informativo** (não soma ao total)

### 3. Verificação jurídica
- [ ] Confirmar que os valores IBS/CBS **não somam ao valor da nota** em 2026
- [ ] Garantir preenchimento correto de: NCM + CST IBS/CBS + cClassTrib + valores gIBS/gCBS
- [ ] Informar IBS/CBS nos **dados adicionais da DANF** (recomendação — boa prática)

### 4. Monitoramento de fornecedores
- [ ] Acompanhar se fornecedores estão informando CST/cClassTrib corretos nos XMLs
- [ ] Guardar XMLs de 2026 — créditos futuros (2027+) dependem dessa classificação

### 5. Treinamento interno
- [ ] Capacitar equipe de faturamento sobre a nova Chave Fiscal
- [ ] Criar rotina de auditoria dos XMLs emitidos e recebidos

### Prazo crítico
Vigência: **1º de janeiro de 2026**. Com feriados de fim de ano, o tempo real disponível é mínimo.

**Próximo passo sugerido:** converse com o fornecedor de sistema dos seus clientes esta semana para confirmar atualização do layout NF-e 4.x.`;
  }

  // ── IBS/CBS soma ao valor ────────────────────────────────────────────────
  if (p.includes("soma") || p.includes("total da nota") || p.includes("valor da nota") || p.includes("destacado")) {
    return `## IBS/CBS soma ao valor da nota em 2026?

**Não.** Em 2026, o IBS (0,1%) e CBS (0,9%) são **meramente informativos** na NF-e.

### Regra clara (Art. 348, LC 214/2025):
- Os valores de IBS/CBS aparecem no **XML** e podem aparecer nos dados adicionais da DANF
- **Não somam** ao valor total da nota fiscal
- O fornecedor **não repassa** esse valor ao cliente em 2026
- O **recolhimento** está dispensado em 2026 — desde que as obrigações acessórias sejam cumpridas corretamente

### A partir de 2027:
- CBS entra em vigor com alíquota cheia (~8,8%)
- O fornecedor **passará a repassar** o valor de CBS no preço
- O adquirente receberá crédito de CBS nas entradas (não-cumulatividade plena)
- IBS começa gradualmente (1,77% em 2029, crescendo até 17,7% em 2033)

### Atenção prática:
Oriente seus clientes que **os sistemas não devem somar** IBS/CBS ao total da nota em 2026. Fornecedor que incluir esses valores no total está em desacordo com a legislação vigente.

**Próximo passo sugerido:** verifique se o ERP dos clientes está configurado para calcular IBS/CBS como campo informativo separado, sem impacto no total da nota.`;
  }

  // ── Autuação / Risco ────────────────────────────────────────────────────
  if (p.includes("autu") || p.includes("penalidade") || p.includes("risco") || p.includes("incorreto") || p.includes("errado")) {
    return `## Risco de Autuação por CST/cClassTrib Incorreto

**Sim, há risco real.** A NT 1.33 foi mal interpretada por muitos — ela suspendeu apenas a **validação técnica** no momento da emissão. A obrigatoriedade **legal** permanece íntegra.

### O que diz a legislação:
> "A apresentação correta e tempestiva dos eventos mencionados é **condição essencial** para que o contribuinte possa usufruir da dispensa do recolhimento do IBS/CBS no período de transição."
> *(NT NF-e 1.33 / Art. 348, LC 214/2025)*

### Cenário de risco:
| Situação | Consequência |
|---|---|
| Campos ausentes | Perda da dispensa + recolhimento normal |
| CST errado | Idem — sujeito a autuação posterior |
| cClassTrib incorreto | Idem |
| NF emitida sem campos | Fisco pode autuar retroativamente |

### A "pegadinha" da NT 1.33:
O fisco retirou a validação para **não travar operações** — mas manteve a obrigatoriedade. Isso significa: a nota passa na emissão, mas o fisco **pode cruzar os dados depois** e autuar.

### Recomendação:
1. Preencher todos os campos corretamente desde 1º/01/2026
2. Auditar periodicamente os XMLs emitidos e recebidos
3. Não fazer "de-para" direto do CST do PIS/COFINS para o CST do IBS/CBS — as tributações podem ser diferentes

**Próximo passo sugerido:** implemente uma rotina de auditoria mensal dos XMLs para verificar consistência de NCM + CST + cClassTrib.`;
  }

  // ── Simulação numérica ───────────────────────────────────────────────────
  if (p.includes("simul") || p.includes("calcul") || p.includes("carga tributária") || p.includes("milhões") || p.includes("milh")) {
    // Tentar extrair valor do faturamento
    const matchValor = pergunta.match(/r\$\s*([\d.,]+)/i) || pergunta.match(/([\d.,]+)\s*milhão/i) || pergunta.match(/([\d.,]+)\s*mil/i);
    const faturamento = matchValor ? matchValor[0] : "R$ 3.000.000,00";

    return `## Simulação de Carga Tributária — Reforma Tributária

### Premissas assumidas:
- Faturamento: **${faturamento}/ano**
- Regime: Lucro Presumido (comércio/indústria — ajuste conforme setor)
- % compras sobre faturamento: 60% (ajuste conforme perfil do cliente)
- Alíquota IBS referência 2033: 17,7% | CBS: 8,8%

### Impacto por ano de transição:

| Ano | CBS | IBS | ICMS/ISS | Carga Nova Aprox. | Crédito Entradas |
|---|---|---|---|---|---|
| 2026 | 0,9% | 0,1% | 100% | Informativo | — |
| 2027 | 8,8% | 0,1% | 100% | +8,9% s/ faturamento | Crédito amplo |
| 2029 | 8,8% | 1,77% | 90% | Transição | Não-cumulativo |
| 2031 | 8,8% | 5,31% | 70% | Transição | Não-cumulativo |
| 2033 | 8,8% | 17,7% | 0% | ~26,5% s/ valor adicionado | Pleno |

### Recomendações para otimização:
1. **Mapear créditos de entradas** — a não-cumulatividade plena pode reduzir significativamente a carga líquida
2. **Analisar mudança de regime** — para alguns perfis, o Simples Nacional pode ser vantajoso até 2026/2027
3. **Renegociar contratos** com clientes e fornecedores considerando o repasse a partir de 2027

> *Simulação baseada em alíquotas de referência e premissas informadas. Cálculo definitivo depende de regulamentação complementar e análise caso a caso.*

**Quer que eu detalhe este cálculo com os números específicos do seu cliente? Me informe o faturamento, regime e setor.**`;
  }

  // ── IPI ──────────────────────────────────────────────────────────────────
  if (p.includes("ipi")) {
    return `## IPI na Reforma Tributária

### O que acontece com o IPI:
- **2027**: IPI reduzido a **zero** para a maioria dos produtos (Art. 125, LC 214/2025)
- **Exceção**: produtos fabricados **fora da Zona Franca de Manaus** que concorram com similares da ZFM — IPI permanece com função extrafiscal de proteção da ZFM

### Relação com CBS:
O IPI **não é absorvido** pela CBS. São tributos distintos. A CBS substitui apenas PIS e COFINS. A extinção do IPI é autônoma e visa simplificação + proteção da ZFM.

### Impacto prático para seus clientes:
| Situação | Impacto do IPI |
|---|---|
| Indústria geral | IPI zerado em 2027 |
| Indústria ZFM | IPI mantido (função de proteção) |
| Indústria fora ZFM com similar ZFM | IPI mantido (concorrência) |
| Comércio | Sem impacto direto |

**Próximo passo sugerido:** se tiver clientes industriais, mapeie quais NCMs podem manter IPI após 2027 por concorrência com similares da ZFM.`;
  }

  // ── Split Payment ────────────────────────────────────────────────────────
  if (p.includes("split") || p.includes("liquidação") || p.includes("recolhimento automático")) {
    return `## Split Payment — Recolhimento Automático

### O que é:
O Split Payment é o mecanismo pelo qual o IBS e CBS serão recolhidos **automaticamente no momento da liquidação financeira** da operação — sem que o contribuinte precise fazer o pagamento em separado (DARF, DAS etc.).

### Como funcionará:
1. A empresa emite a NF-e com IBS/CBS corretamente informados
2. O cliente paga a nota via sistema bancário
3. O banco, de forma automática, **destina** a parcela de IBS/CBS diretamente ao fisco
4. O contribuinte recebe apenas o valor líquido

### Cronograma de implantação:
- **2026**: não há recolhimento (informativo apenas)
- **2027 em diante**: gradual com a entrada do CBS e IBS

### Impacto no fluxo de caixa:
- Redução do risco de inadimplência fiscal
- Sem acumulação de saldo devedor de IBS/CBS
- Crédito de entradas: será compensado pelo próprio sistema (apuração assistida)

**Próximo passo sugerido:** acompanhe as normas do Comitê Gestor do IBS sobre o cronograma operacional do Split Payment — ainda em regulamentação.`;
  }

  // ── Não-cumulatividade / Crédito ─────────────────────────────────────────
  if (p.includes("crédito") || p.includes("não-cumulativ") || p.includes("nao-cumulativ") || p.includes("entrada") && p.includes("ib")) {
    return `## Não-Cumulatividade Plena — Crédito de IBS/CBS nas Entradas

### Conceito (Arts. 28–47, LC 214/2025):
O IBS e CBS adotam **não-cumulatividade plena** — muito mais ampla que o regime atual do PIS/COFINS. Praticamente toda aquisição de bens e serviços gera crédito.

### Regras por tipo de operação:

| Operação | Gera Crédito? | Observação |
|---|---|---|
| **B2B — compra de mercadorias** | Sim | Crédito integral |
| **B2C — venda ao consumidor final** | Não se aplica | Consumidor não tem crédito |
| **Ativo imobilizado** | Sim | Aproveitar no período de aquisição |
| **Serviços tomados** | Sim | Desde que vinculados à atividade |
| **Fornecedor Simples Nacional** | Parcial | Proporcional ao % de tributação do SN (Art. 144) |
| **Fornecedor isento** | Não | Operação isenta não gera crédito |

### Em 2026:
- Crédito de IBS/CBS nas entradas é **apenas informativo** — não há recolhimento nem compensação efetiva
- A partir de **2027**: créditos passam a ser utilizados de forma efetiva

### Importância de acompanhar fornecedores JÁ EM 2026:
Os XMLs de 2026, mesmo sem recolhimento, precisam ter CST/cClassTrib corretos. Esses dados serão a base para os créditos de **2027 em diante**. Um fornecedor com classificação errada em 2026 pode comprometer créditos futuros.

**Próximo passo sugerido:** implemente controle de XMLs de entrada para verificar a qualidade das classificações dos fornecedores desde jan/2026.`;
  }

  // ── Nota técnica / NT 1.33 ────────────────────────────────────────────────
  if (p.includes("nota técnica") || p.includes("nt 1.33") || p.includes("nt 1.32") || p.includes("validação")) {
    return `## Nota Técnica NF-e 1.33 — O que Mudou?

### Contexto:
A NT 1.33 foi publicada como atualização da NT 1.32 (que já havia introduzido os campos cClassTrib, CST IBS/CBS). A grande novidade foi sobre a **validação** dos campos.

### O que a NT 1.33 determina:

**O que foi alterado:**
> O preenchimento dos campos IBS/CBS **não será exigido por regra de validação** na emissão da NF-e.

Ou seja: a SEFAZ aceita a nota mesmo sem esses campos preenchidos tecnicamente.

**O que NÃO mudou:**
> Os campos **permanecem obrigatórios conforme a legislação vigente** (LC 214/2025).

### Por que isso é uma "pegadinha":
| Situação | Validação Técnica | Obrigatoriedade Legal |
|---|---|---|
| Campo ausente | ✅ Nota aprovada | ❌ Infração — risco de autuação |
| Campo incorreto | ✅ Nota aprovada | ❌ Perda da dispensa de recolhimento |
| Campo correto | ✅ Nota aprovada | ✅ Cumprimento integral |

### Recomendação prática:
Preencher **corretamente** desde o primeiro dia, pois a dispensa do recolhimento de IBS/CBS em 2026 está **condicionada ao cumprimento das obrigações acessórias** (Art. 348, LC 214/2025).

**Próximo passo sugerido:** não confunda "a nota vai validar" com "não preciso preencher". Exija dos seus sistemas a correta emissão dos campos desde 1º/01/2026.`;
  }

  // ── SPED / Escrituração ──────────────────────────────────────────────────
  if (p.includes("sped") || p.includes("escrituração") || p.includes("efd") || p.includes("obrigação acessória")) {
    return `## Obrigações Acessórias e SPED — Status em 2026

### O que já foi atualizado:
- **NF-e (XML)**: Layout 4.x já tem tags gIBS e gCBS, campos cClassTrib e CST IBS/CBS — vigentes desde 2026

### O que ainda NÃO foi atualizado:
| Obrigação | Status | Previsão |
|---|---|---|
| EFD-Contribuições | Sem campos IBS/CBS | Aguardar regulamentação |
| SPED Fiscal (EFD-ICMS/IPI) | Sem campos IBS/CBS | Aguardar regulamentação |
| SPED Contábil | Sem campos IBS/CBS | Aguardar regulamentação |
| DCTFWeb | Sem campos específicos | Aguardar regulamentação |

### O que isso significa na prática:
- Em 2026, a escrituração contábil e fiscal **não exige** campos IBS/CBS nas obrigações tradicionais
- Toda a informação relevante de 2026 fica **apenas no XML das NF-e**
- A partir de 2027, espera-se atualização dessas obrigações conforme CBS entra em vigor

### Recomendação:
Mesmo sem obrigatoriedade nas escriturações, mantenha **arquivo organizado dos XMLs** de NF-e emitidos e recebidos em 2026 — serão a base documental para créditos e escrituração futura.

**Próximo passo sugerido:** crie um arquivo digital dos XMLs de 2026 por cliente, organizado por mês, para facilitar a migração quando as obrigações acessórias forem atualizadas.`;
  }

  // ── Resposta genérica inteligente ─────────────────────────────────────────
  return `## Resposta — Consultor Tributário Reforma 2026

Analisei sua pergunta com base na LC 214/2025 e nas últimas atualizações técnicas disponíveis.

${p.includes("cfop") ? `
### CFOP na era IBS/CBS
Os CFOPs continuam sendo utilizados normalmente durante o período de transição (2026–2033). Eles coexistem com o cClassTrib — são informações complementares, não substitutas. Em 2026, o CFOP segue as regras atuais do ICMS/PIS/COFINS, enquanto o cClassTrib identifica a tributação de IBS/CBS.
` : ""}

${p.includes("lucro real") ? `
### Lucro Real e Reforma Tributária
No Lucro Real, a não-cumulatividade do IBS/CBS será plena (Arts. 28–47, LC 214/2025), semelhante ao atual PIS/COFINS não-cumulativo. Porém, atenção: o conceito de insumo e as regras de crédito do IBS/CBS são **mais amplos** que os do PIS/COFINS atual. A transição começa efetivamente em 2027 para o Lucro Real.
` : ""}

Para uma resposta mais precisa e completa, me informe:
1. **Regime tributário** do cliente (Simples Nacional / Lucro Presumido / Lucro Real / MEI)
2. **Setor/atividade** principal
3. **Dúvida específica** (classificação fiscal, simulação numérica, checklist, comunicação ao cliente)

Com esses dados entrego uma resposta pronta para usar no escritório.

> *Não tenho certeza sobre algum ponto específico? Recomendo confirmar no texto atualizado da LC 214/2025 ou em fonte oficial (RFB / Comitê Gestor do IBS).*`;
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function ConsultorIA() {
  const { clienteAtivo } = useCliente();
  const { toast } = useToast();
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `## Olá! Sou seu Consultor Tributário — Reforma 2026

Especialista em **LC 214/2025** e **EC 132/2023**. Estou aqui para traduzir a complexidade da Reforma Tributária em respostas práticas e imediatamente aplicáveis ao seu escritório.

**Posso ajudar com:**
- Chave Fiscal: cClassTrib + CST + NCM (NF-e 2026)
- Regras do IBS/CBS por regime tributário
- Simulações de carga tributária
- Checklists operacionais
- Dúvidas sobre obrigações acessórias

Para começar com precisão, me diga:
1. Qual o **regime tributário** do cliente?
2. Qual o **setor/atividade**?
3. Qual a sua **dúvida ou objetivo**?

Ou escolha um dos temas rápidos abaixo.`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  function enviar(texto?: string) {
    const pergunta = (texto || input).trim();
    if (!pergunta || loading) return;

    const userMsg: Mensagem = {
      id: Date.now().toString(),
      role: "user",
      content: pergunta,
      timestamp: new Date(),
    };
    setMensagens(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const clienteInfo = clienteAtivo
        ? `${clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial} (${clienteAtivo.regime || "regime não informado"})`
        : undefined;

      const resposta = gerarResposta(pergunta, clienteInfo);
      const botMsg: Mensagem = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: clienteAtivo
          ? resposta + `\n\n---\n*Contexto: cliente ativo — **${clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial}** | Regime: ${clienteAtivo.regime || "não informado"}*`
          : resposta,
        timestamp: new Date(),
      };
      setMensagens(prev => [...prev, botMsg]);
      setLoading(false);
    }, 800);
  }

  function copiar(id: string, content: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      toast({ title: "Copiado para a área de transferência" });
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function limpar() {
    setMensagens([{
      id: "welcome-new",
      role: "assistant",
      content: "Conversa reiniciada. Como posso ajudar?",
      timestamp: new Date(),
    }]);
  }

  // Renderiza markdown simples
  function renderContent(content: string) {
    const lines = content.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold mt-3 mb-1.5 text-foreground">{line.slice(3)}</h2>;
      if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-semibold mt-2.5 mb-1 text-foreground">{line.slice(4)}</h3>;
      if (line.startsWith("#### ")) return <h4 key={i} className="text-xs font-semibold mt-2 mb-0.5 text-muted-foreground uppercase tracking-wide">{line.slice(5)}</h4>;
      if (line.startsWith("---")) return <hr key={i} className="my-2 border-border" />;
      if (line.startsWith("| ")) {
        // Linha de tabela
        const cells = line.split("|").filter(c => c.trim() !== "");
        const isHeader = lines[i + 1]?.includes("---");
        const isSeparator = line.includes("---");
        if (isSeparator) return null;
        return (
          <div key={i} className={`grid text-xs border-b border-border ${isHeader ? "font-semibold bg-muted/50" : "hover:bg-muted/20"}`}
            style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
            {cells.map((cell, j) => <div key={j} className="px-2 py-1 border-r border-border last:border-r-0">{renderInline(cell.trim())}</div>)}
          </div>
        );
      }
      if (line.startsWith("- [ ] ")) return <div key={i} className="flex items-start gap-2 text-sm ml-2 my-0.5"><span className="mt-0.5 h-4 w-4 rounded border border-border shrink-0 bg-background"/><span>{renderInline(line.slice(6))}</span></div>;
      if (line.startsWith("- ")) return <div key={i} className="flex items-start gap-2 text-sm ml-2 my-0.5"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0"/><span>{renderInline(line.slice(2))}</span></div>;
      if (/^\d+\.\s/.test(line)) return <div key={i} className="flex items-start gap-2 text-sm ml-2 my-0.5"><span className="shrink-0 text-xs font-bold text-primary mt-0.5">{line.match(/^\d+/)?.[0]}.</span><span>{renderInline(line.replace(/^\d+\.\s/, ""))}</span></div>;
      if (line.startsWith("> ")) return <blockquote key={i} className="border-l-2 border-primary/50 pl-3 my-1 text-xs text-muted-foreground italic">{renderInline(line.slice(2))}</blockquote>;
      if (line === "") return <div key={i} className="h-1.5" />;
      return <p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>;
    });
  }

  function renderInline(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
      return part;
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <BotMessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold flex items-center gap-2">
              Consultor IA — Reforma Tributária 2026
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] px-1.5 py-0">LC 214/2025</Badge>
            </h1>
            <p className="text-xs text-muted-foreground">Especialista em cClassTrib · IBS/CBS · Simples Nacional · Lucro Presumido/Real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {clienteAtivo && (
            <Badge variant="outline" className="text-xs gap-1">
              <span className="text-muted-foreground">Contexto:</span>
              {clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial}
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={limpar}>
            <RefreshCw className="h-3 w-3" /> Nova conversa
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Área de chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 px-4 py-3">
            <div className="max-w-3xl mx-auto space-y-4">
              {mensagens.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === "assistant" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {msg.role === "assistant" ? <BotMessageSquare className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>

                  {/* Mensagem */}
                  <div className={`flex-1 max-w-[85%] ${msg.role === "user" ? "items-end flex flex-col" : ""}`}>
                    <div className={`rounded-xl px-4 py-3 text-sm relative group ${
                      msg.role === "assistant"
                        ? "bg-card border shadow-sm"
                        : "bg-primary text-primary-foreground"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose-sm">
                          {renderContent(msg.content)}
                        </div>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}

                      {/* Botão copiar */}
                      {msg.role === "assistant" && (
                        <button
                          onClick={() => copiar(msg.id, msg.content)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-muted hover:bg-accent"
                        >
                          {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <BotMessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-card border rounded-xl px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t px-4 py-3 bg-card shrink-0">
            <div className="max-w-3xl mx-auto flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder="Faça uma pergunta sobre a Reforma Tributária, cClassTrib, IBS/CBS, Simples Nacional... (Enter para enviar)"
                className="resize-none text-sm min-h-[60px] max-h-[120px]"
                data-testid="consultor-input"
              />
              <Button
                onClick={() => enviar()}
                disabled={!input.trim() || loading}
                className="self-end h-10 px-3"
                data-testid="consultor-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Painel lateral — Prompts rápidos */}
        <div className="hidden lg:flex flex-col w-64 border-l bg-card/50 shrink-0 overflow-y-auto">
          <div className="px-3 py-3 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" /> Perguntas Frequentes
            </p>
          </div>
          <div className="px-3 py-2 space-y-4 flex-1">
            {PROMPTS_RAPIDOS.map(grupo => (
              <div key={grupo.categoria}>
                <Badge className={`text-[10px] mb-2 ${grupo.cor}`}>{grupo.categoria}</Badge>
                <div className="space-y-1">
                  {grupo.itens.map(item => (
                    <button
                      key={item}
                      onClick={() => enviar(item)}
                      className="w-full text-left text-xs px-2.5 py-2 rounded-lg hover:bg-accent transition-colors flex items-start gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="px-3 py-3 border-t">
            <div className="flex gap-1.5 text-[10px] text-muted-foreground">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-orange-400" />
              <span>Base: LC 214/2025 + EC 132/2023 + NT NF-e 1.33. Não substitui julgamento profissional.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

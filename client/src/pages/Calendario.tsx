import { useState, useMemo } from "react";
import {
  CalendarDays,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type TipoObrigacao = "DAS" | "SPED" | "DEFIS" | "Reforma" | "DCTF" | "ECF" | "PGDAS" | "DIRPF" | "EFD";
type Urgencia = "alta" | "media" | "baixa";
type Regime = "todos" | "simples" | "presumido";

interface Obrigacao {
  id: string;
  data: string; // YYYY-MM-DD
  titulo: string;
  descricao: string;
  tipo: TipoObrigacao;
  urgencia: Urgencia;
  regime: Regime;
}

// Hoje fixo: 18/04/2026
const HOJE = new Date("2026-04-18T12:00:00");

function getDaysUntil(dateStr: string) {
  const target = new Date(dateStr + "T12:00:00");
  return Math.ceil((target.getTime() - HOJE.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateBR(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Helper para último dia do mês
function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // month is 1-based here
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Gerar obrigações
function gerarObrigacoes(): Obrigacao[] {
  const lista: Obrigacao[] = [];

  // DAS mensal — dia 20 de cada mês jan–dez 2026
  for (let m = 1; m <= 12; m++) {
    lista.push({
      id: `das-2026-${m}`,
      data: `2026-${pad(m)}-20`,
      titulo: `DAS — ${new Date(2026, m - 1).toLocaleString("pt-BR", { month: "long" })}/2026`,
      descricao: "Recolhimento mensal do Simples Nacional via DAS",
      tipo: "DAS",
      urgencia: "alta",
      regime: "simples",
    });
  }

  // PGDAS-D — último dia de cada mês 2026
  for (let m = 1; m <= 12; m++) {
    lista.push({
      id: `pgdas-2026-${m}`,
      data: lastDayOfMonth(2026, m),
      titulo: `PGDAS-D — ${new Date(2026, m - 1).toLocaleString("pt-BR", { month: "long" })}/2026`,
      descricao: "Declaração e apuração mensal do Simples Nacional",
      tipo: "PGDAS",
      urgencia: "alta",
      regime: "simples",
    });
  }

  // SPED EFD-ICMS — dia 15 de cada mês 2026
  for (let m = 2; m <= 12; m++) {
    lista.push({
      id: `efd-icms-2026-${m}`,
      data: `2026-${pad(m)}-15`,
      titulo: `EFD-ICMS/IPI — ${new Date(2026, m - 1).toLocaleString("pt-BR", { month: "long" })}/2026`,
      descricao: "Escrituração Fiscal Digital ICMS/IPI — entrega ao SPED",
      tipo: "SPED",
      urgencia: "media",
      regime: "presumido",
    });
  }

  // EFD Contribuições — dia 15 de cada mês 2026
  for (let m = 2; m <= 12; m++) {
    lista.push({
      id: `efd-contrib-2026-${m}`,
      data: `2026-${pad(m)}-15`,
      titulo: `EFD Contribuições — ${new Date(2026, m - 1).toLocaleString("pt-BR", { month: "long" })}/2026`,
      descricao: "Escrituração Fiscal Digital PIS/COFINS — Lucro Presumido/Real",
      tipo: "EFD",
      urgencia: "media",
      regime: "presumido",
    });
  }

  // DCTF Mensal — dia 15 de cada mês 2026
  for (let m = 2; m <= 12; m++) {
    lista.push({
      id: `dctf-2026-${m}`,
      data: `2026-${pad(m)}-15`,
      titulo: `DCTF — ${new Date(2026, m - 1).toLocaleString("pt-BR", { month: "long" })}/2026`,
      descricao: "Declaração de Débitos e Créditos Tributários Federais",
      tipo: "DCTF",
      urgencia: "media",
      regime: "presumido",
    });
  }

  // Obrigações únicas
  lista.push(
    // DEFIS 2026
    {
      id: "defis-2026",
      data: "2026-03-31",
      titulo: "DEFIS 2025 (ano-calendário)",
      descricao: "Declaração de Informações Socioeconômicas e Fiscais — base 2025",
      tipo: "DEFIS",
      urgencia: "alta",
      regime: "simples",
    },
    // DIRPF sócios
    {
      id: "dirpf-2026",
      data: "2026-04-30",
      titulo: "DIRPF — Sócios e Titulares",
      descricao: "Imposto de Renda Pessoa Física — prazo final entrega 2026",
      tipo: "DCTF",
      urgencia: "alta",
      regime: "todos",
    },
    // SPED Contábil
    {
      id: "sped-contabil-2026",
      data: "2026-05-31",
      titulo: "SPED Contábil (ECD) 2025",
      descricao: "Escrituração Contábil Digital — ano-calendário 2025",
      tipo: "SPED",
      urgencia: "alta",
      regime: "presumido",
    },
    // ECF
    {
      id: "ecf-2026",
      data: "2026-07-31",
      titulo: "ECF — Escrituração Contábil Fiscal 2025",
      descricao: "Declaração do IRPJ/CSLL via SPED — Lucro Presumido e Real",
      tipo: "ECF",
      urgencia: "alta",
      regime: "presumido",
    },
    // Opção Híbrido setembro 2026 (vigência 2027 1º sem)
    {
      id: "hibrido-set-2026",
      data: "2026-09-30",
      titulo: "Opção Regime Híbrido IBS/CBS — 2027 (1º sem)",
      descricao: "Prazo para opção IBS/CBS fora do DAS — vigência 1º semestre 2027. Oriente clientes sobre os impactos.",
      tipo: "Reforma",
      urgencia: "alta",
      regime: "simples",
    },
    // DEFIS 2027
    {
      id: "defis-2027",
      data: "2027-03-31",
      titulo: "DEFIS 2026 (ano-calendário)",
      descricao: "Declaração de Informações Socioeconômicas e Fiscais — base 2026",
      tipo: "DEFIS",
      urgencia: "alta",
      regime: "simples",
    },
    // Opção Híbrido março 2027
    {
      id: "hibrido-mar-2027",
      data: "2027-03-31",
      titulo: "Opção Regime Híbrido IBS/CBS — 2027 (2º sem)",
      descricao: "Prazo para opção IBS/CBS fora do DAS — vigência 2º semestre 2027",
      tipo: "Reforma",
      urgencia: "alta",
      regime: "simples",
    }
  );

  // Ordenar por data
  lista.sort((a, b) => a.data.localeCompare(b.data));
  return lista;
}

const TODAS_OBRIGACOES = gerarObrigacoes();

const FILTROS: Array<{ label: string; value: TipoObrigacao | "Todos" }> = [
  { label: "Todos", value: "Todos" },
  { label: "DAS", value: "DAS" },
  { label: "SPED", value: "SPED" },
  { label: "DEFIS", value: "DEFIS" },
  { label: "Reforma", value: "Reforma" },
  { label: "DCTF", value: "DCTF" },
];

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function getTipoIcon(tipo: TipoObrigacao) {
  switch (tipo) {
    case "DAS":
    case "PGDAS":
      return <Clock className="h-4 w-4" />;
    case "SPED":
    case "EFD":
    case "ECF":
      return <FileText className="h-4 w-4" />;
    case "DEFIS":
      return <CheckCircle2 className="h-4 w-4" />;
    case "Reforma":
      return <AlertTriangle className="h-4 w-4" />;
    case "DCTF":
      return <Building2 className="h-4 w-4" />;
    default:
      return <CalendarDays className="h-4 w-4" />;
  }
}

function getTipoColor(tipo: TipoObrigacao): string {
  switch (tipo) {
    case "DAS":
    case "PGDAS":
      return "text-blue-600 dark:text-blue-400";
    case "SPED":
    case "EFD":
    case "ECF":
      return "text-indigo-600 dark:text-indigo-400";
    case "DEFIS":
      return "text-green-600 dark:text-green-400";
    case "Reforma":
      return "text-purple-600 dark:text-purple-400";
    case "DCTF":
      return "text-orange-600 dark:text-orange-400";
    default:
      return "text-muted-foreground";
  }
}

function getUrgenciaBadge(urgencia: Urgencia) {
  switch (urgencia) {
    case "alta":
      return <Badge variant="destructive" className="text-xs">Alta</Badge>;
    case "media":
      return <Badge variant="outline" className="text-xs border-orange-400 text-orange-600 dark:text-orange-400">Média</Badge>;
    case "baixa":
      return <Badge variant="secondary" className="text-xs">Baixa</Badge>;
  }
}

function getRegimeBadge(regime: Regime) {
  switch (regime) {
    case "simples":
      return <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Simples Nacional</Badge>;
    case "presumido":
      return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Presumido/Real</Badge>;
    case "todos":
      return <Badge variant="secondary" className="text-xs">Todos</Badge>;
  }
}

function getTipoBadge(tipo: TipoObrigacao) {
  const labels: Record<TipoObrigacao, string> = {
    DAS: "DAS",
    PGDAS: "PGDAS-D",
    SPED: "SPED",
    DEFIS: "DEFIS",
    Reforma: "Reforma",
    DCTF: "DCTF",
    ECF: "ECF",
    DIRPF: "DIRPF",
    EFD: "EFD",
  };
  return (
    <Badge variant="outline" className="text-xs font-mono">
      {labels[tipo] ?? tipo}
    </Badge>
  );
}

export default function Calendario() {
  const [filtroAtivo, setFiltroAtivo] = useState<TipoObrigacao | "Todos">("Todos");

  const obrigacoesFiltradas = useMemo(() => {
    if (filtroAtivo === "Todos") return TODAS_OBRIGACOES;
    return TODAS_OBRIGACOES.filter((o) => o.tipo === filtroAtivo);
  }, [filtroAtivo]);

  // Agrupar por mês/ano
  const grupos = useMemo(() => {
    const map = new Map<string, Obrigacao[]>();
    for (const ob of obrigacoesFiltradas) {
      const key = ob.data.slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ob);
    }
    return Array.from(map.entries()).map(([key, items]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        key,
        label: `${MESES_PT[month - 1]} ${year}`,
        items,
      };
    });
  }, [obrigacoesFiltradas]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Calendário de Obrigações 2026</h1>
          <p className="text-sm text-muted-foreground">
            Obrigações tributárias 2026 e início de 2027 · Hoje: {formatDateBR("2026-04-18")}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltroAtivo(f.value)}
            className={[
              "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
              filtroAtivo === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-border text-foreground",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto text-xs text-muted-foreground self-center">
          {obrigacoesFiltradas.length} obrigações
        </div>
      </div>

      {/* Grupos por mês */}
      {grupos.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhuma obrigação encontrada para o filtro selecionado.
          </CardContent>
        </Card>
      )}

      {grupos.map(({ key, label, items }) => {
        // Checar se este mês tem alguma obrigação nos próximos 30 dias
        const comPrazoProximo = items.filter((ob) => {
          const d = getDaysUntil(ob.data);
          return d >= 0 && d <= 30;
        });

        return (
          <div key={key} className="space-y-2">
            {/* Cabeçalho do mês */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">{label}</h2>
              </div>
              <Badge variant="secondary" className="text-xs">
                {items.length} obrigaç{items.length !== 1 ? "ões" : "ão"}
              </Badge>
              {comPrazoProximo.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {comPrazoProximo.length} venc. em 30d
                </Badge>
              )}
              <div className="flex-1">
                <Separator />
              </div>
            </div>

            {/* Itens do mês */}
            <div className="grid gap-2">
              {items.map((ob) => {
                const dias = getDaysUntil(ob.data);
                const emBreve = dias >= 0 && dias <= 30;
                const vencido = dias < 0;

                return (
                  <Card
                    key={ob.id}
                    className={[
                      "transition-colors",
                      emBreve
                        ? "border-orange-400/60 bg-orange-500/5 dark:bg-orange-500/10"
                        : vencido
                        ? "opacity-60"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        {/* Ícone tipo */}
                        <div className={`mt-0.5 shrink-0 ${getTipoColor(ob.tipo)}`}>
                          {getTipoIcon(ob.tipo)}
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-sm font-semibold">{ob.titulo}</span>
                            {emBreve && (
                              <Badge variant="destructive" className="text-xs">
                                {dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : `${dias}d`}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{ob.descricao}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {getTipoBadge(ob.tipo)}
                            {getRegimeBadge(ob.regime)}
                            {getUrgenciaBadge(ob.urgencia)}
                          </div>
                        </div>

                        {/* Data */}
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-sm font-mono font-medium">{formatDateBR(ob.data)}</p>
                          {!vencido && !emBreve && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {dias > 365
                                ? `${Math.floor(dias / 30)} meses`
                                : `${dias} dias`}
                            </p>
                          )}
                          {vencido && (
                            <p className="text-xs text-muted-foreground mt-0.5">Encerrado</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

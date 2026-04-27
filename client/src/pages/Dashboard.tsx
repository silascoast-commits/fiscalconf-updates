import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  TrendingUp,
  Building2,
  CheckCircle2,
  Clock,
  CalendarClock,
  Download,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

type DashboardData = {
  total: number;
  ativos: number;
  simples: number;
  presumido: number;
  real: number;
  alertas: Array<{
    clienteId: number;
    razaoSocial: string;
    cnpj: string;
    rbt12: number;
    tipo: "desenquadramento" | "hibrido_compulsorio" | "atencao";
  }>;
  regimeDist: Array<{ regime: string; count: number }>;
  anexoDist: Array<{ anexo: string; count: number }>;
};

function formatCNPJ(cnpj: string) {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const alertaConfig = {
  desenquadramento: {
    label: "Risco Desenquadramento",
    color: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
    badgeVariant: "destructive" as const,
  },
  hibrido_compulsorio: {
    label: "Híbrido Compulsório",
    color: "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400",
    badgeVariant: "outline" as const,
  },
  atencao: {
    label: "Atenção RBT12",
    color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
    badgeVariant: "outline" as const,
  },
};

// Próximas datas fixas calculadas a partir de hoje
const hoje = new Date();

function getDaysUntil(dateStr: string) {
  const target = new Date(dateStr + "T12:00:00");
  const diff = Math.ceil((target.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Próximo dia N de cada mês
function getProximoDiaN(dia: number): string {
  const d = new Date(hoje);
  d.setDate(dia);
  if (d <= hoje) d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// Último dia do mês corrente (ou próximo)
function getProximoUltimoDiaMes(): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); // último dia mês atual
  if (d <= hoje) {
    // já passou: último dia do próximo mês
    const d2 = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0);
    return d2.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

type ObrigacaoCalendario = { id: string; titulo: string; data: string };

function calcObrigacoesEstaSemana(): ObrigacaoCalendario[] {
  const agora = new Date();
  const setesDias = new Date(agora);
  setesDias.setDate(agora.getDate() + 7);

  const candidatas: ObrigacaoCalendario[] = [
    { id: "das",     titulo: "DAS — Vencimento mensal",         data: getProximoDiaN(20) },
    { id: "pgdas",   titulo: "PGDAS-D — Entrega declaração",    data: getProximoUltimoDiaMes() },
    { id: "efd",     titulo: "EFD-ICMS — Entrega mensal",       data: getProximoDiaN(15) },
    { id: "dctf",    titulo: "DCTF — Vencimento mensal",        data: getProximoDiaN(15) },
    { id: "hibrido", titulo: "Opção Híbrido Setembro",          data: "2026-09-30" },
    { id: "defis",   titulo: "DEFIS — Prazo final",              data: "2027-03-31" },
  ];

  return candidatas.filter(o => {
    const dataObr = new Date(o.data + "T12:00:00");
    return dataObr >= agora && dataObr <= setesDias;
  });
}

const proximasAcoes = [
  {
    id: "hibrido",
    titulo: "Opção Híbrido Setembro",
    descricao: "Oriente clientes sobre opção IBS/CBS fora do DAS",
    data: "2026-09-30",
    icon: TrendingUp,
    cor: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "das",
    titulo: "Vencimento DAS Mensal",
    descricao: `Recolhimento Simples Nacional — dia 20`,
    data: getProximoDiaN(20),
    icon: Clock,
    cor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "defis",
    titulo: "Prazo DEFIS",
    descricao: "Declaração de Informações Socioeconômicas e Fiscais",
    data: "2027-03-31",
    icon: CheckCircle2,
    cor: "text-green-600 dark:text-green-400",
  },
];

export default function Dashboard() {
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null);

  const handleBackup = () => {
    window.open("/api/backup", "_blank");
    setUltimoBackup(new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }));
  };

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  // Calcula obrigações desta semana (dinâmico, recalculado por render)
  const obrigacoesEstaSemana = calcObrigacoesEstaSemana();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Dashboard</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Dashboard</h1>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>Não foi possível carregar os dados do dashboard.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const semClientes = data.total === 0;

  const maxRegime = data.regimeDist.length > 0 ? Math.max(...data.regimeDist.map((r) => r.count)) : 1;
  const maxAnexo = data.anexoDist.length > 0 ? Math.max(...data.anexoDist.map((a) => a.count)) : 1;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Visão geral do escritório</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8 shrink-0"
          onClick={handleBackup}
          title="Fazer backup do banco de dados"
        >
          <Download className="h-3.5 w-3.5" />
          Backup
        </Button>
      </div>

      {/* Empty state */}
      {semClientes && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Building2 className="h-12 w-12 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-lg font-medium">Nenhum cliente cadastrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Comece cadastrando o primeiro cliente para visualizar as análises.
              </p>
            </div>
            <Link href="/clientes">
              <Button>Cadastrar primeiro cliente</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Banner Esta Semana — sempre visível */}
      <div
        className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
          obrigacoesEstaSemana.length > 0
            ? "bg-amber-50 border-amber-300 dark:bg-amber-900/15 dark:border-amber-700"
            : "bg-emerald-50 border-emerald-300 dark:bg-emerald-900/15 dark:border-emerald-700"
        }`}
      >
        <CalendarClock className={`h-4 w-4 mt-0.5 shrink-0 ${
          obrigacoesEstaSemana.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
        }`} />
        <div className="flex-1 min-w-0">
          {obrigacoesEstaSemana.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                ⚠️ {obrigacoesEstaSemana.length} obrigação{obrigacoesEstaSemana.length !== 1 ? "ões vencem" : " vence"} esta semana
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {obrigacoesEstaSemana.map(o => (
                  <li key={o.id} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <span className="font-medium">{o.titulo}</span>
                    <span className="text-amber-500 dark:text-amber-400">— {formatDate(o.data)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              ✓ Nenhuma obrigação nos próximos 7 dias
            </p>
          )}
        </div>
      </div>

      {!semClientes && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Total Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.ativos} ativos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.ativos}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.total > 0 ? Math.round((data.ativos / data.total) * 100) : 0}% do total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Simples Nacional
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.simples}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.total > 0 ? Math.round((data.simples / data.total) * 100) : 0}% do total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Lucro Presumido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.presumido}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.real > 0 ? `+${data.real} Lucro Real` : "0 Lucro Real"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Alertas RBT12 — só exibe se há alertas */}
          {data.alertas && data.alertas.length > 0 && (() => {
            const countDesenq = data.alertas.filter(a => a.tipo === "desenquadramento").length;
            const countHibrido = data.alertas.filter(a => a.tipo === "hibrido_compulsorio").length;
            const countAtencao = data.alertas.filter(a => a.tipo === "atencao").length;
            return (
              <div className="rounded-xl border border-orange-300/60 bg-orange-50/60 dark:bg-orange-900/10 dark:border-orange-700/50 p-4 space-y-3">
                {/* Cabeçalho com contagens */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <h2 className="text-base font-semibold text-orange-800 dark:text-orange-300">
                      Alertas RBT12
                      <span className="ml-1.5 text-sm font-normal text-orange-600 dark:text-orange-400">
                        ({data.alertas.length} cliente{data.alertas.length !== 1 ? "s" : ""})
                      </span>
                    </h2>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {countDesenq > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        <AlertTriangle className="h-3 w-3" /> {countDesenq} Desenquadramento
                      </span>
                    )}
                    {countHibrido > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                        <AlertTriangle className="h-3 w-3" /> {countHibrido} Híbrido Compulsório
                      </span>
                    )}
                    {countAtencao > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                        <AlertTriangle className="h-3 w-3" /> {countAtencao} Atenção
                      </span>
                    )}
                  </div>
                </div>
                {/* Lista clicável de clientes */}
                <div className="grid gap-2">
                  {data.alertas.map((alerta) => {
                    const cfg = alertaConfig[alerta.tipo];
                    return (
                      <Link key={alerta.clienteId} href="/clientes">
                        <div
                          className={`rounded-lg border p-3 flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity ${cfg.color}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{alerta.razaoSocial}</p>
                              <p className="text-xs opacity-70">
                                {formatCNPJ(alerta.cnpj)} · RBT12: {formatCurrency(alerta.rbt12)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={cfg.badgeVariant} className="text-xs whitespace-nowrap">
                              {cfg.label}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribuição por Regime */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Distribuição por Regime
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.regimeDist.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                )}
                {data.regimeDist.map((item) => (
                  <div key={item.regime} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{item.regime}</span>
                      <span className="text-muted-foreground">
                        {item.count} ({maxRegime > 0 ? Math.round((item.count / data.total) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{
                          width: `${maxRegime > 0 ? (item.count / maxRegime) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Distribuição por Anexo (Simples) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                  Anexos Simples Nacional
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.anexoDist.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem clientes no Simples</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {data.anexoDist.map((item) => (
                    <div
                      key={item.anexo}
                      className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border"
                    >
                      <span className="text-xs font-medium text-muted-foreground">Anexo</span>
                      <span className="font-bold text-sm">{item.anexo}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <Badge variant="secondary" className="text-xs">
                        {item.count}
                      </Badge>
                    </div>
                  ))}
                </div>
                {data.anexoDist.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {data.anexoDist.map((item) => (
                      <div key={item.anexo} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">Anexo {item.anexo}</span>
                          <span className="text-muted-foreground">
                            {item.count} ({data.simples > 0 ? Math.round((item.count / data.simples) * 100) : 0}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${maxAnexo > 0 ? (item.count / maxAnexo) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Próximas Ações */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Próximas Ações</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {proximasAcoes.map((acao) => {
                const diasRestantes = getDaysUntil(acao.data);
                const urgente = diasRestantes >= 0 && diasRestantes <= 30;
                const Icon = acao.icon;
                return (
                  <Card
                    key={acao.id}
                    className={urgente ? "border-orange-400/50 bg-orange-500/5" : ""}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${acao.cor}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold leading-tight">{acao.titulo}</p>
                            {urgente && (
                              <Badge variant="destructive" className="text-xs">
                                {diasRestantes === 0 ? "Hoje" : `${diasRestantes}d`}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{acao.descricao}</p>
                          <p className="text-xs font-medium mt-2 text-foreground/70">
                            {formatDate(acao.data)}
                            {diasRestantes > 30 && (
                              <span className="text-muted-foreground ml-1">
                                ({diasRestantes} dias)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Rodapé */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground text-right">
          Último backup: {ultimoBackup ?? "nunca"}
        </p>
      </div>
    </div>
  );
}

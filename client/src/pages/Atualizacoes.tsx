import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Rss,
  RefreshCw,
  ExternalLink,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Building2,
  Scale,
  Store,
  Landmark,
} from "lucide-react";

type FeedItem = {
  id: string;
  titulo: string;
  resumo: string;
  link: string;
  data: string;
  fonte: string;
  sigla: string;
  cor: string;
};

type FeedResponse = {
  items: FeedItem[];
  atualizadoEm: string;
};

const COR_MAP: Record<string, string> = {
  blue:   "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  green:  "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800",
  purple: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  indigo: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  amber:  "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  red:    "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800",
};

const BADGE_COR: Record<string, string> = {
  blue:   "bg-blue-600 hover:bg-blue-700",
  green:  "bg-green-600 hover:bg-green-700",
  purple: "bg-purple-600 hover:bg-purple-700",
  indigo: "bg-indigo-600 hover:bg-indigo-700",
  amber:  "bg-amber-600 hover:bg-amber-700",
  red:    "bg-red-600 hover:bg-red-700",
};

const ICONE_FONTE: Record<string, typeof Rss> = {
  RFB:    Building2,
  SN:     Store,
  CONFAZ: Scale,
  LC:     Landmark,
  EC:     Landmark,
  NT:     FileText,
  NFe:    FileText,
};

function formatData(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function diasAtras(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const dias = Math.floor(diff / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `${dias}d atrás`;
  if (dias < 365) return `${Math.floor(dias / 30)}m atrás`;
  return `${Math.floor(dias / 365)}a atrás`;
}

const FILTROS = ["Todos", "RFB", "SN", "CONFAZ", "LC", "EC", "NT", "NFe"] as const;

export default function Atualizacoes() {
  const [filtro, setFiltro] = useState<string>("Todos");

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery<FeedResponse>({
    queryKey: ["/api/feed"],
    queryFn: () => apiRequest("GET", "/api/feed").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,      // 5 min cache
    refetchInterval: 10 * 60 * 1000, // re-busca a cada 10 min automaticamente
  });

  const items = data?.items ?? [];
  const filtrados = filtro === "Todos" ? items : items.filter((i) => i.sigla === filtro);

  const ultimaAtualizacao = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Rss className="h-5 w-5 text-primary" />
            Atualizações Tributárias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Normas, notas técnicas e novidades da Receita Federal, SEFAZ e Reforma Tributária — atualizadas automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {ultimaAtualizacao && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Atualizado às {ultimaAtualizacao}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="btn-atualizar-feed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Buscando..." : "Atualizar agora"}
          </Button>
        </div>
      </div>

      {/* Fontes conectadas */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Fontes monitoradas
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { sigla: "RFB",    nome: "Receita Federal",           cor: "blue"   },
            { sigla: "SN",     nome: "Portal Simples Nacional",   cor: "green"  },
            { sigla: "CONFAZ", nome: "CONFAZ",                    cor: "purple" },
            { sigla: "LC",     nome: "Leis Complementares",       cor: "indigo" },
            { sigla: "NT",     nome: "Notas Técnicas SEFAZ",      cor: "blue"   },
            { sigla: "EC",     nome: "Emendas Constitucionais",   cor: "purple" },
          ].map((f) => (
            <div key={f.sigla} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span>{f.nome}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filtro === f ? "default" : "outline"}
            className="text-xs h-7 px-3"
            onClick={() => setFiltro(f)}
            data-testid={`filtro-${f.toLowerCase()}`}
          >
            {f}
            {f !== "Todos" && data && (
              <span className="ml-1.5 text-xs opacity-70">
                {items.filter((i) => i.sigla === f).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      <Separator />

      {/* Estados */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2 animate-pulse">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-full bg-muted rounded" />
              <div className="h-3 w-2/3 bg-muted rounded" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">Não foi possível buscar atualizações</p>
            <p className="text-xs text-red-700 dark:text-red-400">Verifique sua conexão e tente novamente.</p>
            <Button size="sm" variant="outline" className="text-xs mt-2" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      {!isLoading && !isError && filtrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Rss className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">Nenhum item encontrado para este filtro.</p>
        </div>
      )}

      {/* Lista de itens */}
      {!isLoading && !isError && filtrados.length > 0 && (
        <div className="space-y-3" data-testid="lista-feed">
          {filtrados.map((item) => {
            const IconeFonte = ICONE_FONTE[item.sigla] ?? Rss;
            const corClass   = COR_MAP[item.cor] ?? COR_MAP.blue;
            const badgeClass = BADGE_COR[item.cor] ?? BADGE_COR.blue;

            return (
              <div
                key={item.id}
                className="rounded-lg border bg-card p-4 space-y-2.5 hover:shadow-sm transition-shadow"
                data-testid={`feed-item-${item.id}`}
              >
                {/* Linha superior */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs px-2 py-0.5 ${badgeClass}`}>
                    <IconeFonte className="h-3 w-3 mr-1" />
                    {item.sigla}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{item.fonte}</span>
                  <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatData(item.data)}
                    <span className="text-muted-foreground/60">({diasAtras(item.data)})</span>
                  </span>
                </div>

                {/* Título */}
                <p className="text-sm font-semibold text-foreground leading-snug">{item.titulo}</p>

                {/* Resumo */}
                {item.resumo && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.resumo}</p>
                )}

                {/* Link */}
                {item.link && (
                  <div>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                      data-testid={`link-feed-${item.id}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver documento oficial
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rodapé informativo */}
      {!isLoading && filtrados.length > 0 && (
        <div className="text-xs text-muted-foreground text-center pt-2 pb-4 space-y-1">
          <p>
            {filtrados.length} {filtrados.length === 1 ? "item" : "itens"} —
            feed atualizado automaticamente a cada 10 minutos
          </p>
          <p>
            Fontes: Receita Federal · SEFAZ Nacional · CONFAZ · Diário Oficial da União
          </p>
        </div>
      )}
    </div>
  );
}

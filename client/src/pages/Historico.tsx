import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, History, Building2, User, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Consulta } from "@shared/schema";

export default function Historico() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: consultas = [], isLoading } = useQuery<Consulta[]>({
    queryKey: ["/api/consultas"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/consultas/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/consultas"] }); toast({ title: "Consulta removida" }); },
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const sorted = [...consultas].reverse();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Histórico de Consultas</h1>
          <p className="text-sm text-muted-foreground mt-1">{consultas.length} consulta{consultas.length !== 1 ? "s" : ""} realizadas</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma consulta realizada ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(c => {
            const res = JSON.parse(c.resultado);
            return (
              <Card key={c.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="codigo-fiscal font-semibold text-primary">{c.ncm}</span>
                        <span className="text-muted-foreground text-xs">/</span>
                        <span className="codigo-fiscal font-semibold">{c.cfop}</span>
                        <Badge className={c.modalidade === "B2B" ? "badge-b2b" : "badge-b2c"} variant="secondary">
                          {c.modalidade === "B2B" ? <Building2 className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                          {c.modalidade}
                        </Badge>
                        <Badge className={c.regime === "Simples" ? "badge-simples" : "badge-presumido"} variant="secondary">
                          {c.regime === "Simples" ? "Simples Nacional" : "Lucro Presumido"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{res.resumo.cfopDescricao}</span>
                        <span>·</span>
                        <span>
                          {c.regime === "Simples"
                            ? `CSOSN: ${res.icms.csosn}`
                            : `CST ICMS: ${res.icms.cst}`
                          }
                        </span>
                        <span>·</span>
                        <span>cClassTrib: <span className="codigo-fiscal font-medium text-foreground">{res.ibsCbs.cClassTrib}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:block">{formatDate(c.criadoEm)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(c.id)}
                        data-testid={`button-delete-consulta-${c.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

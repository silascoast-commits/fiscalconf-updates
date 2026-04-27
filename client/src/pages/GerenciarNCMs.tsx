import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, Search, ChevronDown, ChevronUp, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Ncm } from "@shared/schema";

const CCLASSTRIB_OPTIONS = [
  { value: "010001", label: "010001 — Tributação integral (padrão)" },
  { value: "200010", label: "200010 — Alíquota zero (cesta básica)" },
  { value: "200011", label: "200011 — Alíquota zero (medicamentos)" },
  { value: "200020", label: "200020 — Reduzida 60% (educação)" },
  { value: "200021", label: "200021 — Reduzida 60% (saúde)" },
  { value: "200040", label: "200040 — Reduzida 50% (agropecuário)" },
  { value: "400001", label: "400001 — Isenção" },
  { value: "410010", label: "410010 — Não incidência (exportação)" },
  { value: "620001", label: "620001 — Monofásico (combustíveis)" },
  { value: "820001", label: "820001 — Regime específico Simples" },
];

const CST_ICMS_OPTIONS = [
  { value: "00", label: "00 — Tributada integralmente" },
  { value: "20", label: "20 — Com redução de base" },
  { value: "40", label: "40 — Isenta" },
  { value: "41", label: "41 — Não tributada" },
  { value: "60", label: "60 — ICMS cobrado por ST" },
  { value: "90", label: "90 — Outros" },
];

const CSOSN_OPTIONS = [
  { value: "101", label: "101 — Tributada com crédito" },
  { value: "102", label: "102 — Tributada sem crédito" },
  { value: "400", label: "400 — Não tributada" },
  { value: "500", label: "500 — ICMS por ST" },
  { value: "900", label: "900 — Outros" },
];

const CST_PIS_OPTIONS_SAIDA = [
  { value: "01", label: "01 — Tributável (alíquota normal)" },
  { value: "06", label: "06 — Alíquota zero" },
  { value: "07", label: "07 — Isenta" },
  { value: "08", label: "08 — Sem incidência" },
  { value: "04", label: "04 — Monofásica" },
  { value: "05", label: "05 — ST" },
];

function NcmForm({ ncm, onSave, onClose }: { ncm?: Ncm; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    codigo: ncm?.codigo || "",
    descricao: ncm?.descricao || "",
    aliquotaIpi: ncm?.aliquotaIpi?.toString() || "0",
    cClassTribSimples: ncm?.cClassTribSimples || "820001",
    cClassTribPresumido: ncm?.cClassTribPresumido || "010001",
    cstIcmsSimples: ncm?.cstIcmsSimples || "102",
    cstIcmsPresumido: ncm?.cstIcmsPresumido || "00",
    cstPisSimples: ncm?.cstPisSimples || "07",
    cstPisPresumido: ncm?.cstPisPresumido || "01",
    cstCofinsSimples: ncm?.cstCofinsSimples || "07",
    cstCofinsPresumido: ncm?.cstCofinsPresumido || "01",
    cBenef: ncm?.cBenef || "",
    cEst: ncm?.cEst || "",
    observacoes: ncm?.observacoes || "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, aliquotaIpi: parseFloat(form.aliquotaIpi) || 0 });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>NCM <span className="text-destructive">*</span></Label>
          <Input
            data-testid="form-ncm-codigo"
            value={form.codigo}
            onChange={e => set("codigo", e.target.value.replace(/\D/g, "").substring(0, 8))}
            placeholder="00000000"
            className="codigo-fiscal"
            disabled={!!ncm}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Alíquota IPI (%)</Label>
          <Input
            data-testid="form-ncm-ipi"
            value={form.aliquotaIpi}
            onChange={e => set("aliquotaIpi", e.target.value)}
            placeholder="0"
            type="number" step="0.01" min="0" max="100"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Descrição <span className="text-destructive">*</span></Label>
        <Input
          data-testid="form-ncm-descricao"
          value={form.descricao}
          onChange={e => set("descricao", e.target.value)}
          placeholder="Ex: Calçados de couro"
        />
      </div>

      {/* Simples Nacional */}
      <div className="border rounded-lg p-3 space-y-3 bg-emerald-50/50 dark:bg-emerald-900/10">
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Simples Nacional</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">cClassTrib IBS/CBS</Label>
            <select
              className="w-full text-xs border rounded px-2 py-1.5 bg-background codigo-fiscal"
              value={form.cClassTribSimples}
              onChange={e => set("cClassTribSimples", e.target.value)}
              data-testid="form-cclasstrib-simples"
            >
              {CCLASSTRIB_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CSOSN</Label>
            <select
              className="w-full text-xs border rounded px-2 py-1.5 bg-background codigo-fiscal"
              value={form.cstIcmsSimples}
              onChange={e => set("cstIcmsSimples", e.target.value)}
            >
              {CSOSN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CST PIS/COFINS</Label>
            <select
              className="w-full text-xs border rounded px-2 py-1.5 bg-background codigo-fiscal"
              value={form.cstPisSimples}
              onChange={e => { set("cstPisSimples", e.target.value); set("cstCofinsSimples", e.target.value); }}
            >
              {CST_PIS_OPTIONS_SAIDA.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Lucro Presumido */}
      <div className="border rounded-lg p-3 space-y-3 bg-blue-50/50 dark:bg-blue-900/10">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Lucro Presumido / Real</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">cClassTrib IBS/CBS</Label>
            <select
              className="w-full text-xs border rounded px-2 py-1.5 bg-background codigo-fiscal"
              value={form.cClassTribPresumido}
              onChange={e => set("cClassTribPresumido", e.target.value)}
              data-testid="form-cclasstrib-presumido"
            >
              {CCLASSTRIB_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CST ICMS</Label>
            <select
              className="w-full text-xs border rounded px-2 py-1.5 bg-background codigo-fiscal"
              value={form.cstIcmsPresumido}
              onChange={e => set("cstIcmsPresumido", e.target.value)}
            >
              {CST_ICMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CST PIS/COFINS</Label>
            <select
              className="w-full text-xs border rounded px-2 py-1.5 bg-background codigo-fiscal"
              value={form.cstPisPresumido}
              onChange={e => { set("cstPisPresumido", e.target.value); set("cstCofinsPresumido", e.target.value); }}
            >
              {CST_PIS_OPTIONS_SAIDA.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* cBenef e cEST */}
      <div className="border rounded-lg p-3 space-y-3 bg-amber-50/50 dark:bg-amber-900/10">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">cBenef / cEST</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">cBenef — Cód. Benefício Fiscal ICMS</Label>
            <Input
              data-testid="form-ncm-cbenef"
              value={form.cBenef}
              onChange={e => set("cBenef", e.target.value.toUpperCase().substring(0, 10))}
              placeholder="Ex: SP12345678"
              className="codigo-fiscal"
            />
            <p className="text-xs text-muted-foreground">UF + 8 dígitos — exigido quando há isenção/redução de ICMS</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">cEST — Cód. Especificador ST</Label>
            <Input
              data-testid="form-ncm-cest"
              value={form.cEst}
              onChange={e => set("cEst", e.target.value.replace(/\D/g, "").substring(0, 7))}
              placeholder="Ex: 0100100"
              className="codigo-fiscal"
            />
            <p className="text-xs text-muted-foreground">7 dígitos — Convênio ICMS 52/2017, exigido nas operações com ST</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Observações</Label>
        <Input
          value={form.observacoes}
          onChange={e => set("observacoes", e.target.value)}
          placeholder="Ex: Sujeito a ST conforme convênio ICMS..."
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" data-testid="button-salvar-ncm">
          {ncm ? "Atualizar NCM" : "Cadastrar NCM"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function GerenciarNCMs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingNcm, setEditingNcm] = useState<Ncm | null | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: ncms = [], isLoading } = useQuery<Ncm[]>({
    queryKey: ["/api/ncms"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/ncms", data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ncms"] }); setEditingNcm(undefined); toast({ title: "NCM cadastrado com sucesso!" }); },
    onError: () => toast({ title: "Erro ao cadastrar NCM", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/ncms/${id}`, data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ncms"] }); setEditingNcm(undefined); toast({ title: "NCM atualizado!" }); },
    onError: () => toast({ title: "Erro ao atualizar NCM", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/ncms/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ncms"] }); toast({ title: "NCM removido" }); },
  });

  const filtered = ncms.filter(n =>
    n.codigo.includes(search) || n.descricao.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (data: any) => {
    if (editingNcm?.id) updateMutation.mutate({ id: editingNcm.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Gerenciar NCMs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre seus NCMs com os códigos tributários corretos para consultas mais precisas.
          </p>
        </div>
        <Button onClick={() => setEditingNcm(null)} gap-2 data-testid="button-novo-ncm" className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Novo NCM
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search-ncm"
          placeholder="Buscar por código ou descrição..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Database className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? "Nenhum NCM encontrado" : "Nenhum NCM cadastrado ainda"}</p>
          {!search && <Button variant="outline" className="mt-3 gap-2" onClick={() => setEditingNcm(null)}><Plus className="h-4 w-4" /> Cadastrar primeiro NCM</Button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ncm => (
            <Card key={ncm.id} className="overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpandedId(expandedId === ncm.id ? null : ncm.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="codigo-fiscal font-semibold text-primary">{ncm.codigo}</span>
                    <span className="text-sm text-foreground truncate">{ncm.descricao}</span>
                  </div>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">IPI: <strong>{ncm.aliquotaIpi}%</strong></span>
                    <span className="text-[10px] text-muted-foreground">SN: <strong className="codigo-fiscal">{ncm.cClassTribSimples}</strong></span>
                    <span className="text-[10px] text-muted-foreground">LP: <strong className="codigo-fiscal">{ncm.cClassTribPresumido}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setEditingNcm(ncm); }} data-testid={`button-edit-${ncm.id}`}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); deleteMutation.mutate(ncm.id); }} data-testid={`button-delete-${ncm.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {expandedId === ncm.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {expandedId === ncm.id && (
                <div className="border-t bg-muted/30 px-4 py-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div><span className="text-muted-foreground">CSOSN (SN)</span><br /><span className="codigo-fiscal font-semibold">{ncm.cstIcmsSimples}</span></div>
                    <div><span className="text-muted-foreground">CST ICMS (LP)</span><br /><span className="codigo-fiscal font-semibold">{ncm.cstIcmsPresumido}</span></div>
                    <div><span className="text-muted-foreground">CST PIS/COFINS (SN)</span><br /><span className="codigo-fiscal font-semibold">{ncm.cstPisSimples}</span></div>
                    <div><span className="text-muted-foreground">CST PIS/COFINS (LP)</span><br /><span className="codigo-fiscal font-semibold">{ncm.cstPisPresumido}</span></div>
                  </div>
                  {ncm.observacoes && <p className="text-xs text-muted-foreground mt-2 italic">{ncm.observacoes}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={editingNcm !== undefined} onOpenChange={open => !open && setEditingNcm(undefined)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingNcm?.id ? "Editar NCM" : "Cadastrar NCM"}</DialogTitle>
          </DialogHeader>
          {editingNcm !== undefined && (
            <NcmForm
              ncm={editingNcm ?? undefined}
              onSave={handleSave}
              onClose={() => setEditingNcm(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

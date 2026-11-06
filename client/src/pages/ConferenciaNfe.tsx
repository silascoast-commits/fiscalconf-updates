import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useCliente } from "@/contexts/ClienteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Download, Info, FileCode2, Building2 } from "lucide-react";
import { formatarNcm } from "@shared/reformaTributaria";
import { STATUS_LABEL, type StatusConformidade, type Gravidade } from "@shared/conformidade";

interface ItemConf {
  notaId: number; numero: string; serie: string; tipo: "entrada" | "saida"; dataEmissao: string; emitente: string; emitCnpj: string;
  item: number; ncm: string; descricao: string; vTotal: number;
  status: StatusConformidade; gravidade: Gravidade; mensagem: string; statusLabel: string;
  informado: { cst: string; cClassTrib: string };
  esperado: { cst: string; cClassTrib: string; tratamento: string; reducao: number; fonte: string };
  esperadoDescricao: string;
}
interface RespostaConf { totalNotas: number; totalItens: number; resumo: Record<string, number>; itens: ItemConf[] }

const COR_GRAV: Record<Gravidade, string> = {
  alta: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  media: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  baixa: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  nenhuma: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};
const ORDEM: StatusConformidade[] = ["vedado", "beneficio_indevido", "beneficio_nao_aplicado", "sem_cclasstrib", "divergente", "verificar", "ncm_invalido", "ok"];
const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ConferenciaNfe() {
  const { clienteAtivo } = useCliente();
  const [filtroStatus, setFiltroStatus] = useState<string>("problemas");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const url = `/api/xml-conformidade${clienteAtivo ? `?clienteId=${clienteAtivo.id}` : ""}`;
  const { data, isLoading } = useQuery<RespostaConf>({ queryKey: [url], staleTime: 0 });

  const itens = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (data?.itens || [])
      .filter(i => filtroStatus === "todos" ? true : filtroStatus === "problemas" ? i.status !== "ok" : i.status === filtroStatus)
      .filter(i => filtroTipo === "todos" || i.tipo === filtroTipo)
      .filter(i => !t || `${i.ncm} ${i.descricao} ${i.emitente} ${i.numero}`.toLowerCase().includes(t))
      .sort((a, b) => ORDEM.indexOf(a.status) - ORDEM.indexOf(b.status));
  }, [data, filtroStatus, filtroTipo, busca]);

  const semGrupo = data && data.totalItens > 0 && (data.resumo["sem_cclasstrib"] || 0) === data.totalItens;

  const exportar = () => {
    const cab = ["Tipo", "Nota", "Serie", "Emissao", "Emitente", "CNPJ", "Item", "NCM", "Descricao", "Valor", "CST_informado", "cClassTrib_informado", "cClassTrib_esperado", "Tratamento_esperado", "Status", "Gravidade", "Mensagem"];
    const rows = itens.map(i => [i.tipo, i.numero, i.serie, i.dataEmissao, i.emitente, i.emitCnpj, i.item, i.ncm, i.descricao, String(i.vTotal).replace(".", ","),
      i.informado.cst, i.informado.cClassTrib, i.esperado.cClassTrib, i.esperado.tratamento, i.statusLabel, i.gravidade, i.mensagem]);
    const csv = [cab, ...rows].map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `conferencia-cclasstrib-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Conferência de cClassTrib nas NF-e</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cruza o CST/cClassTrib de cada item das notas importadas com a tabela oficial (SVRS). Aponta benefício não aplicado (IBS/CBS cobrado a maior), benefício indevido (risco de autuação ou de glosa), códigos vedados e itens sem o grupo IBS/CBS.
        </p>
      </div>

      {clienteAtivo ? (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <Building2 className="h-4 w-4 text-primary" /><span className="font-medium text-primary">{clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial}</span>
          <span className="text-muted-foreground text-xs">— somente notas deste cliente</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Mostrando notas de todos os clientes. Selecione uma empresa no topo para filtrar.</p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Analisando notas...</p>}

      {data && data.totalNotas === 0 && (
        <Alert><FileCode2 className="h-4 w-4" /><AlertDescription className="text-sm">Nenhuma NF-e importada. Importe os XML em <Link href="/xml" className="font-medium text-primary hover:underline">XML NF-e</Link> e volte aqui.</AlertDescription></Alert>
      )}
      {semGrupo && (
        <Alert className="border-amber-300/60 bg-amber-50 dark:bg-amber-950/20">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            Nenhum item tem o grupo IBS/CBS. Se as notas foram importadas antes desta versão, <strong>reimporte os XML</strong>: o sistema agora lê o grupo <code>IBSCBS</code> (CST, cClassTrib, gIBSCBS) do leiaute da NT 2025.002. Se forem notas recentes, o emitente não está preenchendo o grupo — o que é obrigatório desde 2026.
          </AlertDescription>
        </Alert>
      )}

      {data && data.totalItens > 0 && (
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {ORDEM.filter(s => data.resumo[s]).map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)} className={`rounded-lg border p-3 text-left hover:bg-muted/40 ${filtroStatus === s ? "ring-2 ring-primary" : ""}`}>
                <div className="text-2xl font-bold">{data.resumo[s]}</div>
                <div className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</div>
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{data.totalNotas} nota(s) · {data.totalItens} item(ns) · exibindo {itens.length}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-52" aria-label="Filtrar status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="problemas">Somente pendências</SelectItem>
                    <SelectItem value="todos">Todos os itens</SelectItem>
                    {ORDEM.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="w-40" aria-label="Filtrar tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Entradas e saídas</SelectItem>
                    <SelectItem value="entrada">Entradas (fornecedores)</SelectItem>
                    <SelectItem value="saida">Saídas (emissão própria)</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="w-full sm:w-64" placeholder="Buscar NCM, produto, emitente, nº" value={busca} onChange={e => setBusca(e.target.value)} />
                <Button variant="outline" className="sm:ml-auto" onClick={exportar} disabled={!itens.length}><Download className="h-4 w-4 mr-1.5" />Exportar CSV</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Status</TableHead><TableHead>Nota</TableHead><TableHead>Item / NCM</TableHead><TableHead>Informado</TableHead><TableHead>Esperado</TableHead><TableHead className="min-w-[280px]">Análise</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.slice(0, 500).map((i, k) => (
                      <TableRow key={k}>
                        <TableCell><Badge variant="secondary" className={COR_GRAV[i.gravidade]}>{i.statusLabel}</Badge></TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          <div className="font-medium">{i.tipo === "entrada" ? "Entrada" : "Saída"} nº {i.numero}</div>
                          <div className="text-muted-foreground max-w-[160px] truncate">{i.emitente}</div>
                          <div className="text-muted-foreground">{i.dataEmissao}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="codigo-fiscal font-medium">{formatarNcm(i.ncm)}</div>
                          <div className="text-muted-foreground max-w-[200px] truncate">{i.item}. {i.descricao}</div>
                          <div>{brl(i.vTotal)}</div>
                        </TableCell>
                        <TableCell className="text-xs"><span className="codigo-fiscal">{i.informado.cClassTrib || "—"}</span><div className="text-muted-foreground">CST {i.informado.cst || "—"}</div></TableCell>
                        <TableCell className="text-xs"><span className="codigo-fiscal">{i.esperado.cClassTrib}</span><div className="text-muted-foreground">{i.esperado.tratamento}</div></TableCell>
                        <TableCell className="text-xs">{i.mensagem}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {itens.length > 500 && <p className="text-xs text-muted-foreground mt-2">Exibindo os 500 primeiros — exporte o CSV para ver todos.</p>}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        A conferência usa o enquadramento do NCM; a tabela oficial vincula o benefício ao NCM <em>e</em> à descrição do item do anexo. Itens marcados como "Verificar condição" ou "Benefício não aplicado" podem estar corretos se o produto não corresponder à descrição — confirme antes de cobrar o fornecedor ou retificar a emissão. Consulte o detalhe em <Link href="/reforma" className="text-primary hover:underline">Reforma NCM/NBS</Link>.
      </p>
    </div>
  );
}

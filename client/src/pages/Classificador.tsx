import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCliente } from "@/contexts/ClienteContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ListChecks, Download, Save, AlertTriangle, ShieldCheck, Info } from "lucide-react";

type Situacao = "VERDE" | "AMARELO" | "VERMELHO" | "INVALIDO";

interface Opcao {
  anexo: string; artigo: string; tema: string; item: string;
  cst: string; cClassTrib: string; reducao: number; condicao?: string;
}

interface Resultado {
  entrada: string; ncm: string; ncmFormatado: string; zeroCorrigido: boolean;
  situacao: Situacao; cst?: string; cClassTrib?: string; opcoes: Opcao[];
  baseLegal: string; mensagem?: string;
  descricaoCadastro: string | null;
  cClassTribCadastroSimples: string | null;
  cClassTribCadastroPresumido: string | null;
}

interface Operacao {
  tributavel: boolean; cfop: string; descricao: string;
  cst?: string; cClassTrib?: string; baseLegal?: string; observacao?: string;
}

// Escolha do usuário por NCM: índice da opção, ou "integral"
type Escolha = number | "integral";

const COR: Record<Situacao | "RESOLVIDO", string> = {
  VERDE: "bg-emerald-600 text-white",
  AMARELO: "bg-amber-400 text-black",
  VERMELHO: "bg-red-600 text-white",
  RESOLVIDO: "bg-blue-600 text-white",
  INVALIDO: "bg-zinc-800 text-white",
};

const LEGENDA: { s: Situacao | "RESOLVIDO"; label: string; texto: string }[] = [
  { s: "VERDE", label: "Verde", texto: "Não consta nos anexos → tributação integral (000 / 000001)" },
  { s: "AMARELO", label: "Amarelo", texto: "Um enquadramento → já preenchido, mas confira a condição" },
  { s: "VERMELHO", label: "Vermelho", texto: "Mais de um enquadramento → escolha na coluna Decisão" },
  { s: "RESOLVIDO", label: "Resolvido", texto: "Era vermelho e você já escolheu" },
  { s: "INVALIDO", label: "Inválido", texto: "NCM sem 8 dígitos → corrija o código" },
];

const POR_PAGINA = 300;

function reducaoTxt(r: number) {
  return r === 100 ? "alíquota zero" : `redução de ${r}%`;
}

export default function Classificador() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { clienteAtivo } = useCliente() as any;

  const [texto, setTexto] = useState("");
  const [cfop, setCfop] = useState("");
  const [deduplicar, setDeduplicar] = useState(true);
  const [operacao, setOperacao] = useState<Operacao | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [filtro, setFiltro] = useState<Situacao | "RESOLVIDO" | "TODOS">("TODOS");
  const [limite, setLimite] = useState(POR_PAGINA);
  const regimeCliente = String(clienteAtivo?.regime || "").toLowerCase().includes("simples") ? "simples" : "presumido";
  const [regime, setRegime] = useState<"simples" | "presumido" | "ambos">(clienteAtivo ? regimeCliente : "ambos");

  const classificar = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/classificador", { texto, cfop });
      return res.json() as Promise<{ operacao: Operacao | null; resultados: Resultado[] }>;
    },
    onSuccess: data => {
      let lista = data.resultados;
      if (deduplicar) {
        const vistos = new Set<string>();
        lista = lista.filter(r => {
          const k = r.ncm || `inv:${r.entrada}`;
          if (vistos.has(k)) return false;
          vistos.add(k);
          return true;
        });
      }
      setOperacao(data.operacao);
      setResultados(lista);
      setEscolhas({});
      setFiltro("TODOS");
      setLimite(POR_PAGINA);
    },
    onError: (e: Error) => toast({ title: "Erro ao classificar", description: e.message, variant: "destructive" }),
  });

  // Resultado final de cada linha, já considerando a escolha do usuário
  const finais = useMemo(() => resultados.map(r => {
    const esc = r.ncm ? escolhas[r.ncm] : undefined;
    if (esc === undefined) {
      return { r, status: r.situacao as Situacao | "RESOLVIDO", cst: r.cst, cClassTrib: r.cClassTrib, baseLegal: r.baseLegal, anexo: r.opcoes[0]?.anexo, reducao: r.opcoes.length === 1 ? r.opcoes[0].reducao : undefined };
    }
    if (esc === "integral") {
      return { r, status: "RESOLVIDO" as const, cst: "000", cClassTrib: "000001", baseLegal: "Tributação integral (decisão do usuário)", anexo: undefined, reducao: undefined };
    }
    const o = r.opcoes[esc];
    return { r, status: "RESOLVIDO" as const, cst: o.cst, cClassTrib: o.cClassTrib, baseLegal: `${o.artigo}, LC 214/25 — ${o.tema} (${o.anexo}, ${reducaoTxt(o.reducao)})`, anexo: o.anexo, reducao: o.reducao };
  }), [resultados, escolhas]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = { VERDE: 0, AMARELO: 0, VERMELHO: 0, RESOLVIDO: 0, INVALIDO: 0 };
    finais.forEach(f => { c[f.status]++; });
    return c;
  }, [finais]);

  const visiveis = filtro === "TODOS" ? finais : finais.filter(f => f.status === filtro);
  const prontos = finais.filter(f => f.cClassTrib && f.r.ncm);

  const salvar = useMutation({
    mutationFn: async () => {
      const itens = prontos.map(f => ({
        ncm: f.r.ncm,
        cClassTrib: f.cClassTrib!,
        baseLegal: f.baseLegal,
        descricao: f.r.descricaoCadastro || (f.r.opcoes.length === 1 ? f.r.opcoes[0].item : undefined),
      }));
      const res = await apiRequest("POST", "/api/classificador/salvar", { regime, itens });
      return res.json() as Promise<{ criados: number; atualizados: number }>;
    },
    onSuccess: d => {
      qc.invalidateQueries({ queryKey: ["/api/ncms"] });
      toast({ title: "Cadastro de NCMs atualizado", description: `${d.criados} criado(s), ${d.atualizados} atualizado(s).` });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  function exportarCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [
      ["NCM", "Descrição", "Situação", "CST IBS/CBS", "cClassTrib", "Anexo", "Redução", "Base legal", "Observação"].map(esc).join(";"),
      ...finais.map(f => [
        f.r.ncmFormatado, f.r.descricaoCadastro || f.r.opcoes.map(o => o.item).join(" / "), f.status,
        f.cst, f.cClassTrib, f.anexo, f.reducao !== undefined ? reducaoTxt(f.reducao) : "",
        f.baseLegal, f.r.mensagem,
      ].map(esc).join(";")),
    ];
    if (operacao && !operacao.tributavel) {
      linhas.unshift(esc(`ATENÇÃO: CFOP ${operacao.cfop} (${operacao.descricao}) — CST ${operacao.cst} / cClassTrib ${operacao.cClassTrib}. A classificação por NCM abaixo NÃO se aplica a esta operação.`));
    }
    const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "classificacao_ibs_cbs.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const qtdLinhas = texto.split(/\r?\n/).filter(l => l.trim()).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" /> Classificador IBS/CBS em lote
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cole a lista de NCMs e receba o CST e o cClassTrib de cada item, com o anexo da LC 214/2025 e a base legal.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <b>A ordem importa:</b> primeiro a <b>operação</b> (CFOP). Se ela não for tributada (exportação, transferência,
              bonificação), o CST vem da operação e o NCM não importa. Só depois o <b>produto</b> (NCM).
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ncms">NCMs (um por linha — com ou sem pontos; pode colar a coluna do Excel com a descrição junto)</Label>
              <Textarea
                id="ncms"
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder={"1902.11.00\n19053100\n3808.94.19 Desinfetante\n4031000"}
                className="font-mono text-xs min-h-[180px]"
                data-testid="classificador-texto"
              />
              <p className="text-[11px] text-muted-foreground">{qtdLinhas} linha(s). NCM com 7 dígitos tem o zero à esquerda completado (o Excel costuma removê-lo).</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cfop">CFOP da operação (opcional)</Label>
                <Input id="cfop" value={cfop} onChange={e => setCfop(e.target.value)} placeholder="ex.: 5102" maxLength={5} className="font-mono" data-testid="classificador-cfop" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={deduplicar} onChange={e => setDeduplicar(e.target.checked)} />
                Remover NCMs repetidos
              </label>
              <Button className="w-full" onClick={() => classificar.mutate()} disabled={!texto.trim() || classificar.isPending} data-testid="classificador-executar">
                {classificar.isPending ? "Classificando…" : "Classificar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {operacao && (
        operacao.tributavel ? (
          operacao.observacao && (
            <div className="rounded-lg border px-4 py-2.5 text-sm flex gap-2 bg-muted/40">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <span><b>CFOP {operacao.cfop} — {operacao.descricao}.</b> {operacao.observacao}</span>
            </div>
          )
        ) : (
          <div className="rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-3 text-sm flex gap-3" data-testid="classificador-operacao">
            <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-200">
                CFOP {operacao.cfop} — {operacao.descricao}: CST {operacao.cst} / cClassTrib {operacao.cClassTrib}
              </p>
              <p className="text-xs text-blue-900/80 dark:text-blue-200/80 mt-0.5">
                {operacao.baseLegal}. Para esta operação a classificação por NCM abaixo <b>não se aplica</b> — ela serve só para as vendas tributadas desses produtos.
              </p>
            </div>
          </div>
        )
      )}

      {resultados.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={() => { setFiltro("TODOS"); setLimite(POR_PAGINA); }}
              className={`text-xs px-3 py-1.5 rounded-full border ${filtro === "TODOS" ? "bg-foreground text-background" : "bg-background"}`}>
              Todos · {finais.length}
            </button>
            {LEGENDA.map(l => (
              <button key={l.s} title={l.texto} onClick={() => { setFiltro(l.s); setLimite(POR_PAGINA); }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium ${COR[l.s]} ${filtro === l.s ? "ring-2 ring-offset-2 ring-foreground" : "opacity-90"}`}
                data-testid={`filtro-${l.s.toLowerCase()}`}>
                {l.label} · {contagem[l.s]}
              </button>
            ))}
            <div className="ml-auto flex flex-wrap gap-2 items-center">
              <Button variant="outline" size="sm" onClick={exportarCsv} data-testid="classificador-csv">
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
              <select className="text-xs border rounded px-2 py-1.5 bg-background" value={regime} onChange={e => setRegime(e.target.value as any)} data-testid="classificador-regime">
                <option value="ambos">Gravar p/ Simples e Presumido</option>
                <option value="simples">Gravar p/ Simples</option>
                <option value="presumido">Gravar p/ Presumido</option>
              </select>
              <Button size="sm" onClick={() => salvar.mutate()} disabled={!prontos.length || salvar.isPending} data-testid="classificador-salvar">
                <Save className="h-4 w-4 mr-1" /> Salvar {prontos.length} no cadastro
              </Button>
            </div>
          </div>

          {contagem.VERMELHO > 0 && (
            <p className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> {contagem.VERMELHO} NCM(s) em vermelho ficam fora do salvamento até você escolher o enquadramento.
            </p>
          )}

          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">NCM</th>
                  <th className="px-3 py-2 font-semibold">Descrição / item do anexo</th>
                  <th className="px-3 py-2 font-semibold">Situação</th>
                  <th className="px-3 py-2 font-semibold">CST</th>
                  <th className="px-3 py-2 font-semibold">cClassTrib</th>
                  <th className="px-3 py-2 font-semibold min-w-[220px]">Base legal</th>
                  <th className="px-3 py-2 font-semibold min-w-[220px]">Conferir / Decisão</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.slice(0, limite).map((f, i) => {
                  const r = f.r;
                  const atualCadastro = regime === "simples" ? r.cClassTribCadastroSimples : r.cClassTribCadastroPresumido;
                  const divergente = atualCadastro && f.cClassTrib && atualCadastro !== f.cClassTrib;
                  return (
                    <tr key={`${r.ncm || r.entrada}-${i}`} className="border-t align-top">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {r.ncmFormatado}
                        {r.zeroCorrigido && <div className="text-[10px] text-amber-700 dark:text-amber-400">zero completado (era {r.entrada})</div>}
                      </td>
                      <td className="px-3 py-2">
                        {r.descricaoCadastro && <div>{r.descricaoCadastro}</div>}
                        {r.opcoes.length > 0 && (
                          <div className="text-muted-foreground">{r.opcoes.map(o => `${o.anexo}: ${o.item}`).join(" · ")}</div>
                        )}
                        {!r.descricaoCadastro && !r.opcoes.length && r.situacao !== "INVALIDO" && <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={`${COR[f.status]} text-[10px] pointer-events-none`}>{f.status === "INVALIDO" ? "INVÁLIDO" : f.status}</Badge>
                      </td>
                      <td className="px-3 py-2 font-mono">{f.cst || "—"}</td>
                      <td className="px-3 py-2 font-mono">
                        {f.cClassTrib || "—"}
                        {divergente && <div className="text-[10px] text-red-600" title="Valor atual no cadastro de NCMs">cadastro: {atualCadastro}</div>}
                      </td>
                      <td className="px-3 py-2">{f.baseLegal || "—"}</td>
                      <td className="px-3 py-2 space-y-1">
                        {(r.situacao === "VERMELHO" || r.situacao === "AMARELO") && r.ncm && (
                          <select
                            className={`w-full text-xs border rounded px-2 py-1 bg-background ${r.situacao === "VERMELHO" && escolhas[r.ncm] === undefined ? "border-red-500" : ""}`}
                            value={escolhas[r.ncm] === undefined ? "" : String(escolhas[r.ncm])}
                            onChange={e => {
                              const v = e.target.value;
                              setEscolhas(prev => {
                                const n = { ...prev };
                                if (v === "") delete n[r.ncm]; else n[r.ncm] = v === "integral" ? "integral" : Number(v);
                                return n;
                              });
                            }}
                            data-testid={`decisao-${r.ncm}`}
                          >
                            <option value="">{r.situacao === "VERMELHO" ? "— escolha —" : "Manter sugestão"}</option>
                            {r.opcoes.map((o, idx) => (
                              <option key={idx} value={idx}>{o.anexo} · {o.cClassTrib} · {reducaoTxt(o.reducao)} — {o.item}</option>
                            ))}
                            <option value="integral">Tributação integral · 000001</option>
                          </select>
                        )}
                        {r.mensagem && !(r.situacao === "VERMELHO" && f.status === "RESOLVIDO") && <div className="text-muted-foreground">{r.mensagem}</div>}
                        {r.situacao === "VERMELHO" && r.opcoes.map((o, idx) => o.condicao && (
                          <div key={idx} className="text-[10px] text-muted-foreground">• {o.anexo}: {o.condicao}</div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visiveis.length > limite && (
            <div className="text-center">
              <Button variant="outline" size="sm" onClick={() => setLimite(l => l + POR_PAGINA)}>
                Mostrar mais ({visiveis.length - limite} restantes)
              </Button>
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        Ferramenta de apoio: a base mapeia posições NCM aos anexos de redução da LC 214/2025, mas vários itens têm condições
        (destinação, registro na Anvisa/MAPA, exceções) que o NCM sozinho não resolve. Amarelo e vermelho exigem conferência
        no texto da lei. Serviços (NBS) não são cobertos.
      </p>
    </div>
  );
}

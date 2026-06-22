import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus, Printer, Trash2 } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseMoeda(s: string) {
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}
function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
// Dias do mês (28/29/30/31) considerando o ano para calcular fevereiro corretamente
function diasNoMes(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

type Lancamento = {
  id: string;
  descricao: string;
  tipo: "vencimento" | "desconto";
  valor: string;
};

export default function Holerite() {
  // Dados da empresa
  const [empresa, setEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [recibo, setRecibo] = useState("");

  // Dados do funcionário
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState("");

  // Período / cálculo proporcional
  const hoje = new Date();
  const [mesRef, setMesRef] = useState(hoje.getMonth() + 1);
  const [anoRef, setAnoRef] = useState(hoje.getFullYear());
  const [salarioBase, setSalarioBase] = useState("");
  const [diasTrabalhados, setDiasTrabalhados] = useState("");

  // Outros lançamentos
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);

  const diasMes = diasNoMes(mesRef, anoRef);
  const sb = parseMoeda(salarioBase);
  const dt = Math.min(parseFloat(diasTrabalhados) || 0, diasMes);

  // Cálculo proporcional: salário base / dias do mês (28, 29, 30 ou 31) x dias trabalhados
  const valorProporcional = diasMes > 0 ? (sb / diasMes) * dt : 0;
  const proporcionalCompleto = dt >= diasMes; // 30/30, 31/31 etc — sem proporcionalidade

  function addLancamento(tipo: "vencimento" | "desconto") {
    setLancamentos((l) => [
      ...l,
      { id: crypto.randomUUID(), descricao: "", tipo, valor: "" },
    ]);
  }
  function updateLancamento(id: string, patch: Partial<Lancamento>) {
    setLancamentos((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeLancamento(id: string) {
    setLancamentos((l) => l.filter((x) => x.id !== id));
  }

  const totalVencimentosExtra = useMemo(
    () =>
      lancamentos
        .filter((l) => l.tipo === "vencimento")
        .reduce((acc, l) => acc + parseMoeda(l.valor), 0),
    [lancamentos]
  );
  const totalDescontos = useMemo(
    () =>
      lancamentos
        .filter((l) => l.tipo === "desconto")
        .reduce((acc, l) => acc + parseMoeda(l.valor), 0),
    [lancamentos]
  );

  const totalVencimentos = valorProporcional + totalVencimentosExtra;
  const valorLiquido = totalVencimentos - totalDescontos;

  const nomesMeses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  function imprimir() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #holerite-print, #holerite-print * { visibility: visible; }
          #holerite-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold">Gerador de Holerite</h1>
          <p className="text-sm text-muted-foreground">
            Recibo de pagamento com cálculo proporcional por dias do mês (28/29/30/31)
          </p>
        </div>
        <Button onClick={imprimir} className="gap-2" data-testid="btn-imprimir">
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* ─── Formulário ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 no-print">
        <div className="border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Empresa
          </h2>
          <div className="space-y-2">
            <Label>Razão Social</Label>
            <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} data-testid="input-empresa" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                data-testid="input-cnpj"
              />
            </div>
            <div className="space-y-2">
              <Label>Nº do Recibo</Label>
              <Input value={recibo} onChange={(e) => setRecibo(e.target.value)} data-testid="input-recibo" />
            </div>
          </div>
        </div>

        <div className="border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Funcionário / Prestador
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} data-testid="input-codigo" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} data-testid="input-nome" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Função</Label>
            <Input value={funcao} onChange={(e) => setFuncao(e.target.value)} data-testid="input-funcao" />
          </div>
        </div>

        <div className="border rounded-xl p-4 space-y-3 lg:col-span-2">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Período e Cálculo Proporcional
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>Mês</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={mesRef}
                onChange={(e) => setMesRef(parseInt(e.target.value))}
                data-testid="select-mes"
              >
                {nomesMeses.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input
                type="number"
                value={anoRef}
                onChange={(e) => setAnoRef(parseInt(e.target.value) || hoje.getFullYear())}
                data-testid="input-ano"
              />
            </div>
            <div className="space-y-2">
              <Label>Salário Base (R$)</Label>
              <Input
                value={salarioBase}
                onChange={(e) => setSalarioBase(e.target.value)}
                placeholder="0,00"
                data-testid="input-salario-base"
              />
            </div>
            <div className="space-y-2">
              <Label>Dias Trabalhados</Label>
              <Input
                type="number"
                min={0}
                max={diasMes}
                value={diasTrabalhados}
                onChange={(e) => setDiasTrabalhados(e.target.value)}
                data-testid="input-dias-trabalhados"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O mês de {nomesMeses[mesRef - 1]}/{anoRef} tem <strong>{diasMes} dias</strong>.
            {" "}Valor proporcional = Salário Base ÷ {diasMes} × dias trabalhados.
            {proporcionalCompleto && " (mês completo — sem proporcionalidade)"}
          </p>
        </div>

        <div className="border rounded-xl p-4 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Outros Lançamentos
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => addLancamento("vencimento")} data-testid="btn-add-vencimento">
                <Plus className="h-3.5 w-3.5" /> Vencimento
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => addLancamento("desconto")} data-testid="btn-add-desconto">
                <Plus className="h-3.5 w-3.5" /> Desconto
              </Button>
            </div>
          </div>
          {lancamentos.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum lançamento adicional.</p>
          )}
          <div className="space-y-2">
            {lancamentos.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <span className={`text-xs w-20 shrink-0 ${l.tipo === "vencimento" ? "text-green-600" : "text-red-600"}`}>
                  {l.tipo === "vencimento" ? "Vencimento" : "Desconto"}
                </span>
                <Input
                  className="flex-1"
                  placeholder="Descrição"
                  value={l.descricao}
                  onChange={(e) => updateLancamento(l.id, { descricao: e.target.value })}
                  data-testid={`input-lanc-desc-${l.id}`}
                />
                <Input
                  className="w-32"
                  placeholder="0,00"
                  value={l.valor}
                  onChange={(e) => updateLancamento(l.id, { valor: e.target.value })}
                  data-testid={`input-lanc-valor-${l.id}`}
                />
                <Button size="icon" variant="ghost" onClick={() => removeLancamento(l.id)} data-testid={`btn-remove-${l.id}`}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Recibo (visualização e impressão) ─────────────────────────── */}
      <div id="holerite-print" className="border rounded-xl p-6 bg-white text-black max-w-3xl mx-auto print:border-0 print:shadow-none">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-bold text-sm">{empresa || "RAZÃO SOCIAL DA EMPRESA"}</p>
            <p className="text-xs">{cnpj || "00.000.000/0000-00"}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-sm">Recibo de Pagamento</p>
            <p className="text-xs">{recibo || "—"}</p>
          </div>
        </div>
        <Separator className="my-2" />
        <div className="grid grid-cols-3 gap-2 text-xs mb-2">
          <div><span className="text-muted-foreground">Código:</span> {codigo || "—"}</div>
          <div className="col-span-2"><span className="text-muted-foreground">Nome:</span> {nome || "—"}</div>
        </div>
        {funcao && <p className="text-xs mb-2"><span className="text-muted-foreground">Função:</span> {funcao}</p>}
        <p className="text-xs mb-3 text-muted-foreground">
          Referente a {nomesMeses[mesRef - 1]}/{anoRef} — {dt} de {diasMes} dias
        </p>

        <table className="w-full text-xs border-t border-b">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1">Descrição</th>
              <th className="py-1 text-right">Vencimentos</th>
              <th className="py-1 text-right">Descontos</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-1">
                Salário ({dt}/{diasMes} dias)
              </td>
              <td className="py-1 text-right">{fmtMoeda(valorProporcional)}</td>
              <td className="py-1 text-right">—</td>
            </tr>
            {lancamentos.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="py-1">{l.descricao || "—"}</td>
                <td className="py-1 text-right">{l.tipo === "vencimento" ? fmtMoeda(parseMoeda(l.valor)) : "—"}</td>
                <td className="py-1 text-right">{l.tipo === "desconto" ? fmtMoeda(parseMoeda(l.valor)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-2 text-xs mt-2 font-semibold">
          <div>Total de Vencimentos: {fmtMoeda(totalVencimentos)}</div>
          <div className="text-right">Total de Descontos: {fmtMoeda(totalDescontos)}</div>
        </div>

        <div className="mt-3 text-right">
          <p className="text-sm font-bold">Valor Líquido: {fmtMoeda(valorLiquido)}</p>
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          Base de Cálculo: {fmtMoeda(sb)}
        </div>

        <div className="mt-10 flex justify-end">
          <div className="text-center">
            <div className="border-t border-black w-64" />
            <p className="text-xs mt-1">Assinatura do Funcionário / Prestador</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FlaskConical, Info } from "lucide-react";

// ─── Imposto Seletivo (IS) — LC 214/2025, arts. 409 a 434 ────────────────────
// As alíquotas ainda dependem de lei ordinária (art. 422). Os valores abaixo são
// apenas sugestões editáveis; somente o teto de 0,25% para bens minerais está na LC.
type Categoria = {
  label: string;
  aliqSugerida: number; // % ad valorem (editável)
  temEspecifica: boolean; // fumo e bebidas alcoólicas: ad valorem + ad rem
  unidade?: string;
  obs: string;
};

const CATEGORIAS: Record<string, Categoria> = {
  fumo:        { label: "Produtos fumígenos (cigarros, charutos etc.)", aliqSugerida: 0, temEspecifica: true,  unidade: "maço/unidade", obs: "Ad valorem + específica por unidade." },
  alcool:      { label: "Bebidas alcoólicas",                           aliqSugerida: 0, temEspecifica: true,  unidade: "litro de álcool", obs: "Ad valorem + específica por volume de álcool; progressiva conforme teor alcoólico." },
  acucaradas:  { label: "Bebidas açucaradas",                           aliqSugerida: 0, temEspecifica: false, obs: "Ad valorem." },
  veiculos:    { label: "Veículos automotores",                         aliqSugerida: 0, temEspecifica: false, obs: "Alíquota graduada por potência, eficiência energética, reciclabilidade etc. Caminhões: alíquota zero." },
  embarcacoes: { label: "Embarcações e aeronaves",                      aliqSugerida: 0, temEspecifica: false, obs: "Ad valorem. Há exceções (ex.: aeronaves/embarcações de uso comercial e de pesca)." },
  minerais:    { label: "Bens minerais (extração)",                     aliqSugerida: 0.25, temEspecifica: false, obs: "Teto de 0,25% sobre o valor de mercado; incide na extração, inclusive quando exportado." },
  apostas:     { label: "Concursos de prognósticos / fantasy sport",    aliqSugerida: 0, temEspecifica: false, obs: "Base: receita própria (GGR) do operador." },
};

function parseNum(s: string) {
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}
function parsePct(s: string) {
  return parseFloat(s.replace(",", ".")) || 0;
}
function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ImpostoSeletivo() {
  const [cat, setCat] = useState("acucaradas");
  const [valor, setValor] = useState("");
  const [aliq, setAliq] = useState("");
  const [qtd, setQtd] = useState("");
  const [valorEsp, setValorEsp] = useState("");
  const [aliqCbs, setAliqCbs] = useState("8,8");
  const [aliqIbs, setAliqIbs] = useState("17,7");

  const c = CATEGORIAS[cat];
  const v = parseNum(valor);
  let a = aliq === "" ? c.aliqSugerida : parsePct(aliq);
  const tetoMineral = cat === "minerais" && a > 0.25;
  if (tetoMineral) a = 0.25;

  const isAdValorem = v * (a / 100);
  const isEspecifico = c.temEspecifica ? parseNum(qtd) * parseNum(valorEsp) : 0;
  const isTotal = isAdValorem + isEspecifico;

  // IS é "por fora" (não integra a própria base) e INTEGRA a base de CBS/IBS
  const baseIbsCbs = v + isTotal;
  const cbs = baseIbsCbs * (parsePct(aliqCbs) / 100);
  const ibs = baseIbsCbs * (parsePct(aliqIbs) / 100);
  const totalNota = v + isTotal + cbs + ibs;
  const cargaIS = v > 0 ? (isTotal / v) * 100 : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-purple-500" />
          Calculadora do Imposto Seletivo ("imposto do pecado")
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          LC 214/2025, arts. 409–434 · vigência a partir de <strong>01/01/2027</strong>.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          As alíquotas do IS serão fixadas em <strong>lei ordinária</strong> (art. 422). Informe a alíquota aplicável;
          a LC só fixa o teto de <strong>0,25%</strong> para bens minerais. O IS é calculado <strong>por fora</strong>,
          não gera crédito e <strong>integra a base de CBS/IBS</strong>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Dados da operação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Categoria</Label>
            <select
              className="w-full text-sm border rounded-md px-3 py-2 bg-background text-foreground"
              value={cat}
              onChange={e => { setCat(e.target.value); setAliq(""); }}
            >
              {Object.entries(CATEGORIAS).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">{c.obs}</p>
          </div>

          <div className="space-y-1.5">
            <Label>{cat === "apostas" ? "Receita própria (GGR) R$" : "Valor da operação (R$)"}</Label>
            <Input inputMode="decimal" placeholder="10.000,00" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Alíquota ad valorem (%)</Label>
            <Input inputMode="decimal" placeholder={String(c.aliqSugerida).replace(".", ",")} value={aliq} onChange={e => setAliq(e.target.value)} />
            {tetoMineral && <p className="text-xs text-orange-600">Limitada ao teto de 0,25%.</p>}
          </div>

          {c.temEspecifica && (
            <>
              <div className="space-y-1.5">
                <Label>Quantidade ({c.unidade})</Label>
                <Input inputMode="decimal" placeholder="0" value={qtd} onChange={e => setQtd(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Alíquota específica (R$ por {c.unidade})</Label>
                <Input inputMode="decimal" placeholder="0,00" value={valorEsp} onChange={e => setValorEsp(e.target.value)} />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Alíquota CBS (%)</Label>
            <Input inputMode="decimal" value={aliqCbs} onChange={e => setAliqCbs(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Alíquota IBS (%)</Label>
            <Input inputMode="decimal" value={aliqIbs} onChange={e => setAliqIbs(e.target.value)} />
          </div>
          <p className="sm:col-span-2 text-xs text-muted-foreground -mt-2">
            CBS/IBS são opcionais (só para ver o efeito do IS na base). Em 2027–2028 use CBS cheia e IBS 0,1%.
          </p>
        </CardContent>
      </Card>

      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-3"><CardTitle className="text-base">Resultado</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody className="[&_td]:py-1.5 [&_tr]:border-b last:[&_tr]:border-0">
              <tr><td>Valor da operação</td><td className="text-right">{fmt(v)}</td></tr>
              <tr><td>IS ad valorem ({a.toLocaleString("pt-BR")}%)</td><td className="text-right">{fmt(isAdValorem)}</td></tr>
              {c.temEspecifica && <tr><td>IS específico</td><td className="text-right">{fmt(isEspecifico)}</td></tr>}
              <tr className="font-semibold text-purple-700 dark:text-purple-400">
                <td>Imposto Seletivo total</td><td className="text-right">{fmt(isTotal)}</td>
              </tr>
              <tr><td className="text-muted-foreground">Carga efetiva do IS sobre o valor</td><td className="text-right text-muted-foreground">{cargaIS.toFixed(2).replace(".", ",")}%</td></tr>
              <tr><td>Base CBS/IBS (valor + IS)</td><td className="text-right">{fmt(baseIbsCbs)}</td></tr>
              <tr><td>CBS</td><td className="text-right">{fmt(cbs)}</td></tr>
              <tr><td>IBS</td><td className="text-right">{fmt(ibs)}</td></tr>
              <tr className="font-semibold"><td>Total da nota</td><td className="text-right">{fmt(totalNota)}</td></tr>
            </tbody>
          </table>
          <ul className="mt-4 text-xs text-muted-foreground list-disc pl-4 space-y-1">
            <li>Incide uma única vez: na 1ª comercialização pelo fabricante, na importação, na arrematação ou na extração.</li>
            <li>Não incide sobre exportações (exceto bens minerais) nem sobre bens com alíquota reduzida de 60% de IBS/CBS.</li>
            <li>Não gera crédito para o adquirente — é custo.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

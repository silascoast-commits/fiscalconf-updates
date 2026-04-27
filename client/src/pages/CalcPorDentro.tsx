import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Info,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number, casas = 2) {
  return v.toFixed(casas).replace(".", ",") + "%";
}
function parseMoeda(s: string) {
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}
function parsePct(s: string) {
  return parseFloat(s.replace(",", ".")) || 0;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CalcPorDentro() {
  // Aba ativa
  const [aba, setAba] = useState<"dentro" | "fora" | "comparar" | "formacao">("dentro");

  // Estados — cálculo por dentro
  const [baseDentro, setBaseDentro] = useState("");
  const [aliqDentro, setAliqDentro] = useState("");

  // Estados — cálculo por fora (IBS/CBS)
  const [baseFora, setBaseFora] = useState("");
  const [aliqFora, setAliqFora] = useState("");

  // Estados — comparativo
  const [baseComp, setBaseComp] = useState("");
  const [aliqComp, setAliqComp] = useState("");

  // Estados — formação de preço
  const [custoDesp, setCustoDesp] = useState("");
  const [lucroPerc, setLucroPerc] = useState("");
  const [aliqFormacao, setAliqFormacao] = useState("");

  // ── Cálculos por dentro ──
  const bD = parseMoeda(baseDentro);
  const aD = parsePct(aliqDentro) / 100;
  const precoVendaDentro = aD > 0 && aD < 1 ? bD / (1 - aD) : 0;
  const tributoDentro    = precoVendaDentro * aD;
  const sobradentro      = precoVendaDentro - tributoDentro;
  const cargaEfetivaDentro = sobradentro > 0 ? tributoDentro / sobradentro : 0;

  // ── Cálculos por fora ──
  const bF = parseMoeda(baseFora);
  const aF = parsePct(aliqFora) / 100;
  const tributoFora     = bF * aF;
  const precoVendaFora  = bF + tributoFora;
  const sobrafora       = bF;

  // ── Comparativo: mesma base, alíquota nominal igual ──
  const bC  = parseMoeda(baseComp);
  const aC  = parsePct(aliqComp) / 100;
  // Por dentro
  const precoDentroC    = aC > 0 && aC < 1 ? bC / (1 - aC) : 0;
  const tributoDentroC  = precoDentroC * aC;
  const cargaEfetivaC   = bC > 0 ? tributoDentroC / bC : 0;
  // Por fora (mesma alíquota)
  const tributoForaC    = bC * aC;
  const precoForaC      = bC + tributoForaC;
  // Diferença: quanto o empresário pagaria a mais por dentro
  const diferencaTributo = tributoDentroC - tributoForaC;

  // ── Formação de preço ──
  const cd = parseMoeda(custoDesp);
  const lp = parsePct(lucroPerc) / 100;
  const af = parsePct(aliqFormacao) / 100;
  // Base = custos + despesas + lucro desejado
  const baseFormacao   = lp < 1 ? cd / (1 - lp) : 0;
  // Preço por dentro
  const precoPorDentro = af > 0 && af < 1 ? baseFormacao / (1 - af) : baseFormacao;
  const tributoFormacao = precoPorDentro * af;
  const lucroReal       = precoPorDentro - tributoFormacao - cd;
  // Erro comum (sem fórmula inversa)
  const precoErrado     = baseFormacao * (1 + af);
  const tributoPago     = precoErrado * af;
  const sobra           = precoErrado - tributoPago - cd;
  const prejuizoMargem  = lucroReal - sobra;

  const inputClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Calculadora: Por Dentro vs Por Fora
        </h1>
        <p className="text-sm text-muted-foreground">
          O que muda com a Reforma Tributária no cálculo dos tributos sobre vendas (IBS/CBS).
        </p>
      </div>

      {/* Banner explicativo */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-1.5 text-xs text-blue-800 dark:text-blue-300">
          <p className="font-semibold text-sm">Por que isso importa?</p>
          <p>
            No sistema atual, <strong>ICMS, PIS e COFINS</strong> são calculados <strong>por dentro</strong>:
            o tributo incide sobre um preço que já inclui o próprio tributo.
            A alíquota nominal de 20% gera uma <strong>carga efetiva de 25%</strong> sobre o valor líquido.
          </p>
          <p>
            Com a Reforma Tributária, <strong>IBS e CBS</strong> serão calculados <strong>por fora</strong>:
            a alíquota incide apenas sobre a base líquida.
            Alíquota nominal = carga real. Sem fórmula inversa.
          </p>
        </div>
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dentro" data-testid="tab-por-dentro">Por Dentro</TabsTrigger>
          <TabsTrigger value="fora" data-testid="tab-por-fora">Por Fora</TabsTrigger>
          <TabsTrigger value="comparar" data-testid="tab-comparar">Comparativo</TabsTrigger>
          <TabsTrigger value="formacao" data-testid="tab-formacao">Preço de Venda</TabsTrigger>
        </TabsList>

        {/* ══ ABA 1 — POR DENTRO (sistema atual) ══ */}
        <TabsContent value="dentro" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-red-600 hover:bg-red-700 text-xs">Sistema Atual</Badge>
            <span className="text-xs text-muted-foreground">ICMS · PIS · COFINS · ISS</span>
          </div>

          <div className="rounded-lg border p-4 space-y-3 bg-red-50/30 dark:bg-red-950/10 border-red-200 dark:border-red-900/40">
            <p className="text-xs text-muted-foreground font-medium">
              Fórmula: <span className="font-mono text-foreground">Preço = Base ÷ (1 − alíquota)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Valor líquido desejado (R$)</label>
                <input
                  type="text"
                  placeholder="Ex: 150,00"
                  value={baseDentro}
                  onChange={(e) => setBaseDentro(e.target.value)}
                  className={inputClass}
                  data-testid="input-base-dentro"
                />
                <p className="text-xs text-muted-foreground">O que deve sobrar após pagar o tributo</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Alíquota nominal (%)</label>
                <input
                  type="text"
                  placeholder="Ex: 20"
                  value={aliqDentro}
                  onChange={(e) => setAliqDentro(e.target.value)}
                  className={inputClass}
                  data-testid="input-aliq-dentro"
                />
                <p className="text-xs text-muted-foreground">% previsto na lei (ICMS, PIS, etc.)</p>
              </div>
            </div>
          </div>

          {bD > 0 && aD > 0 && aD < 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-4 space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Preço de Venda</p>
                  <p className="text-xl font-bold text-foreground" data-testid="resultado-preco-dentro">{fmtMoeda(precoVendaDentro)}</p>
                  <p className="text-xs text-muted-foreground">para receber {fmtMoeda(bD)} líquido</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1 text-center border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Tributo Pago</p>
                  <p className="text-xl font-bold text-red-700 dark:text-red-400">{fmtMoeda(tributoDentro)}</p>
                  <p className="text-xs text-muted-foreground">alíquota nominal {fmtPct(aD * 100)}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1 text-center border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Carga Efetiva Real</p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{fmtPct(cargaEfetivaDentro * 100)}</p>
                  <p className="text-xs text-muted-foreground">sobre o valor líquido</p>
                </div>
              </div>

              {/* Barra visual */}
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Composição do preço de venda</p>
                <div className="flex h-7 rounded-full overflow-hidden text-xs font-semibold">
                  <div
                    className="flex items-center justify-center bg-blue-500 text-white transition-all"
                    style={{ width: `${(sobradentro / precoVendaDentro) * 100}%` }}
                  >
                    {fmtPct((sobradentro / precoVendaDentro) * 100, 0)} líquido
                  </div>
                  <div
                    className="flex items-center justify-center bg-red-500 text-white transition-all"
                    style={{ width: `${(tributoDentro / precoVendaDentro) * 100}%` }}
                  >
                    {fmtPct(aD * 100, 0)} tributo
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Base líquida: {fmtMoeda(sobradentro)}</span>
                  <span>Tributo embutido: {fmtMoeda(tributoDentro)}</span>
                  <span className="font-semibold text-foreground">Total: {fmtMoeda(precoVendaDentro)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>
                  Alíquota nominal <strong>{fmtPct(aD * 100)}</strong> gera carga efetiva de <strong>{fmtPct(cargaEfetivaDentro * 100)}</strong> sobre o valor que sobra ao empresário.
                  No sistema atual, alíquota nominal ≠ carga real.
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══ ABA 2 — POR FORA (IBS/CBS) ══ */}
        <TabsContent value="fora" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-green-600 hover:bg-green-700 text-xs">Pós-Reforma (IBS/CBS)</Badge>
            <span className="text-xs text-muted-foreground">A partir de 2027</span>
          </div>

          <div className="rounded-lg border p-4 space-y-3 bg-green-50/30 dark:bg-green-950/10 border-green-200 dark:border-green-900/40">
            <p className="text-xs text-muted-foreground font-medium">
              Fórmula: <span className="font-mono text-foreground">Tributo = Base × alíquota</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Base de cálculo (preço líquido, R$)</label>
                <input
                  type="text"
                  placeholder="Ex: 150,00"
                  value={baseFora}
                  onChange={(e) => setBaseFora(e.target.value)}
                  className={inputClass}
                  data-testid="input-base-fora"
                />
                <p className="text-xs text-muted-foreground">Valor sem o tributo embutido</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Alíquota IBS+CBS (%)</label>
                <input
                  type="text"
                  placeholder="Ex: 28"
                  value={aliqFora}
                  onChange={(e) => setAliqFora(e.target.value)}
                  className={inputClass}
                  data-testid="input-aliq-fora"
                />
                <p className="text-xs text-muted-foreground">Alíquota = carga real (sem distorção)</p>
              </div>
            </div>
          </div>

          {bF > 0 && aF > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-4 space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Preço Final ao Cliente</p>
                  <p className="text-xl font-bold text-foreground" data-testid="resultado-preco-fora">{fmtMoeda(precoVendaFora)}</p>
                  <p className="text-xs text-muted-foreground">base + tributo separado</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1 text-center border-green-200 dark:border-green-900/40 bg-green-50/30 dark:bg-green-950/10">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">IBS + CBS</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{fmtMoeda(tributoFora)}</p>
                  <p className="text-xs text-muted-foreground">carga efetiva = {fmtPct(aF * 100)}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1 text-center border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/10">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor Líquido</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{fmtMoeda(sobrafora)}</p>
                  <p className="text-xs text-muted-foreground">fica com o empresário</p>
                </div>
              </div>

              {/* Barra visual */}
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Composição do preço final</p>
                <div className="flex h-7 rounded-full overflow-hidden text-xs font-semibold">
                  <div
                    className="flex items-center justify-center bg-blue-500 text-white transition-all"
                    style={{ width: `${(bF / precoVendaFora) * 100}%` }}
                  >
                    {fmtPct((bF / precoVendaFora) * 100, 0)} líquido
                  </div>
                  <div
                    className="flex items-center justify-center bg-green-600 text-white transition-all"
                    style={{ width: `${(tributoFora / precoVendaFora) * 100}%` }}
                  >
                    {fmtPct((tributoFora / precoVendaFora) * 100, 0)} tributo
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Valor líquido: {fmtMoeda(bF)}</span>
                  <span>IBS+CBS: {fmtMoeda(tributoFora)}</span>
                  <span className="font-semibold text-foreground">Preço final: {fmtMoeda(precoVendaFora)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-xs text-green-800 dark:text-green-300">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>
                  Com IBS/CBS, a alíquota nominal <strong>{fmtPct(aF * 100)}</strong> é exatamente a carga tributária real sobre o valor líquido. Sem fórmula inversa — cálculo direto.
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══ ABA 3 — COMPARATIVO ══ */}
        <TabsContent value="comparar" className="space-y-4 mt-4">
          <p className="text-xs text-muted-foreground">
            Compare quanto o empresário paga com a mesma alíquota nominal nos dois sistemas.
          </p>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Valor líquido desejado (R$)</label>
                <input
                  type="text"
                  placeholder="Ex: 150,00"
                  value={baseComp}
                  onChange={(e) => setBaseComp(e.target.value)}
                  className={inputClass}
                  data-testid="input-base-comp"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Alíquota (%)</label>
                <input
                  type="text"
                  placeholder="Ex: 20"
                  value={aliqComp}
                  onChange={(e) => setAliqComp(e.target.value)}
                  className={inputClass}
                  data-testid="input-aliq-comp"
                />
              </div>
            </div>
          </div>

          {bC > 0 && aC > 0 && aC < 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Por dentro */}
                <div className="rounded-xl border-2 border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-400">Sistema Atual — Por Dentro</p>
                    <Badge className="bg-red-600 text-xs">ICMS · PIS · COFINS</Badge>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço de venda necessário</span>
                      <span className="font-mono font-semibold">{fmtMoeda(precoDentroC)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tributo pago</span>
                      <span className="font-mono font-semibold text-red-700 dark:text-red-400">{fmtMoeda(tributoDentroC)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Carga efetiva real</span>
                      <span className="text-red-700 dark:text-red-400">{fmtPct(cargaEfetivaC * 100)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Alíquota nominal {fmtPct(aC * 100)} → carga real {fmtPct(cargaEfetivaC * 100)}</p>
                </div>

                {/* Por fora */}
                <div className="rounded-xl border-2 border-green-200 dark:border-green-900/50 bg-green-50/30 dark:bg-green-950/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-green-700 dark:text-green-400">Pós-Reforma — Por Fora</p>
                    <Badge className="bg-green-600 text-xs">IBS · CBS</Badge>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço de venda</span>
                      <span className="font-mono font-semibold">{fmtMoeda(precoForaC)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tributo pago</span>
                      <span className="font-mono font-semibold text-green-700 dark:text-green-400">{fmtMoeda(tributoForaC)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Carga efetiva real</span>
                      <span className="text-green-700 dark:text-green-400">{fmtPct(aC * 100)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Alíquota nominal {fmtPct(aC * 100)} = carga real {fmtPct(aC * 100)} ✓</p>
                </div>
              </div>

              {/* Resultado comparativo */}
              <div className={`rounded-lg border p-4 space-y-1 text-center ${diferencaTributo > 0 ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30" : "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30"}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Diferença de tributo pago</p>
                <p className={`text-2xl font-black ${diferencaTributo > 0 ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"}`}>
                  {diferencaTributo > 0 ? "+" : ""}{fmtMoeda(diferencaTributo)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {diferencaTributo > 0
                    ? `O sistema atual cobra ${fmtMoeda(Math.abs(diferencaTributo))} a mais de tributo para a mesma alíquota nominal`
                    : "Tributos iguais nos dois sistemas para esta alíquota"}
                </p>
              </div>

              {/* Tabela de referência */}
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tabela: Alíquota Nominal → Carga Efetiva (por dentro)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Alíquota Nominal</th>
                        <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Carga Efetiva (por fora)</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Diferença</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[10, 12, 15, 17, 18, 20, 25, 28].map((a) => {
                        const aDecimal = a / 100;
                        const efetiva = aDecimal / (1 - aDecimal) * 100;
                        const diff = efetiva - a;
                        return (
                          <tr key={a} className={`border-b last:border-0 hover:bg-muted/30 ${Math.abs(a - (aC * 100)) < 0.5 ? "bg-primary/5 font-semibold" : ""}`}>
                            <td className="py-2 pr-4 font-mono">{a}%</td>
                            <td className="py-2 pr-4 font-mono text-right text-red-700 dark:text-red-400">{fmtPct(efetiva)}</td>
                            <td className="py-2 font-mono text-right text-amber-700 dark:text-amber-400">+{fmtPct(diff)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══ ABA 4 — FORMAÇÃO DE PREÇO ══ */}
        <TabsContent value="formacao" className="space-y-4 mt-4">
          <p className="text-xs text-muted-foreground">
            Calcule o preço de venda correto para garantir a margem desejada considerando o tributo embutido.
          </p>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados da operação</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Custos + Despesas (R$)</label>
                <input
                  type="text"
                  placeholder="Ex: 80,00"
                  value={custoDesp}
                  onChange={(e) => setCustoDesp(e.target.value)}
                  className={inputClass}
                  data-testid="input-custo"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Margem de lucro desejada (%)</label>
                <input
                  type="text"
                  placeholder="Ex: 20"
                  value={lucroPerc}
                  onChange={(e) => setLucroPerc(e.target.value)}
                  className={inputClass}
                  data-testid="input-lucro-perc"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Alíquota tributo por dentro (%)</label>
                <input
                  type="text"
                  placeholder="Ex: 12"
                  value={aliqFormacao}
                  onChange={(e) => setAliqFormacao(e.target.value)}
                  className={inputClass}
                  data-testid="input-aliq-formacao"
                />
              </div>
            </div>
          </div>

          {cd > 0 && lp > 0 && lp < 1 && af > 0 && af < 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Certo */}
                <div className="rounded-xl border-2 border-green-200 dark:border-green-900/50 bg-green-50/30 dark:bg-green-950/10 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <p className="text-xs font-bold uppercase tracking-wide text-green-700 dark:text-green-400">Método Correto — Fórmula P = B ÷ (1−a)</p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base desejada (custos + lucro)</span>
                      <span className="font-mono">{fmtMoeda(baseFormacao)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço de venda correto</span>
                      <span className="font-mono font-bold text-green-700 dark:text-green-400">{fmtMoeda(precoPorDentro)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tributo embutido</span>
                      <span className="font-mono">{fmtMoeda(tributoFormacao)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Lucro real obtido</span>
                      <span className="text-green-700 dark:text-green-400">{fmtMoeda(lucroReal)}</span>
                    </div>
                  </div>
                </div>

                {/* Errado */}
                <div className="rounded-xl border-2 border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <p className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-400">Método Errado — Base × (1 + alíquota)</p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base desejada</span>
                      <span className="font-mono">{fmtMoeda(baseFormacao)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço praticado (errado)</span>
                      <span className="font-mono font-bold text-red-700 dark:text-red-400">{fmtMoeda(precoErrado)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tributo realmente pago</span>
                      <span className="font-mono">{fmtMoeda(tributoPago)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Lucro real obtido</span>
                      <span className="text-red-700 dark:text-red-400">{fmtMoeda(sobra)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prejuízo */}
              <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-red-800 dark:text-red-300">
                    Usando o método errado, você perde {fmtMoeda(Math.abs(prejuizoMargem))} de margem por venda
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400">
                    Em vez de {fmtMoeda(lucroReal)} de lucro, fica com {fmtMoeda(sobra)} —
                    uma diferença de {fmtPct(Math.abs(prejuizoMargem / lucroReal) * 100)} da margem planejada.
                  </p>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rodapé educativo */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground text-sm">Resumo: o que muda com a Reforma Tributária</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <div className="space-y-1">
            <p className="font-medium text-red-700 dark:text-red-400">Sistema Atual — Por Dentro</p>
            <p>• Tributo incide sobre base que inclui o próprio tributo</p>
            <p>• Fórmula obrigatória: P = B ÷ (1 − a)</p>
            <p>• Alíquota nominal ≠ carga tributária real</p>
            <p>• Tributos: ICMS, PIS, COFINS, ISS</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-green-700 dark:text-green-400">Pós-Reforma — Por Fora (IBS/CBS)</p>
            <p>• Tributo incide apenas sobre a base líquida</p>
            <p>• Cálculo direto: T = Base × alíquota</p>
            <p>• Alíquota nominal = carga real (transparência)</p>
            <p>• Tributos: IBS + CBS unificados</p>
          </div>
        </div>
      </div>
    </div>
  );
}

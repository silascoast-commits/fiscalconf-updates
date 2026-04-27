import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import type { Cliente } from "../../../shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export type RelatorioClienteProps = {
  cliente: Cliente;
  onClose: () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const MESES_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const MESES_CHAVES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatMoeda(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function parseFaturamento(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function regimelabel(regime: string): string {
  const map: Record<string, string> = {
    simples: "Simples Nacional",
    presumido: "Lucro Presumido",
    real: "Lucro Real",
  };
  return map[regime] ?? regime;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────
export default function RelatorioCliente({ cliente, onClose }: RelatorioClienteProps) {
  const faturamento = useMemo(
    () => parseFaturamento(cliente.faturamentoMeses),
    [cliente.faturamentoMeses]
  );

  // RBT12 = soma dos 12 meses no JSON
  const rbt12 = useMemo(
    () => MESES_CHAVES.reduce((acc, m) => acc + (faturamento[m] ?? 0), 0),
    [faturamento]
  );

  const mesesComValor = MESES_CHAVES.filter((m) => (faturamento[m] ?? 0) > 0).length;
  const mediaMensal = mesesComValor > 0 ? rbt12 / mesesComValor : 0;
  const maxMes = Math.max(...MESES_CHAVES.map((m) => faturamento[m] ?? 0), 1);

  // Limites do Simples Nacional
  const LIMITE_SIMPLES = 4_800_000;
  const LIMITE_6FAIXA = 3_600_000;
  const pctLimite = Math.min((rbt12 / LIMITE_SIMPLES) * 100, 100);

  let limiteStatus: "verde" | "amarelo" | "vermelho";
  let limiteMsg: string;
  if (rbt12 > LIMITE_SIMPLES) {
    limiteStatus = "vermelho";
    limiteMsg = "ATENÇÃO: Acima do limite do Simples Nacional — necessário desenquadramento";
  } else if (rbt12 > LIMITE_6FAIXA) {
    limiteStatus = "amarelo";
    limiteMsg = "Empresa na 6ª faixa — avalie migração para Lucro Presumido";
  } else {
    limiteStatus = "verde";
    limiteMsg = "Dentro do limite do Simples Nacional";
  }

  // Situação híbrida (Simples: só para regime simples)
  const isSimples = cliente.regime === "simples";
  const dentroDoSimples = rbt12 <= LIMITE_SIMPLES;

  const dataGeracao = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      {/* ── CSS Print ─────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          /* Oculta tudo fora do relatório */
          body > *:not(#relatorio-cliente-root) {
            display: none !important;
          }

          #relatorio-cliente-root {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: white;
            overflow: auto;
          }

          /* Controles de UI */
          .no-print {
            display: none !important;
          }

          body {
            background: white !important;
            color: black !important;
            font-size: 10pt;
          }

          .relatorio-wrapper {
            max-width: 100% !important;
            padding: 16px !important;
            margin: 0 !important;
            background: white !important;
          }

          /* Cores de status para impressão */
          .status-verde  { color: #16a34a !important; }
          .status-amarelo { color: #d97706 !important; }
          .status-vermelho { color: #dc2626 !important; }

          .barra-verde  { background: #16a34a !important; }
          .barra-amarelo { background: #d97706 !important; }
          .barra-vermelho { background: #dc2626 !important; }

          /* Evita quebra de página dentro de tabelas */
          table { page-break-inside: auto; }
          tr    { page-break-inside: avoid; page-break-after: auto; }
          .card-nobreak { page-break-inside: avoid; }

          /* Rodapé de impressão */
          .print-footer {
            display: block !important;
            margin-top: 40px;
            padding-top: 10px;
            border-top: 1px solid #ccc;
            font-size: 8pt;
            color: #555;
            text-align: center;
          }
        }

        /* ── Tela (modal overlay) ── */
        .relatorio-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 1000;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 16px;
          overflow-y: auto;
        }

        .relatorio-wrapper {
          background: white;
          color: #111;
          border-radius: 8px;
          max-width: 900px;
          width: 100%;
          padding: 32px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          position: relative;
        }

        /* Tema escuro: força wrapper branco para legibilidade */
        .dark .relatorio-wrapper {
          background: white;
          color: #111;
        }
      `}</style>

      <div className="relatorio-overlay" id="relatorio-cliente-root">
        <div className="relatorio-wrapper">
          {/* ── Controles de UI (ocultos na impressão) ── */}
          <div className="no-print flex justify-between items-center mb-4">
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Imprimir / Salvar como PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
              <X className="h-4 w-4" />
              Fechar
            </Button>
          </div>

          {/* ── Cabeçalho ─────────────────────────────────────────────── */}
          <div className="card-nobreak border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold text-gray-900">FiscalConf — Relatório Fiscal</h1>
                <p className="text-sm text-gray-600 mt-0.5">
                  Elaborado por Salubre Contabilidade e Associados
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>Gerado em</p>
                <p className="font-semibold">{dataGeracao}</p>
              </div>
            </div>
          </div>

          {/* ── Dados do Cliente ─────────────────────────────────────── */}
          <div className="card-nobreak mb-6">
            <h2 className="text-base font-bold text-gray-800 mb-3 border-b border-gray-200 pb-1">
              Dados do Cliente
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">CNPJ</span>
                <p className="font-mono font-semibold">{formatCnpj(cliente.cnpj)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Razão Social</span>
                <p className="font-semibold">{cliente.razaoSocial}</p>
              </div>
              {cliente.nomeFantasia && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Nome Fantasia</span>
                  <p>{cliente.nomeFantasia}</p>
                </div>
              )}
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Regime Tributário</span>
                <p className="font-semibold">{regimelabel(cliente.regime)}</p>
              </div>
              {cliente.anexo && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Anexo (Simples)</span>
                  <p>Anexo {cliente.anexo}</p>
                </div>
              )}
              {cliente.atividade && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Atividade</span>
                  <p>{cliente.atividade}</p>
                </div>
              )}
              {cliente.responsavel && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Responsável</span>
                  <p>{cliente.responsavel}</p>
                </div>
              )}
              {cliente.email && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">E-mail</span>
                  <p>{cliente.email}</p>
                </div>
              )}
              {cliente.telefone && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Telefone</span>
                  <p>{cliente.telefone}</p>
                </div>
              )}
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Status</span>
                <p className={cliente.ativo ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                  {cliente.ativo ? "Ativo" : "Inativo"}
                </p>
              </div>
            </div>
          </div>

          {/* ── Tabela Faturamento 12 Meses ──────────────────────────── */}
          <div className="card-nobreak mb-6">
            <h2 className="text-base font-bold text-gray-800 mb-3 border-b border-gray-200 pb-1">
              Faturamento — Últimos 12 Meses
            </h2>

            {rbt12 > 0 ? (
              <>
                <table className="w-full text-sm border-collapse mb-3">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left py-1.5 px-2 font-semibold text-gray-700 border border-gray-200">Mês</th>
                      <th className="text-right py-1.5 px-2 font-semibold text-gray-700 border border-gray-200">Faturamento</th>
                      <th className="text-right py-1.5 px-2 font-semibold text-gray-700 border border-gray-200">% do Total</th>
                      <th className="w-28 py-1.5 px-2 border border-gray-200"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {MESES_CHAVES.map((mes, idx) => {
                      const val = faturamento[mes] ?? 0;
                      const pct = rbt12 > 0 ? (val / rbt12) * 100 : 0;
                      const barPct = maxMes > 0 ? (val / maxMes) * 100 : 0;
                      return (
                        <tr key={mes} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="py-1.5 px-2 border border-gray-200 font-medium">
                            {MESES_LABELS[idx]}
                          </td>
                          <td className="py-1.5 px-2 border border-gray-200 text-right font-mono">
                            {val > 0 ? formatMoeda(val) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-500">
                            {val > 0 ? `${pct.toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-1 px-2 border border-gray-200">
                            <div className="h-3 bg-gray-200 rounded-sm overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-sm"
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-800 text-white font-bold">
                      <td className="py-2 px-2 border border-gray-600">RBT12 Total</td>
                      <td className="py-2 px-2 border border-gray-600 text-right font-mono">{formatMoeda(rbt12)}</td>
                      <td className="py-2 px-2 border border-gray-600 text-right">100%</td>
                      <td className="py-2 px-2 border border-gray-600"></td>
                    </tr>
                  </tfoot>
                </table>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 rounded p-3 border border-gray-200">
                    <p className="text-gray-500 text-xs">Média Mensal</p>
                    <p className="font-bold text-base">{formatMoeda(mediaMensal)}</p>
                    <p className="text-gray-400 text-xs">{mesesComValor} meses com faturamento</p>
                  </div>
                  <div className="bg-gray-50 rounded p-3 border border-gray-200">
                    <p className="text-gray-500 text-xs">RBT12</p>
                    <p className="font-bold text-base">{formatMoeda(rbt12)}</p>
                    <p className="text-gray-400 text-xs">Receita Bruta Acumulada 12 meses</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-sm italic">Nenhum faturamento registrado.</p>
            )}
          </div>

          {/* ── Barra de Limite Simples Nacional ─────────────────────── */}
          {isSimples && (
            <div className="card-nobreak mb-6">
              <h2 className="text-base font-bold text-gray-800 mb-3 border-b border-gray-200 pb-1">
                Situação — Limites do Simples Nacional
              </h2>

              <div className="mb-2 flex justify-between text-xs text-gray-500">
                <span>R$ 0</span>
                <span>R$ 1,8M</span>
                <span>R$ 3,6M</span>
                <span>R$ 4,8M (limite)</span>
              </div>

              {/* Barra de progresso */}
              <div className="relative h-5 bg-gray-200 rounded-full overflow-hidden mb-2">
                {/* Zona verde: 0 – 75% */}
                <div className="absolute left-0 top-0 h-full bg-green-400" style={{ width: "75%" }} />
                {/* Zona laranja: 75–100% */}
                <div className="absolute top-0 h-full bg-amber-400" style={{ left: "75%", width: "25%" }} />
                {/* Marcador da posição */}
                <div
                  className="absolute top-0 h-full"
                  style={{ left: `${Math.min(pctLimite, 100)}%`, transform: "translateX(-50%)" }}
                >
                  <div className={`h-full w-1 ${limiteStatus === "vermelho" ? "bg-red-600" : "bg-gray-800"}`} />
                </div>
                {/* Preenchimento colorido */}
                <div
                  className={`absolute left-0 top-0 h-full opacity-60 ${
                    limiteStatus === "verde" ? "barra-verde bg-green-600" :
                    limiteStatus === "amarelo" ? "barra-amarelo bg-amber-500" :
                    "barra-vermelho bg-red-600"
                  }`}
                  style={{ width: `${pctLimite}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-sm">
                <p className={`font-semibold ${
                  limiteStatus === "verde" ? "status-verde text-green-700" :
                  limiteStatus === "amarelo" ? "status-amarelo text-amber-700" :
                  "status-vermelho text-red-700"
                }`}>
                  {pctLimite.toFixed(1)}% do limite utilizado
                </p>
                <p className="text-gray-500 text-xs">{limiteMsg}</p>
              </div>

              {/* Situação híbrida */}
              <div className="mt-3 rounded border p-3 text-sm">
                <p className="font-semibold text-gray-700 mb-1">Situação no DAS</p>
                {dentroDoSimples ? (
                  <div>
                    <p className="text-green-700">
                      ✓ Dentro do Simples Nacional — tributação unificada no DAS.
                    </p>
                    {rbt12 > LIMITE_6FAIXA ? (
                      <p className="text-amber-700 mt-1">
                        ⚠ Na 6ª faixa: alíquotas mais altas. Recomenda-se análise comparativa com Lucro Presumido.
                      </p>
                    ) : (
                      <p className="text-gray-500 mt-1">
                        Empresa se enquadra nas faixas normais do Simples Nacional. Acompanhe o crescimento do faturamento.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-red-700 font-semibold">
                    ✕ Faturamento acima do limite. Empresa deve ser obrigatoriamente desenquadrada.
                    Consulte o escritório para regularização imediata.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Configurações Fiscais Padrão ──────────────────────────── */}
          <div className="card-nobreak mb-6">
            <h2 className="text-base font-bold text-gray-800 mb-3 border-b border-gray-200 pb-1">
              Configurações Fiscais Padrão
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">NCM Principal</span>
                <p className="font-mono font-semibold">
                  {cliente.ncmPrincipal || <span className="text-gray-300 italic">Não informado</span>}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">CFOP Padrão</span>
                <p className="font-mono font-semibold">
                  {cliente.cfopPadrao || <span className="text-gray-300 italic">Não informado</span>}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Observações</span>
                <p className="mt-1 p-2 bg-gray-50 rounded border border-gray-200 text-gray-700 whitespace-pre-wrap">
                  {cliente.observacoes || <span className="text-gray-300 italic">Nenhuma observação registrada.</span>}
                </p>
              </div>
            </div>
          </div>

          {/* ── Informações do Cadastro ──────────────────────────────── */}
          <div className="card-nobreak mb-6 text-xs text-gray-400">
            <p>Cadastrado em: {new Date(cliente.criadoEm).toLocaleString("pt-BR")}</p>
            <p>Última atualização: {new Date(cliente.atualizadoEm).toLocaleString("pt-BR")}</p>
          </div>

          {/* ── Rodapé ── */}
          <div className="print-footer hidden border-t border-gray-300 pt-3 mt-6 text-center text-xs text-gray-500">
            <p>Elaborado por Salubre Contabilidade e Associados</p>
            <p>FiscalConf · Relatório gerado em {dataGeracao}</p>
          </div>

          {/* Rodapé visível na tela (oculto na impressão por .no-print) */}
          <div className="no-print border-t border-gray-200 pt-4 mt-4 text-center text-xs text-gray-400">
            <p>Elaborado por Salubre Contabilidade e Associados · FiscalConf</p>
            <p>Gerado em {dataGeracao}</p>
          </div>
        </div>
      </div>
    </>
  );
}

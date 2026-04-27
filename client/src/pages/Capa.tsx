import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Scale,
  Calculator,
  FileText,
  Layers,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";

// Recursos do vídeo: cálculo por dentro vs por fora — os pilares que mudam na reforma
const PILARES = [
  {
    icone: Scale,
    titulo: "Cálculo por Dentro → Por Fora",
    texto: "IBS e CBS são calculados sobre a base líquida. Alíquota nominal = carga real.",
    cor: "text-blue-400",
    bg: "bg-blue-950/40 border-blue-800/50",
  },
  {
    icone: Calculator,
    titulo: "Precificação Correta",
    texto: "Evite perda de margem: P = Base ÷ (1 − a) no sistema atual. Com IBS/CBS: T = Base × a.",
    cor: "text-green-400",
    bg: "bg-green-950/40 border-green-800/50",
  },
  {
    icone: FileText,
    titulo: "NF-e Híbrida 2026",
    texto: "XML simultâneo: campos antigos (ICMS/PIS/COFINS) + novos (IBS/CBS — NT 2025.002).",
    cor: "text-amber-400",
    bg: "bg-amber-950/40 border-amber-800/50",
  },
  {
    icone: Layers,
    titulo: "Simples Nacional Híbrido",
    texto: "IBS/CBS dentro ou fora do DAS. Compulsório acima de R$ 3,6M de RBT12.",
    cor: "text-purple-400",
    bg: "bg-purple-950/40 border-purple-800/50",
  },
  {
    icone: TrendingUp,
    titulo: "Transição 2026–2033",
    texto: "Extinção gradual de ICMS/ISS e PIS/COFINS. Simulador completo com todos os anos.",
    cor: "text-indigo-400",
    bg: "bg-indigo-950/40 border-indigo-800/50",
  },
  {
    icone: ShieldCheck,
    titulo: "Tabelas Completas",
    texto: "Todos os Anexos do Simples Nacional, Lucro Presumido, CFOP, CST, cBenef e cEST.",
    cor: "text-cyan-400",
    bg: "bg-cyan-950/40 border-cyan-800/50",
  },
];

export default function Capa() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#040d1a] text-white relative overflow-hidden flex flex-col">

      {/* Fundo geométrico animado */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grade de pontos */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #a0aec0 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Linhas diagonais douradas */}
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.07]">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent"
              style={{
                top: `${10 + i * 12}%`,
                left: "-20%",
                width: "140%",
                transform: `rotate(-8deg)`,
              }}
            />
          ))}
        </div>
        {/* Glow azul esquerda */}
        <div className="absolute -left-32 top-1/4 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />
        {/* Glow verde direita */}
        <div className="absolute -right-32 bottom-1/4 w-96 h-96 rounded-full bg-green-600/8 blur-3xl" />
        {/* Faixa verde-amarela brasil no topo */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-yellow-400 to-green-500 opacity-70" />
      </div>

      {/* Conteúdo principal */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 py-10 text-center">

        {/* Badge topo */}
        <div className="mb-6">
          <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-xs px-3 py-1 uppercase tracking-widest">
            Reforma Tributária 2026
          </Badge>
        </div>

        {/* Logo / Título principal */}
        <div className="mb-3 space-y-1">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-none">
            FISCAL
            <span className="text-yellow-400">CONF</span>
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-yellow-400/60" />
            <p className="text-xs uppercase tracking-[0.3em] text-blue-300 font-medium">
              Configuração NF-e 2026
            </p>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-yellow-400/60" />
          </div>
        </div>

        {/* Subtítulo reformaTributária */}
        <h2 className="text-lg sm:text-xl font-semibold text-blue-200 mt-4 mb-1 leading-snug max-w-xl">
          Sistema Completo de Classificação Fiscal
        </h2>
        <p className="text-sm text-slate-400 max-w-lg leading-relaxed mb-2">
          NCM · CFOP · CST · cBenef · cEST · IBS · CBS · Simples Nacional · Lucro Presumido · Sistema Híbrido
        </p>

        {/* Assinatura Salubre */}
        <div className="mt-4 mb-8 flex flex-col items-center gap-1">
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent" />
          <p className="text-xs text-yellow-300/80 font-medium uppercase tracking-widest mt-2">
            Elaborado por
          </p>
          <p className="text-base sm:text-lg font-bold text-white tracking-wide">
            SALUBRE CONTABILIDADE E ASSOCIADOS
          </p>
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent mt-1" />
        </div>

        {/* Botão de entrada */}
        <Button
          onClick={() => setLocation("/")}
          size="lg"
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm px-8 py-3 rounded-full shadow-lg shadow-yellow-500/20 transition-all duration-200 hover:scale-105 gap-2"
          data-testid="btn-entrar"
        >
          Acessar o Sistema
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-xs text-slate-500 mt-3">
          Simples Nacional · Lucro Presumido · Tabelas Completas
        </p>
      </div>

      {/* Cards dos pilares */}
      <div className="relative z-10 px-4 pb-10 max-w-5xl mx-auto w-full">
        <p className="text-center text-xs uppercase tracking-[0.25em] text-slate-500 mb-5">
          O que o sistema cobre
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PILARES.map((p) => {
            const Icone = p.icone;
            return (
              <div
                key={p.titulo}
                className={`rounded-xl border p-4 flex gap-3 items-start ${p.bg}`}
              >
                <Icone className={`h-5 w-5 mt-0.5 flex-shrink-0 ${p.cor}`} />
                <div>
                  <p className={`text-xs font-semibold mb-1 ${p.cor}`}>{p.titulo}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{p.texto}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        <p className="text-center text-xs text-slate-600 mt-8">
          FiscalConf · Reforma Tributária 2026 · LC 214/2025 · EC 132/2023 · NT 2025.002
        </p>
      </div>
    </div>
  );
}

import { Link, useLocation } from "wouter";
import { useTheme } from "./ThemeProvider";
import { useCliente } from "@/contexts/ClienteContext";
import { Moon, Sun, FileText, Database, History, TrendingDown, Calculator, Rss, Scale, LayoutDashboard, CalendarDays, ArrowLeftRight, Users, Building2, ChevronDown, X, FileCode2, MoreHorizontal, BotMessageSquare, MapPin, BookOpen, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";

// Itens principais — sempre visíveis
const navMain = [
  { href: "/",           label: "Dashboard",    icon: LayoutDashboard },
  { href: "/clientes",   label: "Clientes",     icon: Users },
  { href: "/consultor",  label: "Consultor IA", icon: BotMessageSquare },
  { href: "/xml",        label: "XML NF-e",     icon: FileCode2 },
  { href: "/consulta",   label: "Consultar",    icon: FileText },
  { href: "/apuracao",   label: "Apuração",     icon: Calculator },
];

// Itens secundários — ficam no dropdown "Mais"
const navMore = [
  { href: "/mapa",        label: "Mapa Transição",  icon: MapPin },
  { href: "/kit",         label: "Kit Prompts",      icon: BookOpen },
  { href: "/simulador",   label: "Simulador RT",     icon: TrendingDown },
  { href: "/hibrido",     label: "SN × Híbrido",    icon: GitCompare },
  { href: "/ncms",        label: "NCMs",             icon: Database },
  { href: "/calculadora", label: "Calc. Tributos",   icon: Scale },
  { href: "/calendario",  label: "Calendário",        icon: CalendarDays },
  { href: "/atualizacoes",label: "Atualizações",      icon: Rss },
  { href: "/comparativo", label: "Comparativo",       icon: ArrowLeftRight },
  { href: "/historico",   label: "Histórico",         icon: History },
];

function formatCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function ClienteSelector() {
  const { clienteAtivo, setClienteAtivo, clientes } = useCliente();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setBusca("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtrados = clientes.filter(c => {
    const q = busca.toLowerCase();
    return (
      c.razaoSocial.toLowerCase().includes(q) ||
      (c.nomeFantasia || "").toLowerCase().includes(q) ||
      c.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    );
  });

  return (
    <div ref={ref} className="relative flex items-center">
      {/* Botão principal do seletor */}
      <button
        onClick={() => { setOpen(v => !v); setBusca(""); }}
        data-testid="cliente-selector-button"
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all max-w-[260px] ${
          clienteAtivo
            ? "border-primary/50 bg-primary/5 text-foreground hover:bg-primary/10"
            : "border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary/50 hover:text-foreground"
        }`}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
        {clienteAtivo ? (
          <span className="truncate font-medium text-xs">
            {clienteAtivo.nomeFantasia || clienteAtivo.razaoSocial}
          </span>
        ) : (
          <span className="text-xs">Selecionar empresa...</span>
        )}
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Badge regime + botão limpar */}
      {clienteAtivo && (
        <>
          <Badge
            variant="secondary"
            className={`ml-1.5 text-[10px] px-1.5 py-0 shrink-0 ${
              clienteAtivo.regime === "Simples Nacional"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            }`}
          >
            {clienteAtivo.regime === "Simples Nacional" ? "SN" : "LP"}
          </Badge>
          <button
            onClick={(e) => { e.stopPropagation(); setClienteAtivo(null); }}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Remover empresa ativa"
            data-testid="cliente-clear-button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-80 bg-card border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 pt-3 pb-2 border-b">
            <p className="text-xs font-semibold text-muted-foreground mb-2">EMPRESA ATIVA</p>
            <input
              autoFocus
              placeholder="Buscar por nome ou CNPJ..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full text-sm px-3 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="cliente-search-input"
            />
          </div>

          {/* Lista */}
          <div className="max-h-64 overflow-y-auto">
            {filtrados.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                Nenhuma empresa encontrada
              </div>
            ) : (
              filtrados.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setClienteAtivo(c);
                    setOpen(false);
                    setBusca("");
                  }}
                  data-testid={`cliente-option-${c.id}`}
                  className={`w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex items-start gap-3 ${
                    clienteAtivo?.id === c.id ? "bg-primary/5 border-l-2 border-primary" : ""
                  }`}
                >
                  <Building2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {c.nomeFantasia || c.razaoSocial}
                      </span>
                      {clienteAtivo?.id === c.id && (
                        <Badge className="text-[9px] px-1 py-0 bg-primary text-primary-foreground shrink-0">
                          ATIVO
                        </Badge>
                      )}
                    </div>
                    {c.nomeFantasia && (
                      <div className="text-[11px] text-muted-foreground truncate">{c.razaoSocial}</div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground font-mono">{formatCnpj(c.cnpj)}</span>
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1.5 py-0 ${
                          c.regime === "Simples Nacional"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        }`}
                      >
                        {c.regime === "Simples Nacional" ? "Simples" : "Presumido"}
                      </Badge>
                      {c.anexo && (
                        <span className="text-[10px] text-muted-foreground">Anexo {c.anexo}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {clienteAtivo && (
            <div className="border-t px-3 py-2">
              <button
                onClick={() => { setClienteAtivo(null); setOpen(false); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors w-full text-left flex items-center gap-2"
              >
                <X className="h-3 w-3" />
                Remover empresa ativa
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown "Mais" ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const moreActive = navMore.some(n => n.href === location);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            {/* Logo SVG */}
            <svg
              aria-label="FiscalConf"
              viewBox="0 0 32 32"
              width="32"
              height="32"
              fill="none"
              className="text-primary shrink-0"
            >
              <rect x="2" y="4" width="20" height="24" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M6 10h12M6 14h12M6 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="26" cy="26" r="5" fill="currentColor" opacity="0.9"/>
              <path d="M23.5 26l1.5 1.5L28.5 24" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="hidden lg:block">
              <span className="font-semibold text-sm text-foreground">FiscalConf</span>
              <span className="text-xs text-muted-foreground ml-2">Configuração NF-e 2026</span>
            </div>
          </div>

          {/* Seletor de cliente — centro */}
          <div className="flex-1 flex justify-center">
            <ClienteSelector />
          </div>

          <nav className="flex items-center gap-0.5 shrink-0">
            {/* Itens principais — sempre visíveis */}
            {navMain.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <Button
                  variant={location === href ? "secondary" : "ghost"}
                  size="sm"
                  className={`gap-1.5 px-2 ${
                    href === "/xml"
                      ? "border border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                      : href === "/consultor"
                      ? "border border-purple-400/40 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                      : ""
                  }`}
                  data-testid={`nav-${label.toLowerCase().replace(/ /g,"-")}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden xl:inline text-xs">{label}</span>
                </Button>
              </Link>
            ))}

            {/* Dropdown "Mais" */}
            <div ref={moreRef} className="relative">
              <Button
                variant={moreActive ? "secondary" : "ghost"}
                size="sm"
                className="gap-1 px-2"
                onClick={() => setMoreOpen(v => !v)}
                data-testid="nav-mais"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="hidden xl:inline text-xs">Mais</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </Button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-card border rounded-xl shadow-lg z-50 overflow-hidden py-1">
                  {navMore.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href}>
                      <button
                        onClick={() => setMoreOpen(false)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors ${
                          location === href ? "bg-primary/5 text-primary font-medium" : "text-foreground"
                        }`}
                        data-testid={`nav-more-${label.toLowerCase().replace(/ /g,"-")}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </button>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Button variant="ghost" size="icon" onClick={toggle} data-testid="toggle-theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-3 text-center text-xs text-muted-foreground">
        FiscalConf · Reforma Tributária 2026 · LC 214/2025 · Atualizado em abril/2026
      </footer>
    </div>
  );
}

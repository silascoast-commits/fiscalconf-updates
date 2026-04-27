import { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type Cliente = {
  id: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  regime: string;
  anexo: string | null;
  atividade: string | null;
  responsavel: string | null;
  email: string | null;
  telefone: string | null;
  faturamentoMeses: string | null; // JSON
  ncmPrincipal: string | null;
  cfopPadrao: string | null;
  observacoes: string | null;
  ativo: number;
  criadoEm: string;
  atualizadoEm: string | null;
};

export type PgdasImportacao = {
  id: number;
  clienteId: number;
  cnpj: string;
  periodoApuracao: string;
  rpa: number | null;
  rbt12: number | null;
  rba: number | null;
  rbaa: number | null;
  dasTotal: number | null;
  dasIrpj: number | null;
  dasCsll: number | null;
  dasCofins: number | null;
  dasPis: number | null;
  dasInss: number | null;
  dasIcms: number | null;
  dasIss: number | null;
  vencimento: string | null;
  atividade: string | null;
  anexoDetectado: string | null;
  receitasMeses: string | null; // JSON
  pago: number;
  importadoEm: string;
};

// ─── Context ──────────────────────────────────────────────────────────────────
type ClienteContextType = {
  clienteAtivo: Cliente | null;
  setClienteAtivo: (c: Cliente | null) => void;
  clientes: Cliente[];
  pgdasAtivo: PgdasImportacao | null;
  loadingClientes: boolean;
};

const ClienteContext = createContext<ClienteContextType>({
  clienteAtivo: null,
  setClienteAtivo: () => {},
  clientes: [],
  pgdasAtivo: null,
  loadingClientes: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ClienteProvider({ children }: { children: React.ReactNode }) {
  const [clienteAtivo, setClienteAtivoState] = useState<Cliente | null>(null);

  // Carrega todos os clientes
  const { data: clientes = [], isLoading: loadingClientes } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
    staleTime: 30_000,
  });

  // Carrega o PGDAS mais recente do cliente ativo
  const { data: pgdasList = [] } = useQuery<PgdasImportacao[]>({
    queryKey: ["/api/clientes", clienteAtivo?.id, "pgdas"],
    queryFn: async () => {
      if (!clienteAtivo) return [];
      const res = await fetch(`/api/clientes/${clienteAtivo.id}/pgdas`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!clienteAtivo,
    staleTime: 30_000,
  });

  // Pega o PGDAS mais recente
  const pgdasAtivo: PgdasImportacao | null =
    pgdasList.length > 0
      ? [...pgdasList].sort((a, b) =>
          b.periodoApuracao.localeCompare(a.periodoApuracao)
        )[0]
      : null;

  const setClienteAtivo = (c: Cliente | null) => {
    setClienteAtivoState(c);
  };

  return (
    <ClienteContext.Provider
      value={{ clienteAtivo, setClienteAtivo, clientes, pgdasAtivo, loadingClientes }}
    >
      {children}
    </ClienteContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useCliente() {
  return useContext(ClienteContext);
}

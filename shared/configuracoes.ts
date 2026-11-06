// Configurações fiscais centrais — valores padrão.
// Gravadas na tabela `configuracoes`; editáveis na tela "Reforma NCM/NBS".

export interface ConfiguracoesFiscais {
  /** Alíquota de referência da CBS (%) — estimativa até Resolução do Senado */
  aliquotaReferenciaCbs: number;
  /** Alíquota de referência do IBS (UF + Município) (%) */
  aliquotaReferenciaIbs: number;
  /** Premissas de alíquota do Imposto Seletivo (%) por categoria — usadas em simulações */
  premissasIS: Record<string, number>;
}

export const CATEGORIAS_IS: Record<string, string> = {
  bebidas_alc: "Bebidas alcoólicas",
  fumo: "Produtos fumígenos",
  veiculos: "Veículos",
  embarcacoes: "Embarcações / aeronaves",
  bebidas_acu: "Bebidas açucaradas",
  minerais: "Bens minerais (extração)",
  prognosticos: "Concursos de prognósticos / fantasy sport",
};

/** Mapeia a categoria das regras de IS (por NCM) para a chave de premissa */
export const CHAVE_IS_POR_CATEGORIA: Record<string, string> = {
  "Bebidas alcoólicas": "bebidas_alc",
  "Produtos fumígenos": "fumo",
  "Veículos": "veiculos",
  "Aeronaves": "embarcacoes",
  "Embarcações": "embarcacoes",
  "Bebidas açucaradas": "bebidas_acu",
  "Bens minerais": "minerais",
};

export const CONFIG_PADRAO: ConfiguracoesFiscais = {
  aliquotaReferenciaCbs: 8.8,
  aliquotaReferenciaIbs: 17.7,
  premissasIS: {
    bebidas_alc: 20,
    fumo: 100,
    veiculos: 7.5,
    embarcacoes: 10,
    bebidas_acu: 10,
    minerais: 0.25,
    prognosticos: 10,
  },
};

/** Teto legal de alíquota do IS sobre bens minerais (CF, art. 153, §6º, VII) */
export const TETO_IS_MINERAIS = 0.25;

export function mesclarConfiguracoes(salvas: Partial<ConfiguracoesFiscais> | Record<string, unknown>): ConfiguracoesFiscais {
  const s = salvas as Partial<ConfiguracoesFiscais>;
  const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : d);
  const prem: Record<string, number> = { ...CONFIG_PADRAO.premissasIS };
  for (const k of Object.keys(prem)) prem[k] = num(s.premissasIS?.[k], prem[k]);
  prem.minerais = Math.min(prem.minerais, TETO_IS_MINERAIS);
  return {
    aliquotaReferenciaCbs: num(s.aliquotaReferenciaCbs, CONFIG_PADRAO.aliquotaReferenciaCbs),
    aliquotaReferenciaIbs: num(s.aliquotaReferenciaIbs, CONFIG_PADRAO.aliquotaReferenciaIbs),
    premissasIS: prem,
  };
}

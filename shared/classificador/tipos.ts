// Formato compacto da base fiscal oficial usada pelo classificador IBS/CBS.
// Gerado por server/bases/importar.ts a partir de:
//   - Tabela NCM vigente (Portal Único Siscomex)
//   - Tabela de cClassTrib e anexos da LC 214/2025 (Portal DF-e SVRS)

export interface ClassTribInfo {
  cst: string;
  nome: string;           // nome reduzido
  nomeCompleto: string;
  redIbs: number;         // % de redução do IBS
  redCbs: number;         // % de redução da CBS
  anexo: string | null;   // "Anexo I" … "Anexo XV" (só anexos numerados da LC 214)
  nfe: boolean;           // permitido em NF-e
  nfce: boolean;          // permitido em NFC-e
  url: string | null;     // link da legislação
}

// Regra de um NCM: [cClassTrib, permitido (1) ou vedado (0), idxItem, idxCondicao, idxExcecao]
// Os índices apontam para BaseFiscal.textos (-1 = sem texto).
export type RegraNcm = [string, 0 | 1, number, number, number];

export interface BaseFiscal {
  versao: {
    ncm: string;           // ex.: "Vigente em 10/11/2026 — Resolução Gecex nº 926/2026"
    classTrib: string;     // ex.: "SVRS — publicação mais recente 22/06/2026"
    geradoEm: string;      // ISO
  };
  cst: Record<string, string>;
  classTrib: Record<string, ClassTribInfo>;
  ncm: Record<string, string>;            // NCM 8 dígitos → descrição hierárquica
  textos: string[];
  regras: Record<string, RegraNcm[]>;     // NCM 8 dígitos → regras dos anexos
}

// Classificador IBS/CBS em lote — NCM → CST / cClassTrib (LC 214/2025)
//
// Lógica em dois passos:
//   1) OPERAÇÃO (CFOP): se a operação não é tributada (exportação, transferência,
//      bonificação…), o CST/cClassTrib vem da operação e o NCM não importa.
//   2) PRODUTO (NCM): procura o NCM nos anexos de redução da LC 214/2025 e
//      classifica num "semáforo":
//        VERDE    — não consta em nenhum anexo → 000 / 000001 (tributação integral)
//        AMARELO  — consta em um único anexo → preenche, mas o usuário confere a condição
//        VERMELHO — consta em mais de um anexo → o usuário escolhe
//        INVALIDO — NCM sem 8 dígitos
//
// IMPORTANTE: a base abaixo é uma referência por posição/subposição NCM. Vários itens
// dos anexos têm condições que o NCM sozinho não resolve (destinação, registro na
// Anvisa/MAPA, "exceto…"). Por isso todo enquadramento traz a condição a conferir.

export type Situacao = "VERDE" | "AMARELO" | "VERMELHO" | "INVALIDO" | "OPERACAO";

export interface RegraAnexo {
  anexo: string;          // "Anexo I"
  artigo: string;         // "Art. 125"
  tema: string;           // "Cesta Básica Nacional de Alimentos"
  cst: string;            // "200"
  cClassTrib: string;     // "200003"
  reducao: number;        // 100 = alíquota zero; 60 = redução de 60%
  itens: { descricao: string; prefixos: string[]; exceto?: string[]; condicao?: string }[];
}

export const BASE_ANEXOS: RegraAnexo[] = [
  {
    anexo: "Anexo I", artigo: "Art. 125", tema: "Cesta Básica Nacional de Alimentos",
    cst: "200", cClassTrib: "200003", reducao: 100,
    itens: [
      { descricao: "Arroz", prefixos: ["10062", "10063", "10064"] },
      { descricao: "Leite fluido pasteurizado ou UHT", prefixos: ["04011010", "04011090", "04012010", "04012090", "04014010", "04015010"] },
      { descricao: "Leite em pó", prefixos: ["04021010", "04021090", "04022110", "04022120", "04022910", "04022920"] },
      { descricao: "Fórmulas infantis", prefixos: ["19011010", "19011090"], condicao: "Fórmulas infantis definidas por previsão legal específica" },
      { descricao: "Manteiga", prefixos: ["04051000"] },
      { descricao: "Margarina", prefixos: ["15171000"] },
      { descricao: "Feijões", prefixos: ["071333", "071335", "071339"], condicao: "Exceto para semeadura" },
      { descricao: "Raízes e tubérculos", prefixos: ["0714"] },
      { descricao: "Cocos", prefixos: ["08011"] },
      { descricao: "Café torrado/moído e solúvel", prefixos: ["09011", "09012", "21011110"] },
      { descricao: "Óleo de babaçu", prefixos: ["15132120", "15132910"] },
      { descricao: "Farinha de mandioca", prefixos: ["11062000"] },
      { descricao: "Farinha, grumos e sêmolas de milho; grãos de milho", prefixos: ["11022000", "11031300", "11041900", "11042300"] },
      { descricao: "Farinha de trigo", prefixos: ["11010010"] },
      { descricao: "Açúcar", prefixos: ["17011400", "17019900"] },
      { descricao: "Massas alimentícias", prefixos: ["19021100", "19021900"] },
      { descricao: "Pão comum", prefixos: ["19059090"], condicao: "Somente pão comum (farinha, fermento, água e sal); demais produtos de padaria são tributação integral" },
      { descricao: "Aveia (grãos esmagados/em flocos)", prefixos: ["11041200", "11042200"] },
      { descricao: "Carnes bovina, suína, ovina, caprina e de aves; miudezas", prefixos: ["0201", "0202", "0203", "0204", "0206", "0207", "0209", "0210"], condicao: "Exceto foie gras e produtos não previstos no anexo" },
      { descricao: "Peixes", prefixos: ["0302", "0303", "0304"], condicao: "Exceto salmonídeos, atuns, bacalhaus, hadoque, saithe e ovas" },
      { descricao: "Queijos", prefixos: ["04061010", "04061090", "04062000", "04069010", "04069020", "04069030"] },
      { descricao: "Sal", prefixos: ["25010020", "25010090"] },
      { descricao: "Mate", prefixos: ["09030010"] },
    ],
  },
  {
    anexo: "Anexo XV", artigo: "Art. 148", tema: "Produtos hortícolas, frutas e ovos",
    cst: "200", cClassTrib: "200014", reducao: 100,
    itens: [
      { descricao: "Ovos de aves com casca", prefixos: ["040721", "040729", "040790"] },
      { descricao: "Produtos hortícolas frescos ou refrigerados", prefixos: ["0701", "0702", "0703", "0704", "0705", "0706", "0707", "0708", "0709"], condicao: "Frescos ou refrigerados, exceto para semeadura (cozidos, congelados ou em conserva não se enquadram)" },
      { descricao: "Frutas frescas ou refrigeradas", prefixos: ["0803", "0804", "0805", "0806", "0807", "0808", "0809", "0810"], condicao: "Frescas ou refrigeradas (secas ou em conserva não se enquadram)" },
    ],
  },
  {
    anexo: "Anexo VII", artigo: "Art. 135", tema: "Alimentos destinados ao consumo humano",
    cst: "200", cClassTrib: "200034", reducao: 60,
    itens: [
      { descricao: "Crustáceos e moluscos", prefixos: ["0306", "0307"], condicao: "Exceto lagostas e lagostins" },
      { descricao: "Leite fermentado, bebidas e compostos lácteos", prefixos: ["0403"] },
      { descricao: "Mel natural", prefixos: ["04090000"] },
      { descricao: "Farinhas, grumos e sêmolas de cereais", prefixos: ["1102", "1103"], exceto: ["11022000", "11031300"] },
      { descricao: "Farinhas de leguminosas, raízes e frutas", prefixos: ["1106"], exceto: ["11062000"] },
      { descricao: "Massas alimentícias recheadas, cozidas ou cuscuz", prefixos: ["19022", "19023", "19024"] },
      { descricao: "Tapioca", prefixos: ["19030000"] },
      { descricao: "Pão de forma", prefixos: ["19059010"] },
      { descricao: "Óleos vegetais", prefixos: ["1507", "1508", "1511", "1512", "1514", "1515"] },
      { descricao: "Extrato de tomate", prefixos: ["2002"] },
      { descricao: "Polpas de frutas", prefixos: ["2008"], condicao: "Sem adição de açúcar ou edulcorantes" },
      { descricao: "Sucos naturais de frutas ou hortícolas", prefixos: ["2009"], condicao: "Sem adição de açúcar, edulcorantes ou conservantes" },
    ],
  },
  {
    anexo: "Anexo VIII", artigo: "Art. 136", tema: "Produtos de higiene pessoal e limpeza",
    cst: "200", cClassTrib: "200035", reducao: 60,
    itens: [
      { descricao: "Sabões de toucador e sabões em barra", prefixos: ["340111", "340119", "340120"] },
      { descricao: "Dentifrícios", prefixos: ["33061000"] },
      { descricao: "Escovas de dentes", prefixos: ["96032100"] },
      { descricao: "Papel higiênico", prefixos: ["48181000"] },
      { descricao: "Água sanitária", prefixos: ["28289011"] },
      { descricao: "Detergentes", prefixos: ["3402"], condicao: "Produtos de limpeza de uso doméstico" },
      { descricao: "Desinfetantes", prefixos: ["38089419"], condicao: "Uso domissanitário" },
      { descricao: "Fraldas", prefixos: ["96190000"], condicao: "Fraldas; absorventes higiênicos têm alíquota zero (art. 147, 200013)" },
    ],
  },
  {
    anexo: "Anexo IX", artigo: "Art. 138", tema: "Insumos agropecuários e aquícolas",
    cst: "200", cClassTrib: "200038", reducao: 60,
    itens: [
      { descricao: "Fertilizantes", prefixos: ["3101", "3102", "3103", "3104", "3105"] },
      { descricao: "Defensivos agropecuários", prefixos: ["380891", "380892", "380893", "380894", "380899"], condicao: "Com registro no MAPA e destinação agropecuária" },
      { descricao: "Sementes para semeadura", prefixos: ["1209"] },
      { descricao: "Mudas de plantas", prefixos: ["0602"] },
      { descricao: "Rações e preparações para alimentação animal", prefixos: ["2309"], condicao: "Exceto alimentos para cães e gatos (2309.10)", exceto: ["230910"] },
      { descricao: "Vacinas para medicina veterinária", prefixos: ["300242"] },
    ],
  },
  {
    anexo: "Anexo VI", artigo: "Art. 133", tema: "Medicamentos",
    cst: "200", cClassTrib: "200032", reducao: 60,
    itens: [
      { descricao: "Medicamentos", prefixos: ["3003", "3004"], condicao: "Registrados na Anvisa ou produzidos por farmácias de manipulação; os do Anexo XIV têm alíquota zero (200009)" },
    ],
  },
  {
    anexo: "Anexo XIV", artigo: "Art. 146", tema: "Medicamentos com alíquota zero",
    cst: "200", cClassTrib: "200009", reducao: 100,
    itens: [
      { descricao: "Medicamentos listados no Anexo XIV", prefixos: ["3003", "3004"], condicao: "Somente os princípios ativos listados no Anexo XIV" },
    ],
  },
  {
    anexo: "Anexo IV", artigo: "Art. 131", tema: "Dispositivos médicos",
    cst: "200", cClassTrib: "200030", reducao: 60,
    itens: [
      { descricao: "Instrumentos e aparelhos médicos, ortopedia, curativos", prefixos: ["3005", "9018", "9019", "9021"], condicao: "Somente os listados no Anexo IV; os do Anexo XII têm alíquota zero (200004)" },
    ],
  },
  {
    anexo: "Art. 147", artigo: "Art. 147", tema: "Absorventes e tampões higiênicos",
    cst: "200", cClassTrib: "200013", reducao: 100,
    itens: [
      { descricao: "Absorventes e tampões higiênicos", prefixos: ["96190000"], condicao: "Somente absorventes/tampões higiênicos (fraldas: Anexo VIII)" },
    ],
  },
];

// ─── Passo 1: operação (CFOP) ────────────────────────────────────────────────

export interface ResultadoOperacao {
  tributavel: boolean;
  cfop: string;
  descricao: string;
  cst?: string;
  cClassTrib?: string;
  baseLegal?: string;
  observacao?: string;
}

const CFOP_NAO_TRIBUTADO: { cfops: string[]; descricao: string; cst: string; cClassTrib: string; baseLegal: string }[] = [
  {
    cfops: ["5151", "5152", "5155", "5156", "5408", "5409", "6151", "6152", "6155", "6156", "6408", "6409"],
    descricao: "Transferência entre estabelecimentos do mesmo titular",
    cst: "410", cClassTrib: "410002", baseLegal: "Art. 6º, LC 214/25",
  },
  {
    cfops: ["5910", "6910"],
    descricao: "Remessa em bonificação, doação ou brinde",
    cst: "410", cClassTrib: "410001", baseLegal: "Art. 6º, LC 214/25 — confira: doação sem contraprestação usa 410003",
  },
];

export function analisarOperacao(cfopRaw: string): ResultadoOperacao | null {
  const cfop = (cfopRaw || "").replace(/\D/g, "");
  if (!cfop) return null;
  if (cfop.length !== 4) {
    return { tributavel: true, cfop, descricao: "CFOP inválido (use 4 dígitos) — seguindo para a análise por NCM" };
  }
  if (cfop.startsWith("7")) {
    return {
      tributavel: false, cfop, descricao: "Exportação",
      cst: "410", cClassTrib: "410004", baseLegal: "Art. 8º, LC 214/25 — imunidade/não incidência na exportação",
    };
  }
  for (const g of CFOP_NAO_TRIBUTADO) {
    if (g.cfops.includes(cfop)) {
      return { tributavel: false, cfop, descricao: g.descricao, cst: g.cst, cClassTrib: g.cClassTrib, baseLegal: g.baseLegal };
    }
  }
  if (/^[56]20[1-9]$|^[56]41[0-3]$|^[56]55[3-6]$/.test(cfop)) {
    return {
      tributavel: true, cfop, descricao: "Devolução",
      observacao: "Devolução segue a classificação da nota original — confira o cClassTrib da operação devolvida",
    };
  }
  if (cfop.startsWith("1") || cfop.startsWith("2") || cfop.startsWith("3")) {
    return {
      tributavel: true, cfop, descricao: "Entrada",
      observacao: "CFOP de entrada: a classificação é a do documento do fornecedor; use o resultado abaixo só para conferir",
    };
  }
  return { tributavel: true, cfop, descricao: "Operação tributável — classificação pelo NCM" };
}

// ─── Passo 2: produto (NCM) ──────────────────────────────────────────────────

export interface OpcaoEnquadramento {
  anexo: string;
  artigo: string;
  tema: string;
  item: string;
  cst: string;
  cClassTrib: string;
  reducao: number;
  condicao?: string;
}

export interface ResultadoNcm {
  entrada: string;
  ncm: string;              // 8 dígitos normalizados ("" se inválido)
  ncmFormatado: string;     // 0000.00.00
  zeroCorrigido: boolean;   // completou o zero à esquerda (Excel costuma remover)
  situacao: Situacao;
  cst?: string;
  cClassTrib?: string;
  opcoes: OpcaoEnquadramento[];
  baseLegal: string;
  mensagem?: string;
}

export function normalizarNcm(raw: string): { ncm: string; zeroCorrigido: boolean } {
  const digitos = (raw || "").replace(/\D/g, "");
  if (digitos.length === 8) return { ncm: digitos, zeroCorrigido: false };
  // Excel remove o zero à esquerda dos capítulos 01–09 (ex.: 04031000 → 4031000)
  if (digitos.length === 7) return { ncm: "0" + digitos, zeroCorrigido: true };
  return { ncm: "", zeroCorrigido: false };
}

export function formatarNcm(ncm: string): string {
  return ncm.length === 8 ? `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6)}` : ncm;
}

export function buscarEnquadramentos(ncm: string): OpcaoEnquadramento[] {
  const opcoes: OpcaoEnquadramento[] = [];
  for (const regra of BASE_ANEXOS) {
    // Dentro de um anexo, fica só o item de prefixo mais longo
    let melhor: { item: RegraAnexo["itens"][number]; tam: number } | null = null;
    for (const item of regra.itens) {
      if (item.exceto?.some(e => ncm.startsWith(e))) continue;
      for (const p of item.prefixos) {
        if (ncm.startsWith(p) && (!melhor || p.length > melhor.tam)) melhor = { item, tam: p.length };
      }
    }
    if (melhor) {
      opcoes.push({
        anexo: regra.anexo, artigo: regra.artigo, tema: regra.tema, item: melhor.item.descricao,
        cst: regra.cst, cClassTrib: regra.cClassTrib, reducao: regra.reducao, condicao: melhor.item.condicao,
      });
    }
  }
  return opcoes;
}

export function baseLegalDe(o: OpcaoEnquadramento): string {
  const red = o.reducao === 100 ? "alíquota zero" : `redução de ${o.reducao}%`;
  return `${o.artigo}, LC 214/25 — ${o.tema} (${o.anexo}, ${red})`;
}

export function classificarNcm(entrada: string): ResultadoNcm {
  const { ncm, zeroCorrigido } = normalizarNcm(entrada);
  if (!ncm) {
    return {
      entrada, ncm: "", ncmFormatado: entrada, zeroCorrigido: false, situacao: "INVALIDO", opcoes: [],
      baseLegal: "", mensagem: "NCM deve ter 8 dígitos (com ou sem pontos)",
    };
  }
  const opcoes = buscarEnquadramentos(ncm);
  const base = { entrada, ncm, ncmFormatado: formatarNcm(ncm), zeroCorrigido, opcoes };
  const avisoZero = zeroCorrigido ? "Zero à esquerda completado automaticamente — confira o código. " : "";

  if (opcoes.length === 0) {
    return {
      ...base, situacao: "VERDE", cst: "000", cClassTrib: "000001",
      baseLegal: "Tributação integral — não consta nos anexos de redução da LC 214/2025",
      mensagem: avisoZero || undefined,
    };
  }
  if (opcoes.length === 1) {
    const o = opcoes[0];
    return {
      ...base, situacao: "AMARELO", cst: o.cst, cClassTrib: o.cClassTrib, baseLegal: baseLegalDe(o),
      mensagem: avisoZero + (o.condicao ? `Confira: ${o.condicao}` : "Confira se o produto corresponde ao item do anexo"),
    };
  }
  return {
    ...base, situacao: "VERMELHO", baseLegal: "",
    mensagem: avisoZero + `${opcoes.length} enquadramentos possíveis — escolha um (ou tributação integral)`,
  };
}

export function classificarLote(texto: string): ResultadoNcm[] {
  // Um NCM por linha (também aceita ; e tab). A linha pode trazer descrição junto
  // ("1902.11.00 Macarrão") — extrai o primeiro código com formato de NCM.
  return texto
    .split(/[\r\n;\t]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 5000)
    .map(linha => {
      const m = linha.match(/(?<!\d)(?:\d{4}\.\d{2}\.\d{2}|\d{3}\.\d{2}\.\d{2}|\d{7,8})(?!\d)/);
      return classificarNcm(m ? m[0] : linha);
    });
}

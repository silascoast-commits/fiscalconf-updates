// ═══════════════════════════════════════════════════════════════════════════
// BASE DE CLASSIFICAÇÃO DA REFORMA TRIBUTÁRIA DO CONSUMO — NCM e NBS
// EC 132/2023 · LC 214/2025 (IBS, CBS e Imposto Seletivo)
//
// Motor de "maior prefixo": a regra mais específica (mais dígitos) que casa com
// o código informado prevalece. Regras marcadas como `condicional` dependem da
// descrição exata do produto/serviço ou de condição do adquirente/prestador e
// DEVEM ser conferidas no anexo legal e na tabela cClassTrib oficial
// (Portal NF-e / SVRS — Classificação Tributária do IBS/CBS).
//
// Este arquivo é compartilhado entre servidor e cliente.
// ═══════════════════════════════════════════════════════════════════════════

export type Tratamento =
  | "integral"
  | "reducao_100"
  | "reducao_70"
  | "reducao_60"
  | "reducao_50"
  | "reducao_40"
  | "reducao_30"
  | "monofasico"
  | "especifico"
  | "isencao"
  | "imunidade";

export interface RegraReforma {
  /** prefixo, apenas dígitos */
  codigo: string;
  descricao: string;
  tratamento: Tratamento;
  /** % de redução das alíquotas de IBS e CBS (0–100) */
  reducao: number;
  cst: string;
  cClassTrib: string;
  fundamento: string;
  anexo?: string;
  /** depende da descrição exata ou de condição — conferir */
  condicional?: boolean;
  condicoes?: string[];
  alertas?: string[];
  /** cClassTribs alternativos que podem se aplicar ao mesmo código */
  alternativas?: { cClassTrib: string; quando: string }[];
  /** prefixos excluídos desta regra */
  excecoes?: string[];
}

export interface RegraIS {
  codigo: string;
  categoria: string;
  descricao: string;
  fundamento: string;
  aliquota: string;
  condicional?: boolean;
  observacoes: string[];
  excecoes?: string[];
}

export const TRATAMENTO_LABEL: Record<Tratamento, string> = {
  integral: "Tributação integral",
  reducao_100: "Alíquota zero (redução de 100%)",
  reducao_70: "Redução de 70%",
  reducao_60: "Redução de 60%",
  reducao_50: "Redução de 50%",
  reducao_40: "Redução de 40%",
  reducao_30: "Redução de 30%",
  monofasico: "Regime específico monofásico",
  especifico: "Regime específico",
  isencao: "Isenção",
  imunidade: "Imunidade constitucional",
};

// ─── Base legal resumida ─────────────────────────────────────────────────────
export const FONTES_OFICIAIS = [
  { nome: "LC 214/2025 (texto compilado)", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm" },
  { nome: "EC 132/2023", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm" },
  { nome: "Tabela cClassTrib / CST IBS-CBS (SVRS)", url: "https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributaria" },
  { nome: "Portal NF-e — Notas Técnicas da Reforma", url: "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=" },
  { nome: "NBS — Nomenclatura Brasileira de Serviços (MDIC)", url: "https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/nbs" },
  { nome: "Receita Federal — Reforma Tributária do Consumo", url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-consumo" },
];

// ═══════════════════════════════════════════════════════════════════════════
// NCM — CAPÍTULOS DO SISTEMA HARMONIZADO
// ═══════════════════════════════════════════════════════════════════════════
export const CAPITULOS_NCM: Record<string, string> = {
  "01": "Animais vivos",
  "02": "Carnes e miudezas, comestíveis",
  "03": "Peixes e crustáceos, moluscos e outros invertebrados aquáticos",
  "04": "Leite e laticínios; ovos de aves; mel natural; produtos comestíveis de origem animal",
  "05": "Outros produtos de origem animal",
  "06": "Plantas vivas e produtos de floricultura",
  "07": "Produtos hortícolas, plantas, raízes e tubérculos, comestíveis",
  "08": "Frutas; cascas de citros e de melões",
  "09": "Café, chá, mate e especiarias",
  "10": "Cereais",
  "11": "Produtos da indústria de moagem; malte; amidos e féculas; inulina; glúten de trigo",
  "12": "Sementes e frutos oleaginosos; grãos, sementes e frutos diversos; plantas industriais ou medicinais; palhas e forragens",
  "13": "Gomas, resinas e outros sucos e extratos vegetais",
  "14": "Matérias para entrançar e outros produtos de origem vegetal",
  "15": "Gorduras e óleos animais, vegetais ou microbianos; ceras",
  "16": "Preparações de carne, de peixes, de crustáceos ou de moluscos",
  "17": "Açúcares e produtos de confeitaria",
  "18": "Cacau e suas preparações",
  "19": "Preparações à base de cereais, farinhas, amidos, féculas ou leite; produtos de pastelaria",
  "20": "Preparações de produtos hortícolas, de frutas ou de outras partes de plantas",
  "21": "Preparações alimentícias diversas",
  "22": "Bebidas, líquidos alcoólicos e vinagres",
  "23": "Resíduos das indústrias alimentares; alimentos preparados para animais",
  "24": "Tabaco e seus sucedâneos manufaturados; produtos para inalação sem combustão",
  "25": "Sal; enxofre; terras e pedras; gesso, cal e cimento",
  "26": "Minérios, escórias e cinzas",
  "27": "Combustíveis minerais, óleos minerais e produtos da sua destilação",
  "28": "Produtos químicos inorgânicos",
  "29": "Produtos químicos orgânicos",
  "30": "Produtos farmacêuticos",
  "31": "Adubos (fertilizantes)",
  "32": "Extratos tanantes e tintoriais; tintas e vernizes; mástiques",
  "33": "Óleos essenciais; produtos de perfumaria ou de toucador e preparações cosméticas",
  "34": "Sabões, preparações para lavagem, ceras, velas e massas de modelar",
  "35": "Matérias albuminoides; colas; enzimas",
  "36": "Pólvoras e explosivos; artigos de pirotecnia; fósforos",
  "37": "Produtos para fotografia e cinematografia",
  "38": "Produtos diversos das indústrias químicas",
  "39": "Plástico e suas obras",
  "40": "Borracha e suas obras",
  "41": "Peles, exceto as peles com pelo, e couros",
  "42": "Obras de couro; artigos de viagem, bolsas e semelhantes",
  "43": "Peles com pelo e suas obras",
  "44": "Madeira, carvão vegetal e obras de madeira",
  "45": "Cortiça e suas obras",
  "46": "Obras de espartaria ou de cestaria",
  "47": "Pastas de madeira ou de outras matérias fibrosas celulósicas",
  "48": "Papel e cartão; obras de pasta de celulose, de papel ou de cartão",
  "49": "Livros, jornais, gravuras e outros produtos das indústrias gráficas",
  "50": "Seda",
  "51": "Lã, pelos finos ou grosseiros",
  "52": "Algodão",
  "53": "Outras fibras têxteis vegetais",
  "54": "Filamentos sintéticos ou artificiais",
  "55": "Fibras sintéticas ou artificiais, descontínuas",
  "56": "Pastas, feltros e falsos tecidos; cordéis, cordas e cabos",
  "57": "Tapetes e outros revestimentos para pisos, de matérias têxteis",
  "58": "Tecidos especiais; rendas; tapeçarias; bordados",
  "59": "Tecidos impregnados, revestidos ou estratificados",
  "60": "Tecidos de malha",
  "61": "Vestuário e seus acessórios, de malha",
  "62": "Vestuário e seus acessórios, exceto de malha",
  "63": "Outros artefatos têxteis confeccionados; artigos usados",
  "64": "Calçados, polainas e artefatos semelhantes",
  "65": "Chapéus e artefatos de uso semelhante",
  "66": "Guarda-chuvas, sombrinhas, bengalas",
  "67": "Penas preparadas; flores artificiais; obras de cabelo",
  "68": "Obras de pedra, gesso, cimento, amianto, mica",
  "69": "Produtos cerâmicos",
  "70": "Vidro e suas obras",
  "71": "Pérolas, pedras e metais preciosos; bijuterias; moedas",
  "72": "Ferro fundido, ferro e aço",
  "73": "Obras de ferro fundido, ferro ou aço",
  "74": "Cobre e suas obras",
  "75": "Níquel e suas obras",
  "76": "Alumínio e suas obras",
  "78": "Chumbo e suas obras",
  "79": "Zinco e suas obras",
  "80": "Estanho e suas obras",
  "81": "Outros metais comuns; ceramais",
  "82": "Ferramentas, cutelaria e talheres, de metais comuns",
  "83": "Obras diversas de metais comuns",
  "84": "Reatores nucleares, caldeiras, máquinas e aparelhos mecânicos",
  "85": "Máquinas, aparelhos e materiais elétricos; aparelhos de som e imagem",
  "86": "Veículos e material para vias férreas",
  "87": "Veículos automóveis, tratores, ciclos e outros veículos terrestres",
  "88": "Aeronaves e aparelhos espaciais",
  "89": "Embarcações e estruturas flutuantes",
  "90": "Instrumentos e aparelhos de óptica, medida, controle, médico-cirúrgicos",
  "91": "Artigos de relojoaria",
  "92": "Instrumentos musicais",
  "93": "Armas e munições",
  "94": "Móveis; mobiliário médico-cirúrgico; colchões; luminárias; pré-fabricados",
  "95": "Brinquedos, jogos, artigos para divertimento ou esporte",
  "96": "Obras diversas",
  "97": "Objetos de arte, de coleção e antiguidades",
};

// ─── Helpers de construção ───────────────────────────────────────────────────
const ANX_I = "LC 214/2025, art. 125 e Anexo I (Cesta Básica Nacional de Alimentos)";
const ANX_VII = "LC 214/2025, art. 135 e Anexo VII (alimentos destinados ao consumo humano)";
const ANX_XV = "LC 214/2025, art. 148 e Anexo XV (produtos hortícolas, frutas e ovos)";

function cesta(codigos: string[], descricao: string, extra: Partial<RegraReforma> = {}): RegraReforma[] {
  return codigos.map(codigo => ({
    codigo, descricao, tratamento: "reducao_100" as const, reducao: 100, cst: "200", cClassTrib: "200003",
    fundamento: ANX_I, anexo: "Anexo I", ...extra,
  }));
}
function hortifruti(codigos: string[], descricao: string, extra: Partial<RegraReforma> = {}): RegraReforma[] {
  return codigos.map(codigo => ({
    codigo, descricao, tratamento: "reducao_100" as const, reducao: 100, cst: "200", cClassTrib: "200014",
    fundamento: ANX_XV, anexo: "Anexo XV",
    condicoes: ["Produto in natura ou com processamento mínimo (resfriado, congelado, embalado), sem adição de outros ingredientes", "Exceto quando destinado à semeadura/plantio"],
    ...extra,
  }));
}
function alimento60(codigos: string[], descricao: string, extra: Partial<RegraReforma> = {}): RegraReforma[] {
  return codigos.map(codigo => ({
    codigo, descricao, tratamento: "reducao_60" as const, reducao: 60, cst: "200", cClassTrib: "200034",
    fundamento: ANX_VII, anexo: "Anexo VII", ...extra,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// REGRAS IBS/CBS POR NCM
// ═══════════════════════════════════════════════════════════════════════════
export const REGRAS_NCM: RegraReforma[] = [
  // ── Cesta Básica Nacional — alíquota zero (Anexo I) ────────────────────────
  ...cesta(["100620", "100630", "100640"], "Arroz (descascado, semibranqueado/branqueado, quebrado)"),
  ...cesta(["04011010", "04011090", "04012010", "04012090", "04014010", "04015010"], "Leite fluido (UHT, pasteurizado, cru)"),
  ...cesta(["04021010", "04021090", "04022110", "04022120", "04022910", "04022920"], "Leite em pó, integral ou desnatado"),
  ...cesta(["19011010", "19011090"], "Fórmulas infantis (preparações para alimentação infantil)", {
    condicoes: ["Fórmulas infantis definidas por previsão legal específica (Anvisa)"],
  }),
  ...cesta(["04051000"], "Manteiga"),
  ...cesta(["15171000"], "Margarina"),
  ...cesta(["07133319", "07133329", "07133399", "07133590", "07133190", "07133290", "07133990"], "Feijões (exceto para semeadura)"),
  ...cesta(["0714"], "Raízes e tubérculos (mandioca, inhame, cará, batata-doce etc.)"),
  ...cesta(["08011"], "Cocos"),
  ...cesta(["09011", "09012", "21011"], "Café (cru, torrado, moído) e extratos/essências de café", {
    condicoes: ["Inclui café cru, torrado e moído e o café solúvel (2101.1)"],
  }),
  ...cesta(["1507"], "Óleo de soja"),
  ...cesta(["151321", "151329"], "Óleo de babaçu", { condicional: true, condicoes: ["Somente óleo de babaçu (NCM 1513.21.20 e 1513.29.10); demais óleos de palmiste: Anexo VII ou integral"] }),
  ...cesta(["11062000"], "Farinha de mandioca"),
  ...cesta(["11022000", "11031300", "11041900", "11042300"], "Farinha, grumos, sêmolas e grãos esmagados ou em flocos de milho"),
  ...cesta(["11010010"], "Farinha de trigo"),
  ...cesta(["17011400", "17019900"], "Açúcar (cana em bruto e demais açúcares de cana ou beterraba)"),
  ...cesta(["19021"], "Massas alimentícias não cozidas nem recheadas"),
  ...cesta(["19059010"], "Pão do tipo comum (pão francês)", {
    condicoes: ["Pão comum de padaria, preparado com farinha de cereais, sal, água e fermento"],
  }),
  ...cesta(["110412", "110422", "110312"], "Grumos, sêmolas e grãos de aveia"),
  ...cesta(["0201", "0202", "0203", "0204", "0206", "0207", "0209", "0210", "15011000", "15012000", "15013000"], "Carnes bovina, suína, ovina, caprina e de aves e produtos de origem animal", {
    excecoes: ["020743", "020753"],
    condicoes: ["Exceto foie gras (fígados gordos — 0207.43 e 0207.53)", "Inclui carnes frescas, refrigeradas, congeladas, salgadas, secas ou defumadas e miudezas"],
  }),
  ...cesta(["0302", "0303", "0304"], "Peixes e carnes de peixes", {
    excecoes: [
      "030211", "030213", "030214", "030219", "030231", "030232", "030233", "030234", "030235", "030236", "030239", "030251", "030252", "030253",
      "030311", "030312", "030313", "030314", "030319", "030341", "030342", "030343", "030344", "030345", "030346", "030349", "030363", "030364", "030365",
      "030441", "030442", "030444", "030452", "030453", "030481", "030487", "030493", "030495",
    ],
    condicional: true,
    condicoes: ["Exceto salmonídeos, atuns, bacalhaus, hadoque, saithe e ovas e outros subprodutos — conferir subitem no Anexo I"],
  }),
  ...cesta(["040610", "04062000", "040690"], "Queijos (mussarela, minas, prato, coalho, ricota, requeijão, provolone, parmesão, fresco não maturado e do reino)", {
    condicional: true,
    condicoes: ["Somente os tipos de queijo expressamente listados no Anexo I", "Demais queijos: Anexo VII (redução de 60%) — cClassTrib 200034"],
    alternativas: [{ cClassTrib: "200034", quando: "Queijos não listados no Anexo I (ex.: brie, gorgonzola, camembert)" }],
  }),
  ...cesta(["25010020", "25010090"], "Sal de mesa (iodado ou não)"),
  ...cesta(["0903"], "Mate (erva-mate)"),
  ...cesta(["19019020", "19022000"], "Farinha e massas com baixo teor proteico para pacientes com fenilcetonúria", {
    condicional: true, condicoes: ["Somente produtos com baixo teor proteico destinados a portadores de fenilcetonúria, conforme Anvisa"],
  }),

  // ── Hortícolas, frutas e ovos — alíquota zero (Anexo XV) ─────────────────
  ...hortifruti(["040721", "040729", "040790"], "Ovos de aves com casca, frescos ou conservados"),
  ...hortifruti(["0701", "0702", "0703", "0704", "0705", "0706", "0707", "0708", "0709"], "Produtos hortícolas frescos ou refrigerados", {
    excecoes: ["07011000"],
  }),
  ...hortifruti(["0803", "0804", "0805", "080610", "0807", "0808", "0809", "0810"], "Frutas frescas ou refrigeradas"),
  { codigo: "07", descricao: "Demais produtos hortícolas (congelados, secos, preparados)", tratamento: "reducao_60", reducao: 60, cst: "200", cClassTrib: "200034",
    fundamento: ANX_VII, anexo: "Anexo VII", condicional: true,
    condicoes: ["Hortícolas não listados no Anexo XV podem ter redução de 60% se constarem do Anexo VII ou se forem produtos agropecuários in natura (art. 138)"],
    alternativas: [{ cClassTrib: "200036", quando: "Produto agropecuário in natura (art. 138)" }, { cClassTrib: "000001", quando: "Não enquadrado em nenhum anexo" }] },
  { codigo: "08", descricao: "Demais frutas (secas, congeladas, castanhas, nozes)", tratamento: "reducao_60", reducao: 60, cst: "200", cClassTrib: "200034",
    fundamento: ANX_VII, anexo: "Anexo VII", condicional: true,
    condicoes: ["Frutas não listadas no Anexo XV: verificar Anexo VII ou enquadramento como produto in natura (art. 138)"],
    alternativas: [{ cClassTrib: "200036", quando: "Produto agropecuário in natura (art. 138)" }, { cClassTrib: "000001", quando: "Não enquadrado em nenhum anexo" }] },

  // ── Alimentos — redução de 60% (Anexo VII) ───────────────────────────────
  ...alimento60(["0306", "0307", "0308"], "Crustáceos, moluscos e outros invertebrados aquáticos", { condicional: true, condicoes: ["Exceto pratos prontos e preparações (cap. 16)"] }),
  { codigo: "03", descricao: "Peixes não abrangidos pelo Anexo I (salmão, atum, bacalhau etc.)", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025 — regra geral (art. 12) — confira Anexo VII", condicional: true,
    alertas: ["Peixes excluídos da Cesta Básica: verifique se o subitem consta do Anexo VII (redução de 60%)."],
    alternativas: [{ cClassTrib: "200034", quando: "Subitem listado no Anexo VII" }] },
  ...alimento60(["0403"], "Leite fermentado, iogurte, bebidas lácteas e compostos lácteos", { condicional: true }),
  ...alimento60(["0401"], "Creme de leite e demais leites não listados no Anexo I", { condicional: true }),
  ...alimento60(["0402"], "Leite condensado e demais leites concentrados não listados no Anexo I", { condicional: true }),
  ...alimento60(["0406"], "Demais queijos (não listados no Anexo I)", { condicional: true }),
  ...alimento60(["0409"], "Mel natural"),
  ...alimento60(["1101", "1102", "1103", "1104", "1105", "1106"], "Farinhas, grumos e sêmolas de cereais não listados no Anexo I", { condicional: true }),
  ...alimento60(["1508", "1509", "1510", "1511", "1512", "1513", "1514", "1515"], "Óleos vegetais (amendoim, oliva, palma, girassol, algodão, milho, canola etc.)", { condicional: true, condicoes: ["Exceto óleo de soja e de babaçu (alíquota zero — Anexo I)"] }),
  ...alimento60(["1902"], "Massas alimentícias cozidas, recheadas e cuscuz", { condicional: true }),
  ...alimento60(["1903"], "Tapioca e seus sucedâneos"),
  ...alimento60(["190590"], "Pães (de forma, integrais etc.) e demais produtos de panificação não listados no Anexo I", { condicional: true,
    condicoes: ["Biscoitos, bolos e produtos de confeitaria em geral NÃO estão no Anexo VII — verifique o subitem"] }),
  ...alimento60(["2009"], "Sucos naturais de frutas e de produtos hortícolas, sem adição de açúcar ou conservantes", { condicional: true,
    condicoes: ["Sem adição de açúcar, adoçantes e conservantes"] }),
  ...alimento60(["2008", "2007"], "Polpas de frutas e preparações de frutas", { condicional: true,
    condicoes: ["Polpas sem adição de açúcar e conservantes; doces, geleias e compotas em geral: tributação integral"] }),
  ...alimento60(["1208"], "Farinhas de soja e outras oleaginosas destinadas ao consumo humano", { condicional: true }),
  ...alimento60(["1006"], "Arroz não listado no Anexo I (ex.: arroz com casca para consumo)", { condicional: true,
    alternativas: [{ cClassTrib: "200036", quando: "Arroz com casca in natura (art. 138)" }] }),
  ...alimento60(["1601", "1602"], "Embutidos e preparações de carne", { condicional: true,
    condicoes: ["Somente os itens expressamente listados no Anexo VII; demais preparações: tributação integral"] }),
  ...alimento60(["0901", "0902", "0910"], "Chás, especiarias e café não abrangidos pelo Anexo I", { condicional: true }),

  // ── Produtos agropecuários in natura — redução de 60% (art. 138) ────────
  ...["01", "1001", "1002", "1003", "1004", "1005", "1007", "1008", "1201", "1202", "1801", "4401", "4403", "5101", "5201"].map(codigo => ({
    codigo, descricao: "Produto agropecuário, aquícola, pesqueiro, florestal ou extrativista vegetal in natura",
    tratamento: "reducao_60" as const, reducao: 60, cst: "200", cClassTrib: "200036",
    fundamento: "LC 214/2025, art. 137, I e art. 138",
    condicional: true,
    condicoes: ["Produto in natura: não submetido a industrialização (admitidos limpeza, secagem, debulha, resfriamento, armazenagem)", "Produtor rural não contribuinte (receita anual < R$ 3,6 mi) pode transferir crédito presumido ao adquirente"],
    alternativas: [{ cClassTrib: "200002", quando: "Fornecimento para produtor rural não contribuinte ou TAC" }],
  })),

  // ── Insumos agropecuários — redução de 60% (Anexo IX) ───────────────────
  ...["31", "1209", "2309", "3808", "05119910", "300242", "300290"].map(codigo => ({
    codigo, descricao: "Insumos agropecuários e aquícolas (fertilizantes, defensivos, sementes, rações, vacinas veterinárias)",
    tratamento: "reducao_60" as const, reducao: 60, cst: "200", cClassTrib: "200038",
    fundamento: "LC 214/2025, art. 137, II e art. 138; Anexo IX", anexo: "Anexo IX",
    condicional: codigo !== "31",
    condicoes: ["Produto registrado no MAPA quando exigido", "Defensivos (3808): somente os de uso agropecuário — saneantes domissanitários têm tributação integral", "Pode haver diferimento quando o adquirente for produtor rural contribuinte (art. 138, §§)"],
    alternativas: [{ cClassTrib: "510010", quando: "Diferimento na venda a produtor rural" }],
  })),

  // ── Higiene pessoal e limpeza — redução de 60% (Anexo VIII) ─────────────
  ...["3401", "330610", "960321", "481810", "28289011", "3402"].map(codigo => ({
    codigo, descricao: "Produtos de higiene pessoal e limpeza majoritariamente consumidos por famílias de baixa renda",
    tratamento: "reducao_60" as const, reducao: 60, cst: "200", cClassTrib: "200035",
    fundamento: "LC 214/2025, art. 136 e Anexo VIII", anexo: "Anexo VIII",
    condicional: codigo === "3402" || codigo === "3401",
    condicoes: ["Sabões em barra e sabonetes, dentifrícios, escovas de dentes, papel higiênico, água sanitária e detergentes — somente os subitens listados no Anexo VIII"],
  })),
  { codigo: "9619", descricao: "Absorventes, tampões higiênicos e fraldas", tratamento: "reducao_100", reducao: 100, cst: "200", cClassTrib: "200013",
    fundamento: "LC 214/2025, art. 147 (produtos de cuidados básicos à saúde menstrual)", condicional: true,
    condicoes: ["Alíquota zero: tampões higiênicos, absorventes higiênicos internos ou externos, calcinhas absorventes e coletores menstruais", "Fraldas: redução de 60% (Anexo VIII) — cClassTrib 200035"],
    alternativas: [{ cClassTrib: "200035", quando: "Fraldas e demais artigos higiênicos do Anexo VIII" }] },

  // ── Medicamentos ─────────────────────────────────────────────────────────
  { codigo: "30", descricao: "Medicamentos e produtos farmacêuticos", tratamento: "reducao_60", reducao: 60, cst: "200", cClassTrib: "200032",
    fundamento: "LC 214/2025, art. 133 (redução de 60%) e art. 146 c/c Anexo XIV (alíquota zero)", condicional: true,
    condicoes: ["Medicamentos registrados na Anvisa ou produzidos por farmácia de manipulação: redução de 60%", "Medicamentos listados no Anexo XIV (oncológicos, doenças raras, DST/AIDS, negligenciadas, vacinas e soros etc.): alíquota zero", "Medicamentos de uso veterinário: Anexo IX (insumo agropecuário)"],
    alternativas: [
      { cClassTrib: "200009", quando: "Medicamento listado no Anexo XIV — alíquota zero" },
      { cClassTrib: "200010", quando: "Medicamento adquirido por órgão da administração pública" },
      { cClassTrib: "200053", quando: "Soros e vacinas" },
    ] },
  { codigo: "3005", descricao: "Curativos, gazes e ataduras", tratamento: "reducao_60", reducao: 60, cst: "200", cClassTrib: "200030",
    fundamento: "LC 214/2025, art. 131 e Anexo IV (dispositivos médicos)", anexo: "Anexo IV", condicional: true,
    alternativas: [{ cClassTrib: "200004", quando: "Item listado no Anexo XII — alíquota zero" }] },

  // ── Dispositivos médicos e de acessibilidade ────────────────────────────
  ...["9018", "9019", "9020", "9022", "9402", "4015"].map(codigo => ({
    codigo, descricao: "Dispositivos médicos (instrumentos, aparelhos e mobiliário médico-hospitalar)",
    tratamento: "reducao_60" as const, reducao: 60, cst: "200", cClassTrib: "200030",
    fundamento: "LC 214/2025, art. 131 e Anexo IV; art. 144 e Anexo XII (alíquota zero)", anexo: "Anexo IV",
    condicional: true,
    condicoes: ["Somente os subitens listados no Anexo IV (60%) ou XII (zero)", "Itens não listados: tributação integral"],
    alternativas: [
      { cClassTrib: "200004", quando: "Listado no Anexo XII — alíquota zero" },
      { cClassTrib: "200005", quando: "Venda à administração pública / entidades de saúde imunes" },
      { cClassTrib: "000001", quando: "Não listado em nenhum anexo" },
    ],
  })),
  ...["9021", "8713"].map(codigo => ({
    codigo, descricao: "Dispositivos de acessibilidade para pessoas com deficiência (próteses, órteses, aparelhos auditivos, cadeiras de rodas)",
    tratamento: "reducao_60" as const, reducao: 60, cst: "200", cClassTrib: "200031",
    fundamento: "LC 214/2025, art. 132 e Anexo V; art. 145 e Anexo XIII (alíquota zero)", anexo: "Anexo V",
    condicional: true,
    condicoes: ["Grande parte destes itens está no Anexo XIII (alíquota zero) — conferir subitem"],
    alternativas: [
      { cClassTrib: "200007", quando: "Listado no Anexo XIII — alíquota zero" },
      { cClassTrib: "200008", quando: "Venda à administração pública" },
    ],
  })),

  // ── Combustíveis — regime monofásico ─────────────────────────────────────
  ...[
    { c: "271012", d: "Gasolinas e naftas" },
    { c: "271019", d: "Óleo diesel, querosene de aviação e óleos combustíveis" },
    { c: "2711", d: "GLP, gás natural e demais gases de petróleo" },
    { c: "2207", d: "Etanol (álcool etílico) combustível e anidro" },
    { c: "3826", d: "Biodiesel e suas misturas" },
  ].map(({ c, d }) => ({
    codigo: c, descricao: d, tratamento: "monofasico" as const, reducao: 0, cst: "620", cClassTrib: "620001",
    fundamento: "LC 214/2025, arts. 172 a 180 (regime específico de combustíveis)",
    condicional: c === "2207" || c === "271019",
    condicoes: [
      "Incidência única (monofásica) com alíquota específica (ad rem) por unidade de medida, uniforme em todo o território",
      "Contribuinte: produtor, importador e formulador; nas etapas seguintes não há nova incidência",
      ...(c === "2207" ? ["Álcool não destinado a uso combustível (bebidas, hospitalar, industrial) segue regra geral"] : []),
      ...(c === "271019" ? ["Óleos lubrificantes e outros derivados não combustíveis seguem regra geral"] : []),
    ],
    alertas: ["No documento fiscal, informar o grupo de tributação monofásica (quantidade tributada e alíquota ad rem)."],
    alternativas: [{ cClassTrib: "000005", quando: "Etanol anidro combustível (EAC) destinado à mistura com gasolina A" }],
  })),

  // ── Livros, jornais e periódicos — imunidade ─────────────────────────────
  ...["4901", "4902", "4903", "480100"].map(codigo => ({
    codigo, descricao: "Livros, jornais, periódicos e o papel destinado à sua impressão",
    tratamento: "imunidade" as const, reducao: 100, cst: "410", cClassTrib: "410001",
    fundamento: "CF, art. 150, VI, d, c/c art. 149-B (EC 132/2023); LC 214/2025, art. 9º",
    condicoes: ["Imunidade objetiva — alcança o produto, não a empresa", "Papel: somente o destinado à impressão de livros, jornais e periódicos"],
    alertas: ["Confira o cClassTrib de imunidade específico na tabela SVRS vigente."],
  })),

  // ── Soberania e segurança nacional (Anexo XI) ───────────────────────────
  ...["8710", "8906", "9301", "8802"].map(codigo => ({
    codigo, descricao: "Bens relativos à soberania e segurança nacional",
    tratamento: "integral" as const, reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 142 e Anexo XI (redução de 60% apenas nas vendas à administração pública direta)",
    condicional: true,
    condicoes: ["Redução de 60% somente no fornecimento à administração pública direta, autarquias e fundações"],
    alternativas: [{ cClassTrib: "200043", quando: "Fornecimento à administração pública (Anexo XI) — redução de 60%" }],
  })),

  // ── Veículos ─────────────────────────────────────────────────────────────
  { codigo: "8703", descricao: "Automóveis de passageiros", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025 — regra geral; arts. 149 a 156 (PcD/TEA e taxistas)", condicional: true,
    condicoes: ["Alíquota zero na aquisição por pessoa com deficiência, pessoa com TEA e motoristas profissionais (taxistas), observados limites de valor e prazos"],
    alternativas: [{ cClassTrib: "200015", quando: "Aquisição por motorista profissional / PcD / TEA" }],
    alertas: ["Sujeito ao Imposto Seletivo a partir de 2027 — veja o painel IS."] },
];

// ═══════════════════════════════════════════════════════════════════════════
// IMPOSTO SELETIVO — POR NCM (LC 214/2025, arts. 409 e seguintes; Anexo XVII)
// ═══════════════════════════════════════════════════════════════════════════
const IS_FUND = "LC 214/2025, art. 409, §1º e Anexo XVII";
const IS_ALIQ_LEI = "A ser fixada em lei ordinária";
const IS_OBS_GERAIS = [
  "Vigência: a partir de 1º/01/2027",
  "Incidência única (monofásica): fabricante, importador, arrematante ou extrator",
  "Não incide sobre exportações (salvo bens minerais extraídos), energia elétrica e telecomunicações",
  "O IS integra a base de cálculo do IBS e da CBS; não gera crédito",
];

export const REGRAS_IS: RegraIS[] = [
  ...([
    ["2203", "Cervejas de malte (inclusive chope)"],
    ["2204", "Vinhos de uvas frescas, inclusive espumantes"],
    ["2205", "Vermutes e outros vinhos aromatizados"],
    ["2206", "Sidras, hidroméis e outras bebidas fermentadas"],
    ["2208", "Destilados: cachaça, aguardente, uísque, vodca, gim, rum, licores"],
  ] as const).map(([codigo, descricao]) => ({
    codigo, categoria: "Bebidas alcoólicas", descricao,
    fundamento: IS_FUND, aliquota: `${IS_ALIQ_LEI} — ad valorem + específica (por volume de álcool)`,
    observacoes: ["Alíquota específica progressiva conforme o teor alcoólico", "Alíquotas convergem gradualmente de 2029 a 2033", ...IS_OBS_GERAIS],
  })),
  { codigo: "220210", categoria: "Bebidas açucaradas", descricao: "Águas e refrigerantes com adição de açúcar ou outros edulcorantes",
    fundamento: IS_FUND, aliquota: IS_ALIQ_LEI, observacoes: ["Somente bebidas com adição de açúcar", ...IS_OBS_GERAIS] },
  { codigo: "220299", categoria: "Bebidas açucaradas", descricao: "Outras bebidas não alcoólicas adoçadas",
    fundamento: IS_FUND, aliquota: IS_ALIQ_LEI, condicional: true,
    observacoes: ["Confira no Anexo XVII se o subitem está alcançado (bebidas lácteas e achocolatados podem estar fora)", ...IS_OBS_GERAIS] },
  ...([
    ["2402", "Cigarros, charutos e cigarrilhas"],
    ["2403", "Fumo para cachimbo, narguilé, mascar e demais tabacos manufaturados"],
    ["2404", "Produtos que contenham tabaco ou nicotina para inalação sem combustão"],
  ] as const).map(([codigo, descricao]) => ({
    codigo, categoria: "Produtos fumígenos", descricao,
    fundamento: IS_FUND, aliquota: `${IS_ALIQ_LEI} — ad valorem + específica (por unidade/peso)`,
    condicional: codigo === "2404",
    observacoes: ["Comercialização de dispositivos eletrônicos para fumar é proibida pela Anvisa (RDC 855/2024)", ...IS_OBS_GERAIS],
  })),
  { codigo: "8703", categoria: "Veículos", descricao: "Automóveis de passageiros e outros veículos para transporte de pessoas",
    fundamento: IS_FUND, aliquota: `${IS_ALIQ_LEI} — graduada por critérios ambientais e de eficiência`, condicional: true,
    observacoes: ["Alíquota graduada por: potência, eficiência energética, desempenho estrutural e tecnologias assistivas à direção, reciclabilidade, pegada de carbono e densidade tecnológica", "Pode haver alíquota zero para veículos que atendam critérios de sustentabilidade", "Veículos adquiridos por PcD/TEA e taxistas: verificar isenção", ...IS_OBS_GERAIS] },
  { codigo: "8704", categoria: "Veículos", descricao: "Veículos para transporte de mercadorias (somente os alcançados pelo Anexo XVII)",
    fundamento: IS_FUND, aliquota: IS_ALIQ_LEI, condicional: true,
    observacoes: ["Caminhões estão fora do IS; caminhonetes/utilitários podem estar alcançados — conferir subitem no Anexo XVII", ...IS_OBS_GERAIS] },
  { codigo: "8802", categoria: "Aeronaves", descricao: "Aviões, helicópteros e demais aeronaves",
    fundamento: IS_FUND, aliquota: IS_ALIQ_LEI, condicional: true,
    observacoes: ["Não incide sobre aeronaves de uso agrícola, de aviação regular ou de prestação de serviço de transporte (táxi aéreo) e de uso militar — conferir exclusões legais", ...IS_OBS_GERAIS] },
  { codigo: "8903", categoria: "Embarcações", descricao: "Iates e outros barcos e embarcações de recreio ou de esporte",
    fundamento: IS_FUND, aliquota: IS_ALIQ_LEI, condicional: true,
    observacoes: ["Não incide sobre embarcações de pesca, transporte de cargas/passageiros e uso comercial", ...IS_OBS_GERAIS] },
  ...["26", "2701", "2709", "271111", "271121", "2502", "2503", "2504", "2505", "2506", "2507", "2508", "2510", "2511", "2512", "2513", "2514", "2515", "2516", "2517", "2518", "2519", "2520", "2521", "2526", "2529", "2530"].map(codigo => ({
    codigo, categoria: "Bens minerais", descricao: "Bens minerais extraídos (minérios, petróleo, gás natural, carvão e demais substâncias minerais)",
    fundamento: "LC 214/2025, art. 409, §1º e seguintes; CF, art. 153, §6º, VII (alíquota máxima de 0,25%)", aliquota: "Até 0,25% sobre o valor de mercado do bem extraído",
    condicional: true,
    observacoes: ["Incide uma única vez, na extração — revenda e industrialização posteriores não sofrem nova incidência", "Incide inclusive quando o bem é exportado", "Contribuinte: o extrator (titular do direito de lavra)", "Vigência: a partir de 1º/01/2027"],
  })),
];

// ═══════════════════════════════════════════════════════════════════════════
// NBS — SEÇÕES / CAPÍTULOS (Nomenclatura Brasileira de Serviços 2.0)
// Código NBS: 1.XXXX.XX.XX (9 dígitos). Prefixo "1XX" = capítulo.
// ═══════════════════════════════════════════════════════════════════════════
export const CAPITULOS_NBS: Record<string, string> = {
  "101": "Serviços de construção",
  "102": "Serviços de distribuição de mercadorias",
  "103": "Serviços de hospedagem, alimentação e bebidas",
  "104": "Serviços de transporte de passageiros",
  "105": "Serviços de transporte de cargas",
  "106": "Serviços de apoio aos transportes",
  "107": "Serviços postais, de coleta, remessa ou entrega",
  "108": "Serviços de transmissão e distribuição de eletricidade, gás e água",
  "109": "Serviços financeiros e relacionados; securitização; seguros",
  "110": "Serviços imobiliários",
  "111": "Arrendamento mercantil, locação de bens, propriedade intelectual e franquias",
  "112": "Serviços de pesquisa e desenvolvimento",
  "113": "Serviços jurídicos e contábeis",
  "114": "Outros serviços profissionais (consultoria, engenharia, arquitetura, publicidade)",
  "115": "Serviços de tecnologia da informação",
  "116": "Serviços de telecomunicações, difusão e fornecimento de informações",
  "117": "Serviços de apoio às atividades empresariais",
  "118": "Serviços de apoio à agropecuária, silvicultura, pesca, mineração e utilidades",
  "119": "Serviços de manutenção, reparação e instalação (exceto construção)",
  "120": "Serviços de produção (industrialização por encomenda)",
  "121": "Serviços de reciclagem e de reparo",
  "122": "Serviços de educação",
  "123": "Serviços relacionados à saúde humana e assistência social",
  "124": "Serviços de tratamento, eliminação e coleta de resíduos; saneamento",
  "125": "Serviços recreativos, culturais e desportivos",
  "126": "Outros serviços (pessoais, associações, domésticos)",
};

const PROF_INTELECTUAIS = [
  "administradores", "advogados", "arquitetos e urbanistas", "assistentes sociais", "bibliotecários", "biólogos",
  "contabilistas", "economistas", "economistas domésticos", "profissionais de educação física", "engenheiros e agrônomos",
  "estatísticos", "médicos veterinários e zootecnistas", "museólogos", "químicos", "profissionais de relações públicas",
  "técnicos industriais", "técnicos agrícolas",
];

export const REGRAS_NBS: RegraReforma[] = [
  { codigo: "101", descricao: "Serviços de construção civil", tratamento: "reducao_50", reducao: 50, cst: "200", cClassTrib: "200046",
    fundamento: "LC 214/2025, arts. 251 a 270 (regime específico de bens imóveis) — redução de 50%",
    condicional: true,
    condicoes: ["Aplicável a contribuintes sujeitos ao regime específico de operações com bens imóveis", "Incorporação imobiliária/parcelamento do solo podem optar pelo RET (cClassTrib 220001)"],
    alternativas: [{ cClassTrib: "220001", quando: "Incorporação imobiliária — Regime Especial de Tributação" }, { cClassTrib: "000001", quando: "Serviço não enquadrado no regime de imóveis" }],
    alertas: ["Construção civil: ISS municipal continua até 2032 (reduzindo-se de 2029 a 2032)."] },
  { codigo: "102", descricao: "Serviços de distribuição de mercadorias (comissão, representação, comércio)", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)" },
  { codigo: "103", descricao: "Hospedagem, alimentação e bebidas", tratamento: "reducao_40", reducao: 40, cst: "200", cClassTrib: "200047",
    fundamento: "LC 214/2025, arts. 273 a 276 (bares e restaurantes) e arts. 277 a 281 (hotelaria, parques de diversão e temáticos) — redução de 40%",
    condicional: true,
    condicoes: ["Bares e restaurantes, inclusive lanchonetes e fornecimento de alimentação: base de cálculo exclui gorjeta (até limite)", "Hotelaria e similares: regime específico próprio", "Vedado crédito ao adquirente do serviço de bares/restaurantes (salvo exceções)"],
    alternativas: [{ cClassTrib: "200048", quando: "Hotelaria, parques de diversão e parques temáticos" }] },
  { codigo: "104", descricao: "Transporte de passageiros", tratamento: "reducao_40", reducao: 40, cst: "200", cClassTrib: "200049",
    fundamento: "LC 214/2025, arts. 285 a 287 — transporte coletivo rodoviário intermunicipal e interestadual, ferroviário e hidroviário: redução de 40%",
    condicional: true,
    condicoes: ["Transporte público coletivo urbano, semiurbano e metropolitano (rodoviário e metroviário): isenção (art. 157) — CST 400", "Transporte público coletivo ferroviário e hidroviário urbano: alíquota zero (200021)", "Aviação regional: redução de 40% (200050)", "Transporte individual (táxi, aplicativo, fretamento): tributação integral"],
    alternativas: [
      { cClassTrib: "400001", quando: "Transporte público coletivo urbano/metropolitano — isenção" },
      { cClassTrib: "200021", quando: "Transporte público coletivo ferroviário/hidroviário urbano" },
      { cClassTrib: "200050", quando: "Transporte aéreo regional coletivo" },
      { cClassTrib: "000001", quando: "Transporte individual, fretamento, turismo" },
    ] },
  { codigo: "105", descricao: "Transporte de cargas", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)",
    condicoes: ["Contratação de Transportador Autônomo de Cargas (TAC) pessoa física não contribuinte gera crédito presumido ao contratante"],
    alternativas: [{ cClassTrib: "200001", quando: "Transporte de bens até ZPE (exportação)" }],
    alertas: ["Transporte interestadual/intermunicipal: ICMS continua até 2032; documento CT-e com grupo IBS/CBS."] },
  { codigo: "106", descricao: "Serviços de apoio aos transportes (armazenagem, agenciamento, operação portuária)", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)" },
  { codigo: "107", descricao: "Serviços postais e de entrega", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)" },
  { codigo: "108", descricao: "Distribuição de eletricidade, gás e água", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)",
    alertas: ["Não há incidência de Imposto Seletivo sobre energia elétrica (CF, art. 153, §6º, I).", "Consumidor de baixa renda pode ter cashback (devolução personalizada — arts. 112 a 124)."] },
  { codigo: "109", descricao: "Serviços financeiros, seguros, previdência e securitização", tratamento: "especifico", reducao: 0, cst: "010", cClassTrib: "010002",
    fundamento: "LC 214/2025, arts. 181 a 233 (regime específico de serviços financeiros)",
    condicional: true,
    condicoes: ["Alíquotas próprias e uniformes, com base de cálculo pela margem (receitas − despesas financeiras dedutíveis)", "Alíquotas crescentes de 2027 a 2033 de forma a manter a carga atual", "Planos de saúde: regime específico com redução de 60% (arts. 234 a 243)"],
    alternativas: [
      { cClassTrib: "011002", quando: "Planos de assistência à saúde" },
      { cClassTrib: "011001", quando: "Planos de assistência funerária" },
      { cClassTrib: "200018", quando: "Resseguro e retrocessão" },
      { cClassTrib: "010001", quando: "Operações do FGTS não realizadas pela Caixa" },
    ] },
  { codigo: "110", descricao: "Serviços imobiliários (locação, administração, intermediação, venda)", tratamento: "reducao_50", reducao: 50, cst: "200", cClassTrib: "200046",
    fundamento: "LC 214/2025, arts. 251 a 270 — alienação, administração e intermediação: redução de 50%; locação, cessão onerosa e arrendamento: redução de 70%",
    condicional: true,
    condicoes: ["Locação, cessão onerosa e arrendamento de imóveis: redução de 70% (cClassTrib 200027)", "Redutor de ajuste (custo de aquisição) e redutor social na venda de imóvel residencial novo (R$ 100 mil) e lote (R$ 30 mil)", "Redutor social na locação residencial: R$ 600/mês por imóvel", "Pessoa física é contribuinte se tiver mais de 3 imóveis locados e receita de locação > R$ 240 mil/ano"],
    alternativas: [{ cClassTrib: "200027", quando: "Locação, cessão onerosa e arrendamento — redução de 70%" }, { cClassTrib: "200026", quando: "Locação em zonas reabilitadas" }] },
  { codigo: "11001", descricao: "Locação e arrendamento de imóveis", tratamento: "reducao_70", reducao: 70, cst: "200", cClassTrib: "200027",
    fundamento: "LC 214/2025, arts. 251 a 270 (redução de 70% na locação, cessão onerosa e arrendamento)", condicional: true,
    condicoes: ["Confira se o código NBS corresponde à locação; administração/intermediação: redução de 50%"] },
  { codigo: "111", descricao: "Locação de bens móveis, cessão de direitos, propriedade intelectual e franquias", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)",
    alertas: ["Cessão de direitos de produções artísticas/culturais nacionais pode ter redução de 60% (Anexo X — 200039)."] },
  { codigo: "112", descricao: "Pesquisa e desenvolvimento", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)", condicional: true,
    condicoes: ["P&D prestado por ICT sem fins lucrativos à administração pública: alíquota zero (200016)"],
    alternativas: [{ cClassTrib: "200016", quando: "P&D por Instituição Científica e Tecnológica (ICT)" }] },
  { codigo: "113", descricao: "Serviços jurídicos e contábeis", tratamento: "reducao_30", reducao: 30, cst: "200", cClassTrib: "200052",
    fundamento: "LC 214/2025, art. 127 (profissões intelectuais de natureza científica, literária ou artística) — redução de 30%",
    condicional: true,
    condicoes: [
      "Profissão regulamentada e fiscalizada por conselho profissional",
      "Prestado por pessoa física habilitada ou por sociedade em que todos os sócios sejam habilitados e prestem o serviço pessoalmente",
      "Não aplicável a sociedade com sócio pessoa jurídica, ou que exerça atividade diversa",
      "Profissionais optantes pelo Simples Nacional recolhem pelo DAS",
    ],
    alternativas: [{ cClassTrib: "000001", quando: "Sociedade que não atende aos requisitos do art. 127" }] },
  { codigo: "114", descricao: "Serviços profissionais (engenharia, arquitetura, consultoria, publicidade, pesquisa de mercado)", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral); art. 127 (profissões intelectuais)", condicional: true,
    condicoes: [`Redução de 30% se prestado por profissional regulamentado: ${PROF_INTELECTUAIS.join(", ")}`, "Requisitos: conselho profissional + todos os sócios habilitados prestando o serviço pessoalmente"],
    alternativas: [{ cClassTrib: "200052", quando: "Profissão intelectual regulamentada (art. 127) — redução de 30%" }, { cClassTrib: "200040", quando: "Comunicação institucional à administração pública — redução de 60%" }] },
  { codigo: "115", descricao: "Tecnologia da informação (software, desenvolvimento, licenciamento, hospedagem)", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)", condicional: true,
    condicoes: ["Segurança da informação e segurança cibernética desenvolvidas por sociedade com sócio brasileiro: redução de 60% (art. 142, II — 200044)"],
    alternativas: [{ cClassTrib: "200044", quando: "Segurança da informação / cibernética" }],
    alertas: ["Licenciamento de software e serviços digitais do exterior: importação de serviço tributada (destino); plataformas digitais são responsáveis solidárias / split payment."] },
  { codigo: "116", descricao: "Telecomunicações, radiodifusão e fornecimento de informações", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)",
    alertas: ["Não incide Imposto Seletivo sobre telecomunicações (CF, art. 153, §6º, I).", "Radiodifusão sonora e de sons e imagens de recepção livre e gratuita: imunidade (CF, art. 156-A, §1º, XI)."],
    alternativas: [{ cClassTrib: "410999", quando: "Radiodifusão de recepção livre e gratuita — imunidade" }] },
  { codigo: "117", descricao: "Apoio às atividades empresariais (limpeza, vigilância, call center, mão de obra)", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)",
    alertas: ["Fornecimento de mão de obra: base é o valor do serviço; salários do empregado do próprio contribuinte não são fato gerador."] },
  { codigo: "118", descricao: "Apoio à agropecuária, pesca, mineração e utilidades", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12; art. 138 e Anexo IX (serviços considerados insumos agropecuários)", condicional: true,
    condicoes: ["Serviços listados no Anexo IX (ex.: serviços de pulverização, inseminação, colheita) têm redução de 60%", "Serviços ambientais de conservação/recuperação de vegetação nativa: redução de 60% (200037)"],
    alternativas: [{ cClassTrib: "200038", quando: "Serviço listado como insumo agropecuário (Anexo IX)" }, { cClassTrib: "200037", quando: "Serviços ambientais de conservação" }] },
  { codigo: "119", descricao: "Manutenção, reparação e instalação", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)" },
  { codigo: "120", descricao: "Serviços de produção / industrialização por encomenda", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)",
    alertas: ["Industrialização sob encomenda: avalie diferimento/suspensão em regimes aduaneiros especiais e ZFM."] },
  { codigo: "121", descricao: "Reciclagem e reparo", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)",
    alertas: ["Aquisição de resíduos sólidos de pessoa física/catadores pode gerar crédito presumido ao adquirente."] },
  { codigo: "122", descricao: "Serviços de educação", tratamento: "reducao_60", reducao: 60, cst: "200", cClassTrib: "200028",
    fundamento: "LC 214/2025, art. 129 e Anexo II (serviços de educação) — redução de 60%", anexo: "Anexo II",
    condicional: true,
    condicoes: ["Ensino infantil, fundamental, médio, técnico, superior, pós-graduação, EJA, idiomas e educação especial — conforme lista do Anexo II", "Cursos livres e treinamentos não listados: tributação integral", "Entidades sem fins lucrativos de educação (CF, art. 150, VI, c): imunidade"],
    alternativas: [
      { cClassTrib: "200025", quando: "Bolsas Prouni — alíquota zero" },
      { cClassTrib: "200041", quando: "Educação desportiva (art. 141, I)" },
      { cClassTrib: "410001", quando: "Instituição de educação sem fins lucrativos — imunidade" },
      { cClassTrib: "000001", quando: "Curso livre não listado no Anexo II" },
    ] },
  { codigo: "123", descricao: "Serviços de saúde humana e assistência social", tratamento: "reducao_60", reducao: 60, cst: "200", cClassTrib: "200029",
    fundamento: "LC 214/2025, art. 130 e Anexo III (serviços de saúde humana) — redução de 60%", anexo: "Anexo III",
    condicional: true,
    condicoes: ["Serviços médicos, hospitalares, laboratoriais, odontológicos, de enfermagem, fisioterapia, psicologia, nutrição etc. listados no Anexo III", "Planos de saúde: regime específico (011002)", "Entidades beneficentes de assistência social: imunidade (CF, art. 150, VI, c)", "Situação de emergência de saúde pública: possibilidade de alíquota zero (200006)"],
    alternativas: [
      { cClassTrib: "011002", quando: "Planos de assistência à saúde" },
      { cClassTrib: "200006", quando: "Emergência de saúde pública reconhecida" },
      { cClassTrib: "410001", quando: "Entidade beneficente — imunidade" },
    ] },
  { codigo: "124", descricao: "Coleta, tratamento de resíduos e saneamento", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)" },
  { codigo: "125", descricao: "Serviços recreativos, culturais e desportivos", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12; arts. 139 a 141 (produções artísticas e desporto); arts. 244 a 250 (prognósticos)", condicional: true,
    condicoes: [
      "Produções nacionais artísticas, culturais, de eventos, jornalísticas e audiovisuais (Anexo X): redução de 60% (200039)",
      "Atividades desportivas (gestão e exploração do desporto): redução de 60% (200041 / 200042)",
      "Parques de diversão e temáticos: regime específico, redução de 40% (200048)",
      "Concursos de prognósticos e fantasy sport: regime específico (011004) + Imposto Seletivo",
    ],
    alternativas: [
      { cClassTrib: "200039", quando: "Produção artística/cultural nacional (Anexo X)" },
      { cClassTrib: "200042", quando: "Gestão e exploração do desporto" },
      { cClassTrib: "200048", quando: "Parques de diversão e temáticos" },
      { cClassTrib: "011004", quando: "Concursos de prognósticos (loterias, apostas)" },
    ],
    alertas: ["Concursos de prognósticos e fantasy sport estão sujeitos ao Imposto Seletivo a partir de 2027."] },
  { codigo: "126", descricao: "Serviços pessoais (beleza, lavanderia, funerários, associações)", tratamento: "integral", reducao: 0, cst: "000", cClassTrib: "000001",
    fundamento: "LC 214/2025, art. 12 (regra geral)",
    alternativas: [{ cClassTrib: "011001", quando: "Planos de assistência funerária" }, { cClassTrib: "410020", quando: "Templos de qualquer culto — imunidade" }] },
];

// ═══════════════════════════════════════════════════════════════════════════
// MOTOR DE CONSULTA
// ═══════════════════════════════════════════════════════════════════════════
export type TipoCodigo = "NCM" | "NBS";

export interface ResultadoReforma {
  tipo: TipoCodigo;
  codigo: string;          // dígitos
  codigoFormatado: string;
  valido: boolean;
  capitulo: { codigo: string; descricao: string } | null;
  regra: RegraReforma;
  regraEncontrada: boolean; // false = caiu na regra geral
  descricaoTratamento: string;
  is: RegraIS | null;
  /** regras mais específicas sob o prefixo informado (quando o código é parcial) */
  subregras: RegraReforma[];
  alertas: string[];
}

const REGRA_GERAL_NCM: RegraReforma = {
  codigo: "", descricao: "Sem tratamento diferenciado identificado — regra geral", tratamento: "integral", reducao: 0,
  cst: "000", cClassTrib: "000001", fundamento: "LC 214/2025, arts. 4º e 12 (regra geral — alíquota padrão)",
  alertas: ["Nenhum anexo de redução identificado para este código. Se o produto tiver destinação ou adquirente específico (administração pública, ZFM, exportação, produtor rural), revise o enquadramento."],
};
const REGRA_GERAL_NBS: RegraReforma = { ...REGRA_GERAL_NCM, fundamento: "LC 214/2025, arts. 4º e 12 (regra geral — alíquota padrão)" };

export function somenteDigitos(v: string) { return (v || "").replace(/\D/g, ""); }

export function formatarNcm(v: string) {
  const d = somenteDigitos(v).slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}

export function formatarNbs(v: string) {
  const d = somenteDigitos(v).slice(0, 9);
  if (d.length <= 1) return d;
  if (d.length <= 5) return `${d.slice(0, 1)}.${d.slice(1)}`;
  if (d.length <= 7) return `${d.slice(0, 1)}.${d.slice(1, 5)}.${d.slice(5)}`;
  return `${d.slice(0, 1)}.${d.slice(1, 5)}.${d.slice(5, 7)}.${d.slice(7)}`;
}

function casa(codigo: string, r: { codigo: string; excecoes?: string[] }) {
  return codigo.startsWith(r.codigo) && !(r.excecoes || []).some(e => codigo.startsWith(e));
}

function melhor<T extends { codigo: string; excecoes?: string[] }>(codigo: string, regras: T[]): T | null {
  let best: T | null = null;
  for (const r of regras) if (casa(codigo, r) && (!best || r.codigo.length > best.codigo.length)) best = r;
  return best;
}

export function consultarReforma(entrada: string, tipo: TipoCodigo): ResultadoReforma {
  const codigo = somenteDigitos(entrada);
  const isNcm = tipo === "NCM";
  const valido = isNcm ? codigo.length === 8 : codigo.length === 9 && codigo.startsWith("1");
  const regras = isNcm ? REGRAS_NCM : REGRAS_NBS;

  const capCod = isNcm ? codigo.slice(0, 2) : codigo.slice(0, 3);
  const capDesc = isNcm ? CAPITULOS_NCM[capCod] : CAPITULOS_NBS[capCod];
  const capitulo = capDesc ? { codigo: capCod, descricao: capDesc } : null;

  const achada = codigo.length >= 2 ? melhor(codigo, regras) : null;
  const regra = achada || (isNcm ? REGRA_GERAL_NCM : REGRA_GERAL_NBS);
  const is = isNcm && codigo.length >= 4 ? melhor(codigo, REGRAS_IS) : null;

  // Subregras: quando o código é parcial, lista tratamentos possíveis abaixo dele
  const subregras = !valido && codigo.length >= 2
    ? regras.filter(r => r.codigo.startsWith(codigo) && r.codigo !== regra.codigo).slice(0, 30)
    : [];

  const alertas: string[] = [...(regra.alertas || [])];
  if (!valido) alertas.unshift(isNcm
    ? "Código NCM incompleto: informe os 8 dígitos para um enquadramento preciso."
    : "Código NBS incompleto: informe os 9 dígitos (formato 1.XXXX.XX.XX).");
  if (isNcm && !capitulo && codigo.length >= 2) alertas.push("Capítulo NCM inexistente — confira o código na TIPI.");
  if (!isNcm && !capitulo && codigo.length >= 3) alertas.push("Capítulo NBS não reconhecido — confira o código na tabela NBS.");
  if (regra.condicional) alertas.push("Enquadramento CONDICIONAL: depende da descrição exata do item ou de condição do adquirente/prestador. Confira o anexo legal antes de parametrizar o ERP.");
  if (is) alertas.push(`Sujeito ao Imposto Seletivo (${is.categoria}) a partir de 2027${is.condicional ? " — incidência condicional, confira o subitem" : ""}.`);

  return {
    tipo, codigo,
    codigoFormatado: isNcm ? formatarNcm(codigo) : formatarNbs(codigo),
    valido, capitulo, regra, regraEncontrada: !!achada,
    descricaoTratamento: TRATAMENTO_LABEL[regra.tratamento],
    is, subregras, alertas,
  };
}

/** Detecta automaticamente NCM (8 dígitos) ou NBS (9 dígitos iniciando em 1) */
export function detectarTipo(entrada: string): TipoCodigo {
  const d = somenteDigitos(entrada);
  if (/^\d\.\d{4}/.test(entrada.trim()) || (d.length === 9 && d.startsWith("1"))) return "NBS";
  return "NCM";
}

/** Busca textual nas descrições das regras e capítulos */
export function buscarPorDescricao(termo: string, tipo: TipoCodigo, limite = 25) {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const t = norm(termo.trim());
  if (t.length < 3) return [];
  const regras = tipo === "NCM" ? [...REGRAS_NCM] : [...REGRAS_NBS];
  const caps = tipo === "NCM" ? CAPITULOS_NCM : CAPITULOS_NBS;
  const out: { codigo: string; descricao: string; tratamento?: Tratamento; origem: "regra" | "capitulo" | "is" }[] = [];
  for (const r of regras) if (norm(r.descricao).includes(t)) out.push({ codigo: r.codigo, descricao: r.descricao, tratamento: r.tratamento, origem: "regra" });
  if (tipo === "NCM") for (const r of REGRAS_IS) if (norm(r.descricao).includes(t) || norm(r.categoria).includes(t)) out.push({ codigo: r.codigo, descricao: `[IS] ${r.descricao}`, origem: "is" });
  for (const [c, d] of Object.entries(caps)) if (norm(d).includes(t)) out.push({ codigo: c, descricao: `Capítulo ${c} — ${d}`, origem: "capitulo" });
  const vistos = new Set<string>();
  return out.filter(o => { const k = o.codigo + o.origem; if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, limite);
}

// ═══════════════════════════════════════════════════════════════════════════
// CRONOGRAMA DE TRANSIÇÃO (EC 132/2023, ADCT arts. 125 a 133; LC 214/2025)
// ═══════════════════════════════════════════════════════════════════════════
export interface AliquotasReferencia { cbs: number; ibs: number }
/** Estimativa — as alíquotas de referência serão fixadas por Resolução do Senado Federal */
export const ALIQ_REF_PADRAO: AliquotasReferencia = { cbs: 8.8, ibs: 17.7 };

export interface AnoTransicao {
  ano: number;
  cbs: number;
  ibs: number;
  total: number;
  fatorIbs: string;
  tributosAntigos: string;
  isVigente: boolean;
  obs: string;
}

export function cronogramaTransicao(reducao: number, tratamento: Tratamento, tipo: TipoCodigo, ref: AliquotasReferencia = ALIQ_REF_PADRAO): AnoTransicao[] {
  const f = Math.max(0, Math.min(100, reducao)) / 100;
  const zero = tratamento === "isencao" || tratamento === "imunidade" || reducao >= 100;
  const k = (v: number) => (zero ? 0 : +(v * (1 - f)).toFixed(4));
  const antigosBens = (pct: number) => pct === 100 ? "ICMS integral" : `ICMS a ${pct}%`;
  const antigosServ = (pct: number) => pct === 100 ? "ISS integral" : `ISS a ${pct}%`;
  const ant = (pct: number) => tipo === "NCM" ? antigosBens(pct) : antigosServ(pct);

  const linhas: Omit<AnoTransicao, "total">[] = [
    { ano: 2026, cbs: k(0.9), ibs: k(0.1), fatorIbs: "teste", isVigente: false,
      tributosAntigos: tipo === "NCM" ? "PIS, Cofins, IPI e ICMS integrais" : "PIS, Cofins e ISS integrais",
      obs: "Ano-teste: destaque obrigatório no documento; valor compensável com PIS/Cofins. Dispensa de recolhimento para quem cumprir as obrigações acessórias." },
    { ano: 2027, cbs: k(ref.cbs - 0.1), ibs: k(0.1), fatorIbs: "0,1%", isVigente: true,
      tributosAntigos: `PIS/Cofins extintos; ${tipo === "NCM" ? "IPI zerado (exceto produtos com industrialização incentivada na ZFM); " : ""}${ant(100)}`,
      obs: "CBS plena (reduzida em 0,1 p.p. em 2027–2028). IBS 0,05% estadual + 0,05% municipal. Início do Imposto Seletivo." },
    { ano: 2028, cbs: k(ref.cbs - 0.1), ibs: k(0.1), fatorIbs: "0,1%", isVigente: true, tributosAntigos: ant(100), obs: "Mesma estrutura de 2027." },
    { ano: 2029, cbs: k(ref.cbs), ibs: k(ref.ibs * 0.1), fatorIbs: "10%", isVigente: true, tributosAntigos: ant(90), obs: "Início da transição do ICMS/ISS para o IBS." },
    { ano: 2030, cbs: k(ref.cbs), ibs: k(ref.ibs * 0.2), fatorIbs: "20%", isVigente: true, tributosAntigos: ant(80), obs: "" },
    { ano: 2031, cbs: k(ref.cbs), ibs: k(ref.ibs * 0.3), fatorIbs: "30%", isVigente: true, tributosAntigos: ant(70), obs: "" },
    { ano: 2032, cbs: k(ref.cbs), ibs: k(ref.ibs * 0.4), fatorIbs: "40%", isVigente: true, tributosAntigos: ant(60), obs: "" },
    { ano: 2033, cbs: k(ref.cbs), ibs: k(ref.ibs), fatorIbs: "100%", isVigente: true,
      tributosAntigos: tipo === "NCM" ? "ICMS extinto" : "ISS extinto", obs: "Sistema pleno: CBS + IBS + IS." },
  ];
  return linhas.map(l => ({ ...l, total: +(l.cbs + l.ibs).toFixed(4) }));
}

// ═══════════════════════════════════════════════════════════════════════════
// OBRIGAÇÕES ACESSÓRIAS — DOCUMENTO FISCAL
// ═══════════════════════════════════════════════════════════════════════════
export function camposDocumentoFiscal(r: ResultadoReforma): { campo: string; valor: string; obs?: string }[] {
  const reduz = r.regra.reducao > 0 && r.regra.reducao < 100 && r.regra.tratamento !== "imunidade";
  const campos: { campo: string; valor: string; obs?: string }[] = [
    { campo: r.tipo === "NCM" ? "NCM (prod/NCM)" : "Código NBS (cNBS)", valor: r.codigoFormatado },
    { campo: "CST IBS/CBS", valor: r.regra.cst },
    { campo: "cClassTrib", valor: r.regra.cClassTrib },
  ];
  if (reduz) campos.push({ campo: "pRedAliq (gRed)", valor: `${r.regra.reducao}%`, obs: "Percentual de redução aplicado sobre IBS UF, IBS Mun e CBS" });
  if (r.regra.tratamento === "monofasico") campos.push({ campo: "Grupo monofásico (gIBSCBSMono)", valor: "Obrigatório", obs: "qBCMono, adRemIBS, adRemCBS" });
  if (r.is) campos.push({ campo: "Grupo IS (gIS) — a partir de 2027", valor: "CSTIS / cClassTribIS / vBCIS / pIS / vIS", obs: r.is.categoria });
  if (r.tipo === "NBS") campos.push({ campo: "NFS-e Padrão Nacional", valor: "Obrigatória", obs: "Código NBS + indicador de operação (local de incidência) + grupo IBSCBS" });
  return campos;
}

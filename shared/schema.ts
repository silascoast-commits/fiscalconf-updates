import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tabela de NCMs cadastrados pelo usuário
export const ncms = sqliteTable("ncms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  codigo: text("codigo").notNull().unique(),
  descricao: text("descricao").notNull(),
  aliquotaIpi: real("aliquota_ipi").default(0),
  cClassTribSimples: text("cclasstrib_simples"),
  cClassTribPresumido: text("cclasstrib_presumido"),
  cstIcmsSimples: text("cst_icms_simples"),
  cstIcmsPresumido: text("cst_icms_presumido"),
  cstPisSimples: text("cst_pis_simples"),
  cstPisPresumido: text("cst_pis_presumido"),
  cstCofinsSimples: text("cst_cofins_simples"),
  cstCofinsPresumido: text("cst_cofins_presumido"),
  cBenef: text("c_benef"),
  cEst: text("c_est"),
  observacoes: text("observacoes"),
});

// Tabela de consultas salvas
export const consultas = sqliteTable("consultas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ncm: text("ncm").notNull(),
  cfop: text("cfop").notNull(),
  modalidade: text("modalidade").notNull(), // B2B ou B2C
  regime: text("regime").notNull(), // Simples ou Presumido
  resultado: text("resultado").notNull(), // JSON com configuração completa
  criadoEm: text("criado_em").notNull(),
});

export const insertNcmSchema = createInsertSchema(ncms).omit({ id: true });
export const insertConsultaSchema = createInsertSchema(consultas).omit({ id: true });

export type Ncm = typeof ncms.$inferSelect;
export type InsertNcm = z.infer<typeof insertNcmSchema>;
export type Consulta = typeof consultas.$inferSelect;
export type InsertConsulta = z.infer<typeof insertConsultaSchema>;

// Tabela de clientes do escritório de contabilidade
export const clientes = sqliteTable("clientes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cnpj: text("cnpj").notNull().unique(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  regime: text("regime").notNull(), // "simples" | "presumido" | "real"
  anexo: text("anexo"), // "I" | "II" | "III" | "IV" | "V" — só Simples
  atividade: text("atividade"), // descrição livre
  responsavel: text("responsavel"), // nome do contador responsável
  email: text("email"),
  telefone: text("telefone"),
  // RBT12: armazenado como JSON string com 12 meses
  // Formato: '{"jan":10000,"fev":12000,...,"dez":9000}'
  faturamentoMeses: text("faturamento_meses"),
  // Configurações fiscais padrão do cliente
  ncmPrincipal: text("ncm_principal"),
  cfopPadrao: text("cfop_padrao"),
  observacoes: text("observacoes"),
  ativo: integer("ativo").default(1), // 1=ativo, 0=inativo
  criadoEm: text("criado_em").notNull(),
  atualizadoEm: text("atualizado_em").notNull(),
});

// Configs fiscais salvas por cliente (histórico de consultas vinculadas)
export const configsCliente = sqliteTable("configs_cliente", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id").notNull(),
  ncm: text("ncm").notNull(),
  cfop: text("cfop").notNull(),
  modalidade: text("modalidade").notNull(),
  descricao: text("descricao"),
  resultado: text("resultado").notNull(), // JSON
  criadoEm: text("criado_em").notNull(),
});

export const insertClienteSchema = createInsertSchema(clientes).omit({ id: true });
export const insertConfigClienteSchema = createInsertSchema(configsCliente).omit({ id: true });

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = z.infer<typeof insertClienteSchema>;
export type ConfigCliente = typeof configsCliente.$inferSelect;
export type InsertConfigCliente = z.infer<typeof insertConfigClienteSchema>;

// Tabela de anotações por cliente
export const anotacoesCliente = sqliteTable("anotacoes_cliente", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id").notNull(),
  texto: text("texto").notNull(),
  tipo: text("tipo").default("geral"), // "geral" | "alerta" | "decisao" | "reuniao"
  criadoEm: text("criado_em").notNull(),
});
export const insertAnotacaoSchema = createInsertSchema(anotacoesCliente).omit({ id: true });
export type AnotacaoCliente = typeof anotacoesCliente.$inferSelect;
export type InsertAnotacao = z.infer<typeof insertAnotacaoSchema>;

// Tabela de importações PGDAS-D por cliente
export const pgdasImportacoes = sqliteTable("pgdas_importacoes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id").notNull(),
  cnpj: text("cnpj").notNull(),
  periodoApuracao: text("periodo_apuracao").notNull(), // "03/2026"
  rpa: real("rpa").default(0),           // Receita Bruta do PA
  rbt12: real("rbt12").default(0),        // Acumulado 12 meses
  rba: real("rba").default(0),            // Acumulado ano corrente
  rbaa: real("rbaa").default(0),          // Acumulado ano anterior
  dasTotal: real("das_total").default(0),
  dasIrpj: real("das_irpj").default(0),
  dasCsll: real("das_csll").default(0),
  dasCofins: real("das_cofins").default(0),
  dasPis: real("das_pis").default(0),
  dasInss: real("das_inss").default(0),
  dasIcms: real("das_icms").default(0),
  dasIss: real("das_iss").default(0),
  vencimento: text("vencimento"),
  atividade: text("atividade"),            // texto da atividade detectada
  anexoDetectado: text("anexo_detectado"), // "III", "IV", etc
  receitasMeses: text("receitas_meses"),   // JSON mês a mês
  pago: integer("pago").default(0),       // 0=não pago, 1=pago
  importadoEm: text("importado_em").notNull(),
});

export const insertPgdasSchema = createInsertSchema(pgdasImportacoes).omit({ id: true });
export type PgdasImportacao = typeof pgdasImportacoes.$inferSelect;
export type InsertPgdas = z.infer<typeof insertPgdasSchema>;

// ─── Importações XML NF-e / NFS-e ────────────────────────────────────────────
export const xmlImportacoes = sqliteTable("xml_importacoes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id"),           // nullable — pode importar sem cliente ativo
  tipo: text("tipo").notNull(),               // "entrada" | "saida"
  chaveAcesso: text("chave_acesso"),          // 44 dígitos
  modelo: text("modelo"),                     // "55" NF-e | "65" NFC-e | "SE" NFS-e
  serie: text("serie"),
  numero: text("numero"),
  dataEmissao: text("data_emissao"),
  // Emitente
  emitCnpj: text("emit_cnpj"),
  emitRazao: text("emit_razao"),
  // Destinatário
  destCnpj: text("dest_cnpj"),
  destRazao: text("dest_razao"),
  // Totais
  valorNota: real("valor_nota").default(0),
  baseCalcIcms: real("base_calc_icms").default(0),
  valorIcms: real("valor_icms").default(0),
  valorIpi: real("valor_ipi").default(0),
  valorPis: real("valor_pis").default(0),
  valorCofins: real("valor_cofins").default(0),
  valorIbs: real("valor_ibs").default(0),
  valorCbs: real("valor_cbs").default(0),
  valorSt: real("valor_st").default(0),
  valorFrete: real("valor_frete").default(0),
  valorDesc: real("valor_desc").default(0),
  valorProd: real("valor_prod").default(0),
  // Itens resumidos (JSON)
  itens: text("itens"),                       // JSON: [{ncm, cfop, descricao, qtd, vUnit, vTotal, cst...}]
  // Status
  situacao: text("situacao").default("importado"), // "importado" | "cancelada" | "denegada"
  nomeArquivo: text("nome_arquivo"),
  importadoEm: text("importado_em").notNull(),
});

export const insertXmlImportacaoSchema = createInsertSchema(xmlImportacoes).omit({ id: true });
export type XmlImportacao = typeof xmlImportacoes.$inferSelect;
export type InsertXmlImportacao = z.infer<typeof insertXmlImportacaoSchema>;

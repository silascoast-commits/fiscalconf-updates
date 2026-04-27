import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { ncms, consultas, clientes, configsCliente, anotacoesCliente, pgdasImportacoes, xmlImportacoes, type Ncm, type InsertNcm, type Consulta, type InsertConsulta, type Cliente, type InsertCliente, type ConfigCliente, type InsertConfigCliente, type AnotacaoCliente, type InsertAnotacao, type PgdasImportacao, type InsertPgdas, type XmlImportacao, type InsertXmlImportacao } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const sqlite = new Database("./data.db");
const db = drizzle(sqlite);

// Criar tabelas se não existirem — cada exec() separado para compatibilidade Windows
try { sqlite.exec(`PRAGMA journal_mode=WAL;`); } catch { /* ignora */ }

try { sqlite.exec(`CREATE TABLE IF NOT EXISTS ncms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  aliquota_ipi REAL DEFAULT 0,
  cclasstrib_simples TEXT,
  cclasstrib_presumido TEXT,
  cst_icms_simples TEXT,
  cst_icms_presumido TEXT,
  cst_pis_simples TEXT,
  cst_pis_presumido TEXT,
  cst_cofins_simples TEXT,
  cst_cofins_presumido TEXT,
  c_benef TEXT,
  c_est TEXT,
  observacoes TEXT
)`); } catch { /* já existe */ }

try { sqlite.exec(`CREATE TABLE IF NOT EXISTS consultas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ncm TEXT NOT NULL,
  cfop TEXT NOT NULL,
  modalidade TEXT NOT NULL,
  regime TEXT NOT NULL,
  resultado TEXT NOT NULL,
  criado_em TEXT NOT NULL
)`); } catch { /* já existe */ }

try { sqlite.exec(`CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cnpj TEXT NOT NULL UNIQUE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  regime TEXT NOT NULL,
  anexo TEXT,
  atividade TEXT,
  responsavel TEXT,
  email TEXT,
  telefone TEXT,
  faturamento_meses TEXT,
  ncm_principal TEXT,
  cfop_padrao TEXT,
  observacoes TEXT,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
)`); } catch { /* já existe */ }

try { sqlite.exec(`CREATE TABLE IF NOT EXISTS configs_cliente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  ncm TEXT NOT NULL,
  cfop TEXT NOT NULL,
  modalidade TEXT NOT NULL,
  descricao TEXT,
  resultado TEXT NOT NULL,
  criado_em TEXT NOT NULL
)`); } catch { /* já existe */ }

try { sqlite.exec(`CREATE TABLE IF NOT EXISTS anotacoes_cliente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  texto TEXT NOT NULL,
  tipo TEXT DEFAULT 'geral',
  criado_em TEXT NOT NULL
)`); } catch { /* já existe */ }

try { sqlite.exec(`CREATE TABLE IF NOT EXISTS xml_importacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER,
  tipo TEXT NOT NULL,
  chave_acesso TEXT,
  modelo TEXT,
  serie TEXT,
  numero TEXT,
  data_emissao TEXT,
  emit_cnpj TEXT,
  emit_razao TEXT,
  dest_cnpj TEXT,
  dest_razao TEXT,
  valor_nota REAL DEFAULT 0,
  base_calc_icms REAL DEFAULT 0,
  valor_icms REAL DEFAULT 0,
  valor_ipi REAL DEFAULT 0,
  valor_pis REAL DEFAULT 0,
  valor_cofins REAL DEFAULT 0,
  valor_ibs REAL DEFAULT 0,
  valor_cbs REAL DEFAULT 0,
  valor_st REAL DEFAULT 0,
  valor_frete REAL DEFAULT 0,
  valor_desc REAL DEFAULT 0,
  valor_prod REAL DEFAULT 0,
  itens TEXT,
  situacao TEXT DEFAULT 'importado',
  nome_arquivo TEXT,
  importado_em TEXT NOT NULL
)`); } catch { /* já existe */ }

try { sqlite.exec(`CREATE TABLE IF NOT EXISTS pgdas_importacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  cnpj TEXT NOT NULL,
  periodo_apuracao TEXT NOT NULL,
  rpa REAL DEFAULT 0,
  rbt12 REAL DEFAULT 0,
  rba REAL DEFAULT 0,
  rbaa REAL DEFAULT 0,
  das_total REAL DEFAULT 0,
  das_irpj REAL DEFAULT 0,
  das_csll REAL DEFAULT 0,
  das_cofins REAL DEFAULT 0,
  das_pis REAL DEFAULT 0,
  das_inss REAL DEFAULT 0,
  das_icms REAL DEFAULT 0,
  das_iss REAL DEFAULT 0,
  vencimento TEXT,
  atividade TEXT,
  anexo_detectado TEXT,
  receitas_meses TEXT,
  pago INTEGER DEFAULT 0,
  importado_em TEXT NOT NULL
)`); } catch { /* já existe */ }

// Migrar colunas novas sem quebrar banco existente
for (const col of ["c_benef TEXT", "c_est TEXT"]) {
  try { sqlite.exec(`ALTER TABLE ncms ADD COLUMN ${col}`); } catch { /* já existe */ }
}

// Migrar coluna cliente_id em consultas (vinculação opcional)
try { sqlite.exec(`ALTER TABLE consultas ADD COLUMN cliente_id INTEGER`); } catch { /* já existe */ }

// Migrações para tabela clientes (caso o banco já exista sem essas colunas)
for (const col of [
  "nome_fantasia TEXT",
  "anexo TEXT",
  "atividade TEXT",
  "responsavel TEXT",
  "email TEXT",
  "telefone TEXT",
  "faturamento_meses TEXT",
  "ncm_principal TEXT",
  "cfop_padrao TEXT",
  "observacoes TEXT",
  "ativo INTEGER DEFAULT 1",
]) {
  try { sqlite.exec(`ALTER TABLE clientes ADD COLUMN ${col}`); } catch { /* já existe */ }
}

export interface IStorage {
  // NCMs
  getNcms(): Ncm[];
  getNcmByCodigo(codigo: string): Ncm | undefined;
  createNcm(ncm: InsertNcm): Ncm;
  updateNcm(id: number, ncm: Partial<InsertNcm>): Ncm | undefined;
  deleteNcm(id: number): void;

  // Consultas
  getConsultas(): Consulta[];
  createConsulta(consulta: InsertConsulta): Consulta;
  deleteConsulta(id: number): void;

  // Clientes
  getClientes(): Cliente[];
  getClienteById(id: number): Cliente | undefined;
  getClienteByCnpj(cnpj: string): Cliente | undefined;
  createCliente(c: InsertCliente): Cliente;
  updateCliente(id: number, data: Partial<InsertCliente>): Cliente | undefined;
  deleteCliente(id: number): void;

  // Configs por cliente
  getConfigsCliente(clienteId: number): ConfigCliente[];
  createConfigCliente(c: InsertConfigCliente): ConfigCliente;
  deleteConfigCliente(id: number): void;

  // Anotações por cliente
  getAnotacoes(clienteId: number): AnotacaoCliente[];
  createAnotacao(a: InsertAnotacao): AnotacaoCliente;
  deleteAnotacao(id: number): void;

  // PGDAS-D
  getPgdasByCliente(clienteId: number): PgdasImportacao[];
  createPgdas(p: InsertPgdas): PgdasImportacao;
  deletePgdas(id: number): void;
  updatePgdasPago(id: number, pago: number): void;

  // XML NF-e
  getXmlImportacoes(clienteId?: number): XmlImportacao[];
  getXmlImportacaoById(id: number): XmlImportacao | undefined;
  createXmlImportacao(x: InsertXmlImportacao): XmlImportacao;
  deleteXmlImportacao(id: number): void;
  getXmlDashboard(clienteId?: number): {
    totalEntradas: number; totalSaidas: number;
    valorEntradas: number; valorSaidas: number;
    icmsEntradas: number; icmsSaidas: number;
    pisEntradas: number; pisSaidas: number;
    cofinsEntradas: number; cofinsSaidas: number;
    ibsEntradas: number; ibsSaidas: number;
    cbsEntradas: number; cbsSaidas: number;
    creditoIbs: number; creditoCbs: number;
    totalNotas: number;
  };
}

export class SqliteStorage implements IStorage {
  getNcms(): Ncm[] {
    return db.select().from(ncms).all();
  }

  getNcmByCodigo(codigo: string): Ncm | undefined {
    return db.select().from(ncms).where(eq(ncms.codigo, codigo)).get();
  }

  createNcm(ncm: InsertNcm): Ncm {
    return db.insert(ncms).values(ncm).returning().get();
  }

  updateNcm(id: number, data: Partial<InsertNcm>): Ncm | undefined {
    return db.update(ncms).set(data).where(eq(ncms.id, id)).returning().get();
  }

  deleteNcm(id: number): void {
    db.delete(ncms).where(eq(ncms.id, id)).run();
  }

  getConsultas(): Consulta[] {
    return db.select().from(consultas).all();
  }

  createConsulta(consulta: InsertConsulta): Consulta {
    return db.insert(consultas).values(consulta).returning().get();
  }

  deleteConsulta(id: number): void {
    db.delete(consultas).where(eq(consultas.id, id)).run();
  }

  getClientes(): Cliente[] {
    return db.select().from(clientes).all();
  }

  getClienteById(id: number): Cliente | undefined {
    return db.select().from(clientes).where(eq(clientes.id, id)).get();
  }

  getClienteByCnpj(cnpj: string): Cliente | undefined {
    return db.select().from(clientes).where(eq(clientes.cnpj, cnpj)).get();
  }

  createCliente(c: InsertCliente): Cliente {
    return db.insert(clientes).values(c).returning().get();
  }

  updateCliente(id: number, data: Partial<InsertCliente>): Cliente | undefined {
    return db.update(clientes).set(data).where(eq(clientes.id, id)).returning().get();
  }

  deleteCliente(id: number): void {
    db.delete(clientes).where(eq(clientes.id, id)).run();
  }

  getConfigsCliente(clienteId: number): ConfigCliente[] {
    return db.select().from(configsCliente).where(eq(configsCliente.clienteId, clienteId)).all();
  }

  createConfigCliente(c: InsertConfigCliente): ConfigCliente {
    return db.insert(configsCliente).values(c).returning().get();
  }

  deleteConfigCliente(id: number): void {
    db.delete(configsCliente).where(eq(configsCliente.id, id)).run();
  }

  getAnotacoes(clienteId: number): AnotacaoCliente[] {
    return db.select().from(anotacoesCliente).where(eq(anotacoesCliente.clienteId, clienteId)).all();
  }

  createAnotacao(a: InsertAnotacao): AnotacaoCliente {
    return db.insert(anotacoesCliente).values(a).returning().get();
  }

  deleteAnotacao(id: number): void {
    db.delete(anotacoesCliente).where(eq(anotacoesCliente.id, id)).run();
  }

  getPgdasByCliente(clienteId: number): PgdasImportacao[] {
    return db.select().from(pgdasImportacoes).where(eq(pgdasImportacoes.clienteId, clienteId)).all();
  }

  createPgdas(p: InsertPgdas): PgdasImportacao {
    return db.insert(pgdasImportacoes).values(p).returning().get();
  }

  deletePgdas(id: number): void {
    db.delete(pgdasImportacoes).where(eq(pgdasImportacoes.id, id)).run();
  }

  updatePgdasPago(id: number, pago: number): void {
    db.update(pgdasImportacoes).set({ pago }).where(eq(pgdasImportacoes.id, id)).run();
  }

  // ─── XML NF-e ────────────────────────────────────────────────────────────────
  getXmlImportacoes(clienteId?: number): XmlImportacao[] {
    if (clienteId !== undefined) {
      return db.select().from(xmlImportacoes).where(eq(xmlImportacoes.clienteId, clienteId)).all();
    }
    return db.select().from(xmlImportacoes).all();
  }

  getXmlImportacaoById(id: number): XmlImportacao | undefined {
    return db.select().from(xmlImportacoes).where(eq(xmlImportacoes.id, id)).get();
  }

  createXmlImportacao(x: InsertXmlImportacao): XmlImportacao {
    return db.insert(xmlImportacoes).values(x).returning().get();
  }

  deleteXmlImportacao(id: number): void {
    db.delete(xmlImportacoes).where(eq(xmlImportacoes.id, id)).run();
  }

  getXmlDashboard(clienteId?: number) {
    const notas = this.getXmlImportacoes(clienteId);
    const entradas = notas.filter(n => n.tipo === "entrada");
    const saidas   = notas.filter(n => n.tipo === "saida");
    const sum = (arr: XmlImportacao[], field: keyof XmlImportacao) =>
      arr.reduce((a, n) => a + ((n[field] as number) || 0), 0);
    return {
      totalEntradas: entradas.length,
      totalSaidas:   saidas.length,
      totalNotas:    notas.length,
      valorEntradas:  sum(entradas, "valorNota"),
      valorSaidas:    sum(saidas,   "valorNota"),
      icmsEntradas:   sum(entradas, "valorIcms"),
      icmsSaidas:     sum(saidas,   "valorIcms"),
      pisEntradas:    sum(entradas, "valorPis"),
      pisSaidas:      sum(saidas,   "valorPis"),
      cofinsEntradas: sum(entradas, "valorCofins"),
      cofinsSaidas:   sum(saidas,   "valorCofins"),
      ibsEntradas:    sum(entradas, "valorIbs"),
      ibsSaidas:      sum(saidas,   "valorIbs"),
      cbsEntradas:    sum(entradas, "valorCbs"),
      cbsSaidas:      sum(saidas,   "valorCbs"),
      // crédito = impostos nas entradas (não-cumulatividade)
      creditoIbs:     sum(entradas, "valorIbs"),
      creditoCbs:     sum(entradas, "valorCbs"),
    };
  }
}

export const storage = new SqliteStorage();

import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertNcmSchema, insertClienteSchema, insertConfigClienteSchema, insertAnotacaoSchema } from "@shared/schema";
import { z } from "zod";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import multer from "multer";
import { parseStringPromise } from "xml2js";
import QRCode from "qrcode";

// ─── PIX PAYLOAD ─────────────────────────────────────────────────────────────

function pixCrc16(payload: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function emv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function buildPixPayload(valor: number, txId = "cobranca"): string {
  const merchantAccount = emv("00", "br.gov.bcb.pix") + emv("01", "30016838000134");
  const f26 = emv("26", merchantAccount);
  const f52 = emv("52", "0000");
  const f53 = emv("53", "986");
  const amountStr = valor.toFixed(2);
  const f54 = emv("54", amountStr);
  const f58 = emv("58", "BR");
  const f59 = emv("59", "SC Contabilidade");
  const f60 = emv("60", "Santo Andre");
  const safeId = txId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 25) || "cobranca";
  const f62 = emv("62", emv("05", safeId));
  const base = `${emv("00", "01")}${f26}${f52}${f53}${f54}${f58}${f59}${f60}${f62}6304`;
  return base + pixCrc16(base);
}

const MESES_NOME = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// Extrai texto de PDF usando pdfjs-dist (legacy/Node.js)
async function extractPdfText(buf: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string) as any;
  const uint8 = new Uint8Array(buf);
  const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((x: any) => x.str).join(" ") + "\n";
  }
  return text;
}

// Parser do extrato PGDAS-D (PDF texto)
function parsePgdasPdf(text: string) {
  // normaliza espaços múltiplos
  const t = text.replace(/\s+/g, " ");
  const get = (pattern: RegExp, idx = 1): string | null => { const m = t.match(pattern); return m ? m[idx].trim() : null; };
  const num = (s: string | null) => s ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : 0;

  // Período e CNPJ
  const periodoApuracao = get(/Período de Apuração \(PA\):\s*([\d\/]+)/) || "";
  const cnpjBasico      = get(/CNPJ Básico:\s*([\d.]+)/) || "";
  const vencimento      = get(/Data de Vencimento:\s*([\d\/]+)/);

  // Receitas brutas: padrão "<label> <mi> <me> <total>"
  // Ex: "Receita Bruta do PA (RPA) - Competência 4.535,00 0,00 4.535,00"
  const rpa   = num(get(/Receita Bruta do PA[^\d]+([\d.,]+)\s+[\d.,]+\s+[\d.,]+/));
  const rbt12 = num(get(/RBT12\)[^\d]+([\d.,]+)\s+[\d.,]+\s+[\d.,]+/));
  const rba   = num(get(/RBA\)[^\d]+([\d.,]+)\s+[\d.,]+\s+[\d.,]+/));
  const rbaa  = num(get(/RBAA\)[^\d]+([\d.,]+)\s+[\d.,]+\s+[\d.,]+/));

  // Tributos: padrão único "IRPJ CSLL COFINS PIS/Pasep INSS/CPP ICMS IPI ISS Total" seguido pelos valores
  // Pega a linha do Total do Débito Exigível (setor 4)
  const tribMatch = t.match(/Total do Débito Exigível[^\d]+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/);
  const dasIrpj   = tribMatch ? num(tribMatch[1]) : 0;
  const dasCsll   = tribMatch ? num(tribMatch[2]) : 0;
  const dasCofins = tribMatch ? num(tribMatch[3]) : 0;
  const dasPis    = tribMatch ? num(tribMatch[4]) : 0;
  const dasInss   = tribMatch ? num(tribMatch[5]) : 0;
  const dasIcms   = tribMatch ? num(tribMatch[6]) : 0;
  // tribMatch[7] = IPI
  const dasIss    = tribMatch ? num(tribMatch[8]) : 0;
  const dasTotal  = tribMatch ? num(tribMatch[9]) : 0;

  // Atividade e Anexo
  let atividade = "";
  let anexoDetectado = "";
  const atividadeMatch = t.match(/Valor do Débito por Tributo[^(]+\(R\$\):\s*([^R]+?)Receita/);
  if (atividadeMatch) {
    atividade = atividadeMatch[1].trim();
    if (/Anexo III/i.test(atividade))      anexoDetectado = "III";
    else if (/Anexo IV/i.test(atividade))  anexoDetectado = "IV";
    else if (/Anexo V/i.test(atividade))   anexoDetectado = "V";
    else if (/Anexo II/i.test(atividade))  anexoDetectado = "II";
    else if (/Anexo I/i.test(atividade))   anexoDetectado = "I";
    else if (/Comércio|Mercadoria/i.test(atividade)) anexoDetectado = "I";
    else if (/Prestação|Serviço/i.test(atividade))  anexoDetectado = "III";
    else if (/Indústr/i.test(atividade))  anexoDetectado = "II";
  }

  // Receitas mês a mês (setor 2.2)
  const receitasMeses: Record<string, number> = {};
  // Pega somente a seção 2.2.1 Mercado Interno
  const secaoMI = t.match(/2\.2\.1\) Mercado Interno(.+?)2\.2\.2\)/);
  if (secaoMI) {
    const blocoMI = secaoMI[1];
    const r = /(\d{2}\/\d{4})\s+([\d.,]+)/g;
    let m;
    while ((m = r.exec(blocoMI)) !== null) {
      receitasMeses[m[1]] = num(m[2]);
    }
  }

  return { periodoApuracao, cnpjBasico, rpa, rbt12, rba, rbaa, vencimento,
           dasTotal, dasIrpj, dasCsll, dasCofins, dasPis, dasInss, dasIcms, dasIss,
           atividade, anexoDetectado, receitasMeses };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // GET todos NCMs cadastrados
  app.get("/api/ncms", (req, res) => {
    const result = storage.getNcms();
    res.json(result);
  });

  // GET NCM por código
  app.get("/api/ncms/:codigo", (req, res) => {
    const ncm = storage.getNcmByCodigo(req.params.codigo);
    if (!ncm) return res.status(404).json({ error: "NCM não encontrado" });
    res.json(ncm);
  });

  // POST criar NCM
  app.post("/api/ncms", (req, res) => {
    const parsed = insertNcmSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const ncm = storage.createNcm(parsed.data);
    res.json(ncm);
  });

  // PATCH atualizar NCM
  app.patch("/api/ncms/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const ncm = storage.updateNcm(id, req.body);
    if (!ncm) return res.status(404).json({ error: "NCM não encontrado" });
    res.json(ncm);
  });

  // DELETE NCM
  app.delete("/api/ncms/:id", (req, res) => {
    storage.deleteNcm(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // POST consulta fiscal — motor principal
  app.post("/api/consulta", (req, res) => {
    const { ncm, cfop, modalidade, regime, clienteId } = req.body;
    if (!ncm || !cfop || !modalidade || !regime) {
      return res.status(400).json({ error: "Campos obrigatórios: ncm, cfop, modalidade, regime" });
    }

    // Busca NCM cadastrado
    const ncmData = storage.getNcmByCodigo(ncm.replace(/\./g, "").replace(/-/g, ""));

    // Motor de regras fiscal
    const config = gerarConfiguracao({ ncm, cfop, modalidade, regime, ncmData });

    // Salvar consulta
    const consulta = storage.createConsulta({
      ncm,
      cfop,
      modalidade,
      regime,
      resultado: JSON.stringify(config),
      criadoEm: new Date().toISOString(),
    });

    // Se clienteId fornecido, salvar também em configs_cliente
    if (clienteId) {
      const cid = parseInt(clienteId);
      if (!isNaN(cid) && storage.getClienteById(cid)) {
        try {
          storage.createConfigCliente({
            clienteId: cid,
            ncm,
            cfop,
            modalidade,
            descricao: `Consulta automática via motor fiscal (${regime})`,
            resultado: JSON.stringify(config),
            criadoEm: new Date().toISOString(),
          });
        } catch {
          // Não bloquear a resposta se a vinculação falhar
        }
      }
    }

    res.json({ id: consulta.id, config });
  });

  // GET histórico de consultas
  app.get("/api/consultas", (req, res) => {
    res.json(storage.getConsultas());
  });

  // DELETE consulta
  app.delete("/api/consultas/:id", (req, res) => {
    storage.deleteConsulta(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // GET /api/feed — busca RSS de fontes tributárias e retorna itens normalizados
  app.get("/api/feed", async (req, res) => {
    const fontes = [
      {
        nome: "Receita Federal",
        sigla: "RFB",
        cor: "blue",
        url: "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/@@rss.xml",
        icone: "building",
      },
      {
        nome: "Portal do Simples Nacional",
        sigla: "SN",
        cor: "green",
        url: "https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/RSS/RSSNoticia.aspx",
        icone: "store",
      },
      {
        nome: "CONFAZ",
        sigla: "CONFAZ",
        cor: "purple",
        url: "https://www.confaz.fazenda.gov.br/legislacao/@@rss.xml",
        icone: "scale",
      },
    ];

    function fetchUrl(url: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const client = url.startsWith("https") ? https : http;
        const req2 = client.get(url, { headers: { "User-Agent": "FiscalConf/1.0" } }, (r) => {
          let data = "";
          r.on("data", (chunk) => (data += chunk));
          r.on("end", () => resolve(data));
        });
        req2.on("error", reject);
        req2.setTimeout(5000, () => { req2.destroy(); reject(new Error("timeout")); });
      });
    }

    function parseRss(xml: string, fonte: typeof fontes[0]) {
      const items: any[] = [];
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      let m: RegExpExecArray | null;
      while ((m = itemRegex.exec(xml)) !== null) {
        const block = m[1];
        const title   = (/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title[^>]*>([^<]*)<\/title>/i.exec(block))?.[1] ?? (/<title[^>]*>([^<]*)<\/title>/i.exec(block))?.[1] ?? "";
        const link    = (/<link[^>]*>([^<]*)<\/link>/i.exec(block))?.[1] ?? "";
        const desc    = (/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description[^>]*>([^<]*)<\/description>/i.exec(block))?.[1] ?? (/<description[^>]*>([^<]*)<\/description>/i.exec(block))?.[1] ?? "";
        const pubDate = (/<pubDate[^>]*>([^<]*)<\/pubDate>/i.exec(block))?.[1] ?? "";
        const cleanDesc = desc.replace(/<[^>]+>/g, "").trim().substring(0, 220);
        const cleanTitle = title.replace(/<[^>]+>/g, "").trim();
        if (cleanTitle) {
          items.push({
            id: `${fonte.sigla}-${Buffer.from(link || cleanTitle).toString("base64").substring(0, 12)}`,
            titulo: cleanTitle,
            resumo: cleanDesc || "Clique para ver mais detalhes.",
            link: link.trim(),
            data: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            fonte: fonte.nome,
            sigla: fonte.sigla,
            cor: fonte.cor,
          });
        }
        if (items.length >= 6) break;
      }
      return items;
    }

    // Itens fixos (fallback + normas recentes conhecidas)
    const fixos = [
      {
        id: "fixo-lc214",
        titulo: "LC 214/2025 — Institui IBS, CBS e IS (Reforma Tributária)",
        resumo: "Criado o Imposto sobre Bens e Serviços (IBS), a Contribuição sobre Bens e Serviços (CBS) e o Imposto Seletivo (IS). Transição gradual de 2026 a 2033.",
        link: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm",
        data: "2025-01-16T00:00:00.000Z",
        fonte: "Planalto",
        sigla: "LC",
        cor: "indigo",
      },
      {
        id: "fixo-nt2025002",
        titulo: "NT 2025.002 — Novo leiaute NF-e com campos IBS e CBS",
        resumo: "Nota Técnica define os novos campos obrigatórios no XML da NF-e para suportar IBS e CBS: pIBS, pCBS, vIBS, vCBS, vTotIBS, vTotCBS e Grupo UB por item.",
        link: "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=Yxw7sqGHs8A=",
        data: "2025-03-01T00:00:00.000Z",
        fonte: "SEFAZ Nacional",
        sigla: "NT",
        cor: "blue",
      },
      {
        id: "fixo-lc227",
        titulo: "LC 227/2026 — Simples Híbrido: IBS/CBS dentro ou fora do DAS",
        resumo: "Empresas do Simples Nacional podem optar por recolher IBS e CBS fora do DAS, gerando crédito na cadeia. Acima de R$ 3,6M de RBT12, o recolhimento fora do DAS é obrigatório.",
        link: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm",
        data: "2026-01-10T00:00:00.000Z",
        fonte: "Planalto",
        sigla: "LC",
        cor: "green",
      },
      {
        id: "fixo-ec132",
        titulo: "EC 132/2023 — Emenda Constitucional da Reforma Tributária",
        resumo: "Altera a Constituição Federal para extinguir ICMS e ISS, criando IBS, e extinguir PIS/COFINS, criando CBS. Estabelece o cronograma de transição 2026–2033.",
        link: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm",
        data: "2023-12-20T00:00:00.000Z",
        fonte: "Planalto",
        sigla: "EC",
        cor: "purple",
      },
      {
        id: "fixo-cbenef2026",
        titulo: "cBenef 2026 — Tabela de Códigos de Benefício Fiscal atualizada",
        resumo: "SEFAZ atualizou a tabela cBenef com novos códigos para 2026, incluindo reduções relacionadas à reforma tributária. Obrigatório para operações com CST 20, 40, 41 e equiparadas.",
        link: "https://www.nfe.fazenda.gov.br/portal/",
        data: "2026-02-01T00:00:00.000Z",
        fonte: "SEFAZ Nacional",
        sigla: "NFe",
        cor: "amber",
      },
    ];

    // Tenta buscar RSS em paralelo
    const rssItems: any[] = [];
    await Promise.allSettled(
      fontes.map(async (f) => {
        try {
          const xml = await fetchUrl(f.url);
          rssItems.push(...parseRss(xml, f));
        } catch {
          // fonte indisponível — ignora silenciosamente
        }
      })
    );

    // Mescla fixos + RSS, ordena por data desc, limita 30
    const todos = [...fixos, ...rssItems]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 30);

    res.json({ items: todos, atualizadoEm: new Date().toISOString() });
  });

  // ─── CLIENTES ─────────────────────────────────────────────────────────────

  // Helper: calcula RBT12 a partir do JSON de faturamentoMeses
  function calcRbt12(faturamentoMeses: string | null | undefined): number {
    if (!faturamentoMeses) return 0;
    try {
      const meses = JSON.parse(faturamentoMeses) as Record<string, number>;
      return Object.values(meses).reduce((acc, v) => acc + (Number(v) || 0), 0);
    } catch {
      return 0;
    }
  }

  // GET /api/clientes — lista todos com rbt12 calculado
  app.get("/api/clientes", (req, res) => {
    const lista = storage.getClientes();
    const result = lista.map((c) => ({ ...c, rbt12: calcRbt12(c.faturamentoMeses) }));
    res.json(result);
  });

  // GET /api/clientes/:id — detalhe
  app.get("/api/clientes/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    const c = storage.getClienteById(id);
    if (!c) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json({ ...c, rbt12: calcRbt12(c.faturamentoMeses) });
  });

  // POST /api/clientes — criar
  app.post("/api/clientes", (req, res) => {
    const now = new Date().toISOString();
    const body = { ...req.body, criadoEm: req.body.criadoEm || now, atualizadoEm: req.body.atualizadoEm || now };
    const parsed = insertClienteSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    // Verificar CNPJ duplicado
    const existing = storage.getClienteByCnpj(parsed.data.cnpj);
    if (existing) return res.status(409).json({ error: "CNPJ já cadastrado" });
    const cliente = storage.createCliente(parsed.data);
    res.status(201).json({ ...cliente, rbt12: calcRbt12(cliente.faturamentoMeses) });
  });

  // PUT /api/clientes/:id — atualizar
  app.put("/api/clientes/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    const now = new Date().toISOString();
    const data = { ...req.body, atualizadoEm: now };
    const cliente = storage.updateCliente(id, data);
    if (!cliente) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json({ ...cliente, rbt12: calcRbt12(cliente.faturamentoMeses) });
  });

  // DELETE /api/clientes/:id — deletar
  app.delete("/api/clientes/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    const existing = storage.getClienteById(id);
    if (!existing) return res.status(404).json({ error: "Cliente não encontrado" });
    storage.deleteCliente(id);
    res.json({ ok: true });
  });

  // GET /api/clientes/:id/configs — configs fiscais salvas do cliente
  app.get("/api/clientes/:id/configs", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    res.json(storage.getConfigsCliente(id));
  });

  // POST /api/clientes/:id/configs — salvar config fiscal para cliente
  app.post("/api/clientes/:id/configs", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    const existing = storage.getClienteById(id);
    if (!existing) return res.status(404).json({ error: "Cliente não encontrado" });
    const now = new Date().toISOString();
    const body = { ...req.body, clienteId: id, criadoEm: req.body.criadoEm || now };
    const parsed = insertConfigClienteSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const config = storage.createConfigCliente(parsed.data);
    res.status(201).json(config);
  });

  // ─── DASHBOARD ────────────────────────────────────────────────────────────

  // GET /api/dashboard — estatísticas gerais + alertas RBT12
  app.get("/api/dashboard", (req, res) => {
    const lista = storage.getClientes();

    const total = lista.length;
    const ativos = lista.filter((c) => c.ativo !== 0).length;
    const simples = lista.filter((c) => c.regime === "simples").length;
    const presumido = lista.filter((c) => c.regime === "presumido").length;
    const real = lista.filter((c) => c.regime === "real").length;

    // Alertas RBT12
    const alertas: Array<{ clienteId: number; razaoSocial: string; cnpj: string; rbt12: number; tipo: string }> = [];
    for (const c of lista) {
      const rbt12 = calcRbt12(c.faturamentoMeses);
      if (rbt12 > 4_800_000) {
        alertas.push({ clienteId: c.id, razaoSocial: c.razaoSocial, cnpj: c.cnpj, rbt12, tipo: "desenquadramento" });
      } else if (rbt12 > 3_600_000) {
        alertas.push({ clienteId: c.id, razaoSocial: c.razaoSocial, cnpj: c.cnpj, rbt12, tipo: "hibrido_compulsorio" });
      } else if (rbt12 > 3_000_000) {
        alertas.push({ clienteId: c.id, razaoSocial: c.razaoSocial, cnpj: c.cnpj, rbt12, tipo: "atencao" });
      }
    }

    // Distribuição por regime
    const regimeMap: Record<string, number> = {};
    for (const c of lista) {
      regimeMap[c.regime] = (regimeMap[c.regime] || 0) + 1;
    }
    const regimeDist = Object.entries(regimeMap).map(([regime, count]) => ({ regime, count }));

    // Distribuição por anexo (apenas Simples Nacional)
    const anexoMap: Record<string, number> = {};
    for (const c of lista.filter((c) => c.regime === "simples" && c.anexo)) {
      const anexo = c.anexo as string;
      anexoMap[anexo] = (anexoMap[anexo] || 0) + 1;
    }
    const anexoDist = Object.entries(anexoMap).map(([anexo, count]) => ({ anexo, count }));

    res.json({ total, ativos, simples, presumido, real, alertas, regimeDist, anexoDist });
  });

  // GET /api/cnpj/:cnpj — proxy para ReceitaWS (evita CORS no frontend)
  app.get("/api/cnpj/:cnpj", async (req, res) => {
    const cnpj = req.params.cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) {
      return res.status(400).json({ error: "CNPJ deve ter 14 dígitos" });
    }
    function fetchJson(url: string): Promise<any> {
      return new Promise((resolve, reject) => {
        const client = url.startsWith("https") ? https : http;
        const r = client.get(url, { headers: { "User-Agent": "FiscalConf/2.0" } }, (resp) => {
          let data = "";
          resp.on("data", (chunk) => (data += chunk));
          resp.on("end", () => {
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error("JSON inválido")); }
          });
        });
        r.on("error", reject);
        r.setTimeout(8000, () => { r.destroy(); reject(new Error("timeout")); });
      });
    }
    try {
      const data = await fetchJson(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
      if (data.status === "ERROR") {
        return res.status(404).json({ error: data.message || "CNPJ não encontrado" });
      }
      // Normaliza e retorna campos úteis
      res.json({
        cnpj: cnpj,
        razaoSocial: data.nome ?? "",
        nomeFantasia: data.fantasia ?? "",
        situacao: data.situacao ?? "",
        tipo: data.tipo ?? "",
        porte: data.porte ?? "",
        naturezaJuridica: data.natureza_juridica ?? "",
        atividadePrincipal: data.atividade_principal?.[0]?.text ?? "",
        cnaeCode: data.atividade_principal?.[0]?.code ?? "",
        email: data.email ?? "",
        telefone: data.telefone ?? "",
        endereco: [
          data.logradouro,
          data.numero,
          data.complemento,
          data.bairro,
          data.municipio,
          data.uf,
        ].filter(Boolean).join(", "),
        abertura: data.abertura ?? "",
        capitalSocial: data.capital_social ?? "",
        socios: (data.qsa ?? []).map((s: any) => s.nome).join(", "),
      });
    } catch (err: any) {
      res.status(502).json({ error: "Serviço temporariamente indisponível. Tente novamente em instantes." });
    }
  });

  // ─── IMPORTAÇÃO CSV ───────────────────────────────────────────────────────

  // POST /api/clientes/importar — importa array de clientes
  app.post("/api/clientes/importar", (req, res) => {
    const { clientes: lista } = req.body as {
      clientes: Array<{ cnpj: string; razaoSocial: string; regime: string; anexo?: string; faturamentoMeses?: string }>
    };
    if (!Array.isArray(lista)) return res.status(400).json({ error: "Body deve conter { clientes: [] }" });

    let importados = 0;
    const erros: Array<{ linha: number; cnpj: string; erro: string }> = [];
    const now = new Date().toISOString();

    for (let i = 0; i < lista.length; i++) {
      const item = lista[i];
      const linha = i + 1;
      const cnpjRaw = (item.cnpj || "").replace(/\D/g, "");

      if (cnpjRaw.length !== 14) {
        erros.push({ linha, cnpj: item.cnpj || "", erro: "CNPJ deve ter 14 dígitos numéricos" });
        continue;
      }
      if (!item.razaoSocial || !item.razaoSocial.trim()) {
        erros.push({ linha, cnpj: cnpjRaw, erro: "Razão social obrigatória" });
        continue;
      }
      if (!item.regime) {
        erros.push({ linha, cnpj: cnpjRaw, erro: "Regime tributário obrigatório" });
        continue;
      }

      // Ignorar duplicatas silenciosamente
      const existing = storage.getClienteByCnpj(cnpjRaw);
      if (existing) continue;

      try {
        storage.createCliente({
          cnpj: cnpjRaw,
          razaoSocial: item.razaoSocial.trim(),
          regime: item.regime as any,
          anexo: item.anexo || undefined,
          faturamentoMeses: item.faturamentoMeses || undefined,
          criadoEm: now,
          atualizadoEm: now,
        });
        importados++;
      } catch (err: any) {
        erros.push({ linha, cnpj: cnpjRaw, erro: err.message || "Erro ao inserir" });
      }
    }

    res.json({ importados, erros });
  });

  // ─── BACKUP ───────────────────────────────────────────────────────────────

  // GET /api/backup — download do banco SQLite
  app.get("/api/backup", (req, res) => {
    const dbPath = path.resolve(process.cwd(), "data.db");
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: "Arquivo data.db não encontrado" });
    }
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename=fiscalconf-backup-${today}.db`);
    res.setHeader("Content-Type", "application/octet-stream");
    const stream = fs.createReadStream(dbPath);
    stream.pipe(res);
  });

  // ─── ANOTAÇÕES ─────────────────────────────────────────────────────────────

  // GET /api/clientes/:id/anotacoes
  app.get("/api/clientes/:id/anotacoes", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    res.json(storage.getAnotacoes(id));
  });

  // POST /api/clientes/:id/anotacoes
  app.post("/api/clientes/:id/anotacoes", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    const cliente = storage.getClienteById(id);
    if (!cliente) return res.status(404).json({ error: "Cliente não encontrado" });
    const now = new Date().toISOString();
    const body = {
      clienteId: id,
      texto: req.body.texto,
      tipo: req.body.tipo || "geral",
      criadoEm: now,
    };
    const parsed = insertAnotacaoSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const anotacao = storage.createAnotacao(parsed.data);
    res.status(201).json(anotacao);
  });

  // DELETE /api/anotacoes/:id
  app.delete("/api/anotacoes/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    storage.deleteAnotacao(id);
    res.json({ ok: true });
  });

  // POST /api/clientes/:id/pgdas — importação do extrato PGDAS-D (PDF)
  app.post("/api/clientes/:id/pgdas", upload.single("pdf"), async (req, res) => {
    try {
      const clienteId = parseInt(req.params.id as string);
      if (isNaN(clienteId)) return res.status(400).json({ error: "ID inválido" });
      if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

      const text = await extractPdfText(req.file.buffer);
      const parsed = parsePgdasPdf(text);

      // Salva no banco
      const pgdas = storage.createPgdas({
        clienteId,
        cnpj: parsed.cnpjBasico,
        periodoApuracao: parsed.periodoApuracao,
        rpa: parsed.rpa,
        rbt12: parsed.rbt12,
        rba: parsed.rba,
        rbaa: parsed.rbaa,
        dasTotal: parsed.dasTotal,
        dasIrpj: parsed.dasIrpj,
        dasCsll: parsed.dasCsll,
        dasCofins: parsed.dasCofins,
        dasPis: parsed.dasPis,
        dasInss: parsed.dasInss,
        dasIcms: parsed.dasIcms,
        dasIss: parsed.dasIss,
        vencimento: parsed.vencimento,
        atividade: parsed.atividade,
        anexoDetectado: parsed.anexoDetectado,
        receitasMeses: JSON.stringify(parsed.receitasMeses),
        pago: 0,
        importadoEm: new Date().toISOString(),
      });

      // Atualiza faturamento do cliente com os dados do PGDAS
      if (Object.keys(parsed.receitasMeses).length > 0) {
        const cliente = storage.getClienteById(clienteId);
        if (cliente) {
          storage.updateCliente(clienteId, {
            faturamentoMeses: JSON.stringify(parsed.receitasMeses),
            atualizadoEm: new Date().toISOString(),
          });
        }
      }

      res.json({ ok: true, pgdas, parsed });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Erro ao processar PDF" });
    }
  });

  // GET /api/clientes/:id/pgdas — lista importações PGDAS
  app.get("/api/clientes/:id/pgdas", (req, res) => {
    const clienteId = parseInt(req.params.id);
    if (isNaN(clienteId)) return res.status(400).json({ error: "ID inválido" });
    res.json(storage.getPgdasByCliente(clienteId));
  });

  // PATCH /api/pgdas/:id/pago — marca DAS como pago/não pago
  app.patch("/api/pgdas/:id/pago", (req, res) => {
    const id = parseInt(req.params.id);
    const { pago } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    storage.updatePgdasPago(id, pago ? 1 : 0);
    res.json({ ok: true });
  });

  // DELETE /api/pgdas/:id
  app.delete("/api/pgdas/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    storage.deletePgdas(id);
    res.json({ ok: true });
  });

  // ─── XML NF-e Import ──────────────────────────────────────────────────────
  const xmlUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  // Parser NF-e XML — extrai campos padronizados
  async function parseNfe(xmlBuf: Buffer, nomeArquivo: string, clienteAtivoCnpj?: string) {
    const raw = await parseStringPromise(xmlBuf.toString("utf8"), { explicitArray: false, ignoreAttrs: false });

    // Suporte nfeProcNFe (retorno SEFAZ) ou NFe direto
    const root = raw.nfeProc?.NFe || raw.NFe || raw.nfeProc || raw;
    const infNFe = root?.infNFe;
    if (!infNFe) throw new Error("Estrutura NF-e não reconhecida");

    const attrs = infNFe.$ || {};
    const rawId: string = (attrs.Id || "").replace(/^NFe/, "");
    const chaveAcesso = rawId.length === 44 ? rawId : null;

    const emit = infNFe.emit || {};
    const dest = infNFe.dest || {};
    const ide  = infNFe.ide  || {};
    const tot  = infNFe.total?.ICMSTot || {};

    const emitCnpj = emit.CNPJ || emit.CPF || "";
    const destCnpj  = dest.CNPJ || dest.CPF || "";
    const emitRazao = emit.xNome || "";
    const destRazao  = dest.xNome || "";
    const modelo    = (ide.mod || "55").toString();
    const serie     = ide.serie?.toString() || "";
    const numero    = ide.nNF?.toString()   || "";
    const dataEmissao = ide.dhEmi ? ide.dhEmi.split("T")[0] : ide.dEmi || "";

    // Determinar Entrada vs Saída
    // 1) CFOP do 1º item
    const detRaw = infNFe.det;
    const dets: any[] = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];
    const primCfop: string = dets[0]?.prod?.CFOP?.toString() || "";
    let tipo: "entrada" | "saida" = "saida";
    if (primCfop && ["1","2","3"].includes(primCfop[0])) {
      tipo = "entrada";
    } else if (clienteAtivoCnpj) {
      const cnpjLimpo = clienteAtivoCnpj.replace(/\D/g, "");
      if (destCnpj.replace(/\D/g,"") === cnpjLimpo) tipo = "entrada";
      else if (emitCnpj.replace(/\D/g,"") === cnpjLimpo) tipo = "saida";
    }

    // Totais
    const n = (v: any) => parseFloat((v || "0").toString()) || 0;
    const valorNota    = n(tot.vNF);
    const baseCalcIcms = n(tot.vBC);
    const valorIcms    = n(tot.vICMS);
    const valorIpi     = n(tot.vIPI);
    const valorPis     = n(tot.vPIS);
    const valorCofins  = n(tot.vCOFINS);
    const valorSt      = n(tot.vST);
    const valorFrete   = n(tot.vFrete);
    const valorDesc    = n(tot.vDesc);
    const valorProd    = n(tot.vProd);

    // IBS/CBS — grupos gIBS e gCBS (NF-e 4.x)
    let valorIbs = 0; let valorCbs = 0;
    for (const det of dets) {
      valorIbs += n(det.imposto?.gIBS?.vIBS);
      valorCbs += n(det.imposto?.gCBS?.vCBS);
    }
    // Situação da nota
    const protNFe = raw.nfeProc?.protNFe;
    const cStat = protNFe?.infProt?.cStat?.toString() || "100";
    let situacao = "importado";
    if (["101","151","155"].includes(cStat)) situacao = "cancelada";
    else if (cStat === "110") situacao = "denegada";

    // Itens
    const itens = dets.map((det: any) => ({
      ncm:        det.prod?.NCM || "",
      cfop:       det.prod?.CFOP?.toString() || "",
      descricao:  det.prod?.xProd || "",
      cEAN:       det.prod?.cEAN || "",
      cProd:      det.prod?.cProd || "",
      uCom:       det.prod?.uCom || "",
      qCom:       n(det.prod?.qCom),
      vUnitCom:   n(det.prod?.vUnCom),
      vTotal:     n(det.prod?.vProd),
      vDesc:      n(det.prod?.vDesc),
      cstIcms:    det.imposto?.ICMS?.[Object.keys(det.imposto?.ICMS || {})[0]]?.CST ||
                  det.imposto?.ICMS?.[Object.keys(det.imposto?.ICMS || {})[0]]?.CSOSN || "",
      cstPis:     det.imposto?.PIS?.[Object.keys(det.imposto?.PIS || {})[0]]?.CST || "",
      cstCofins:  det.imposto?.COFINS?.[Object.keys(det.imposto?.COFINS || {})[0]]?.CST || "",
      vIcms:      n(det.imposto?.ICMS?.[Object.keys(det.imposto?.ICMS || {})[0]]?.vICMS),
      vPis:       n(det.imposto?.PIS?.[Object.keys(det.imposto?.PIS || {})[0]]?.vPIS),
      vCofins:    n(det.imposto?.COFINS?.[Object.keys(det.imposto?.COFINS || {})[0]]?.vCOFINS),
      vIbs:       n(det.imposto?.gIBS?.vIBS),
      vCbs:       n(det.imposto?.gCBS?.vCBS),
      cstIbs:     det.imposto?.gIBS?.CST || "",
      cstCbs:     det.imposto?.gCBS?.CST || "",
    }));

    return {
      tipo, chaveAcesso, modelo, serie, numero, dataEmissao,
      emitCnpj, emitRazao, destCnpj, destRazao,
      valorNota, baseCalcIcms, valorIcms, valorIpi, valorPis, valorCofins,
      valorIbs, valorCbs, valorSt, valorFrete, valorDesc, valorProd,
      itens: JSON.stringify(itens), situacao, nomeArquivo,
      importadoEm: new Date().toISOString(),
    };
  }

  // POST /api/xml-import — recebe múltiplos arquivos XML
  app.post("/api/xml-import", xmlUpload.array("xmlFiles", 100), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0)
        return res.status(400).json({ error: "Nenhum arquivo enviado" });

      const clienteId = req.body.clienteId ? parseInt(req.body.clienteId) : undefined;
      const clienteAtivoCnpj = req.body.clienteCnpj || undefined;

      const resultados: any[] = [];
      const erros: any[] = [];

      for (const file of files) {
        try {
          const parsed = await parseNfe(file.buffer, file.originalname, clienteAtivoCnpj);
          const saved = storage.createXmlImportacao({ ...parsed, clienteId: clienteId ?? null });
          resultados.push({ id: saved.id, arquivo: file.originalname, tipo: parsed.tipo, numero: parsed.numero, emitRazao: parsed.emitRazao, valorNota: parsed.valorNota });
        } catch (e: any) {
          erros.push({ arquivo: file.originalname, erro: e.message });
        }
      }

      res.json({ importados: resultados.length, totalErros: erros.length, resultados, erros });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/xml-importacoes
  app.get("/api/xml-importacoes", (req, res) => {
    const clienteId = req.query.clienteId ? parseInt(req.query.clienteId as string) : undefined;
    const notas = storage.getXmlImportacoes(clienteId);
    res.json(notas);
  });

  // GET /api/xml-importacoes/:id
  app.get("/api/xml-importacoes/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const nota = storage.getXmlImportacaoById(id);
    if (!nota) return res.status(404).json({ error: "Não encontrada" });
    res.json(nota);
  });

  // DELETE /api/xml-importacoes/:id
  app.delete("/api/xml-importacoes/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    storage.deleteXmlImportacao(id);
    res.json({ ok: true });
  });

  // GET /api/xml-dashboard
  app.get("/api/xml-dashboard", (req, res) => {
    const clienteId = req.query.clienteId ? parseInt(req.query.clienteId as string) : undefined;
    res.json(storage.getXmlDashboard(clienteId));
  });

  // ─── COBRANÇAS ────────────────────────────────────────────────────────────────

  // GET /api/cobrancas
  app.get("/api/cobrancas", (req, res) => {
    const clienteId = req.query.clienteId ? parseInt(req.query.clienteId as string) : undefined;
    const mes = req.query.mes ? parseInt(req.query.mes as string) : undefined;
    const ano = req.query.ano ? parseInt(req.query.ano as string) : undefined;
    const list = storage.getCobrancas({ clienteId, mes, ano });
    // Enriquecer com dados do cliente
    const enriched = list.map(c => {
      const cli = storage.getClienteById(c.clienteId);
      return { ...c, cliente: cli ? { razaoSocial: cli.razaoSocial, nomeFantasia: cli.nomeFantasia, cnpj: cli.cnpj, email: cli.email } : null };
    });
    res.json(enriched);
  });

  // POST /api/cobrancas — individual
  app.post("/api/cobrancas", (req, res) => {
    const { clienteId, valor, mesReferencia, anoReferencia, vencimento, descricao } = req.body;
    if (!clienteId || !valor || !mesReferencia || !anoReferencia || !descricao) {
      return res.status(400).json({ error: "Campos obrigatórios: clienteId, valor, mesReferencia, anoReferencia, descricao" });
    }
    const cli = storage.getClienteById(parseInt(clienteId));
    if (!cli) return res.status(404).json({ error: "Cliente não encontrado" });
    const cob = storage.createCobranca({
      clienteId: parseInt(clienteId),
      valor: parseFloat(valor),
      mesReferencia: parseInt(mesReferencia),
      anoReferencia: parseInt(anoReferencia),
      vencimento: vencimento || null,
      descricao,
      status: "pendente",
      criadoEm: new Date().toISOString(),
    });
    res.status(201).json(cob);
  });

  // POST /api/cobrancas/lote — gera para todos (ou lista) de clientes
  app.post("/api/cobrancas/lote", (req, res) => {
    const { mesReferencia, anoReferencia, vencimento, descricao, clienteIds } = req.body;
    if (!mesReferencia || !anoReferencia || !descricao) {
      return res.status(400).json({ error: "Campos obrigatórios: mesReferencia, anoReferencia, descricao" });
    }
    const clientes = clienteIds?.length
      ? (clienteIds as number[]).map(id => storage.getClienteById(id)).filter(Boolean)
      : storage.getClientes().filter(c => c.ativo !== 0);

    const criados: any[] = [];
    const erros: any[] = [];
    const now = new Date().toISOString();

    for (const cli of clientes as any[]) {
      if (!cli.honorario || cli.honorario <= 0) {
        erros.push({ clienteId: cli.id, razaoSocial: cli.razaoSocial, erro: "Honorário não cadastrado" });
        continue;
      }
      try {
        const cob = storage.createCobranca({
          clienteId: cli.id,
          valor: cli.honorario,
          mesReferencia: parseInt(mesReferencia),
          anoReferencia: parseInt(anoReferencia),
          vencimento: vencimento || null,
          descricao,
          status: "pendente",
          criadoEm: now,
        });
        criados.push({ ...cob, cliente: { razaoSocial: cli.razaoSocial, cnpj: cli.cnpj } });
      } catch (err: any) {
        erros.push({ clienteId: cli.id, razaoSocial: cli.razaoSocial, erro: err.message });
      }
    }
    res.json({ criados: criados.length, erros, cobrancas: criados });
  });

  // PATCH /api/cobrancas/:id — atualiza status ou campos
  app.patch("/api/cobrancas/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    const updated = storage.updateCobranca(id, req.body);
    if (!updated) return res.status(404).json({ error: "Cobrança não encontrada" });
    res.json(updated);
  });

  // DELETE /api/cobrancas/:id
  app.delete("/api/cobrancas/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    storage.deleteCobranca(id);
    res.json({ ok: true });
  });

  // GET /api/cobrancas/:id/carta — gera HTML da carta de cobrança
  app.get("/api/cobrancas/:id/carta", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("ID inválido");
    const cob = storage.getCobrancaById(id);
    if (!cob) return res.status(404).send("Cobrança não encontrada");
    const cli = storage.getClienteById(cob.clienteId);
    if (!cli) return res.status(404).send("Cliente não encontrado");

    const pixPayload = buildPixPayload(cob.valor, `COB${cob.id}`);
    const qrDataUrl = await QRCode.toDataURL(pixPayload, { width: 220, margin: 1, color: { dark: "#000000", light: "#ffffff" } });

    const mesNome = MESES_NOME[(cob.mesReferencia - 1)] || "";
    const valorFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cob.valor);
    const cnpjFmt = (cnpj: string) => {
      const d = cnpj.replace(/\D/g, "");
      return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
    };
    const dataHoje = new Date().toLocaleDateString("pt-BR");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Carta de Cobrança — ${cli.razaoSocial}</title>
<style>
  @page { size: A4; margin: 20mm 20mm 20mm 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; background: #fff; font-size: 13px; line-height: 1.6; }
  .page { max-width: 680px; margin: 0 auto; padding: 40px 0; }
  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #e91e8c; margin-bottom: 28px; }
  .brand-name { font-size: 26px; font-weight: 700; color: #e91e8c; letter-spacing: -0.5px; }
  .brand-sub { font-size: 11px; color: #666; margin-top: 2px; }
  .doc-info { text-align: right; }
  .doc-titulo { font-size: 18px; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: 1px; }
  .doc-num { font-size: 11px; color: #888; margin-top: 4px; }
  /* Seções */
  .section { margin-bottom: 24px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .info-item label { display: block; font-size: 10px; color: #888; text-transform: uppercase; }
  .info-item span { font-size: 13px; font-weight: 600; color: #111; }
  /* Descrição */
  .desc-box { background: #f9f9f9; border-left: 4px solid #e91e8c; padding: 14px 16px; border-radius: 4px; font-size: 13px; color: #333; }
  /* Valor */
  .valor-box { display: flex; justify-content: space-between; align-items: center; background: #fff5fb; border: 2px solid #e91e8c; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
  .valor-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .valor-num { font-size: 28px; font-weight: 700; color: #e91e8c; }
  .venc-text { font-size: 12px; color: #555; }
  /* PIX */
  .pix-section { display: flex; align-items: flex-start; gap: 24px; background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 20px; }
  .pix-qr img { width: 200px; height: 200px; border: 1px solid #ddd; border-radius: 4px; }
  .pix-info h3 { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 8px; }
  .pix-info p { font-size: 12px; color: #555; margin-bottom: 6px; }
  .pix-key-box { background: #fff; border: 1px dashed #ccc; border-radius: 4px; padding: 8px 10px; font-size: 11px; color: #333; word-break: break-all; margin-top: 10px; }
  .pix-key-label { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 3px; }
  /* Footer */
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #aaa; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand-name">SC Contabilidade</div>
      <div class="brand-sub">CNPJ: 30.016.838/0001-34 · Santo André – SP</div>
    </div>
    <div class="doc-info">
      <div class="doc-titulo">Carta de Cobrança</div>
      <div class="doc-num">Ref. ${mesNome}/${cob.anoReferencia} · Emitida em ${dataHoje}</div>
    </div>
  </div>

  <!-- Cliente -->
  <div class="section">
    <div class="section-title">Dados do Cliente</div>
    <div class="info-grid">
      <div class="info-item" style="grid-column: span 2">
        <label>Razão Social</label>
        <span>${cli.razaoSocial}</span>
      </div>
      <div class="info-item">
        <label>CNPJ</label>
        <span>${cnpjFmt(cli.cnpj)}</span>
      </div>
      ${cli.email ? `<div class="info-item"><label>E-mail</label><span>${cli.email}</span></div>` : ""}
    </div>
  </div>

  <!-- Período -->
  <div class="section">
    <div class="section-title">Período de Referência</div>
    <div class="info-grid">
      <div class="info-item">
        <label>Competência</label>
        <span>${mesNome} / ${cob.anoReferencia}</span>
      </div>
      ${cob.vencimento ? `<div class="info-item"><label>Vencimento</label><span>${cob.vencimento}</span></div>` : ""}
    </div>
  </div>

  <!-- Descrição -->
  <div class="section">
    <div class="section-title">Descrição dos Serviços</div>
    <div class="desc-box">${cob.descricao.replace(/\n/g, "<br>")}</div>
  </div>

  <!-- Valor -->
  <div class="valor-box">
    <div>
      <div class="valor-label">Valor Total</div>
      ${cob.vencimento ? `<div class="venc-text">Vencimento: ${cob.vencimento}</div>` : ""}
    </div>
    <div class="valor-num">${valorFmt}</div>
  </div>

  <!-- PIX -->
  <div class="section">
    <div class="section-title">Pagamento via PIX</div>
    <div class="pix-section">
      <div class="pix-qr">
        <img src="${qrDataUrl}" alt="QR Code PIX" />
      </div>
      <div class="pix-info">
        <h3>Pague com PIX</h3>
        <p>Escaneie o QR Code ao lado com seu aplicativo de banco ou copie a chave PIX abaixo.</p>
        <p>O pagamento é identificado automaticamente — não é necessário enviar comprovante.</p>
        <div class="pix-key-box">
          <div class="pix-key-label">Chave PIX (CNPJ)</div>
          30.016.838/0001-34
        </div>
        <div class="pix-key-box" style="margin-top:6px">
          <div class="pix-key-label">Valor</div>
          ${valorFmt}
        </div>
      </div>
    </div>
  </div>

  <!-- Botão imprimir (oculto na impressão) -->
  <div class="no-print" style="text-align:center;margin-top:28px">
    <button onclick="window.print()" style="background:#e91e8c;color:#fff;border:none;padding:12px 32px;font-size:14px;border-radius:6px;cursor:pointer;font-weight:600">
      Imprimir / Salvar PDF
    </button>
  </div>

  <div class="footer">SC Contabilidade · Santo André – SP · CNPJ 30.016.838/0001-34</div>
</div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  return httpServer;
}

// ─── MOTOR DE REGRAS FISCAL ───────────────────────────────────────────────────
function gerarConfiguracao({ ncm, cfop, modalidade, regime, ncmData }: any) {
  const cfopNum = parseInt(cfop.replace(".", ""));
  const isEntrada = cfopNum < 4000;
  const isInterestadual = cfopNum >= 2000 && cfopNum < 4000;
  const isExterior = cfopNum >= 3000 && cfopNum < 4000 || cfopNum >= 7000;
  const isSaida = cfopNum >= 5000;
  const isB2B = modalidade === "B2B";
  const isSimples = regime === "Simples";

  // Determinar CST ICMS
  let cstIcms = "";
  let cstIcmsDescricao = "";
  let csosn = "";
  let csosnDescricao = "";

  if (isSimples) {
    // CSOSN para Simples Nacional
    if (ncmData?.cstIcmsSimples) {
      csosn = ncmData.cstIcmsSimples;
    } else {
      csosn = "102"; // Tributada sem permissão de crédito (padrão Simples saída)
      if (isEntrada) csosn = "900";
    }
    csosnDescricao = mapCSOSN(csosn);
  } else {
    // CST ICMS para Presumido/Real
    if (ncmData?.cstIcmsPresumido) {
      cstIcms = ncmData.cstIcmsPresumido;
    } else {
      cstIcms = "00"; // Tributada integralmente (padrão saída)
      if (isEntrada) cstIcms = "00";
    }
    cstIcmsDescricao = mapCSTIcms(cstIcms);
  }

  // CST PIS/COFINS
  let cstPis = "";
  let cstCofins = "";
  let cstPisDescricao = "";
  let cstCofinsDescricao = "";

  if (isSimples) {
    cstPis = ncmData?.cstPisSimples || (isSaida ? "07" : "70");
    cstCofins = ncmData?.cstCofinsSimples || (isSaida ? "07" : "70");
  } else {
    cstPis = ncmData?.cstPisPresumido || (isSaida ? "01" : "50");
    cstCofins = ncmData?.cstCofinsPresumido || (isSaida ? "01" : "50");
  }
  cstPisDescricao = mapCSTPisCofins(cstPis);
  cstCofinsDescricao = mapCSTPisCofins(cstCofins);

  // cClassTrib IBS/CBS
  let cClassTrib = "";
  let cClassTribDescricao = "";
  let cstIbsCbs = "";
  let cstIbsCbsDescricao = "";

  if (isSimples) {
    cClassTrib = ncmData?.cClassTribSimples || "010001";
    cstIbsCbs = cClassTrib.substring(0, 3);
  } else {
    cClassTrib = ncmData?.cClassTribPresumido || "010001";
    cstIbsCbs = cClassTrib.substring(0, 3);
  }
  cClassTribDescricao = mapCClassTrib(cClassTrib);
  cstIbsCbsDescricao = mapCSTIbsCbs(cstIbsCbs);

  // Alíquotas IBS/CBS 2026 (fase teste)
  const aliquotaIbs = 0.1;
  const aliquotaCbs = 0.9;
  const aliquotaTotal = aliquotaIbs + aliquotaCbs;

  // ── cBenef ───────────────────────────────────────────────────────────────
  // Código de Benefício Fiscal — campo obrigatório quando há isenção/redução de ICMS
  // Formato: UF + 8 dígitos (ex: SP12345678) — cadastrado por estado no CAT/SEFAZ
  const cBenef: string = ncmData?.cBenef || "";
  const cBenefObrigatorio = ["20", "40", "41", "50", "51", "70"].includes(cstIcms) ||
    ["103", "300", "400"].includes(csosn);

  // ── cEST ─────────────────────────────────────────────────────────────────
  // Código Especificador da Substituição Tributária (7 dígitos)
  // Obrigatório quando CSOSN 201/202/203/500 ou CST ICMS 10/30/60/70
  const cEst: string = ncmData?.cEst || "";
  const cEstObrigatorio = ["10", "30", "60", "70"].includes(cstIcms) ||
    ["201", "202", "203", "500"].includes(csosn);

  // Tipo de documento
  const tipoDocumento = isB2B ? "NF-e (modelo 55)" : "NFC-e (modelo 65) ou NF-e (modelo 55)";

  // Alertas
  const alertas: string[] = [];
  if (!ncmData) {
    alertas.push("NCM não cadastrado na base local. Configure as alíquotas específicas no módulo NCM para maior precisão.");
  }
  if (isInterestadual && !isSimples) {
    alertas.push("Operação interestadual: verifique DIFAL se destinatário for não contribuinte (B2C).");
  }
  if (isExterior) {
    alertas.push("Operação com exterior: verifique suspensão de IPI e imunidade de ICMS (art. 155 §2° X, a CF).");
  }
  if (!isB2B && isSaida) {
    alertas.push("B2C: verifique se o produto está sujeito a Substituição Tributária (ICMS-ST) já retida na cadeia.");
  }
  if (isSimples) {
    alertas.push("Simples Nacional 2026: IBS/CBS em fase de teste (0,1% + 0,9%). Adequação do XML já obrigatória.");
  }

  // CFOP espelhado (para entrada correspondente)
  const cfopEspelho = getCfopEspelho(cfop);

  return {
    resumo: {
      ncm,
      cfop,
      cfopDescricao: getCfopDescricao(cfop),
      modalidade,
      regime,
      tipoDocumento,
    },
    icms: isSimples
      ? { csosn, csosnDescricao, regime: "Simples Nacional" }
      : { cst: cstIcms, cstDescricao: cstIcmsDescricao, regime },
    pisCofins: {
      cstPis,
      cstPisDescricao,
      cstCofins,
      cstCofinsDescricao,
    },
    ibsCbs: {
      cstIbsCbs,
      cstIbsCbsDescricao,
      cClassTrib,
      cClassTribDescricao,
      aliquotaIbs: `${aliquotaIbs}%`,
      aliquotaCbs: `${aliquotaCbs}%`,
      aliquotaTotal: `${aliquotaTotal}%`,
      observacao: "Alíquotas de 2026 (fase de teste). A partir de 2027, CBS passa à alíquota plena.",
    },
    ipi: {
      aliquota: ncmData?.aliquotaIpi ?? "Verificar tabela TIPI",
      observacao: ncmData ? `IPI conforme NCM cadastrado` : "Consulte a TIPI vigente para o NCM informado",
    },
    cfopEspelho: cfopEspelho ? { cfop: cfopEspelho, descricao: getCfopDescricao(cfopEspelho) } : null,
    cBenef: {
      codigo: cBenef,
      obrigatorio: cBenefObrigatorio,
      descricao: cBenef
        ? `Benefício fiscal cadastrado: ${cBenef}`
        : cBenefObrigatorio
        ? "Campo obrigatório p/ este CST/CSOSN — cadastre no NCM ou informe manualmente"
        : "Não exigido para esta operação",
    },
    cEst: {
      codigo: cEst,
      obrigatorio: cEstObrigatorio,
      descricao: cEst
        ? `cEST cadastrado: ${cEst}`
        : cEstObrigatorio
        ? "Campo obrigatório p/ ST — consulte tabela CEST/Convênio ICMS 52/2017"
        : "Não exigido para esta operação",
    },
    alertas,
    ncmCadastrado: !!ncmData,
  };
}

// ─── MAPEAMENTOS ──────────────────────────────────────────────────────────────

function mapCSOSN(csosn: string): string {
  const map: Record<string, string> = {
    "101": "Tributada pelo Simples Nacional com permissão de crédito",
    "102": "Tributada pelo Simples Nacional sem permissão de crédito",
    "103": "Isenção do ICMS para faixa de receita bruta",
    "201": "Tributada pelo Simples Nacional com permissão de crédito e com cobrança do ICMS por ST",
    "202": "Tributada pelo Simples Nacional sem permissão de crédito e com cobrança do ICMS por ST",
    "203": "Isenção do ICMS para faixa de receita bruta e com cobrança do ICMS por ST",
    "300": "Imune",
    "400": "Não tributada pelo Simples Nacional",
    "500": "ICMS cobrado anteriormente por ST ou por antecipação",
    "900": "Outros",
  };
  return map[csosn] || "Outros";
}

function mapCSTIcms(cst: string): string {
  const map: Record<string, string> = {
    "00": "Tributada integralmente",
    "10": "Tributada e com cobrança do ICMS por substituição tributária",
    "20": "Com redução de base de cálculo",
    "30": "Isenta ou não tributada e com cobrança do ICMS por ST",
    "40": "Isenta",
    "41": "Não tributada",
    "50": "Suspensão",
    "51": "Diferimento",
    "60": "ICMS cobrado anteriormente por ST",
    "70": "Com redução de base de cálculo e cobrança do ICMS por ST",
    "90": "Outros",
  };
  return map[cst] || "Outros";
}

function mapCSTPisCofins(cst: string): string {
  const map: Record<string, string> = {
    "01": "Operação tributável (base de cálculo = valor da operação alíquota normal)",
    "02": "Operação tributável (base de cálculo = valor da operação alíquota diferenciada)",
    "03": "Operação tributável (base de cálculo = quantidade vendida × alíquota por unidade)",
    "04": "Operação tributável (tributação monofásica — alíquota zero)",
    "05": "Operação tributável (ST)",
    "06": "Operação tributável (alíquota zero)",
    "07": "Operação isenta da contribuição",
    "08": "Operação sem incidência",
    "09": "Operação com suspensão",
    "49": "Outras saídas",
    "50": "Operação com direito a crédito — vinculada exclusivamente a receita tributada",
    "51": "Operação com direito a crédito — vinculada exclusivamente a receita não tributada",
    "52": "Operação com direito a crédito — vinculada a receitas tributadas e não tributadas",
    "53": "Operação com direito a crédito — vinculada a receitas tributadas e exportação",
    "60": "Crédito presumido — operação de aquisição vinculada exclusivamente a receita tributada",
    "70": "Operação de aquisição sem direito a crédito",
    "71": "Operação de aquisição com isenção",
    "72": "Operação de aquisição com suspensão",
    "73": "Operação de aquisição com alíquota zero",
    "74": "Operação de aquisição sem incidência da contribuição",
    "75": "Operação de aquisição por ST",
    "98": "Outras operações de entrada",
    "99": "Outras operações",
  };
  return map[cst] || "Consulte a tabela oficial";
}

function mapCClassTrib(code: string): string {
  // Fonte oficial: Portal SVRS - dfe-portal.svrs.rs.gov.br/Cff/ClassificacaoTributaria
  const map: Record<string, string> = {
    "000001": "Situações tributadas integralmente pelo IBS e CBS",
    "000002": "Exploração de via",
    "000003": "Regime automotivo — projetos incentivados (art. 311)",
    "000004": "Regime automotivo — projetos incentivados (art. 312)",
    "000005": "Operação com EAC destinado à mistura com gasolina A",
    "010001": "Operações do FGTS não realizadas pela Caixa Econômica Federal",
    "010002": "Operações do serviço financeiro",
    "011001": "Planos de assistência funerária",
    "011002": "Planos de assistência à saúde",
    "011003": "Intermediação de planos de assistência à saúde",
    "011004": "Concursos e prognósticos",
    "011005": "Planos de assistência à saúde de animais domésticos",
    "200001": "Serviços de transporte de bens até zonas de processamento de exportação",
    "200002": "Fornecimento ou importação para produtor rural não contribuinte ou TAC",
    "200003": "Vendas de produtos destinados à alimentação humana (Anexo I)",
    "200004": "Fornecimento de dispositivos médicos (Anexo XII)",
    "200005": "Fornecimento de dispositivos médicos para órgãos da administração pública",
    "200006": "Situação de emergência de saúde pública reconhecida pelo Poder público",
    "200007": "Fornecimento de dispositivos de acessibilidade para pessoas com deficiência (Anexo XIII)",
    "200008": "Fornecimento de dispositivos de acessibilidade adquiridos por órgãos públicos",
    "200009": "Fornecimento dos medicamentos registrados na Anvisa",
    "200010": "Fornecimento dos medicamentos registrados na Anvisa — órgãos públicos",
    "200011": "Fornecimento das composições para nutrição enteral e parenteral — órgãos públicos",
    "200012": "Situação de emergência de saúde pública (específico)",
    "200013": "Fornecimento de tampões higiênicos e absorventes higiênicos",
    "200014": "Fornecimento dos produtos hortícolas, frutas e ovos (Anexo XV)",
    "200015": "Venda de automóveis nacionais adquiridos por motoristas profissionais",
    "200016": "Prestação de serviços de pesquisa e desenvolvimento por ICT",
    "200017": "Operações relacionadas ao FGTS",
    "200018": "Operações de resseguro e retrocessão",
    "200019": "Importador dos serviços financeiros contribuinte",
    "200020": "Operação por sociedades cooperativas optantes por regime específico",
    "200021": "Serviços de transporte público coletivo ferroviário e hidroviário",
    "200022": "Operação originada fora da ZFM destinando bem a contribuinte na ZFM",
    "200023": "Indústria incentivada — bem intermediário para outra indústria incentivada na ZFM",
    "200024": "Operação originada fora das Áreas de Livre Comércio — destinada a contribuinte nas ALCs",
    "200025": "Fornecimento de serviços de educação — Programa Prouni",
    "200026": "Locação de imóveis em zonas reabilitadas",
    "200027": "Operações de locação, cessão onerosa e arrendamento de bens imóveis",
    "200028": "Fornecimento dos serviços de educação (Anexo II)",
    "200029": "Fornecimento dos serviços de saúde humana (Anexo III)",
    "200030": "Venda dos dispositivos médicos (Anexo IV)",
    "200031": "Fornecimento dos dispositivos de acessibilidade para PCD (Anexo V)",
    "200032": "Fornecimento dos medicamentos Anvisa ou farmácias de manipulação (Anexo VI)",
    "200033": "Fornecimento das composições para nutrição enteral e parenteral (Anexo VI)",
    "200034": "Fornecimento dos alimentos destinados ao consumo humano (Anexo VII)",
    "200035": "Fornecimento dos produtos de higiene pessoal e limpeza (Anexo VIII)",
    "200036": "Fornecimento de produtos agropecuários, aquícolas, pesqueiros, florestais e extrativistas vegetais",
    "200037": "Fornecimento de serviços ambientais de conservação ou recuperação da vegetação nativa",
    "200038": "Fornecimento dos insumos agropecuários e aquícolas (Anexo IX)",
    "200039": "Fornecimento de bens e serviços — produções artísticas, culturais e eventos",
    "200040": "Fornecimento de serviços de comunicação institucional à administração pública",
    "200041": "Fornecimento de serviço de educação desportiva (art. 141, I)",
    "200042": "Fornecimento de serviço de gestão e exploração do desporto (art. 141, II)",
    "200043": "Fornecimento à administração pública — bens relativos à soberania (Anexo XI)",
    "200044": "Operações de segurança da informação e cibernética — sociedade brasileira",
    "200045": "Projetos de reabilitação urbana de zonas históricas e áreas críticas",
    "200046": "Operações com bens imóveis",
    "200047": "Bares e Restaurantes",
    "200048": "Hotelaria, Parques de Diversão e Parques Temáticos",
    "200049": "Transporte coletivo de passageiros rodoviário, ferroviário e hidroviário",
    "200050": "Serviços de transporte aéreo regional coletivo de passageiros ou de carga",
    "200051": "Agências de Turismo",
    "200052": "Prestação de serviços de profissões intelectuais",
    "200053": "Fornecimento de medicamentos classificados como soros ou vacinas",
    "200054": "Fornecimento de bem pela cooperativa agropecuária a associado não sujeito ao regime geral",
    "220001": "Incorporação imobiliária — regime especial de tributação",
    "400001": "Isenção — prevista na LC 214/2025",
    "410001": "Imunidade — prevista na Constituição Federal",
    "410010": "Não incidência — exportações de bens e serviços",
    "410020": "Imunidade — templos religiosos",
    "410021": "Imunidade — partidos políticos",
    "410999": "Não incidência — outros",
    "510001": "Diferimento integral do IBS e CBS",
    "510010": "Diferimento — operação com insumos agropecuários",
    "515001": "Diferimento com redução de alíquota",
    "550001": "Suspensão — exportação temporária",
    "620001": "Tributação monofásica — combustíveis",
    "620002": "Tributação monofásica — energia elétrica",
    "620003": "Tributação monofásica — telecomunicações",
    "620004": "Tributação monofásica — medicamentos",
    "620005": "Tributação monofásica — veículos",
    "620006": "Tributação monofásica — outros produtos",
    "800001": "Transferência de crédito",
    "810001": "Ajustes de IBS na Zona Franca de Manaus",
    "820001": "Regime específico — Simples Nacional",
    "820002": "Regime específico — produtor rural",
    "820003": "Regime específico — microempreendedor individual",
    "820006": "Regime específico — cooperativas",
    "830001": "Exclusão de base de cálculo — LC 214/2025",
  };
  return map[code] || `Classificação tributária IBS/CBS — código ${code} (consulte tabela oficial SVRS)`;
}

function mapCSTIbsCbs(cst: string): string {
  const map: Record<string, string> = {
    "000": "Tributação integral",
    "010": "Tributação integral com crédito presumido",
    "011": "Tributação integral com crédito presumido (específico)",
    "200": "Alíquota reduzida (inclusive zero)",
    "220": "Alíquota fixa",
    "221": "Alíquota fixa proporcional",
    "222": "Redução de base de cálculo",
    "400": "Isenção",
    "410": "Imunidade e não incidência",
    "510": "Diferimento",
    "515": "Diferimento com redução de alíquota",
    "550": "Suspensão",
    "620": "Tributação monofásica",
    "800": "Transferência de crédito",
    "810": "Ajustes de IBS na ZFM",
    "811": "Ajustes",
    "820": "Tributação em declaração de regime específico",
    "830": "Exclusão de base de cálculo",
  };
  return map[cst] || `CST IBS/CBS ${cst}`;
}

function getCfopDescricao(cfop: string): string {
  const map: Record<string, string> = {
    "1102": "Compra para comercialização (mesmo estado)",
    "1101": "Compra para industrialização (mesmo estado)",
    "1202": "Devolução de venda (mesmo estado)",
    "1403": "Compra para comercialização em operação com ST",
    "1556": "Compra de material de uso ou consumo",
    "2102": "Compra para comercialização (outro estado)",
    "2101": "Compra para industrialização (outro estado)",
    "2202": "Devolução de venda (outro estado)",
    "3102": "Compra para comercialização (exterior)",
    "5102": "Venda de mercadoria adquirida de terceiros (mesmo estado)",
    "5101": "Venda de produção própria (mesmo estado)",
    "5104": "Venda fora do estabelecimento (mesmo estado)",
    "5110": "Venda para Zona Franca de Manaus (mesmo estado)",
    "5152": "Transferência para comercialização (mesmo estado)",
    "5202": "Devolução de compra (mesmo estado)",
    "5405": "Venda de mercadoria com ST (mesmo estado)",
    "5410": "Venda de produção própria com ST (mesmo estado)",
    "5910": "Remessa em bonificação/doação/brinde",
    "5902": "Remessa para armazenagem",
    "5408": "Transferência de mercadoria sujeita ao regime de ST",
    "6102": "Venda de mercadoria adquirida de terceiros (outro estado)",
    "6101": "Venda de produção própria (outro estado)",
    "6104": "Venda fora do estabelecimento (outro estado)",
    "6108": "Venda para não contribuinte (outro estado)",
    "6110": "Venda para Zona Franca de Manaus (outro estado)",
    "6202": "Devolução de compra (outro estado)",
    "6405": "Venda com ST (outro estado)",
    "6910": "Remessa em bonificação/doação/brinde (outro estado)",
    "7102": "Venda de mercadoria para o exterior",
    "7101": "Venda de produção própria para o exterior",
  };
  return map[cfop] || `Operação CFOP ${cfop}`;
}

function getCfopEspelho(cfop: string): string | null {
  const espelhos: Record<string, string> = {
    "5102": "1102", "1102": "5102",
    "5101": "1101", "1101": "5101",
    "5202": "1202", "1202": "5202",
    "6102": "2102", "2102": "6102",
    "6101": "2101", "2101": "6101",
    "6202": "2202", "2202": "6202",
    "7102": "3102", "3102": "7102",
    "5405": "1403", "1403": "5405",
  };
  return espelhos[cfop] || null;
}

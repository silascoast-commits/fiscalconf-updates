// ═══════════════════════════════════════════════════════════════════════════
// CONFERÊNCIA DE cClassTrib EM DOCUMENTOS FISCAIS (NF-e importadas)
// Compara o CST/cClassTrib informado em cada item com o enquadramento esperado
// pela tabela oficial (SVRS) + base complementar.
// ═══════════════════════════════════════════════════════════════════════════
import type { BaseOficial } from "./cffOficial";
import { consultarReforma, CCLASSTRIB_POR_CONDICAO, type ResultadoReforma } from "./reformaTributaria";

export type StatusConformidade =
  | "ok"
  | "sem_cclasstrib"
  | "vedado"
  | "beneficio_nao_aplicado"
  | "beneficio_indevido"
  | "divergente"
  | "verificar"
  | "ncm_invalido";

export type Gravidade = "alta" | "media" | "baixa" | "nenhuma";

export interface ItemDocumento {
  ncm: string;
  descricao?: string;
  cClassTrib?: string;
  cstIbsCbs?: string;
  vTotal?: number;
}

export interface ResultadoConformidade {
  status: StatusConformidade;
  gravidade: Gravidade;
  mensagem: string;
  informado: { cst: string; cClassTrib: string };
  esperado: { cst: string; cClassTrib: string; tratamento: string; reducao: number; fonte: string };
  aceitos: string[];
}

export const STATUS_LABEL: Record<StatusConformidade, string> = {
  ok: "Conforme",
  sem_cclasstrib: "Sem cClassTrib",
  vedado: "cClassTrib vedado",
  beneficio_nao_aplicado: "Benefício não aplicado",
  beneficio_indevido: "Benefício indevido",
  divergente: "Divergente",
  verificar: "Verificar condição",
  ncm_invalido: "NCM inválido",
};

const temReducao = (cst: string) => ["200", "400", "410", "515"].includes(cst);

export function conferirItem(item: ItemDocumento, base: BaseOficial | null, tipoNota: "entrada" | "saida" = "entrada", data?: string): ResultadoConformidade {
  const ncm = (item.ncm || "").replace(/\D/g, "");
  const informado = { cst: (item.cstIbsCbs || "").trim(), cClassTrib: (item.cClassTrib || "").trim() };
  const r: ResultadoReforma = consultarReforma(ncm, "NCM", base, data);
  const esperado = {
    cst: r.regra.cst, cClassTrib: r.regra.cClassTrib, tratamento: r.descricaoTratamento,
    reducao: r.regra.reducao, fonte: r.fonte,
  };
  const aceitos = [r.regra.cClassTrib, ...(r.regra.alternativas || []).map(a => a.cClassTrib)];
  const out = (status: StatusConformidade, gravidade: Gravidade, mensagem: string): ResultadoConformidade =>
    ({ status, gravidade, mensagem, informado, esperado, aceitos });
  const lado = tipoNota === "entrada" ? "fornecedor" : "emissão própria";

  if (ncm.length !== 8) return out("ncm_invalido", "media", "NCM ausente ou com menos de 8 dígitos — não é possível conferir o enquadramento.");

  if (!informado.cClassTrib) {
    return out("sem_cclasstrib", tipoNota === "saida" ? "alta" : "media",
      `Item sem grupo IBS/CBS (CST/cClassTrib). Esperado: ${esperado.cClassTrib} (${esperado.tratamento}). ` +
      (tipoNota === "saida"
        ? "Desde 2026 o preenchimento é obrigatório e condiciona a dispensa de recolhimento do ano-teste."
        : "Solicite ao fornecedor a correção: sem o destaque não há crédito de IBS/CBS a partir de 2027."));
  }

  if (r.vedados.some(v => v.cClassTrib === informado.cClassTrib)) {
    const v = r.vedados.find(x => x.cClassTrib === informado.cClassTrib)!;
    return out("vedado", "alta",
      `A tabela oficial VEDA o cClassTrib ${informado.cClassTrib} para este NCM${v.excecao ? ` (${v.excecao})` : ""}. Esperado: ${esperado.cClassTrib} (${esperado.tratamento}).`);
  }

  if (informado.cst && informado.cst !== informado.cClassTrib.slice(0, 3)) {
    return out("divergente", "media", `CST ${informado.cst} incompatível com o cClassTrib ${informado.cClassTrib} (deveria ser ${informado.cClassTrib.slice(0, 3)}).`);
  }

  if (informado.cClassTrib === esperado.cClassTrib) {
    const cond = (r.regra.condicoes || [])[0];
    return out("ok", "nenhuma", `Enquadramento conforme a ${r.fonte === "oficial" ? "tabela oficial" : "base"}${cond ? ` — ${cond}` : ""}.`);
  }

  const infReduz = temReducao(informado.cClassTrib.slice(0, 3));
  const espReduz = temReducao(esperado.cst) && esperado.reducao > 0;

  if (!infReduz && espReduz) {
    return out("beneficio_nao_aplicado", tipoNota === "saida" ? "alta" : "media",
      `Item tributado integralmente (${informado.cClassTrib}), mas o NCM tem ${esperado.tratamento} (${esperado.cClassTrib}). ` +
      (tipoNota === "saida" ? "A empresa está cobrando IBS/CBS a maior do cliente" : "O fornecedor está destacando IBS/CBS a maior — custo maior na aquisição") +
      " — salvo se o produto não corresponder à descrição do item do anexo.");
  }

  if (aceitos.includes(informado.cClassTrib)) {
    return out("verificar", "baixa",
      `cClassTrib ${informado.cClassTrib} é admitido para este NCM em situação específica (${(r.regra.alternativas || []).find(a => a.cClassTrib === informado.cClassTrib)?.quando || "conferir condição"}). Confirme se a condição se aplica à operação.`);
  }

  if (infReduz && !espReduz && !CCLASSTRIB_POR_CONDICAO.has(informado.cClassTrib)) {
    return out("beneficio_indevido", "alta",
      `cClassTrib ${informado.cClassTrib} indica redução/não incidência, mas a base não prevê benefício para este NCM (esperado ${esperado.cClassTrib}). ` +
      (tipoNota === "entrada" ? "Risco de crédito destacado a menor e de questionamento do enquadramento do fornecedor." : "Risco de recolhimento a menor e autuação."));
  }
  if (CCLASSTRIB_POR_CONDICAO.has(informado.cClassTrib)) {
    return out("verificar", "media", `cClassTrib ${informado.cClassTrib} depende de condição do adquirente/prestador (órgão público, autônomo, diferimento etc.). Confirme a condição na operação (${lado}).`);
  }
  return out("divergente", "media",
    `cClassTrib informado (${informado.cClassTrib}) difere do esperado (${esperado.cClassTrib} — ${esperado.tratamento}).`);
}

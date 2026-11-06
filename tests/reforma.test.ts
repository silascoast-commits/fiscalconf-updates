// Testes do motor da Reforma Tributária — execute com: npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import baseJson from "../shared/data/cff-oficial.json";
import type { BaseOficial } from "../shared/cffOficial";
import { extrairDadosSvrs, compactarBase, vinculosDoCodigo } from "../shared/cffOficial";
import { consultarReforma, cronogramaTransicao, tratamentoPorCst, buscarPorDescricao, detectarTipo, formatarNbs } from "../shared/reformaTributaria";
import { conferirItem } from "../shared/conformidade";
import { simularOperacao } from "../shared/simulacao";
import { mesclarConfiguracoes, CONFIG_PADRAO } from "../shared/configuracoes";

const base = baseJson as unknown as BaseOficial;
const ncm = (c: string) => consultarReforma(c, "NCM", base);
const nbs = (c: string) => consultarReforma(c, "NBS", base);
const alts = (r: ReturnType<typeof ncm>) => (r.regra.alternativas || []).map(a => a.cClassTrib);
const REF = { cbs: 8.8, ibs: 17.7 };

describe("base oficial (SVRS)", () => {
  test("carrega a tabela com classificações e vínculos", () => {
    assert.ok(Object.keys(base.classificacoes).length >= 170);
    assert.ok(base.vinculos.length >= 4000);
    assert.equal(base.classificacoes["200003"].redIbs, 100);
    assert.equal(base.classificacoes["200052"].redCbs, 30);
    assert.equal(base.classificacoes["410008"].cst, "410");
  });
  test("extrai e compacta a página HTML do SVRS", () => {
    const html = `<script>var dadosOriginais = [{"Cst":"200","NomeCst":"Alíquota reduzida","ClassificacoesTributarias":[{"CodClassTrib":"200003","NomeClassTrib":"Cesta [teste] \\"básica\\"","Cst":"200","PercRedIbs":100,"PercRedCbs":100,"DthIniVig":"2025-01-01T00:00:00","IndNfe":true,"Anexos":[{"CodNcmNbs":"10063021","TipoCodigo":"NCM","TipoPermissao":"PERMITIDO","DescCondicao":"X","DthIniVig":"2026-01-01T00:00:00"}]}]}];\nvar outra = 1;</script>`;
    const b = compactarBase(extrairDadosSvrs(html));
    assert.equal(b.classificacoes["200003"].nome, 'Cesta [teste] "básica"');
    assert.deepEqual(b.classificacoes["200003"].documentos, ["NF-e"]);
    assert.equal(vinculosDoCodigo(b, "10063021", "NCM", "2026-06-01")[0].condicao, "X");
    assert.equal(vinculosDoCodigo(b, "10063021", "NCM", "2025-06-01").length, 0, "vínculo fora da vigência");
  });
  test("ignora cClassTrib com vigência encerrada", () => {
    assert.equal(base.classificacoes["220001"].fimVigencia, "2026-01-01");
  });
});

describe("enquadramento de produtos (NCM)", () => {
  test("arroz → Cesta Básica, alíquota zero; Anexo VII vedado", () => {
    const r = ncm("1006.30.21");
    assert.equal(r.fonte, "oficial");
    assert.equal(r.regra.cClassTrib, "200003");
    assert.equal(r.regra.tratamento, "reducao_100");
    assert.ok(r.vedados.some(v => v.cClassTrib === "200034"));
  });
  test("carne bovina → 200003", () => assert.equal(ncm("02013000").regra.cClassTrib, "200003"));
  test("salmão → não é Cesta Básica (vedado) nem recebe sugestão sem respaldo oficial", () => {
    const r = ncm("03021400");
    assert.notEqual(r.regra.cClassTrib, "200003");
    assert.ok(r.vedados.some(v => v.cClassTrib === "200003"));
    assert.ok(!alts(r).includes("200034"));
  });
  test("tomate → hortícolas, alíquota zero (Anexo XV)", () => assert.equal(ncm("07020000").regra.cClassTrib, "200014"));
  test("mel → alimentos Anexo VII, redução de 60%", () => {
    const r = ncm("04090000");
    assert.equal(r.regra.cClassTrib, "200034");
    assert.equal(r.regra.reducao, 60);
  });
  test("pão francês: zero apenas se corresponder ao item; alternativa integral", () => {
    const r = ncm("19059090");
    assert.equal(r.regra.cClassTrib, "200003");
    assert.ok(alts(r).includes("000001"));
  });
  test("fertilizante → insumo agropecuário 200038 com diferimento 515001 como alternativa", () => {
    const r = ncm("31021010");
    assert.equal(r.regra.cClassTrib, "200038");
    assert.ok(alts(r).includes("515001"));
  });
  test("absorvente → 200013 (zero) e fraldas 200035 como alternativa", () => {
    const r = ncm("96190000");
    assert.equal(r.regra.cClassTrib, "200013");
    assert.ok(alts(r).includes("200035"));
  });
  test("alternativas não se repetem", () => {
    for (const c of ["10063021", "96190000", "31021010", "30049099"]) {
      const a = alts(ncm(c));
      assert.equal(a.length, new Set(a).size, c);
    }
  });
  test("medicamento de uso humano → 200032 (60%), itens oficiais como alternativas", () => {
    const r = ncm("30049099");
    assert.equal(r.regra.cClassTrib, "200032");
    assert.equal(r.fonte, "complementar");
    assert.ok(alts(r).includes("200009"));
    assert.ok(alts(r).includes("200030"));
  });
  test("gasolina → monofásico 620001", () => assert.equal(ncm("27101259").regra.cClassTrib, "620001"));
  test("livro → imunidade 410008 (não 410001, que é bonificação)", () => {
    const r = ncm("49019900");
    assert.equal(r.regra.cClassTrib, "410008");
    assert.equal(r.regra.tratamento, "imunidade");
  });
  test("notebook → regra geral 000001", () => {
    const r = ncm("84713012");
    assert.equal(r.fonte, "regra_geral");
    assert.equal(r.regra.cClassTrib, "000001");
    assert.equal(r.is, null);
  });
  test("código incompleto lista subregras e alerta", () => {
    const r = ncm("0406");
    assert.equal(r.valido, false);
    assert.ok(r.subregras.length > 0);
    assert.match(r.alertas[0], /incompleto/);
  });
});

describe("Imposto Seletivo", () => {
  test("cerveja → IS bebidas alcoólicas, IBS/CBS integral", () => {
    const r = ncm("22030000");
    assert.equal(r.is?.categoria, "Bebidas alcoólicas");
    assert.equal(r.regra.cClassTrib, "000001");
  });
  test("refrigerante com açúcar → IS bebidas açucaradas", () => assert.equal(ncm("22021000").is?.categoria, "Bebidas açucaradas"));
  test("automóvel → IS veículos e alternativa PcD/taxista", () => {
    const r = ncm("87032310");
    assert.equal(r.is?.categoria, "Veículos");
    assert.ok(alts(r).includes("200015"));
  });
  test("minério de ferro → IS bens minerais", () => assert.equal(ncm("26011100").is?.categoria, "Bens minerais"));
  test("etanol (2207) não é bebida alcoólica para o IS", () => assert.equal(ncm("22071019").is, null));
});

describe("enquadramento de serviços (NBS)", () => {
  test("serviço contábil/jurídico → profissões intelectuais 200052 (30%)", () => {
    const r = nbs("1.1301.10.00");
    assert.equal(r.fonte, "oficial");
    assert.equal(r.regra.cClassTrib, "200052");
    assert.ok(alts(r).includes("200056"));
  });
  test("hospedagem em hotel → 200048 (40%) pela tabela oficial", () => {
    const r = nbs("103031100");
    assert.equal(r.regra.cClassTrib, "200048");
    assert.equal(r.regra.reducao, 40);
  });
  test("serviços financeiros → documento específico 820007", () => assert.equal(nbs("109011000").regra.cClassTrib, "820007"));
  test("educação → 200028 (60%) pela base complementar", () => {
    const r = nbs("122011000");
    assert.equal(r.regra.cClassTrib, "200028");
    assert.equal(r.fonte, "complementar");
  });
  test("pedágio → exploração de via 000002", () => assert.equal(nbs("106042100").regra.cClassTrib, "000002"));
  test("detecção automática NCM × NBS", () => {
    assert.equal(detectarTipo("1.2201.10.00"), "NBS");
    assert.equal(detectarTipo("122011000"), "NBS");
    assert.equal(detectarTipo("2203.00.00"), "NCM");
    assert.equal(formatarNbs("122011000"), "1.2201.10.00");
  });
  test("busca pela lista da LC 116", () => {
    const r = buscarPorDescricao("contábil", "NBS", base);
    assert.ok(r.some(x => x.origem === "lc116" && x.codigo === "113"));
  });
  test("busca por descrição nos itens oficiais", () => {
    const r = buscarPorDescricao("pão francês", "NCM", base);
    assert.ok(r.some(x => x.origem === "oficial" && x.codigo === "19059090"));
  });
});

describe("cronograma de transição", () => {
  test("redução de 60% em 2033 = 40% da referência", () => {
    const c = cronogramaTransicao(60, "reducao_60", "NCM", REF);
    assert.equal(c.at(-1)!.total, 10.6);
    assert.equal(c[0].ano, 2026);
    assert.equal(c[0].total, 0.4);
  });
  test("2027: CBS reduzida em 0,1 p.p. e IBS 0,1%", () => {
    const l = cronogramaTransicao(0, "integral", "NCM", REF).find(x => x.ano === 2027)!;
    assert.equal(l.cbs, 8.7);
    assert.equal(l.ibs, 0.1);
  });
  test("Prouni: redução diferente para IBS (60%) e CBS (100%)", () => {
    const l = cronogramaTransicao(60, "reducao_60", "NBS", REF, 100).at(-1)!;
    assert.equal(l.cbs, 0);
    assert.equal(l.ibs, 7.08);
  });
  test("imunidade zera tudo", () => assert.equal(cronogramaTransicao(0, "imunidade", "NCM", REF).at(-1)!.total, 0));
  test("tratamento por CST", () => {
    assert.equal(tratamentoPorCst("200", 100), "reducao_100");
    assert.equal(tratamentoPorCst("200", 80), "reducao_80");
    assert.equal(tratamentoPorCst("410", 0), "imunidade");
    assert.equal(tratamentoPorCst("515", 60), "diferimento");
    assert.equal(tratamentoPorCst("820", 0), "especifico");
  });
});

describe("conferência de cClassTrib em NF-e", () => {
  test("arroz com 200003 → conforme", () => assert.equal(conferirItem({ ncm: "10063021", cClassTrib: "200003", cstIbsCbs: "200" }, base).status, "ok"));
  test("arroz com 200034 → vedado", () => {
    const c = conferirItem({ ncm: "10063021", cClassTrib: "200034", cstIbsCbs: "200" }, base);
    assert.equal(c.status, "vedado");
    assert.equal(c.gravidade, "alta");
  });
  test("arroz tributado integral → benefício não aplicado", () => assert.equal(conferirItem({ ncm: "10063021", cClassTrib: "000001", cstIbsCbs: "000" }, base, "saida").status, "beneficio_nao_aplicado"));
  test("notebook com cesta básica → benefício indevido", () => assert.equal(conferirItem({ ncm: "84713012", cClassTrib: "200003", cstIbsCbs: "200" }, base).status, "beneficio_indevido"));
  test("item sem grupo IBS/CBS", () => assert.equal(conferirItem({ ncm: "84713012" }, base, "saida").status, "sem_cclasstrib"));
  test("CST incompatível com cClassTrib", () => assert.equal(conferirItem({ ncm: "84713012", cClassTrib: "000001", cstIbsCbs: "200" }, base).status, "divergente"));
  test("alternativa condicionada (diferimento) → verificar", () => assert.equal(conferirItem({ ncm: "31021010", cClassTrib: "515001", cstIbsCbs: "515" }, base).status, "verificar"));
  test("NCM inválido", () => assert.equal(conferirItem({ ncm: "123", cClassTrib: "000001" }, base).status, "ncm_invalido"));
});

describe("simulação de operação", () => {
  const params = { valor: 1000, ano: 2033, destino: "mercado_interno" as const, regimeVendedor: "regular" as const, adquirente: "contribuinte" as const, aliquotaDasIbsCbs: 0, aliquotaIS: 0, ref: REF };
  test("integral 2033: 26,5% e crédito integral ao contribuinte", () => {
    const s = simularOperacao(ncm("84713012"), params);
    assert.equal(s.totalTributos, 265);
    assert.equal(s.creditoAdquirente, 265);
    assert.equal(s.custoLiquidoAdquirente, 1000);
  });
  test("consumidor final não tem crédito", () => assert.equal(simularOperacao(ncm("84713012"), { ...params, adquirente: "consumidor_final" }).creditoAdquirente, 0));
  test("exportação → não incidência 410004", () => {
    const s = simularOperacao(ncm("84713012"), { ...params, destino: "exportacao" });
    assert.equal(s.cClassTrib, "410004");
    assert.equal(s.totalTributos, 0);
  });
  test("ZFM → 200022 alíquota zero", () => {
    const s = simularOperacao(ncm("84713012"), { ...params, destino: "zfm" });
    assert.equal(s.cClassTrib, "200022");
    assert.equal(s.valorIbs + s.valorCbs, 0);
  });
  test("IS integra a base de cálculo do IBS/CBS", () => {
    const s = simularOperacao(ncm("22030000"), { ...params, aliquotaIS: 10 });
    assert.equal(s.valorIS, 100);
    assert.equal(s.baseCalculo, 1100);
    assert.equal(s.valorIbs + s.valorCbs, 291.5);
  });
  test("IS não incide antes de 2027", () => assert.equal(simularOperacao(ncm("22030000"), { ...params, ano: 2026, aliquotaIS: 10 }).valorIS, 0));
  test("Simples no DAS: crédito limitado ao valor do DAS", () => {
    const s = simularOperacao(ncm("84713012"), { ...params, regimeVendedor: "simples_das", aliquotaDasIbsCbs: 4 });
    assert.equal(s.creditoAdquirente, 40);
    const fora = s.comparativo.find(c => c.regime === "simples_fora")!;
    assert.equal(fora.credito, 265);
  });
  test("combustível não é simulado por alíquota percentual", () => assert.equal(simularOperacao(ncm("27101259"), params).aplicavel, false));
});

describe("configurações", () => {
  test("respeita o teto legal de 0,25% do IS sobre minerais", () => {
    assert.equal(mesclarConfiguracoes({ premissasIS: { minerais: 5 } }).premissasIS.minerais, 0.25);
  });
  test("valores inválidos voltam ao padrão", () => {
    const c = mesclarConfiguracoes({ aliquotaReferenciaCbs: -1 as any, aliquotaReferenciaIbs: "x" as any });
    assert.equal(c.aliquotaReferenciaCbs, CONFIG_PADRAO.aliquotaReferenciaCbs);
    assert.equal(c.aliquotaReferenciaIbs, CONFIG_PADRAO.aliquotaReferenciaIbs);
  });
});

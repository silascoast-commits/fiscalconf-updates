// Ponto de entrada do bundle da página standalone: motor + base oficial embutida.
import base from "../../server/data/base-fiscal.json";
import { Classificador, lerLista, analisarOperacao, chaveProduto, formatarNcm } from "../../shared/classificador/motor";
(window as any).Classif = { classificador: new Classificador(base as any), base, lerLista, analisarOperacao, chaveProduto, formatarNcm };

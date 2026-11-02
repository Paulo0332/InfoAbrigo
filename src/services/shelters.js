import { gravarLista, lerRegistros } from './bancoLocal';
import { avisarMudanca, garantirAtualizado } from './sincronizacao';

const COLECAO = 'abrigos';

const RAIO_TERRA_KM = 6371;

export async function carregarAbrigos() {
  try {
    await garantirAtualizado();

    return await lerRegistros(COLECAO);
  } catch (error) {
    console.log('Erro ao carregar os abrigos:', error);

    throw error;
  }
}

// O que já está no aparelho, sem esperar o servidor. É o que o mapa desenha
// primeiro: a lista nova, quando chega, só redesenha se algo tiver mudado.
export function carregarAbrigosDoAparelho() {
  return lerRegistros(COLECAO);
}

// Cadastra um abrigo e devolve a lista já atualizada, para a tela não
// precisar ler de novo em seguida.
export async function cadastrarAbrigo(abrigo) {
  try {
    const atuais = await lerRegistros(COLECAO);
    const nova = [abrigo, ...atuais];

    await gravarLista(COLECAO, nova);
    avisarMudanca();

    return nova;
  } catch (error) {
    console.log('Erro ao cadastrar o abrigo:', error);

    throw error;
  }
}

// Troca o abrigo de mesmo id pela versão nova. O map percorre a lista
// inteira e devolve outra do mesmo tamanho, como o toggleNeed do Módulo 1.
export async function atualizarAbrigo(abrigo) {
  try {
    const atuais = await lerRegistros(COLECAO);

    const nova = atuais.map((item) => {
      if (item.id === abrigo.id) {
        return abrigo;
      }

      return item;
    });

    await gravarLista(COLECAO, nova);
    avisarMudanca();

    return nova;
  } catch (error) {
    console.log('Erro ao atualizar o abrigo:', error);

    throw error;
  }
}

export async function apagarAbrigo(id) {
  try {
    const atuais = await lerRegistros(COLECAO);
    const nova = atuais.filter((abrigo) => abrigo.id !== id);

    await gravarLista(COLECAO, nova);
    avisarMudanca();

    return nova;
  } catch (error) {
    console.log('Erro ao apagar o abrigo:', error);

    throw error;
  }
}

// De quem é o abrigo. A comparação ignora maiúscula e espaço nas pontas:
// o e-mail é digitado à mão no cadastro da conta, e "Josue@x.com" e
// "josue@x.com" são a mesma pessoa em qualquer serviço de e-mail. Sem
// isso, uma diferença de maiúscula fazia o abrigo parecer de outro dono.
export function ehDono(abrigo, conta) {
  if (abrigo == null || conta == null) {
    return false;
  }

  const dono = (abrigo.dono || '').trim().toLowerCase();
  const email = (conta.email || '').trim().toLowerCase();

  return dono !== '' && dono === email;
}

export function abrigosDaConta(lista, conta) {
  return lista.filter((abrigo) => ehDono(abrigo, conta));
}

function grausParaRadianos(graus) {
  return (graus * Math.PI) / 180;
}

// Fórmula de haversine: a distância em linha reta entre dois pontos da
// superfície da Terra. Não dá para subtrair latitudes e chamar de
// distância, porque um grau de longitude vale 111 km no equador e quase
// nada perto dos polos — o Math.cos no meio da conta é esse ajuste.
export function calcularDistancia(latitudeA, longitudeA, latitudeB, longitudeB) {
  const deltaLatitude = grausParaRadianos(latitudeB - latitudeA);
  const deltaLongitude = grausParaRadianos(longitudeB - longitudeA);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(grausParaRadianos(latitudeA)) *
      Math.cos(grausParaRadianos(latitudeB)) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  return RAIO_TERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Traça a rota até o abrigo dentro do próprio aplicativo, em vez de jogar
// a pessoa no mapa do celular.
//
// Quem calcula é o Valhalla mantido pela FOSSGIS, o mesmo serviço aberto
// que o site do OpenStreetMap usa. Não pede chave, entende português e,
// principalmente, sabe traçar a pé de verdade: o caminho de carro e o
// caminho a pé entre os mesmos dois pontos dão rotas e tempos bem
// diferentes, e para quem vai levar uma doação isso importa.
//
// O OSRM público foi a primeira tentativa e ficou pelo caminho: aquele
// servidor só tem o perfil de carro instalado, então pedir "a pé"
// devolvia exatamente a rota de carro, com o mesmo tempo. Seria uma
// opção de mentira na tela.
//
// O limite honesto: é um serviço de demonstração, gratuito e sem
// garantia. Quando ele não responder, a tela continua oferecendo abrir o
// mapa do celular, que é também onde se faz navegação com voz — isso o
// aplicativo não faz e não promete.

const URL_ROTA = 'https://valhalla1.openstreetmap.de/route';

export const MODOS = [
  { id: 'auto', nome: 'De carro', icone: 'car' },
  { id: 'pedestrian', nome: 'A pé', icone: 'walk' },
  { id: 'bicycle', nome: 'De bike', icone: 'bicycle' },
];

// A linha da rota vem como um texto comprimido, não como uma lista de
// coordenadas: cada ponto é guardado como a diferença para o anterior, e
// essa diferença é escrita em pedaços de cinco bits somados a 63, para
// caírem todos em caracteres imprimíveis. Descompactar é desfazer isso.
//
// O divisor é um milhão porque o Valhalla guarda seis casas decimais.
const PRECISAO = 1000000;

function lerNumero(texto, inicio) {
  let indice = inicio;
  let resultado = 0;
  let deslocamento = 0;
  let pedaco = 0;

  do {
    pedaco = texto.charCodeAt(indice) - 63;
    indice = indice + 1;

    resultado = resultado | ((pedaco & 0x1f) << deslocamento);
    deslocamento = deslocamento + 5;
  } while (pedaco >= 0x20);

  // O último bit diz se o número é negativo.
  const valor = resultado & 1 ? ~(resultado >> 1) : resultado >> 1;

  return { valor: valor, indice: indice };
}

export function decodificarForma(texto) {
  const pontos = [];
  let indice = 0;
  let latitude = 0;
  let longitude = 0;

  while (indice < texto.length) {
    const lat = lerNumero(texto, indice);

    latitude = latitude + lat.valor;

    const lon = lerNumero(texto, lat.indice);

    longitude = longitude + lon.valor;
    indice = lon.indice;

    pontos.push([latitude / PRECISAO, longitude / PRECISAO]);
  }

  return pontos;
}

// Minutos viram o jeito que as pessoas falam: "12 min", "1 h 20 min".
export function formatarDuracao(minutos) {
  const total = Math.round(minutos);

  if (total < 60) {
    return total + ' min';
  }

  const horas = Math.floor(total / 60);
  const resto = total % 60;

  return resto === 0 ? horas + ' h' : horas + ' h ' + resto + ' min';
}

export function formatarDistancia(quilometros) {
  if (quilometros < 1) {
    return Math.round(quilometros * 1000) + ' m';
  }

  return quilometros.toFixed(1).replace('.', ',') + ' km';
}

// Devolve sempre um objeto com situacao, para a tela decidir o que dizer
// sem precisar tratar exceção.
export async function buscarRota(origem, destino, modo) {
  const pedido = {
    locations: [
      { lat: origem.latitude, lon: origem.longitude },
      { lat: destino.latitude, lon: destino.longitude },
    ],
    costing: modo || 'auto',
    directions_options: { language: 'pt-BR', units: 'kilometers' },
  };

  try {
    const resposta = await fetch(URL_ROTA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'InfoAbrigo-Academico/1.0',
      },
      body: JSON.stringify(pedido),
    });

    // O serviço recusa com 400 quando não existe caminho, quando o ponto
    // cai longe demais de qualquer via e quando a distância passa do
    // limite dele. Isso é diferente de estar fora do ar, e a tela precisa
    // dizer coisas diferentes nos dois casos.
    if (!resposta.ok) {
      return { situacao: resposta.status === 400 ? 'sem-caminho' : 'indisponivel' };
    }

    const dados = await resposta.json();
    const viagem = dados.trip;

    if (viagem == null || !viagem.legs || viagem.legs.length === 0) {
      return { situacao: 'sem-caminho' };
    }

    const trecho = viagem.legs[0];

    const passos = (trecho.maneuvers || []).map((manobra, indice) => {
      return {
        id: String(indice),
        instrucao: manobra.instruction || '',
        metros: Math.round((manobra.length || 0) * 1000),
      };
    });

    return {
      situacao: 'encontrada',
      distanciaKm: viagem.summary.length,
      minutos: viagem.summary.time / 60,
      linha: decodificarForma(trecho.shape || ''),
      passos: passos,
    };
  } catch (error) {
    console.log('Erro ao buscar a rota:', error);

    return { situacao: 'indisponivel' };
  }
}

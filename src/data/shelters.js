import { colors } from '../theme/colors';

const RAIO_TERRA_KM = 6371;

// Abrigos fictícios do trabalho. Como ainda não existe servidor, cada um
// guarda um deslocamento em graus em vez de uma coordenada fixa: o mapa
// os posiciona ao redor de quem abriu o aplicativo, então a tela funciona
// em qualquer cidade. Com backend, isto vira uma consulta por região.
const ABRIGOS = [
  {
    id: '1',
    nome: 'Lar Esperança',
    criancas: 24,
    cor: colors.primary,
    deslocamento: { latitude: 0.006, longitude: 0.004 },
  },

  {
    id: '2',
    nome: 'Casa Acolher',
    criancas: 15,
    cor: colors.supportGreen,
    deslocamento: { latitude: -0.005, longitude: 0.008 },
  },

  {
    id: '3',
    nome: 'Instituto Semear',
    criancas: 31,
    cor: colors.supportBlue,
    deslocamento: { latitude: 0.009, longitude: -0.007 },
  },
];

function grausParaRadianos(graus) {
  return (graus * Math.PI) / 180;
}

// Fórmula de haversine: a distância em linha reta entre dois pontos da
// superfície da Terra. É o que preenche o "a 1,2 km" no cartão do abrigo.
function calcularDistancia(latitudeA, longitudeA, latitudeB, longitudeB) {
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

// Recebe as coordenadas do usuário e devolve a lista pronta para o mapa,
// já com a coordenada de cada abrigo e a distância até ele.
export function montarAbrigos(localizacao) {
  return ABRIGOS.map((abrigo) => {
    const latitude = localizacao.latitude + abrigo.deslocamento.latitude;
    const longitude = localizacao.longitude + abrigo.deslocamento.longitude;

    return {
      id: abrigo.id,
      nome: abrigo.nome,
      criancas: abrigo.criancas,
      cor: abrigo.cor,
      latitude: latitude,
      longitude: longitude,
      distancia: calcularDistancia(
        localizacao.latitude,
        localizacao.longitude,
        latitude,
        longitude
      ),
    };
  });
}

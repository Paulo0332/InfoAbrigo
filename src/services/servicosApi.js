import { pedir, temServidor } from './api';
import { usuarioAtual } from './firebase';

// O que o aplicativo pede à API. Os dados do dia a dia ficam no Firebase; aqui está
// o que precisa ser decidido num lugar que o aparelho não controla.
async function comLogin(metodo, caminho, corpo) {
  const usuario = await usuarioAtual();

  if (usuario == null) {
    throw new Error('É preciso entrar na conta.');
  }

  return pedir(metodo, caminho, corpo, await usuario.getIdToken());
}

export const MOTIVOS_DE_DENUNCIA = [
  { id: 'chave-pix-suspeita', nome: 'A chave Pix parece não ser do abrigo' },
  { id: 'abrigo-inexistente', nome: 'Este abrigo não existe' },
  { id: 'dados-errados', nome: 'Endereço ou contatos estão errados' },
  { id: 'outro', nome: 'Outro motivo' },
];

export function apiDisponivel() {
  return temServidor();
}

export function buscarRecomendacoes(localizacao) {
  const posicao = localizacao
    ? '?lat=' + localizacao.latitude + '&lng=' + localizacao.longitude
    : '';

  return comLogin('GET', '/recomendacoes' + posicao);
}

export function denunciarAbrigo(abrigoId, motivo, detalhe) {
  return comLogin('POST', '/denuncias', {
    abrigoId: String(abrigoId),
    motivo: motivo,
    detalhe: detalhe,
  });
}

export function buscarRelatorio(abrigoId) {
  return comLogin('GET', '/abrigos/' + encodeURIComponent(abrigoId) + '/relatorio');
}

export function buscarPlanilha(abrigoId) {
  return comLogin('GET', '/abrigos/' + encodeURIComponent(abrigoId) + '/relatorio?formato=csv');
}

export function buscarDenuncias(abrigoId) {
  return comLogin('GET', '/abrigos/' + encodeURIComponent(abrigoId) + '/denuncias');
}

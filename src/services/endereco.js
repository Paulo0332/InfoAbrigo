// Busca de endereço pelo CEP, usando a consulta pública da BrasilAPI, que
// não pede chave. Além da rua e do bairro, ela devolve as coordenadas —
// e é isso que permite marcar o abrigo no mapa sem a pessoa precisar
// estar fisicamente lá.
//
// Uma ressalva honesta: a coordenada do CEP aponta para a via, não para o
// número exato. Para achar o abrigo no mapa isso basta; para tocar a
// campainha, não.

const URL_CEP = 'https://brasilapi.com.br/api/cep/v2/';

export function apenasDigitos(texto) {
  return (texto || '').replace(/[^0-9]/g, '');
}

export function formatarCep(texto) {
  const d = apenasDigitos(texto).slice(0, 8);

  if (d.length <= 5) {
    return d;
  }

  return d.slice(0, 5) + '-' + d.slice(5);
}

export function cepValido(texto) {
  return apenasDigitos(texto).length === 8;
}

// Devolve sempre um objeto com situacao, para a tela decidir o que dizer
// sem precisar tratar exceção.
export async function buscarCep(texto) {
  const d = apenasDigitos(texto);

  try {
    const resposta = await fetch(URL_CEP + d);

    if (resposta.status === 404) {
      return { situacao: 'inexistente' };
    }

    if (!resposta.ok) {
      return { situacao: 'indisponivel' };
    }

    const dados = await resposta.json();
    const local = dados.location || {};
    const coordenadas = local.coordinates || {};

    // Alguns CEPs vêm sem coordenada. Nesse caso o endereço serve para
    // preencher o texto, mas o ponto no mapa ainda precisa vir do GPS.
    const temPonto =
      coordenadas.latitude != null && coordenadas.longitude != null;

    return {
      situacao: temPonto ? 'encontrado' : 'sem-coordenada',
      cep: formatarCep(d),
      logradouro: dados.street || '',
      bairro: dados.neighborhood || '',
      cidade: dados.city || '',
      uf: dados.state || '',
      latitude: temPonto ? Number(coordenadas.latitude) : null,
      longitude: temPonto ? Number(coordenadas.longitude) : null,
    };
  } catch (error) {
    console.log('Erro ao buscar o CEP:', error);

    return { situacao: 'indisponivel' };
  }
}

// Monta a linha de endereço que aparece no cartão do abrigo.
export function montarEndereco(dados, numero) {
  const partes = [];

  if (dados.logradouro) {
    partes.push(numero ? dados.logradouro + ', ' + numero : dados.logradouro);
  }

  if (dados.bairro) {
    partes.push(dados.bairro);
  }

  if (dados.cidade) {
    partes.push(dados.cidade + (dados.uf ? '/' + dados.uf : ''));
  }

  return partes.join(' • ');
}

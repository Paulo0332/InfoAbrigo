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

const URL_BUSCA = 'https://nominatim.openstreetmap.org/search';

// Procura a coordenada do endereço completo, com número, usando o
// geocodificador do OpenStreetMap. É mais preciso que a coordenada do
// CEP, que aponta para o meio da via.
//
// O Nominatim pede que quem usa se identifique no User-Agent e não faça
// mais de uma consulta por segundo. Como aqui é um toque de botão por
// cadastro, ficamos bem dentro da política.
export async function buscarCoordenadas(dados) {
  const partes = [];

  if (dados.logradouro) {
    partes.push(dados.numero ? dados.logradouro + ' ' + dados.numero : dados.logradouro);
  }

  if (dados.bairro) {
    partes.push(dados.bairro);
  }

  if (dados.cidade) {
    partes.push(dados.cidade);
  }

  if (dados.uf) {
    partes.push(dados.uf);
  }

  if (partes.length === 0) {
    return { situacao: 'incompleto' };
  }

  const consulta = encodeURIComponent(partes.join(', '));
  const url = URL_BUSCA + '?q=' + consulta + '&format=json&limit=1&countrycodes=br';

  try {
    const resposta = await fetch(url, {
      headers: { 'User-Agent': 'InfoAbrigo-Academico/1.0' },
    });

    if (!resposta.ok) {
      return { situacao: 'indisponivel' };
    }

    const lista = await resposta.json();

    if (!lista || lista.length === 0) {
      return { situacao: 'nao-encontrado' };
    }

    return {
      situacao: 'encontrado',
      latitude: Number(lista[0].lat),
      longitude: Number(lista[0].lon),
    };
  } catch (error) {
    console.log('Erro ao buscar as coordenadas:', error);

    return { situacao: 'indisponivel' };
  }
}

// Monta a linha de endereço que aparece no cartão do abrigo.
export function montarEndereco(dados) {
  const partes = [];

  if (dados.logradouro) {
    let rua = dados.logradouro;

    if (dados.numero) {
      rua = rua + ', ' + dados.numero;
    }

    if (dados.complemento) {
      rua = rua + ' — ' + dados.complemento;
    }

    partes.push(rua);
  }

  if (dados.bairro) {
    partes.push(dados.bairro);
  }

  if (dados.cidade) {
    partes.push(dados.cidade + (dados.uf ? '/' + dados.uf : ''));
  }

  return partes.join(' • ');
}

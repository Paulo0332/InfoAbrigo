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

// Palavras que abrem o nome da via. Elas atrapalham a comparação, porque
// a mesma rua aparece como "Av. Brasil" num lugar e "Avenida Brasil" no
// outro, então são retiradas antes de comparar.
const TIPOS_DE_VIA = [
  'rua',
  'r',
  'avenida',
  'av',
  'alameda',
  'al',
  'travessa',
  'tv',
  'praca',
  'pca',
  'rodovia',
  'estrada',
  'largo',
  'via',
];

// Tira acento, maiúscula e o tipo da via, para "Av. São João" e
// "Avenida Sao Joao" contarem como o mesmo nome.
function chaveDaVia(texto) {
  let limpo = (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const palavras = limpo.split(' ');

  if (palavras.length > 1 && TIPOS_DE_VIA.indexOf(palavras[0]) >= 0) {
    palavras.shift();
  }

  return palavras.join(' ');
}

// O Nominatim devolve o estado por extenso ("São Paulo") e a sigla só
// dentro deste código, no formato BR-SP.
function siglaDoEstado(endereco) {
  const codigo = endereco['ISO3166-2-lvl4'] || '';

  return codigo.length === 5 ? codigo.slice(3) : '';
}

async function consultarNominatim(parametros) {
  const url = URL_BUSCA + '?' + parametros + '&format=json&limit=5&addressdetails=1&countrycodes=br';

  const resposta = await fetch(url, {
    headers: { 'User-Agent': 'InfoAbrigo-Academico/1.0' },
  });

  if (!resposta.ok) {
    return null;
  }

  return resposta.json();
}

// Procura a coordenada do endereço, usando o geocodificador do
// OpenStreetMap.
//
// A versão anterior mandava tudo numa frase só e aceitava o primeiro
// resultado calado. Isso marcava o abrigo no lugar errado sem avisar:
// pedindo "Rua das Flores, Centro, Curitiba" o serviço responde "Rua XV
// de Novembro", que é a mesma via com outro nome oficial — mas ele
// responde igual quando a rua simplesmente não existe naquela cidade.
//
// Agora a busca é por campos separados, que é o formato que o serviço
// entende melhor, e o resultado volta com o que foi encontrado e com o
// aviso de que o nome achado não bate com o digitado. Quem cadastra
// confere antes de marcar o ponto.
export async function buscarCoordenadas(dados) {
  if (!dados.logradouro || !dados.cidade) {
    return { situacao: 'incompleto' };
  }

  // O número vai na frente do nome da via: é assim que o serviço espera
  // receber, e com ele o ponto cai no imóvel em vez do meio da rua.
  const via = dados.numero
    ? dados.numero + ' ' + dados.logradouro
    : dados.logradouro;

  const campos =
    'street=' + encodeURIComponent(via) +
    '&city=' + encodeURIComponent(dados.cidade) +
    (dados.uf ? '&state=' + encodeURIComponent(dados.uf) : '') +
    '&country=Brasil';

  try {
    let lista = await consultarNominatim(campos);

    // A busca por campos é exigente e às vezes não acha endereço que
    // existe. Aí vale repetir em texto corrido, que é mais tolerante.
    if (lista != null && lista.length === 0) {
      const frase = [via, dados.bairro, dados.cidade, dados.uf]
        .filter((parte) => Boolean(parte))
        .join(', ');

      lista = await consultarNominatim('q=' + encodeURIComponent(frase));
    }

    if (lista == null) {
      return { situacao: 'indisponivel' };
    }

    if (lista.length === 0) {
      return { situacao: 'nao-encontrado' };
    }

    const procurada = chaveDaVia(dados.logradouro);

    // Entre os resultados, o melhor é aquele cuja rua tem o mesmo nome
    // da digitada. Só quando nenhum bate é que o primeiro serve, e aí
    // com a ressalva de conferir.
    const igual = lista.filter(
      (item) => chaveDaVia((item.address || {}).road) === procurada
    );

    const achado = igual.length > 0 ? igual[0] : lista[0];
    const endereco = achado.address || {};

    return {
      situacao: 'encontrado',
      latitude: Number(achado.lat),
      longitude: Number(achado.lon),
      confere: igual.length > 0,
      descricao: achado.display_name || '',
      rua: endereco.road || '',
      bairro: endereco.suburb || endereco.neighbourhood || '',
      cidade: endereco.city || endereco.town || endereco.municipality || '',
      uf: siglaDoEstado(endereco),
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

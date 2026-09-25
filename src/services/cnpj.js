// Verificação do CNPJ da instituição, em duas etapas.
//
// A primeira é matemática e funciona sem internet: todo CNPJ tem dois
// dígitos no fim calculados a partir dos outros doze. Isso derruba erro
// de digitação e número inventado na hora.
//
// A segunda é uma consulta pública à BrasilAPI, que não pede chave e diz
// se o CNPJ existe, se está ativo, qual a razão social e qual o CNAE —
// o código da atividade econômica.
//
// O que isto PROVA: que a instituição existe, está ativa na Receita e é
// do ramo de assistência social.
//
// O que isto NÃO PROVA: que a pessoa que digitou trabalha lá. Qualquer
// um pode copiar um CNPJ público. Verificação de vínculo exige documento
// e revisão humana, e portanto servidor.

const URL_CONSULTA = 'https://brasilapi.com.br/api/cnpj/v1/';

// CNPJ de demonstração, no mesmo espírito dos cartões de teste que as
// empresas de pagamento publicam. Ele passa na conta dos dígitos e
// devolve 404 na Receita, ou seja, não pertence a instituição nenhuma.
//
// Serve para apresentar o aplicativo sem usar o CNPJ real de um orfanato
// que não autorizou aparecer. Tudo que for cadastrado com ele fica
// marcado como demonstração na tela, para ninguém confundir com cadastro
// de verdade.
export const CNPJ_DEMONSTRACAO = '99999999000191';

// Famílias de CNAE ligadas a acolhimento e assistência social:
// 873 = assistência social em residências coletivas, inclui orfanatos
// 88  = serviços de assistência social sem alojamento
// 94  = associações de defesa de direitos sociais
const FAMILIAS_SOCIAIS = ['873', '88', '94'];

export function apenasDigitos(texto) {
  return (texto || '').replace(/[^0-9]/g, '');
}

export function formatarCnpj(texto) {
  const d = apenasDigitos(texto).slice(0, 14);

  if (d.length <= 2) {
    return d;
  }

  if (d.length <= 5) {
    return d.slice(0, 2) + '.' + d.slice(2);
  }

  if (d.length <= 8) {
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
  }

  if (d.length <= 12) {
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
  }

  return (
    d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' +
    d.slice(8, 12) + '-' + d.slice(12)
  );
}

// Calcula um dígito verificador a partir dos pesos que a Receita define.
function calcularDigito(numeros, pesos) {
  let soma = 0;

  for (let i = 0; i < pesos.length; i++) {
    soma = soma + Number(numeros[i]) * pesos[i];
  }

  const resto = soma % 11;

  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(texto) {
  const d = apenasDigitos(texto);

  if (d.length !== 14) {
    return false;
  }

  // 11111111111111 passa na conta dos dígitos, mas não é CNPJ de ninguém.
  if (d.split('').every((digito) => digito === d[0])) {
    return false;
  }

  const primeiro = calcularDigito(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = calcularDigito(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return primeiro === Number(d[12]) && segundo === Number(d[13]);
}

export function ehAssistenciaSocial(cnae) {
  const codigo = String(cnae || '');

  return FAMILIAS_SOCIAIS.some((familia) => codigo.startsWith(familia));
}

// Consulta a Receita pela BrasilAPI. Devolve sempre um objeto com o campo
// situacao, para a tela poder decidir o que dizer sem tratar exceção.
export async function consultarCnpj(texto) {
  const d = apenasDigitos(texto);

  if (d === CNPJ_DEMONSTRACAO) {
    return {
      situacao: 'demonstracao',
      razaoSocial: 'Abrigo Modelo — instituição de demonstração',
      municipio: 'Cidade Exemplo',
      uf: 'SP',
      cnae: '8730101',
      cnaeDescricao: 'Orfanatos',
      assistenciaSocial: true,
    };
  }

  try {
    const resposta = await fetch(URL_CONSULTA + d);

    if (resposta.status === 404) {
      return { situacao: 'inexistente' };
    }

    if (!resposta.ok) {
      return { situacao: 'indisponivel' };
    }

    const dados = await resposta.json();
    const ativa = dados.descricao_situacao_cadastral === 'ATIVA';

    return {
      situacao: ativa ? 'ativa' : 'inativa',
      razaoSocial: dados.razao_social,
      nomeFantasia: dados.nome_fantasia,
      cnae: String(dados.cnae_fiscal || ''),
      cnaeDescricao: dados.cnae_fiscal_descricao,
      municipio: dados.municipio,
      uf: dados.uf,
      assistenciaSocial: ehAssistenciaSocial(dados.cnae_fiscal),
    };
  } catch (error) {
    console.log('Erro ao consultar o CNPJ:', error);

    // Sem internet não dá para consultar, e isso não é culpa de quem está
    // cadastrando. Quem chama decide se segue com a validação local.
    return { situacao: 'indisponivel' };
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@infoabrigo:avisos-vistos';

// Os avisos não são eventos guardados: eles são lidos do que está no
// aparelho a cada vez que a tela abre. Uma necessidade em aberto é um
// fato, não uma mensagem que chegou — por isso ela reaparece sozinha.
//
// O que faltava era memória do que já foi lido. Sem ela o sino ficava
// com a bolinha para sempre: tocar abria o painel, mas nada registrava
// que a pessoa tinha visto, e no instante seguinte a conta era refeita
// do zero com o mesmo resultado.
//
// Guardamos só os identificadores já vistos. É pouca coisa, e é o
// bastante para o sino contar apenas o que é novo.

export async function carregarVistos() {
  try {
    const dados = await AsyncStorage.getItem(STORAGE_KEY);

    return dados != null ? JSON.parse(dados) : [];
  } catch (error) {
    console.log('Erro ao carregar os avisos vistos:', error);

    return [];
  }
}

// Marca como vistos os avisos que estão na tela agora. Os identificadores
// que não existem mais são descartados na mesma passada: sem essa
// limpeza a lista cresceria para sempre, guardando necessidade apagada e
// doação de meses atrás.
export async function marcarVistos(idsNaTela) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(idsNaTela));

    return idsNaTela;
  } catch (error) {
    console.log('Erro ao marcar os avisos como vistos:', error);

    return idsNaTela;
  }
}

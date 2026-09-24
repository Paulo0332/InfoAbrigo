import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library/legacy';

// A foto do registro nem sempre e tirada na hora. Quem voltou do abrigo e
// so depois lembrou de registrar tem a foto na galeria do celular, e
// obrigar a fotografar de novo seria obrigar a voltar la.
//
// O caminho inverso tambem importa: foto tirada dentro do aplicativo fica
// so dentro dele ate ser salva no celular, e ai se perde junto com o
// aplicativo.

// Devolve o endereco da foto escolhida, ou nulo quando a pessoa desistiu
// ou negou o acesso.
export async function escolherDoCelular() {
  try {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissao.granted) {
      return { situacao: 'sem-permissao' };
    }

    const escolha = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.7,
    });

    if (escolha.canceled || !escolha.assets || escolha.assets.length === 0) {
      return { situacao: 'cancelado' };
    }

    return { situacao: 'escolhida', uri: escolha.assets[0].uri };
  } catch (error) {
    console.log('Erro ao escolher a foto:', error);

    return { situacao: 'erro' };
  }
}

// Guarda a foto na galeria do celular. Devolve se conseguiu, porque no
// Expo Go a permissao as vezes nao vem e o registro continua valendo
// dentro do aplicativo.
export async function salvarNoCelular(uri) {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync(true, ['photo']);

    if (status !== 'granted') {
      return false;
    }

    await MediaLibrary.saveToLibraryAsync(uri);

    return true;
  } catch (error) {
    console.log('Galeria do aparelho indisponivel:', error);

    return false;
  }
}

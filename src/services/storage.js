import { gravarLista, lerRegistros } from './bancoLocal';
import { avisarMudanca, garantirAtualizado } from './sincronizacao';

const COLECAO = 'necessidades';

export async function saveNeeds(list) {
  try {
    await gravarLista(COLECAO, list);
    avisarMudanca();
  } catch (error) {
    console.log("Erro ao salvar necessidades:", error);
    throw error;
  }
}

export async function loadNeeds() {
  try {
    await garantirAtualizado();

    return await lerRegistros(COLECAO);
  } catch (error) {
    console.log("Erro ao carregar necessidades:", error);
    throw error;
  }
}

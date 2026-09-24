import * as Notifications from 'expo-notifications';

// Marcar na agenda e esquecer é o desfecho mais comum de qualquer
// compromisso. O lembrete é o que fecha esse buraco — e ele é local: o
// aparelho agenda consigo mesmo, sem servidor nenhum no meio.
//
// O que precisaria de servidor é a notificação remota, do tipo "o abrigo
// perto de você está precisando de fraldas". Essa não dá, e não é o que
// está aqui.

// Sem isto a notificação chega calada quando o aplicativo está aberto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Uma hora antes: cedo o bastante para dar tempo de sair, tarde o
// bastante para a pessoa ainda estar pensando no dia de hoje.
const ANTECEDENCIA = 60 * 60 * 1000;

export async function pedirPermissao() {
  try {
    const atual = await Notifications.getPermissionsAsync();

    if (atual.granted) {
      return true;
    }

    const pedida = await Notifications.requestPermissionsAsync();

    return pedida.granted === true;
  } catch (error) {
    console.log('Erro ao pedir permissão de lembrete:', error);

    return false;
  }
}

// Devolve o identificador do lembrete, para poder cancelá-lo depois, ou
// nulo quando não deu para agendar. Não dá em dois casos: sem permissão,
// e quando a hora do aviso já passou — agendar para trás não avisa
// ninguém, só entulha a fila do sistema.
export async function agendarLembrete(compromisso, textoDoTipo) {
  const quando = new Date(compromisso.quando).getTime() - ANTECEDENCIA;

  if (quando <= Date.now()) {
    return null;
  }

  if (!(await pedirPermissao())) {
    return null;
  }

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: textoDoTipo + ' em uma hora',
        body: compromisso.abrigoNome
          ? compromisso.abrigoNome +
            (compromisso.observacao ? ' — ' + compromisso.observacao : '')
          : compromisso.observacao || 'Compromisso marcado no InfoAbrigo',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(quando),
      },
    });
  } catch (error) {
    console.log('Erro ao agendar o lembrete:', error);

    return null;
  }
}

export async function cancelarLembrete(id) {
  if (!id) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    console.log('Erro ao cancelar o lembrete:', error);
  }
}

// Trocar a data de um compromisso significa cancelar o aviso velho e
// marcar outro: sem cancelar, o antigo tocaria na hora que não vale mais.
export async function reagendarLembrete(compromisso, textoDoTipo, idAntigo) {
  await cancelarLembrete(idAntigo);

  return agendarLembrete(compromisso, textoDoTipo);
}

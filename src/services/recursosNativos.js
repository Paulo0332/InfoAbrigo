import { Linking, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Badge, lembrete e calendário do celular.
//
// expo-notifications e expo-calendar não funcionam no Expo Go: o primeiro derruba
// o aplicativo só de ser carregado, e foi por isso que o lembrete saiu do projeto
// antes. Agora os dois só são carregados dentro das funções, e só fora do Expo
// Go. No Expo Go o aplicativo abre normalmente, sem badge e sem lembrete; no
// aplicativo instalado de verdade, os dois funcionam.
const noExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const UMA_HORA = 60 * 60 * 1000;

function notificacoes() {
  return noExpoGo ? null : require('expo-notifications');
}

async function temPermissao(Notifications) {
  const atual = await Notifications.getPermissionsAsync();

  if (atual.granted) {
    return true;
  }

  if (!atual.canAskAgain) {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('lembretes', {
      name: 'Lembretes da agenda',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return (await Notifications.requestPermissionsAsync()).granted;
}

// O número no ícone do aplicativo: os avisos que a pessoa ainda não viu.
export async function atualizarBadge(quantidade) {
  try {
    const Notifications = notificacoes();

    if (Notifications == null) {
      return false;
    }

    // Zerar não precisa de permissão, e não vale incomodar a pessoa por isso.
    if (quantidade > 0 && !(await temPermissao(Notifications))) {
      return false;
    }

    return await Notifications.setBadgeCountAsync(quantidade);
  } catch (error) {
    console.log('Erro ao atualizar o badge:', error);

    return false;
  }
}

// Refaz todos os lembretes a partir da agenda: é mais simples e mais seguro do
// que acompanhar cada edição, e um compromisso apagado nunca fica para trás.
export async function reprogramarLembretes(compromissos) {
  try {
    const Notifications = notificacoes();

    if (Notifications == null) {
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    const futuros = compromissos.filter(
      (item) => new Date(item.quando).getTime() - UMA_HORA > Date.now()
    );

    if (futuros.length === 0 || !(await temPermissao(Notifications))) {
      return;
    }

    for (const item of futuros) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Compromisso em uma hora',
          body: item.abrigoNome || 'Veja os detalhes na sua agenda.',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(new Date(item.quando).getTime() - UMA_HORA),
          channelId: 'lembretes',
        },
      });
    }
  } catch (error) {
    console.log('Erro ao programar os lembretes:', error);
  }
}

// Link que abre o evento já preenchido na Agenda do Google. Funciona em qualquer
// lugar, inclusive no Expo Go, onde o módulo de calendário não existe.
export function linkDoCalendario(titulo, quando, local, observacao) {
  const formatar = (data) => data.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const inicio = new Date(quando);
  const fim = new Date(inicio.getTime() + UMA_HORA);

  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(titulo) +
    '&dates=' + formatar(inicio) + '/' + formatar(fim) +
    '&location=' + encodeURIComponent(local || '') +
    '&details=' + encodeURIComponent(observacao || '')
  );
}

// Abre o formulário do próprio calendário do celular. A pessoa confere e salva:
// o aplicativo não escreve na agenda dela sem ela ver.
export async function adicionarAoCalendario(titulo, quando, local, observacao) {
  if (!noExpoGo) {
    try {
      const Calendar = require('expo-calendar');
      const permissao = await Calendar.requestCalendarPermissions(Platform.OS === 'ios');

      if (permissao.granted) {
        const calendario =
          Platform.OS === 'ios'
            ? Calendar.getDefaultCalendarSync()
            : (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).find(
                (item) => item.allowsModifications
              );

        if (calendario != null) {
          await calendario.addEventWithForm({
            title: titulo,
            startDate: new Date(quando),
            endDate: new Date(new Date(quando).getTime() + UMA_HORA),
            location: local || '',
            notes: observacao || '',
          });

          return;
        }
      }
    } catch (error) {
      console.log('Erro ao abrir o calendário do celular:', error);
    }
  }

  await Linking.openURL(linkDoCalendario(titulo, quando, local, observacao));
}

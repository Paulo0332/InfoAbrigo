import * as Haptics from 'expo-haptics';

// O aparelho respondendo ao toque é o que separa um botão que parece
// funcionar de um que parece travado. Confirmar uma doação sem nenhuma
// resposta física é coisa datada.
//
// Cada chamada está dentro de um try: vibração é enfeite, e enfeite não
// pode derrubar a ação que ele acompanha. Aparelho sem motor de vibração,
// ou com a vibração desligada nas configurações, simplesmente não sente
// nada — e o aplicativo segue igual.

export async function toqueLeve() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    console.log('Sem resposta tátil neste aparelho:', error);
  }
}

export async function deuCerto() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    console.log('Sem resposta tátil neste aparelho:', error);
  }
}

export async function deuErrado() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (error) {
    console.log('Sem resposta tátil neste aparelho:', error);
  }
}

export async function aviso() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (error) {
    console.log('Sem resposta tátil neste aparelho:', error);
  }
}

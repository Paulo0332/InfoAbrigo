# Módulo 5: Câmera e Galeria

1. **O que este módulo faz**
Permite tirar uma foto ou escolher uma da galeria, e salvar a foto no celular. A câmera registra o que aconteceu num compromisso da agenda e fotografa o abrigo no cadastro.

2. **Onde fica no app**
Na aba **Agenda**, no botão de registrar com foto, e no **cadastro do abrigo**, em "Foto do abrigo".

3. **Conceito da aula aplicado**
Vem do exemplo **App Camera**: `expo-camera` para a câmera, com `useCameraPermissions()` pedindo a permissão, e `expo-media-library` para salvar a foto na galeria. O projeto soma o `expo-image-picker`, para trazer uma foto que já está no celular.

4. **Onde está o código**
- `src/components/CameraFoto.js`: a câmera em tela cheia, reaproveitada no cadastro do abrigo.
- `src/services/galeria.js`: escolher uma foto do celular e salvar nele.
- `src/screens/ScheduleScreen.js`: o registro com foto de cada compromisso.

```javascript
const { status } = await MediaLibrary.requestPermissionsAsync(true, ['photo']);

if (status !== 'granted') {
  return false; // A foto continua valendo dentro do aplicativo.
}

await MediaLibrary.saveToLibraryAsync(uri);
```

5. **Como testar**
- Crie um compromisso com a data de hoje na aba Agenda.
- Toque em registrar com foto e permita a câmera.
- Tire a foto, escreva um título e salve.
- Toque em "Salvar no celular" e confira a galeria.
- Negue a permissão da câmera e confirme que o aplicativo avisa em vez de travar.

6. **Possíveis perguntas**
- *Por que pedir a permissão só na hora de usar?*
Porque é quando a pessoa entende o motivo do pedido. Pedir ao abrir o aplicativo aumenta a chance de ela negar.
- *Por que o registro continua valendo se a galeria recusar?*
Salvar na galeria é um extra. O registro pertence ao compromisso e não depende da permissão de galeria.

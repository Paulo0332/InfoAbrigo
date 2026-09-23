import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme/colors';

// O desenho do QR é feito dentro de um WebView, pelo mesmo caminho do
// mapa: em vez de trazer uma dependência nativa nova só para desenhar
// quadradinhos, a página que já sabe fazer isso faz o trabalho.
//
// O desenho precisa de internet para buscar a biblioteca. O código em
// texto, não: ele é montado no próprio aparelho e funciona offline. Por
// isso a tela mostra sempre o texto, e o QR é o extra — quando a rede
// falha, aparece o aviso no lugar do quadrado, e não uma área branca
// sem explicação.
const BIBLIOTECA = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';

function montarHtml(codigo) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <style>
      html, body {
        height: 100%;
        margin: 0;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #FFFFFF;
      }

      svg {
        width: 94%;
        height: auto;
      }
    </style>
  </head>

  <body>
    <div id="area"></div>

    <script
      src="${BIBLIOTECA}"
      onerror="window.ReactNativeWebView.postMessage('falhou')"
    ></script>

    <script>
      // O script acima bloqueia a página, então quando esta linha roda
      // ele já carregou ou já falhou.
      try {
        if (typeof qrcode !== 'function') {
          window.ReactNativeWebView.postMessage('falhou');
        } else {
          // O zero deixa a biblioteca escolher o tamanho pelo conteúdo, e
          // o M é a correção de erro que os aplicativos de banco usam.
          var qr = qrcode(0, 'M');

          qr.addData(${JSON.stringify(codigo)});
          qr.make();

          document.getElementById('area').innerHTML = qr.createSvgTag({
            cellSize: 8,
            margin: 2,
            scalable: true
          });

          window.ReactNativeWebView.postMessage('pronto');
        }
      } catch (erro) {
        window.ReactNativeWebView.postMessage('falhou');
      }
    </script>
  </body>
</html>`;
}

export default function PixQrCode(props) {

  const [situacao, setSituacao] = useState('carregando');

  function aoReceberAviso(evento) {
    setSituacao(evento.nativeEvent.data === 'pronto' ? 'pronto' : 'falhou');
  }

  if (situacao === 'falhou') {
    return (
      <View style={styles.caixa}>
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>
            Não deu para desenhar o QR agora — parece que a internet caiu.
            Use o código copia e cola aqui embaixo, que funciona do mesmo
            jeito.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.caixa}>
      <WebView
        style={styles.pagina}
        originWhitelist={['*']}
        source={{ html: montarHtml(props.codigo) }}
        onMessage={aoReceberAviso}
        scrollEnabled={false}
      />

      {situacao === 'carregando' && (
        <View style={styles.carregando}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    width: 240,
    height: 240,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignSelf: 'center',

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  pagina: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  carregando: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  aviso: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  avisoTexto: {
    fontSize: 13,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 19,
  },
});

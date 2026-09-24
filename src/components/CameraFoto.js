import { useEffect, useState } from 'react';
import { useRef } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { toqueLeve } from '../services/tato';
import { colors } from '../theme/colors';

// Câmera para quando a tela só precisa de uma foto e mais nada.
//
// A da agenda pede título, descrição e salva na galeria, porque lá a foto
// é um registro do que aconteceu. Aqui ela é só a cara do abrigo: tirar,
// olhar, refazer se ficou ruim, usar. Misturar os dois casos num
// componente só deixaria ambos piores.
export default function CameraFoto(props) {

  const [permissao, pedirPermissao] = useCameraPermissions();
  const areaSegura = useSafeAreaInsets();

  const [foto, setFoto] = useState(null);
  const [pronta, setPronta] = useState(false);

  const cameraRef = useRef(null);

  // Abrindo de novo, a câmera precisa começar do zero: com a foto
  // anterior ainda no estado, a pessoa veria a prévia da vez passada.
  useEffect(() => {
    if (props.visivel) {
      setFoto(null);
      setPronta(false);
      garantirPermissao();
    }
  }, [props.visivel]);

  async function garantirPermissao() {
    if (permissao?.granted) {
      return;
    }

    const { granted } = await pedirPermissao();

    if (!granted) {
      Alert.alert(
        'Sem acesso à câmera',
        'Para fotografar o abrigo, permita o acesso à câmera nas configurações do aparelho.'
      );

      props.aoFechar();
    }
  }

  async function fotografar() {
    if (!cameraRef.current || !pronta) {
      return;
    }

    try {
      const capturada = await cameraRef.current.takePictureAsync({ quality: 0.7 });

      toqueLeve();
      setFoto(capturada.uri);
    } catch (error) {
      console.log('Erro ao fotografar:', error);

      Alert.alert('Erro', 'Não foi possível tirar a foto.');
    }
  }

  function refazer() {
    setFoto(null);
    setPronta(false);
  }

  return (
    <Modal visible={props.visivel} animationType="slide" onRequestClose={props.aoFechar}>
      <View style={styles.tela}>
        {foto ? (
          <View style={styles.tela}>
            <Image source={{ uri: foto }} style={styles.previa} resizeMode="cover" />

            <Text style={[styles.aviso, { top: areaSegura.top + 20 }]}>
              A foto ficou boa?
            </Text>

            <View style={styles.barraBaixo}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tirar outra foto"
                style={({ pressed }) => [styles.botaoClaro, pressed && styles.pressionado]}
                onPress={refazer}
              >
                <Ionicons name="camera-reverse" size={19} color="#FFFFFF" />
                <Text style={styles.textoClaro}>Refazer</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Usar esta foto"
                style={({ pressed }) => [styles.botaoUsar, pressed && styles.pressionado]}
                onPress={() => props.aoConfirmar(foto)}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.textoUsar}>Usar esta foto</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.tela}>
            <CameraView
              style={styles.camera}
              facing="back"
              ref={cameraRef}
              onCameraReady={() => setPronta(true)}
            />

            {/* Os controles flutuam por cima da imagem, sem faixa preta
                por baixo. A faixa comia um pedaço grande da tela para
                mostrar dois botões, e o que interessa aqui é ver o que
                vai ser fotografado. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar a câmera"
              style={({ pressed }) => [
                styles.fechar,
                { top: areaSegura.top + 12 },
                pressed && styles.pressionado,
              ]}
              onPress={props.aoFechar}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>

            <Text style={[styles.aviso, { top: areaSegura.top + 20 }]}>
              {props.titulo || 'Fotografe o abrigo'}
            </Text>

            <View style={styles.baseCamera}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tirar a foto"
                style={[styles.anel, !pronta && styles.anelTravado]}
                onPress={fotografar}
                disabled={!pronta}
              >
                <View style={styles.disparo} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: '#000000',
  },

  camera: {
    flex: 1,
  },

  previa: {
    ...StyleSheet.absoluteFillObject,
  },

  // Flutuando por cima da imagem, sem faixa por baixo: a foto ocupa a
  // tela inteira, que é o que importa na hora de enquadrar.
  fechar: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  aviso: {
    position: 'absolute',
    right: 0,
    left: 0,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  baseCamera: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    paddingBottom: 34,
  },

  barraBaixo: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 16,
  },

  anel: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  anelTravado: {
    opacity: 0.3,
  },

  disparo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },

  botaoClaro: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginRight: 12,
  },

  textoClaro: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 7,
  },

  botaoUsar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 22,
    borderRadius: 25,
    backgroundColor: colors.primary,
  },

  textoUsar: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 7,
  },

  pressionado: {
    opacity: 0.6,
  },
});

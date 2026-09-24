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
import { escolherDoCelular } from '../services/galeria';
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

  // Nem todo abrigo e fotografado na hora do cadastro: muita vez a foto
  // ja existe no celular de quem administra.
  async function trazerDoCelular() {
    const escolha = await escolherDoCelular();

    if (escolha.situacao === 'escolhida') {
      toqueLeve();
      setFoto(escolha.uri);

      return;
    }

    if (escolha.situacao === 'sem-permissao') {
      Alert.alert(
        'Sem acesso às fotos',
        'Para escolher uma foto já tirada, permita o acesso às fotos nas configurações do aparelho.'
      );
    }
  }

  return (
    <Modal visible={props.visivel} animationType="slide" onRequestClose={props.aoFechar}>
      <View style={styles.tela}>
        {foto ? (
          <View style={styles.tela}>
            <Image source={{ uri: foto }} style={styles.previa} resizeMode="cover" />

            <View style={[styles.barraTopo, { paddingTop: areaSegura.top + 16 }]}>
              <Text style={styles.aviso}>A foto ficou boa?</Text>
            </View>

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

            <View style={[styles.barraTopo, { paddingTop: areaSegura.top + 16 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar a câmera"
                style={({ pressed }) => [styles.fechar, pressed && styles.pressionado]}
                onPress={props.aoFechar}
              >
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </Pressable>

              <Text style={styles.aviso}>{props.titulo || 'Fotografe o abrigo'}</Text>
            </View>

            <View style={styles.barraBaixo}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tirar a foto"
                style={[styles.anel, !pronta && styles.anelTravado]}
                onPress={fotografar}
                disabled={!pronta}
              >
                <View style={styles.disparo} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Escolher uma foto do celular"
                style={({ pressed }) => [styles.doCelular, pressed && styles.pressionado]}
                onPress={trazerDoCelular}
              >
                <Ionicons name="images-outline" size={18} color="#FFFFFF" />
                <Text style={styles.doCelularTexto}>Escolher do celular</Text>
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

  barraTopo: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  fechar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  aviso: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  barraBaixo: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },

  doCelular: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginLeft: 14,
  },

  doCelularTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 7,
  },

  anel: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  anelTravado: {
    opacity: 0.3,
  },

  disparo: {
    width: 62,
    height: 62,
    borderRadius: 31,
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

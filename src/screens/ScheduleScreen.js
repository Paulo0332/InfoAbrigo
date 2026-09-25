import { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, Modal, Image, Alert, FlatList, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Ionicons } from '@expo/vector-icons';
import { carregarAtividades, salvarAtividades } from '../services/activities';
import { colors } from '../theme/colors';
import { globalStyles } from '../theme/styles';
import { LinearGradient } from 'expo-linear-gradient';

const TAGS = ['Doação', 'Visita', 'Manutenção', 'Outros'];

export default function ScheduleScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // O SafeAreaView do topo do formulário piscava sem parar quando o
  // teclado abria na descrição: dentro de um Modal ele remede a folga a
  // cada mudança da janela, aplica o novo espaço, e a mudança dispara
  // outra medição. O hook devolve a mesma folga sem remedir, então o
  // laço não existe.
  const areaSegura = useSafeAreaInsets();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTag, setSelectedTag] = useState(TAGS[0]);

  // Lista de atividades registradas
  const [activities, setActivities] = useState([]);

  // O registro que está sendo editado. Nulo quando é um registro novo.
  const [editando, setEditando] = useState(null);

  // A prévia do formulário é cortada em 250 px de altura, o que esconde
  // as bordas da foto. Guardando aqui qual foto ampliar, dá para ver a
  // imagem inteira antes de salvar.
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  
  const cameraRef = useRef(null);

  useEffect(() => {
    buscarAtividades();
  }, []);

  // As atividades ficavam so no useState: fotografar, fechar o app e
  // perder tudo. Agora elas vem do AsyncStorage, como a lista do Modulo 2.
  async function buscarAtividades() {
    try {
      const salvas = await carregarAtividades();

      setActivities(salvas);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível ler as atividades salvas.');
    }
  }

  // Toda alteracao na lista passa por aqui, para o estado da tela e o
  // disco nunca sairem de sincronia.
  async function gravarLista(novaLista) {
    setActivities(novaLista);

    try {
      await salvarAtividades(novaLista);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar as atividades.');
    }
  }

  async function openCamera() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Aviso', 'Você precisa permitir o acesso à câmera para registrar a atividade.');
        return;
      }
    }
    setModalVisible(true);
    setIsCameraReady(false);
  }

  // Voltar para a câmera não é só limpar a foto: a permissão pode ter
  // sido revogada nas configurações desde o último registro, e o
  // isCameraReady precisa voltar a false para o botão de disparo só
  // liberar quando a câmera estiver de pé outra vez.
  async function refazerFoto() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();

      if (!granted) {
        Alert.alert('Aviso', 'Você precisa permitir o acesso à câmera para trocar a foto.');

        return;
      }
    }

    setPhoto(null);
    setIsCameraReady(false);
  }

  async function takePicture() {
    if (cameraRef.current && isCameraReady) {
      try {
        const data = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        setPhoto(data.uri);
      } catch (error) {
        console.log('Error capturing photo:', error);
        Alert.alert('Erro', 'Não foi possível capturar a foto.');
      }
    }
  }

  // Tenta salvar nativamente na galeria exigida pelo módulo. Devolve se
  // conseguiu, porque no Expo Go a permissão às vezes não vem e aí o
  // registro continua valendo, só que apenas dentro do aplicativo.
  async function guardarNaGaleria(uri) {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true, ['photo']);

      if (status !== 'granted') {
        return false;
      }

      await MediaLibrary.saveToLibraryAsync(uri);

      return true;
    } catch (error) {
      console.log('Galeria nativa bloqueada ou inacessível no Expo Go:', error);

      return false;
    }
  }

  async function saveActivity() {
    if (!title.trim()) {
      Alert.alert('Aviso', 'Dê um título para sua atividade.');
      return;
    }

    if (editando) {
      await salvarEdicao();

      return;
    }

    const newActivity = {
      id: Date.now().toString(),
      uri: photo,
      title: title.trim(),
      description: description.trim(),
      tag: selectedTag,
      date: new Date().toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      saved: await guardarNaGaleria(photo)
    };

    gravarLista([newActivity, ...activities]);
    closeModal();
  }

  // Editar troca o registro no lugar, pelo id, como o atualizarAbrigo do
  // mapa. A data original fica: ela diz quando a atividade aconteceu, não
  // quando o texto foi corrigido.
  async function salvarEdicao() {
    const trocouFoto = photo !== editando.uri;
    const naGaleria = trocouFoto ? await guardarNaGaleria(photo) : editando.saved;

    const nova = activities.map((item) => {
      if (item.id !== editando.id) {
        return item;
      }

      return {
        ...item,
        uri: photo,
        title: title.trim(),
        description: description.trim(),
        tag: selectedTag,
        saved: naGaleria
      };
    });

    gravarLista(nova);
    closeModal();
  }

  // Abrir um registro que já existe reaproveita o mesmo formulário: a
  // foto vem do registro, os campos vêm preenchidos e o salvar troca no
  // lugar em vez de criar outro.
  function editarAtividade(atividade) {
    setEditando(atividade);
    setPhoto(atividade.uri);
    setTitle(atividade.title);
    setDescription(atividade.description);
    setSelectedTag(atividade.tag);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setPhoto(null);
    setIsCameraReady(false);
    setTitle('');
    setDescription('');
    setSelectedTag(TAGS[0]);
    setEditando(null);
    setFotoAmpliada(null);
  }

  // Mostra a foto inteira por cima de tudo. É uma camada absoluta, e não
  // outro Modal, porque Modal dentro de Modal se comporta mal no Android.
  function fotoEmTelaCheia() {
    if (!fotoAmpliada) {
      return null;
    }

    return (
      <Pressable style={styles.camadaFoto} onPress={() => setFotoAmpliada(null)}>
        <Image
          source={{ uri: fotoAmpliada }}
          style={styles.fotoInteira}
          resizeMode="contain"
        />

        <Text style={styles.dicaFoto}>Toque em qualquer lugar para fechar</Text>
      </Pressable>
    );
  }

  function deleteActivity(id) {
    Alert.alert(
      'Excluir Atividade',
      'Tem certeza que deseja apagar este registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: () => {
            gravarLista(activities.filter(a => a.id !== id));
          }
        }
      ]
    );
  }

  function renderActivityItem({ item }) {
    return (
      <View style={styles.activityCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver a foto inteira" onPress={() => setFotoAmpliada(item.uri)}>
          <Image source={{ uri: item.uri }} style={styles.activityImage} />

          <View style={styles.lupa}>
            <Ionicons name="expand" size={12} color="#FFF" />
          </View>
        </Pressable>

        <View style={styles.activityInfo}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Editar o registro" onPress={() => editarAtividade(item)} style={styles.deleteButton}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Excluir o registro" onPress={() => deleteActivity(item.id)} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={18} color="#FF5252" />
            </Pressable>
          </View>
          
          <Text style={styles.activityDate}>{item.date}</Text>
          {item.description ? (
            <Text style={styles.activityDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          
          <View style={styles.badgeContainer}>
            <View style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>{item.tag}</Text>
            </View>
            <View style={[styles.badge, item.saved ? styles.badgeSuccess : styles.badgeWarning]}>
              <Ionicons name={item.saved ? "checkmark-circle" : "warning"} size={12} color={item.saved ? "#2e7d32" : "#ed6c02"} />
              <Text style={[styles.badgeText, { color: item.saved ? "#2e7d32" : "#ed6c02" }]}>
                {item.saved ? 'Galeria' : 'App'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[globalStyles.container, styles.container]} edges={['top']}>
      <View style={{ padding: 20, flex: 1 }}>
        <Text style={[globalStyles.title, { marginBottom: 4 }]}>Registro de Atividades</Text>
        <Text style={[globalStyles.text, { marginBottom: 24 }]}>Documente o dia a dia, visitas e doações do abrigo.</Text>
        
        <FlatList 
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderActivityItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="camera-outline" size={48} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Nenhum registro ainda</Text>
              <Text style={styles.emptyText}>Clique no botão abaixo para capturar momentos importantes do abrigo.</Text>
            </View>
          }
        />

        <View style={styles.fabContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Registrar uma atividade" style={styles.fab} onPress={openCamera}>
            <LinearGradient
              colors={[colors.primary, colors.primaryGradient]}
              style={styles.fabGradient}
            >
              <Ionicons name="add" size={32} color="#FFF" />
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal} transparent={false}>
        <KeyboardAvoidingView 
          style={styles.modalContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {!photo ? (
            <View style={styles.cameraContainer}>
              <CameraView 
                style={styles.camera} 
                facing="back" 
                ref={cameraRef}
                onCameraReady={() => setIsCameraReady(true)}
              />
              <View style={styles.cameraOverlay}>
                <View style={[styles.cameraHeader, { paddingTop: areaSegura.top + 20 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Fechar a câmera" onPress={closeModal} style={styles.glassButton}>
                    <Ionicons name="close" size={28} color="#FFF" />
                  </Pressable>
                </View>
                <View style={styles.cameraFooter}>
                  <Pressable 
                    onPress={takePicture} 
                    style={[styles.captureRing, !isCameraReady && styles.captureDisabled]}
                    disabled={!isCameraReady}
                  >
                    <View style={styles.captureButtonInner} />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <ScrollView style={styles.formContainer} bounces={false}>
              <View style={styles.previewHeader}>
                <Image source={{ uri: photo }} style={styles.formPreviewImage} />
                <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={styles.formPreviewGradient}>
                  <View style={[styles.barraPrevia, { paddingTop: areaSegura.top + 16 }]}>
                    <Pressable onPress={refazerFoto} style={styles.botaoPrevia}>
                      <Ionicons name="camera-reverse" size={18} color="#FFF" />
                      <Text style={styles.textoPrevia}>Refazer foto</Text>
                    </Pressable>

                    <Pressable onPress={() => setFotoAmpliada(photo)} style={styles.botaoPrevia}>
                      <Ionicons name="expand" size={18} color="#FFF" />
                      <Text style={styles.textoPrevia}>Ver inteira</Text>
                    </Pressable>
                  </View>
                </LinearGradient>
              </View>

              <View style={styles.formBody}>
                <Text style={styles.formTitle}>
                  {editando ? 'Editar Registro' : 'Detalhes do Registro'}
                </Text>
                
                <Text style={styles.inputLabel}>Título da Atividade</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Entrega de Ração"
                  placeholderTextColor="#999"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={50}
                />

                <Text style={styles.inputLabel}>Categoria</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsContainer}>
                  {TAGS.map(tag => (
                    <Pressable 
                      key={tag} 
                      style={[styles.chip, selectedTag === tag && styles.chipActive]}
                      onPress={() => setSelectedTag(tag)}
                    >
                      <Text style={[styles.chipText, selectedTag === tag && styles.chipTextActive]}>{tag}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Descrição (Opcional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Detalhes sobre o que aconteceu..."
                  placeholderTextColor="#999"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <Pressable style={styles.saveAction} onPress={saveActivity}>
                  <LinearGradient colors={[colors.primary, colors.primaryGradient]} style={styles.saveActionGradient}>
                    <Ionicons name="checkmark-done" size={24} color="#FFF" />

                    <Text style={styles.saveActionText}>
                      {editando ? 'Salvar Alterações' : 'Salvar Registro'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {fotoEmTelaCheia()}
        </KeyboardAvoidingView>
      </Modal>

      {!modalVisible && fotoEmTelaCheia()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  listContainer: {
    paddingBottom: 100,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 60,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(224, 122, 31, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textMain,
    marginBottom: 8,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    gap: 16,
  },
  activityImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  activityInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activityTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textMain,
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
  },
  activityDate: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
    marginBottom: 4,
  },
  activityDesc: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    lineHeight: 20,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
  },
  tagBadge: {
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeSuccess: {
    backgroundColor: '#e8f5e9',
  },
  badgeWarning: {
    backgroundColor: '#fff3e0',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    padding: 20,
    alignItems: 'flex-start',
  },
  glassButton: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  barraPrevia: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },

  botaoPrevia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  textoPrevia: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },

  camadaFoto: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  fotoInteira: {
    width: '100%',
    height: '80%',
  },

  dicaFoto: {
    color: '#FFF',
    fontSize: 13,
    marginTop: 16,
    opacity: 0.7,
  },

  lupa: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraFooter: {
    paddingBottom: 50,
    alignItems: 'center',
  },
  captureRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureDisabled: {
    opacity: 0.3,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
  },
  formContainer: {
    flex: 1,
  },
  previewHeader: {
    height: 250,
    width: '100%',
    position: 'relative',
  },
  formPreviewImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  formPreviewGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  formBody: {
    padding: 24,
    paddingBottom: 60,
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textMain,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.textMain,
    marginBottom: 20,
  },
  textArea: {
    height: 100,
  },
  tagsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  chip: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  chipTextActive: {
    color: '#FFF',
  },
  saveAction: {
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  saveActionText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

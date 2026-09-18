import { useState, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, Modal, Image, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { globalStyles } from '../theme/styles';

export default function ScheduleScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  // Lista de atividades registradas
  const [activities, setActivities] = useState([]);
  
  const cameraRef = useRef(null);

  async function openCamera() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Aviso', 'Você precisa permitir o acesso à câmera para registrar a atividade.');
        return;
      }
    }
    setModalVisible(true);
    setIsCameraReady(false); // Reseta o estado ao abrir
  }

  async function takePicture() {
    if (cameraRef.current && isCameraReady) {
      try {
        const data = await cameraRef.current.takePictureAsync();
        setPhoto(data.uri);
      } catch (error) {
        console.log('Error capturing photo:', error);
        Alert.alert('Erro', 'Não foi possível capturar a foto.');
      }
    }
  }

  async function savePhoto() {
    let savedToGallery = false;

    // Tenta salvar nativamente na galeria exigida pelo módulo
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync({ writeOnly: true, granularPermissions: ['photo'] });
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(photo);
        savedToGallery = true;
      }
    } catch (error) {
      // Falha capturada silenciosamente para contornar o bloqueio restrito do Expo Go (Android 13+)
      console.log('Galeria nativa bloqueada ou inacessível no Expo Go:', error);
    }

    // Registra na lista de atividades do aplicativo (funcionalidade principal da tela)
    const newActivity = {
      id: Date.now().toString(),
      uri: photo,
      date: new Date().toLocaleString(),
      saved: savedToGallery
    };

    setActivities([newActivity, ...activities]);

    if (savedToGallery) {
      Alert.alert('Sucesso!', 'Atividade registrada e foto salva na galeria do celular!');
    } else {
      Alert.alert('Atividade Registrada!', 'A foto foi registrada na lista abaixo. (Nota: O salvamento na galeria nativa foi bloqueado pelas permissões do seu dispositivo/Expo Go).');
    }

    closeModal();
  }

  function closeModal() {
    setModalVisible(false);
    setPhoto(null);
    setIsCameraReady(false);
  }

  function renderActivityItem({ item }) {
    return (
      <View style={styles.activityCard}>
        <Image source={{ uri: item.uri }} style={styles.activityImage} />
        <View style={styles.activityInfo}>
          <Text style={styles.activityTitle}>Registro de Atividade</Text>
          <Text style={styles.activityDate}>{item.date}</Text>
          <View style={[styles.badge, item.saved ? styles.badgeSuccess : styles.badgeWarning]}>
            <Text style={styles.badgeText}>
              {item.saved ? 'Salva na Galeria' : 'Apenas no App'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[globalStyles.container, styles.container]} edges={['top']}>
      <View style={{ padding: 16, flex: 1 }}>
        <Text style={globalStyles.title}>Agenda & Atividades</Text>
        <Text style={globalStyles.text}>Registre eventos, visitas e ações no abrigo.</Text>
        
        <View style={styles.buttonContainer}>
          <Pressable style={styles.cameraButton} onPress={openCamera}>
            <Ionicons name="camera" size={24} color={colors.white} />
            <Text style={styles.cameraButtonText}>Registrar Nova Atividade</Text>
          </Pressable>
        </View>

        <FlatList 
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderActivityItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>Nenhuma atividade registrada ainda.</Text>
            </View>
          }
        />
      </View>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalContainer}>
          {!photo ? (
            <View style={styles.cameraContainer}>
              <CameraView 
                style={styles.camera} 
                facing="back" 
                ref={cameraRef}
                onCameraReady={() => setIsCameraReady(true)}
              />
              <View style={styles.cameraOverlay}>
                <View style={styles.cameraHeader}>
                  <Pressable onPress={closeModal} style={styles.iconButton}>
                    <Ionicons name="close" size={32} color={colors.white} />
                  </Pressable>
                </View>
                <View style={styles.cameraFooter}>
                  <Pressable 
                    onPress={takePicture} 
                    style={[styles.captureButton, !isCameraReady && styles.captureButtonDisabled]}
                    disabled={!isCameraReady}
                  >
                    <View style={styles.captureButtonInner} />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photo }} style={styles.previewImage} />
              <View style={styles.previewFooter}>
                <Pressable onPress={() => setPhoto(null)} style={styles.previewButtonDiscard}>
                  <Text style={styles.previewButtonText}>Descartar</Text>
                </Pressable>
                <Pressable onPress={savePhoto} style={styles.previewButtonSave}>
                  <Text style={styles.previewButtonText}>Registrar Atividade</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  buttonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  cameraButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cameraButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    marginTop: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 16,
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 16,
  },
  activityImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  activityInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  activityDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginVertical: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  badgeSuccess: {
    backgroundColor: '#e6f4ea',
  },
  badgeWarning: {
    backgroundColor: '#fef7e0',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
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
    marginTop: 40,
  },
  iconButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 24,
  },
  cameraFooter: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  previewFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  previewButtonDiscard: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.textSecondary,
    borderRadius: 8,
  },
  previewButtonSave: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  previewButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

import { useState, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, Modal, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { globalStyles } from '../theme/styles';

export default function ScheduleScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [photo, setPhoto] = useState(null);
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
  }

  async function takePicture() {
    if (cameraRef.current) {
      try {
        const data = await cameraRef.current.takePictureAsync();
        setPhoto(data.uri);
      } catch (error) {
        console.log(error);
        Alert.alert('Erro', 'Não foi possível capturar a foto.');
      }
    }
  }

  async function savePhoto() {
    if (!mediaPermission?.granted) {
      const { granted } = await requestMediaPermission();
      if (!granted) {
        Alert.alert('Aviso', 'Você precisa permitir o acesso à galeria para salvar a foto.');
        return;
      }
    }

    try {
      await MediaLibrary.saveToLibraryAsync(photo);
      Alert.alert('Sucesso!', 'Atividade registrada e foto salva na galeria!');
      closeModal();
    } catch (error) {
      console.log(error);
      Alert.alert('Erro', 'Não foi possível salvar a foto.');
    }
  }

  function closeModal() {
    setModalVisible(false);
    setPhoto(null);
  }

  return (
    <SafeAreaView style={[globalStyles.container, styles.container]} edges={['top']}>
      <View style={{ padding: 16, flex: 1 }}>
        <Text style={globalStyles.title}>Agenda</Text>
        <Text style={globalStyles.text}>Próximos eventos e atividades nos abrigos.</Text>
        
        <View style={styles.content}>
          <Pressable style={styles.cameraButton} onPress={openCamera}>
            <Ionicons name="camera" size={32} color={colors.white} />
            <Text style={styles.cameraButtonText}>Registrar Atividade</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalContainer}>
          {!photo ? (
            <CameraView 
              style={styles.camera} 
              facing="back" 
              ref={cameraRef}
            >
              <View style={styles.cameraHeader}>
                <Pressable onPress={closeModal} style={styles.iconButton}>
                  <Ionicons name="close" size={32} color={colors.white} />
                </Pressable>
              </View>
              <View style={styles.cameraFooter}>
                <Pressable onPress={takePicture} style={styles.captureButton}>
                  <View style={styles.captureButtonInner} />
                </Pressable>
              </View>
            </CameraView>
          ) : (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photo }} style={styles.previewImage} />
              <View style={styles.previewFooter}>
                <Pressable onPress={() => setPhoto(null)} style={styles.previewButtonDiscard}>
                  <Text style={styles.previewButtonText}>Descartar</Text>
                </Pressable>
                <Pressable onPress={savePhoto} style={styles.previewButtonSave}>
                  <Text style={styles.previewButtonText}>Salvar na Galeria</Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cameraButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
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

import * as FileSystem from 'expo-file-system/legacy';
import getDatabase from '../../assets/migrations';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { generateUUID } from './Helper';

const db = getDatabase();

export const saveImageToBDD = async (file: string, pointId: string) => {
    try{
      console.log('Saving image for point ID:', pointId, file);
      
      // Convertir l'image en base64 et l'insérer dans la colonne `image`
      const base64 = await imageToBase64(file);
      console.log('Image converted to base64, length:', base64.length);
      
      const pictureId = generateUUID();
      const result = db.runSync(
        'INSERT INTO picture (id, point_id, image) VALUES (?, ?, ?)',
        [pictureId, pointId, base64]
      );
      
      return result;
    } catch (error) {
        console.error('Erreur sauvegarde image:', error);
        throw error;
    }
}

export const imageToBase64 = async (uri: string) => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });
  console.log("Image converted to base64");

  return base64;
};

export const pickImage = async () => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "Autorisation caméra refusée.");
      return;
    }

    const result: any = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    const uri = result?.assets?.[0]?.uri ?? result?.uri;
    if (uri) {
      return uri;
    }
  } catch (error) {
    console.error("Erreur lors de la prise de photo :", error);
    Alert.alert("Erreur", "Impossible d'accéder à la caméra.");
  }
};

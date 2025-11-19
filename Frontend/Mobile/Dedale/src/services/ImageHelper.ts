import * as FileSystem from 'expo-file-system/legacy';
import getDatabase from '../../assets/migrations';

const db = getDatabase();

export const saveImageToBDD = async (file: string, pointId: number) => {
    try{
      console.log('Saving image for point ID:', pointId, file);
      
      // Convertir l'image en base64 et l'insérer dans la colonne `image`
      const base64 = await imageToBase64(file);
      console.log('Image converted to base64, length:', base64.length);
      
      const result = db.runSync(
        'INSERT INTO pictures (point_id, image) VALUES (?, ?)',
        [pointId, base64]
      );
      
      return result;
    } catch (error) {
        console.error('Erreur sauvegarde image:', error);
        throw error;
    }
}

const imageToBase64 = async (uri: string) => {
    const base64 = await FileSystem.readAsStringAsync(uri , {
        encoding: 'base64',
    });
    console.log('Image converted to base64');

  return base64;
}
import * as FileSystem from 'expo-file-system';
import getDatabase from '../../assets/migrations';

const db = getDatabase();

export const saveImageToBDD = async (file: string, pointId: number) => {
    try{
        const base64 = await imageToBase64(file)
        const result = db.runSync(
        'INSERT INTO pictures (point_id, image) VALUES (?, ?)',
        [pointId, base64]
    );
    return result
    }catch (error) {
        console.error('Erreur sauvegarde image:', error);
    throw error;
  }
    
    
}

const imageToBase64 = async (uri: string) => {
    const base64 = await FileSystem.readAsStringAsync(uri , {
        encoding: 'base64',
    });

  return base64;
}
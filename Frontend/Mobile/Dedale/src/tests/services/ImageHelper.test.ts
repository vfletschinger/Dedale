import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { generateUUID } from '../../services/Helper';
import * as ImageHelper from '../../services/ImageHelper';
import getDatabase from '../../../assets/migrations';

jest.mock('../../../assets/migrations', () => {
  const mockRunSync = jest.fn();
  const dbInstance = { runSync: mockRunSync };
  
  return {
    __esModule: true,
    default: () => dbInstance,
    getDatabase: () => dbInstance,
  };
});

jest.mock('../../services/Helper', () => ({
  generateUUID: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

describe('Service: ImageHelper', () => {
  const db = getDatabase();
  
  beforeEach(() => {
    // Arrange
    jest.clearAllMocks();
  });

  describe('imageToBase64', () => {
    test('should convert file uri to base64 string', async () => {
      // Arrange
      const fakeUri = 'file://photo.jpg';
      const fakeBase64 = 'SGVsbG8gV29ybGQ=';
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(fakeBase64);

      // Act
      const result = await ImageHelper.imageToBase64(fakeUri);

      // Assert
      expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(fakeUri, { encoding: 'base64' });
      expect(result).toBe(fakeBase64);
    });
  });

  describe('saveImageToBDD', () => {
    test('should convert image, generate ID and insert into DB', async () => {
      // Arrange
      const fakeUri = 'file://photo.jpg';
      const pointId = 'point-123';
      const fakeBase64 = 'base64data';
      const fakeUuid = 'pic-uuid-1';
      
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(fakeBase64);
      (generateUUID as jest.Mock).mockReturnValue(fakeUuid);
      
      (db.runSync as jest.Mock).mockReturnValue({ changes: 1 });

      // Act
      await ImageHelper.saveImageToBDD(fakeUri, pointId);

      // Assert
      expect(FileSystem.readAsStringAsync).toHaveBeenCalled();
      
      expect(db.runSync).toHaveBeenCalledWith(
        'INSERT INTO picture (id, point_id, image) VALUES (?, ?, ?)',
        [fakeUuid, pointId, fakeBase64]
      );
    });

    test('should throw error if database fails', async () => {
      // Arrange
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('data');
      
      (db.runSync as jest.Mock).mockImplementation(() => {
        throw new Error('DB Full');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act & Assert
      await expect(ImageHelper.saveImageToBDD('uri', 'pt-1')).rejects.toThrow('DB Full');
      
      expect(consoleSpy).toHaveBeenCalledWith('Erreur sauvegarde image:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('pickImage', () => {
    test('should return URI if permission granted and photo taken', async () => {
      // Arrange
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://new-photo.jpg' }]
      });

      // Act
      const result = await ImageHelper.pickImage();

      // Assert
      expect(result).toBe('file://new-photo.jpg');
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    test('should alert and return undefined if permission denied', async () => {
      // Arrange
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      // Act
      const result = await ImageHelper.pickImage();

      // Assert
      expect(result).toBeUndefined();
      expect(Alert.alert).toHaveBeenCalledWith('Permission refusée', expect.stringContaining('refusée'));
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    });

    test('should return undefined if user cancels camera', async () => {
      // Arrange
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: true,
        assets: null
      });

      // Act
      const result = await ImageHelper.pickImage();

      // Assert
      expect(result).toBeUndefined();
    });

    test('should handle errors and show alert', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockRejectedValue(new Error('Camera broken'));

      // Act
      await ImageHelper.pickImage();

      // Assert
      expect(Alert.alert).toHaveBeenCalledWith('Erreur', expect.stringContaining('Impossible'));
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});
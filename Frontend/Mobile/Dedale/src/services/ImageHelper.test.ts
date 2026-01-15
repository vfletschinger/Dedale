import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
// CORRECTION 1 : ./ car on est dans le même dossier
import { generateUUID } from './Helper'; 

// --- 1. Mocks globaux ---

// Mock de la Base de données
const mockRunSync = jest.fn();
// CORRECTION 2 : ../../ car on remonte de services -> src -> racine -> assets
jest.mock('../../assets/migrations', () => ({
  __esModule: true,
  default: () => ({
    runSync: mockRunSync,
  }),
}));

// Mock du Helper
// CORRECTION 3 : ./Helper
jest.mock('./Helper', () => ({
  generateUUID: jest.fn(),
}));

// Mock du FileSystem
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
}));

// Mock de l'ImagePicker
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

// Mock de l'Alert React Native
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

// --- 2. Import du Service après les mocks ---
// CORRECTION 4 : ./ImageHelper
import * as ImageHelper from './ImageHelper';

describe('Service: ImageHelper', () => {
  
  beforeEach(() => {
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
      mockRunSync.mockReturnValue({ changes: 1 });

      // Act
      await ImageHelper.saveImageToBDD(fakeUri, pointId);

      // Assert
      expect(FileSystem.readAsStringAsync).toHaveBeenCalled();
      
      expect(mockRunSync).toHaveBeenCalledWith(
        'INSERT INTO picture (id, point_id, image) VALUES (?, ?, ?)',
        [fakeUuid, pointId, fakeBase64]
      );
    });

    test('should throw error if database fails', async () => {
      // Arrange
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('data');
      mockRunSync.mockImplementation(() => {
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
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: true,
        assets: null
      });

      const result = await ImageHelper.pickImage();
      expect(result).toBeUndefined();
    });

    test('should handle errors and show alert', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockRejectedValue(new Error('Camera broken'));

      await ImageHelper.pickImage();

      expect(Alert.alert).toHaveBeenCalledWith('Erreur', expect.stringContaining('Impossible'));
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});
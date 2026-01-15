import * as Helper from '../../services/Helper';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

// Mock des modules externes
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

describe('Service: Helper', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateUUID', () => {
    test('should generate a valid UUID v4 format', () => {
      // Act
      const uuid = Helper.generateUUID();

      // Assert
      // Regex standard pour UUID v4
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test('should generate unique values', () => {
      // Act
      const uuid1 = Helper.generateUUID();
      const uuid2 = Helper.generateUUID();

      // Assert
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('shortId', () => {
    test('should return first 8 chars of a long string', () => {
      // Arrange
      const longId = '1234567890abcdef';

      // Act
      const result = Helper.shortId(longId);

      // Assert
      expect(result).toBe('12345678');
    });

    test('should return empty string if input is falsy', () => {
      // Act
      const result = Helper.shortId('');

      // Assert
      expect(result).toBe('');
    });
  });

  describe('calculateDistance', () => {
    test('should calculate correct euclidean distance', () => {
      // Arrange
      // Triangle 3-4-5 (Pythagore)
      const x1 = 0, y1 = 0;
      const x2 = 3, y2 = 4;

      // Act
      const distance = Helper.calculateDistance(x1, y1, x2, y2);

      // Assert
      expect(distance).toBe(5);
    });

    test('should return 0 for same points', () => {
      // Act
      const distance = Helper.calculateDistance(10, 10, 10, 10);

      // Assert
      expect(distance).toBe(0);
    });
  });

  describe('getUserLocation', () => {
    test('should return coordinates if permission granted', async () => {
      // Arrange
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 48.5734, longitude: 7.7521 }
      });

      // Act
      const result = await Helper.getUserLocation();

      // Assert
      expect(result).toEqual({ latitude: 48.5734, longitude: 7.7521 });
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    test('should alert and return null if permission denied', async () => {
      // Arrange
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      // Act
      const result = await Helper.getUserLocation();

      // Assert
      expect(result).toBeNull();
      expect(Alert.alert).toHaveBeenCalledWith('Permission refusée', expect.stringContaining('Impossible'));
      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    });
  });

  describe('getAddressFromCoords', () => {
    test('should format address correctly when all fields exist', async () => {
      // Arrange
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{
        name: 'Cathédrale',
        street: 'Place du Château',
        city: 'Strasbourg',
        region: 'Grand Est',
        postalCode: '67000',
        country: 'France'
      }]);

      // Act
      const result = await Helper.getAddressFromCoords(48.5, 7.7);

      // Assert
      expect(result).toBe('Cathédrale, Place du Château, Strasbourg, Grand Est, 67000, France');
    });

    test('should handle missing fields gracefully', async () => {
      // Arrange
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{
        name: null,
        street: null,
        city: 'Strasbourg',
        region: null,
        postalCode: null,
        country: 'France'
      }]);

      // Act
      const result = await Helper.getAddressFromCoords(48.5, 7.7);

      // Assert
      // Vérifie qu'il n'y a pas de "null, " ou de virgules en trop
      expect(result).toBe('Strasbourg, France');
    });

    test('should return null and log error on failure', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValue(new Error('Geo Error'));

      // Act
      const result = await Helper.getAddressFromCoords(48.5, 7.7);

      // Assert
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});
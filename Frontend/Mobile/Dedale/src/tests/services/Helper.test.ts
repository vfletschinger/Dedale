import * as Helper from '../../services/Helper';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

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

  describe('generation ID', () => {
    test('devrait générer un UUID v4 valide', () => {
      // Act
      const uuid = Helper.generateUUID();

      // Assert
      // Regex standard pour UUID v4
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test('devrait générer des valeurs uniques', () => {
      // Act
      const uuid1 = Helper.generateUUID();
      const uuid2 = Helper.generateUUID();

      // Assert
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('Formatage String', () => {
    test('devrait retourner les 8 premiers caractères d\'une longue chaîne', () => {
      // Arrange
      const longId = '1234567890abcdef';

      // Act
      const result = Helper.shortId(longId);

      // Assert
      expect(result).toBe('12345678');
    });

    test('devrait retourner une chaîne vide si l\'entrée est falsy', () => {
      // Act
      const result = Helper.shortId('');

      // Assert
      expect(result).toBe('');
    });
  });

  describe('calcul de distance', () => {
    test('devrait calculer correctement la distance euclidienne', () => {
      // Arrange
      // Triangle 3-4-5 (Pythagore)
      const x1 = 0, y1 = 0;
      const x2 = 3, y2 = 4;

      // Act
      const distance = Helper.calculateDistance(x1, y1, x2, y2);

      // Assert
      expect(distance).toBe(5);
    });

    test('devrait retourner 0 pour des points identiques', () => {
      // Act
      const distance = Helper.calculateDistance(10, 10, 10, 10);

      // Assert
      expect(distance).toBe(0);
    });
  });

  describe('getUserLocation', () => {
    test('devrait retourner les coordonnées si la permission est accordée', async () => {
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

    test('devrait afficher une alerte et retourner null si la permission est refusée', async () => {
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
    test('devrait formater correctement l\'adresse lorsque tous les champs existent', async () => {
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

    test('devrait gérer gracieusement les champs manquants', async () => {
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
      expect(result).toBe('Strasbourg, France');
    });

    test('devrait retourner null et consigner une erreur en cas d\'échec', async () => {
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
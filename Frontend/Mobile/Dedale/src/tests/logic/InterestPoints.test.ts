import { calculateDistance } from '../../services/Helper';

jest.mock('../../services/Helper', () => ({
  calculateDistance: jest.fn(),
  getAddressFromCoords: jest.fn(),
  getUserLocation: jest.fn(),
}));

// Fonction de tri extraite de InterestPoints.tsx pour les tests
function sortPointsByRecent<T extends { id: number }>(points: T[]): T[] {
  return [...points].sort((a, b) => b.id - a.id);
}

function sortPointsByDistance<T extends { x: number; y: number }>(
  points: T[],
  location: { latitude: number; longitude: number }
): T[] {
  return [...points].sort((a, b) => {
    const distA = calculateDistance(location.longitude, location.latitude, a.x, a.y);
    const distB = calculateDistance(location.longitude, location.latitude, b.x, b.y);
    return (distA as number) - (distB as number);
  });
}

describe('Logic: InterestPoints Sorting', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tri par récent (ID décroissant)', () => {
    test('Trie les points par ID décroissant', () => {
      // ARRANGE
      const points = [
        { id: 1, x: 0, y: 0, event_id: 1 },
        { id: 3, x: 0, y: 0, event_id: 1 },
        { id: 2, x: 0, y: 0, event_id: 1 },
      ];

      // ACT
      const result = sortPointsByRecent(points);

      // ASSERT
      expect(result.map(p => p.id)).toEqual([3, 2, 1]);
    });

    test('Ne modifie pas le tableau original', () => {
      // ARRANGE
      const points = [
        { id: 1, x: 0, y: 0, event_id: 1 },
        { id: 2, x: 0, y: 0, event_id: 1 },
      ];
      const originalIds = points.map(p => p.id);

      // ACT
      sortPointsByRecent(points);

      // ASSERT
      expect(points.map(p => p.id)).toEqual(originalIds);
    });

    test('Retourne un tableau de même longueur', () => {
      // ARRANGE
      const points = [
        { id: 1, x: 0, y: 0, event_id: 1 },
        { id: 2, x: 0, y: 0, event_id: 1 },
        { id: 3, x: 0, y: 0, event_id: 1 },
      ];

      // ACT
      const result = sortPointsByRecent(points);

      // ASSERT
      expect(result.length).toBe(points.length);
    });
  });

  describe('Tri par distance', () => {
    test('Trie les points par distance croissante', () => {
      // ARRANGE
      const points = [
        { id: 1, x: 10, y: 10, event_id: 1 }, // loin
        { id: 2, x: 1, y: 1, event_id: 1 },   // proche
        { id: 3, x: 5, y: 5, event_id: 1 },   // moyen
      ];
      const location = { latitude: 0, longitude: 0 };
      
      // Mock qui retourne une distance basée sur les coordonnées
      (calculateDistance as jest.Mock).mockImplementation(
        (_lng1, _lat1, x, y) => Math.sqrt(x * x + y * y)
      );

      // ACT
      const result = sortPointsByDistance(points, location);

      // ASSERT
      expect(result.map(p => p.id)).toEqual([2, 3, 1]);
    });

    test('Conserve toutes les propriétés des objets', () => {
      // ARRANGE
      const points = [
        { id: 2, x: 5, y: 10, event_id: 1 },
        { id: 1, x: 0, y: 0, event_id: 1 },
      ];
      const location = { latitude: 0, longitude: 0 };
      
      (calculateDistance as jest.Mock).mockReturnValue(0);

      // ACT
      const result = sortPointsByDistance(points, location);

      // ASSERT
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('x');
      expect(result[0]).toHaveProperty('y');
      expect(result[0]).toHaveProperty('event_id');
    });
  });
});
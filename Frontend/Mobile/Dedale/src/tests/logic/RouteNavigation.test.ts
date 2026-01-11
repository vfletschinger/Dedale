import { checkPointVisibility, fetchRouteCoordinates } from '../../screens/RouteNavigation';

global.fetch = jest.fn();

describe('Logic: RouteNavigation', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('checkPointVisibility retourne true si le point est dans la région', () => {
    // ARRANGE
    const point = { id: 1, x: 10, y: 10, event_id: 1 };
    const region = {
      latitude: 10,
      longitude: 10,
      latitudeDelta: 2,
      longitudeDelta: 2,
    };

    // ACT
    const isVisible = checkPointVisibility(point, region);

    // ASSERT
    expect(isVisible).toBe(true);
  });

  test('checkPointVisibility retourne false si le point est hors de la région', () => {
    // ARRANGE
    const point = { id: 1, x: 50, y: 50, event_id: 1 };
    const region = {
      latitude: 10,
      longitude: 10,
      latitudeDelta: 2,
      longitudeDelta: 2,
    };

    // ACT
    const isVisible = checkPointVisibility(point, region);

    // ASSERT
    expect(isVisible).toBe(false);
  });

  test('fetchRouteCoordinates retourne les coordonnées de l\'API si succès', async () => {
    // ARRANGE
    const points = [
      { id: 1, x: 7.75, y: 48.58 },
      { id: 2, x: 7.76, y: 48.59 }
    ];

    const mockApiResponse = {
      code: "Ok",
      routes: [{
        geometry: {
          coordinates: [[7.75, 48.58], [7.755, 48.585], [7.76, 48.59]]
        }
      }]
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockApiResponse)
    });

    // ACT
    const coords = await fetchRouteCoordinates(points);

    // ASSERT
    expect(coords).toHaveLength(3);
    expect(coords[0]).toEqual({ longitude: 7.75, latitude: 48.58 });
  });

  test('fetchRouteCoordinates fallback sur lignes droites si échec API', async () => {
    // ARRANGE
    const points = [
      { id: 1, x: 10, y: 10 },
      { id: 2, x: 20, y: 20 }
    ];

    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

    // ACT
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const coords = await fetchRouteCoordinates(points);

    // ASSERT
    expect(coords).toHaveLength(2);
    expect(coords[0]).toEqual({ latitude: 10, longitude: 10 });
    expect(coords[1]).toEqual({ latitude: 20, longitude: 20 });
    
    consoleSpy.mockRestore();
  });
});
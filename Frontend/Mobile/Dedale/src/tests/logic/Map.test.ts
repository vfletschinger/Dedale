jest.mock('../../context/PointsContext', () => ({
  usePoints: () => ({ pointsByEvent: {}, loading: false }),
}));

jest.mock('../../context/GeometriesContext', () => ({
  useGeometries: () => ({ geometriesByEvent: {}, loading: false }),
}));

jest.mock('../../context/EventContext', () => ({
  useEvent: () => ({ selectedEventId: null }),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  return {
      __esModule: true,
      default: React.Fragment,
      Marker: React.Fragment,
      Polyline: React.Fragment,
      Polygon: React.Fragment,
      PROVIDER_DEFAULT: 'default',
  };
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));


import { parseWKT } from '../../components/Map';

describe('Logic: Map WKT Parsing', () => {
  
  test('Parse correctement un POINT', () => {
    // ARRANGE
    const wkt = "POINT(7.75 48.58)";
    const result = parseWKT(wkt);

    // ASSERT
    expect(result).toEqual({
      type: 'point',
      coordinates: [{ latitude: 48.58, longitude: 7.75 }]
    });
  });

  test('Parse correctement une LINESTRING', () => {
    // ARRANGE
    const wkt = "LINESTRING(10 10, 20 20, 30 40)";
    const result = parseWKT(wkt);

    // ASSERT
    expect(result).toEqual({
      type: 'linestring',
      coordinates: [
        { latitude: 10, longitude: 10 },
        { latitude: 20, longitude: 20 },
        { latitude: 40, longitude: 30 }
      ]
    });
  });

  test('Parse correctement un POLYGON', () => {
    // ARRANGE
    const wkt = "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))";
    const result = parseWKT(wkt);

    // ASSERT
    expect(result?.type).toBe('polygon');
    expect(result?.coordinates).toHaveLength(5);
    expect(result?.coordinates[0]).toEqual({ latitude: 0, longitude: 0 });
    expect(result?.coordinates[4]).toEqual({ latitude: 0, longitude: 0 });
  });

  test('Retourne null pour un WKT invalide', () => {
    // ARRANGE
    const result = parseWKT("INVALID TEXT");
    
    // ASSERT
    expect(result).toBeNull();
  });

  test('Retourne null pour une chaîne vide', () => {
    // ARRANGE
    const result = parseWKT("");
    
    // ASSERT
    expect(result).toBeNull();
  });
});
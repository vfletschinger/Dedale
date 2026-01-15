import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import TeamGuidanceScreen from '../../screens/TeamGuidance';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => <>{children}</>,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: {
      teamId: 'team-123',
      teamName: 'Équipe Alpha',
    },
  }),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 48.5, longitude: 7.7 }
  })),
  watchPositionAsync: jest.fn(),
  Accuracy: { High: 6 },
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const MockMapView = (props: any) => <View testID="map-view">{props.children}</View>;
  const MockMarker = (props: any) => <View testID="map-marker" />;
  const MockPolyline = (props: any) => <View testID="map-polyline" />;
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    Polyline: MockPolyline,
  };
});

jest.mock('@expo/vector-icons', () => ({
  Feather: (props: any) => {
    const { Text } = require('react-native');
    return <Text>Icon-{props.name}</Text>;
  },
}));

const mockGetFirstSync = jest.fn();
const mockGetAllSync = jest.fn();
const mockRunSync = jest.fn();

jest.mock('../../../assets/migrations', () => ({
  getDatabase: () => ({
    getFirstSync: mockGetFirstSync,
    getAllSync: mockGetAllSync,
    runSync: mockRunSync,
  }),
}));

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({
      code: 'Ok',
      routes: [{
        geometry: { coordinates: [[7.7, 48.5], [7.8, 48.6]] },
        distance: 1500,
        duration: 900
      }]
    }),
  })
) as jest.Mock;


describe('Screen: TeamGuidance', () => {

  beforeEach(() => {
    // Arrange
    jest.clearAllMocks();

    mockGetFirstSync.mockReturnValue({ event_id: 'evt-1' });

    mockGetAllSync.mockReturnValue([
      {
        id: 'action-1',
        type: 'pose',
        is_done: 0,
        equipement_name: 'Balise A',
        coord_x: 7.75,
        coord_y: 48.58,
        scheduled_time: '2025-01-01T10:00:00.000Z'
      },
      {
        id: 'action-2',
        type: 'retrait',
        is_done: 0,
        equipement_name: 'Balise B',
        coord_x: 7.76,
        coord_y: 48.59,
        scheduled_time: '2025-01-01T11:00:00.000Z'
      }
    ]);
  });

  test('should render loading state initially then display map and actions', async () => {
    // Act
    const { getByText, getByTestId, queryByText } = render(<TeamGuidanceScreen />);

    // Assert
    expect(getByText('Chargement du guidage...')).toBeTruthy();
    await waitFor(() => {
      expect(queryByText('Chargement du guidage...')).toBeNull();
    });

    // Assert
    expect(getByText('Équipe Alpha')).toBeTruthy();
    expect(getByTestId('map-view')).toBeTruthy();
    expect(getByText('Pose')).toBeTruthy();
    expect(getByText('Balise A')).toBeTruthy();
  });

  test('should fetch route from OSRM API', async () => {
    // Arrange
    render(<TeamGuidanceScreen />);

    // Act & Assert
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://router.project-osrm.org/route/v1/foot/')
    );
  });

  test('should handle empty actions (all done or no actions)', async () => {
    // Arrange
    mockGetAllSync.mockReturnValue([]);

    // Act
    const { getByText } = render(<TeamGuidanceScreen />);

    // Assert
    await waitFor(() => {
      expect(getByText('Toutes les actions terminées !')).toBeTruthy();
    });
  });

  test('should fallback to direct coordinates if point coordinates missing', async () => {
     // Arrange
     mockGetAllSync.mockReturnValue([{
        id: 'act-1',
        type: 'inspection',
        coord_x: null, 
        coord_y: null
     }]);
     
     mockGetAllSync.mockReset();
     mockGetAllSync
      .mockReturnValueOnce([{
        id: 'act-1', type: 'inspection', coord_x: null, coord_y: null
      }])
      .mockReturnValueOnce([{
        x: 10, y: 10, name: 'Point Secours'
      }]);

     // Act
     const { getByText } = render(<TeamGuidanceScreen />);

     // Assert
     await waitFor(() => {
        expect(getByText('Inspection')).toBeTruthy();
     });
  });

  test('should detect proximity and allow validation via Alert', async () => {
    // Arange
    const mockLocation = { 
      coords: { latitude: 48.58, longitude: 7.75 } 
    };
    (require('expo-location').getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockLocation);
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');

    // Act
    render(<TeamGuidanceScreen />);

    // Assert
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "📍 Vous êtes arrivé !",
      expect.stringContaining('Valider'),
      expect.any(Array)
    );

    // Arrange
    const alertButtons = alertSpy.mock.calls[0][2];
    const validateButton = alertButtons?.find((btn: any) => btn.text.includes('Valider'));
    
    // Act
    if (validateButton && validateButton.onPress) {
      validateButton.onPress();
    }

    // Assert
    expect(mockRunSync).toHaveBeenCalledWith(
      "UPDATE action SET is_done = 1 WHERE id = ?",
      ['action-1']
    );
  });
});
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PlanningScreen from '../../screens/Planning';


const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => <>{children}</>,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: (props: any) => {
    const { Text } = require('react-native');
    return <Text>Icon-{props.name}</Text>;
  },
  MaterialCommunityIcons: (props: any) => {
    const { Text } = require('react-native');
    return <Text>Icon-{props.name}</Text>;
  },
}));

jest.mock('../../components/QrCodeScanner', () => {
  const { View, Text } = require('react-native');
  return () => <View testID="mock-qr-scanner"><Text>Scanner View</Text></View>;
});

const mockGetFirstSync = jest.fn();
const mockGetAllSync = jest.fn();

jest.mock('../../../assets/migrations', () => ({
  getDatabase: () => ({
    getFirstSync: mockGetFirstSync,
    getAllSync: mockGetAllSync,
  }),
  __esModule: true,
  default: () => ({
    getFirstSync: mockGetFirstSync,
    getAllSync: mockGetAllSync,
  }),
}));

jest.mock('../../context/EventContext', () => ({
  useEvent: () => ({
    selectedEventId: 'evt-1',
    getSelectedEvent: () => ({ id: 'evt-1', name: 'Festival du Code' }),
  }),
}));

describe('PlanningScreen - Screens', () => {
  
  beforeEach(() => {
    // Arrange
    jest.clearAllMocks();

    mockGetFirstSync.mockReturnValue({
      id: 'team-alpha',
      event_id: 'evt-1',
      name: 'Équipe Alpha'
    });

    mockGetAllSync.mockReturnValue([
      {
        id: '1',
        type: 'pose',
        scheduled_time: '2025-01-01T10:00:00',
        is_done: 1, 
        equipement_name: 'Barrière'
      },
      {
        id: '2',
        type: 'retrait',
        scheduled_time: '2025-01-01T12:00:00',
        is_done: 0, 
        equipement_name: 'Podium'
      }
    ]);
  });

  test('devrait afficher les infos d\'équipe et la liste d\'actions correctement', async () => {
    // Act
    const { getByText, getAllByText } = render(<PlanningScreen />);

    // Assert
    expect(getByText('Festival du Code')).toBeTruthy();
    expect(getByText('Équipe Alpha')).toBeTruthy();

    expect(getAllByText('1')).toHaveLength(2); 

    expect(getByText('Pose')).toBeTruthy();
    expect(getByText('Retrait')).toBeTruthy();
    
    expect(getAllByText('Terminée')).toBeTruthy();
    expect(getAllByText('En attente')).toBeTruthy();
  });

  test('devrait naviguer vers TeamGuidance quand on clique sur le bouton démarrer', async () => {
    // Act
    const { getByText } = render(<PlanningScreen />);
    
    const button = getByText('Commencer le guidage');
    fireEvent.press(button);

    // Assert
    expect(mockNavigate).toHaveBeenCalledWith('TeamGuidance', {
      teamId: 'team-alpha',
      teamName: 'Équipe Alpha'
    });
  });

  test('devrait basculer le scanner QR', async () => {
    // Act
    const { getByTestId, queryByTestId, getAllByText } = render(<PlanningScreen />);
    
    const qrIcon = getAllByText('Icon-qrcode-scan')[0];
    fireEvent.press(qrIcon);

    // Assert
    expect(getByTestId('mock-qr-scanner')).toBeTruthy();

    // Act
    fireEvent.press(getAllByText('Retour')[0]);

    // Assert
    expect(queryByTestId('mock-qr-scanner')).toBeNull();
  });

  test('devrait gérer l\'état vide (aucune équipe trouvée)', async () => {
    // Arrange
    mockGetFirstSync.mockReturnValue(null);

    // Act
    const { getByText } = render(<PlanningScreen />);

    // Assert
    expect(getByText('Aucune équipe pour cet événement')).toBeTruthy();
  });
});
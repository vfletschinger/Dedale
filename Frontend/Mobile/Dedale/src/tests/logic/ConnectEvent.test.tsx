import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ConnectEvent, { sortEventsByStatus } from '../../screens/ConnectEvent';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => <>{children}</>,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

const mockRefreshEvents = jest.fn();
const mockSetSelectedEventId = jest.fn();
let mockEventsReturn: any[] = []; 

jest.mock('../../context/EventContext', () => ({
  useEvent: () => ({
    events: mockEventsReturn,
    refreshEvents: mockRefreshEvents,
    setSelectedEventId: mockSetSelectedEventId,
  }),
}));

const mockGetFirstSync = jest.fn();
jest.mock('../../../assets/migrations', () => ({
  getDatabase: () => ({
    getFirstSync: mockGetFirstSync,
  }),
}));

jest.mock('../../components/QrCodeScanner', () => {
  const { View, Text } = require('react-native');
  return () => <View testID="mock-qr-scanner"><Text>Scanner View</Text></View>;
});

jest.mock('../../components/EventItem', () => {
  const { View, Text, Pressable } = require('react-native');
  return ({ event, onPress }: any) => (
    <Pressable onPress={() => onPress(event)} testID={`event-item-${event.id}`}>
      <Text>{event.name}</Text>
    </Pressable>
  );
});

jest.mock('@expo/vector-icons', () => ({
  Feather: 'Icon',
}));

describe('Screen: ConnectEvent', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockEventsReturn = []; 
    mockGetFirstSync.mockReturnValue({ count: 0 });
  });

  test('should render empty state correctly', () => {
    // Arrange
    mockEventsReturn = [];

    // Act
    const { getByText } = render(<ConnectEvent />);
    
    // Assert
    expect(getByText('Sélectionner un événement')).toBeTruthy();
    expect(getByText('Aucun événement disponible')).toBeTruthy();
    expect(mockRefreshEvents).toHaveBeenCalledTimes(1);
  });

  test('should render a list of events', () => {
    // Arrange
    mockEventsReturn = [
      { id: '1', name: 'Festival 2024', status: 'actif' },
      { id: '2', name: 'Marathon', status: 'planifié' },
    ];

    // Act
    const { getByText } = render(<ConnectEvent />);

    // Assert
    expect(getByText('Festival 2024')).toBeTruthy();
    expect(getByText('Marathon')).toBeTruthy();
  });

  test('should toggle QR Scanner view', () => {
    // Arrange
    const { getByText, getByTestId, queryByTestId } = render(<ConnectEvent />);

    // Act & Assert
    fireEvent.press(getByText('Scanner un QR Code'));
    expect(getByTestId('mock-qr-scanner')).toBeTruthy();

    fireEvent.press(getByText('Retour'));
    expect(queryByTestId('mock-qr-scanner')).toBeNull();
  });

  test('should handle event selection: fetch stats, set context, and navigate', () => {
    // Arrange
    const fakeEvent = { id: 'evt-1', name: 'Super Event', status: 'actif' };
    mockEventsReturn = [fakeEvent];
    
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    const { getByTestId } = render(<ConnectEvent />);
    fireEvent.press(getByTestId('event-item-evt-1'));

    // Assert
    expect(mockGetFirstSync).toHaveBeenCalledTimes(6);
    expect(mockSetSelectedEventId).toHaveBeenCalledWith('evt-1');
    expect(mockNavigate).toHaveBeenCalledWith('Tabs');

    consoleSpy.mockRestore();
  });
});

describe('Helper: sortEventsByStatus', () => {
  test('should sort events by priority: actif > planifié > passé', () => {
    // Arrange
    const mixedEvents: any[] = [
      { id: '1', name: 'Passé', status: 'passé' },
      { id: '2', name: 'Actif', status: 'actif' },
      { id: '3', name: 'Planifié', status: 'planifié' },
      { id: '4', name: 'Inconnu', status: 'autre' },
    ];

    // Act
    const sorted = sortEventsByStatus(mixedEvents);

    // Assert
    expect(sorted[0].status).toBe('actif');
    expect(sorted[1].status).toBe('planifié');
    expect(sorted[2].status).toBe('passé');
    expect(sorted[3].status).toBe('autre');
  });

  test('should handle missing status gracefully', () => {
    const events: any[] = [
      { id: '1', name: 'No Status' },
      { id: '2', name: 'Actif', status: 'actif' },
    ];

    const sorted = sortEventsByStatus(events);

    expect(sorted[0].status).toBe('actif');
    expect(sorted[1].name).toBe('No Status');
  });
});
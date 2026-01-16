import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import SettingsScreen from '../../screens/Settings';
import { Alert } from 'react-native';


const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

jest.mock('../../components/CustomButton', () => {
  const { Pressable, Text } = require('react-native');
  return ({ onPress, title, disabled }: any) => (
    <Pressable onPress={onPress} disabled={disabled} testID={`btn-${title}`}>
      <Text>{title}</Text>
    </Pressable>
  );
});

jest.mock('../../components/EventItem', () => {
  const { View, Text } = require('react-native');
  return ({ event }: any) => <View><Text>{event.name}</Text></View>;
});

jest.mock('../../components/QrCodeScanner', () => {
  const { View, Button } = require('react-native');
  return ({ setScanQR, onExportSuccess }: any) => (
    <View testID="mock-scanner">
      <Button title="CloseScanner" onPress={() => setScanQR(false)} />
      <Button title="TriggerSuccess" onPress={onExportSuccess} />
    </View>
  );
});

const mockRunSync = jest.fn();
const mockGetAllSync = jest.fn();

jest.mock('../../../assets/migrations', () => ({
  __esModule: true,
  default: () => ({
    runSync: mockRunSync,
    getAllSync: mockGetAllSync,
  }),
}));

const mockSetSelectedEventId = jest.fn();
const mockRefreshEvents = jest.fn();
const mockSendEvent = jest.fn();

let mockEvents = [
  { id: 'evt-1', name: 'Event A', description: 'Desc A' },
  { id: 'evt-2', name: 'Event B', description: 'Desc B' },
];
let mockSelectedEventId: string | null = 'evt-1';

jest.mock('../../context/EventContext', () => ({
  useEvent: () => ({
    selectedEventId: mockSelectedEventId,
    setSelectedEventId: mockSetSelectedEventId,
    events: mockEvents,
    refreshEvents: mockRefreshEvents,
    getSelectedEvent: () => mockEvents.find(e => e.id === mockSelectedEventId),
  }),
}));

jest.mock('../../context/WebSocketContext', () => ({
  useWebSocket: () => ({
    isConnected: true,
    sendEvent: mockSendEvent,
  }),
}));

jest.mock('@expo/vector-icons/Feather', () => 'Icon-Feather');


describe('SettingsScreen : Screen', () => {
  
  beforeEach(() => {
    // Arrange
    jest.clearAllMocks();
    mockSelectedEventId = 'evt-1';
  });

  test('devrait rendre l\'événement actuel et les boutons de paramètres', () => {
    // Act
    const { getByText, getByTestId } = render(<SettingsScreen />);

    // Assert
    expect(getByText('Event A')).toBeTruthy();
    expect(getByTestId('btn-📥 Recevoir des événements')).toBeTruthy();
    expect(getByTestId('btn-📤 Envoyer l\'événement au bureau')).toBeTruthy();
  });

  test('devrait ouvrir le modal et permettre de changer d\'événement', async () => {
    // Act
    const { getByText } = render(<SettingsScreen />);
    
    fireEvent.press(getByText("Changer d'événement"));

    // Assert
    expect(getByText('Choisir un événement')).toBeTruthy();
    expect(getByText('Event B')).toBeTruthy();

    // Act
    fireEvent.press(getByText('Event B'));

    // Assert
    expect(mockSetSelectedEventId).toHaveBeenCalledWith('evt-2');
  });

  test('devrait gérer le mode "Recevoir" : ouvrir le scanner', () => {
    // Act
    const { getByTestId } = render(<SettingsScreen />);
    
    fireEvent.press(getByTestId('btn-📥 Recevoir des événements'));

    // Assert
    expect(getByTestId('mock-scanner')).toBeTruthy();
  });

  test('devrait gérer le mode "Envoyer" : ouvrir le scanner et déclencher la suppression en cas de succès', async () => {
    // Arrange
    mockSelectedEventId = 'evt-1';

    // Act
    const { getByTestId, getByText } = render(<SettingsScreen />);
    
    fireEvent.press(getByTestId('btn-📤 Envoyer l\'événement au bureau'));

    // Assert
    expect(getByTestId('mock-scanner')).toBeTruthy();
    fireEvent.press(getByText('TriggerSuccess'));

    // Assert
    expect(mockRunSync).toHaveBeenCalledWith("DELETE FROM parcours WHERE event_id = ?", ['evt-1']);
    expect(mockRunSync).toHaveBeenCalledWith("DELETE FROM zone WHERE event_id = ?", ['evt-1']);
    expect(mockRunSync).toHaveBeenCalledWith("DELETE FROM point WHERE event_id = ?", ['evt-1']);
    expect(mockRunSync).toHaveBeenCalledWith("DELETE FROM event WHERE id = ?", ['evt-1']);
    expect(mockRefreshEvents).toHaveBeenCalled();
  });

  test('devrait empêcher l\'envoi si aucun événement sélectionné', () => {
    // Arrange
    mockSelectedEventId = null;

    // Act
    const { getByTestId } = render(<SettingsScreen />);
    const sendBtn = getByTestId('btn-📤 Envoyer l\'événement au bureau');

    // Assert
    expect(sendBtn.props.accessibilityState?.disabled).toBe(true);
  });
});
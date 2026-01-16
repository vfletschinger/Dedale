import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import SettingsScreen from '../../screens/Settings';
import { Alert } from 'react-native';

// --- MOCKS ---

// 1. Navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// 2. Alert (pour éviter les crashs natifs)
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// 3. Components
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

// Mock du Scanner pour simuler le succès de l'export
jest.mock('../../components/QrCodeScanner', () => {
  const { View, Button } = require('react-native');
  return ({ setScanQR, onExportSuccess }: any) => (
    <View testID="mock-scanner">
      <Button title="CloseScanner" onPress={() => setScanQR(false)} />
      <Button title="TriggerSuccess" onPress={onExportSuccess} />
    </View>
  );
});

// 4. Database (Critique pour la suppression)
const mockRunSync = jest.fn();
const mockGetAllSync = jest.fn();

jest.mock('../../../assets/migrations', () => ({
  __esModule: true,
  default: () => ({
    runSync: mockRunSync,
    getAllSync: mockGetAllSync,
  }),
}));

// 5. Contexts
const mockSetSelectedEventId = jest.fn();
const mockRefreshEvents = jest.fn();
const mockSendEvent = jest.fn();

// État initial du contexte événement
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

// 6. Icons
jest.mock('@expo/vector-icons/Feather', () => 'Icon-Feather');


describe('Screen: SettingsScreen', () => {
  
  beforeEach(() => {
    // ARRANGE
    jest.clearAllMocks();
    mockSelectedEventId = 'evt-1'; // Reset sélection par défaut
  });

  test('should render rendering current event and settings buttons', () => {
    // ACT
    const { getByText, getByTestId } = render(<SettingsScreen />);

    // ASSERT
    expect(getByText('Event A')).toBeTruthy();
    expect(getByTestId('btn-📥 Recevoir des événements')).toBeTruthy();
    expect(getByTestId('btn-📤 Envoyer l\'événement au bureau')).toBeTruthy();
  });

  test('should open modal and allow changing event', async () => {
    // ACT
    const { getByText } = render(<SettingsScreen />);
    
    // Ouvrir la modale
    fireEvent.press(getByText("Changer d'événement"));

    // ASSERT - Vérifier que la liste s'affiche
    expect(getByText('Choisir un événement')).toBeTruthy();
    expect(getByText('Event B')).toBeTruthy();

    // ACT - Sélectionner Event B
    fireEvent.press(getByText('Event B'));

    // ASSERT - Vérifier l'appel au contexte
    expect(mockSetSelectedEventId).toHaveBeenCalledWith('evt-2');
  });

  test('should handle "Receive" mode: open scanner', () => {
    // ACT
    const { getByTestId } = render(<SettingsScreen />);
    
    fireEvent.press(getByTestId('btn-📥 Recevoir des événements'));

    // ASSERT
    expect(getByTestId('mock-scanner')).toBeTruthy();
  });

  test('should handle "Send" mode: open scanner and trigger delete on success', async () => {
    // ARRANGE
    // On s'assure qu'un event est sélectionné pour activer le bouton
    mockSelectedEventId = 'evt-1';

    // ACT
    const { getByTestId, getByText } = render(<SettingsScreen />);
    
    // 1. Clic sur Envoyer
    fireEvent.press(getByTestId('btn-📤 Envoyer l\'événement au bureau'));

    // ASSERT
    expect(getByTestId('mock-scanner')).toBeTruthy();

    // 2. Simuler le succès de l'export (via le mock du scanner qui appelle onExportSuccess)
    fireEvent.press(getByText('TriggerSuccess'));

    // ASSERT - Vérification de la suppression en cascade dans la DB
    // On vérifie que les appels SQL de suppression sont faits
    expect(mockRunSync).toHaveBeenCalledWith("DELETE FROM parcours WHERE event_id = ?", ['evt-1']);
    expect(mockRunSync).toHaveBeenCalledWith("DELETE FROM zone WHERE event_id = ?", ['evt-1']);
    expect(mockRunSync).toHaveBeenCalledWith("DELETE FROM point WHERE event_id = ?", ['evt-1']);
    expect(mockRunSync).toHaveBeenCalledWith("DELETE FROM event WHERE id = ?", ['evt-1']);
    
    // Vérifier le rafraîchissement
    expect(mockRefreshEvents).toHaveBeenCalled();
  });

  test('should prevent sending if no event selected', () => {
    // ARRANGE
    mockSelectedEventId = null; // Pas d'événement

    // ACT
    const { getByTestId } = render(<SettingsScreen />);
    const sendBtn = getByTestId('btn-📤 Envoyer l\'événement au bureau');

    // ASSERT
    // Le bouton est désactivé visuellement ou gère le clic via alert ?
    // Dans ton code : disabled={!selectedEvent}.
    // Donc fireEvent ne devrait rien déclencher ou on vérifie la prop.
    expect(sendBtn.props.accessibilityState?.disabled).toBe(true);
  });
});
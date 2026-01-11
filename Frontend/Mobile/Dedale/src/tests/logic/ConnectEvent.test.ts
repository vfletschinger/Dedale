jest.mock('../../../assets/migrations', () => ({
  __esModule: true,
  default: () => ({
    getAllSync: jest.fn(),
  }),
  getDatabase: jest.fn(),
}));

jest.mock('../../components/QrCodeScanner', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@expo/vector-icons/Feather', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('../../context/EventContext', () => ({
  useEvent: () => ({ setSelectedEventId: jest.fn() }),
}));

import { sortEventsByStatus } from '../../screens/ConnectEvent';

describe('Logic: ConnectEvent Sorting', () => {
  
  test('Trie les événements par priorité de statut (Actif > Planifié > Passé)', () => {
    // ARRANGE
    const events = [
      { id: 1, statut: 'passé', name: 'Vieux', description: '', dateDebut: '', dateFin: '' },
      { id: 2, statut: 'actif', name: 'Urgent', description: '', dateDebut: '', dateFin: '' },
      { id: 3, statut: 'planifié', name: 'Futur', description: '', dateDebut: '', dateFin: '' },
      { id: 4, statut: 'actif', name: 'Urgent 2', description: '', dateDebut: '', dateFin: '' },
    ];

    // ACT  
    // @ts-ignore
    const result = sortEventsByStatus(events);

    // Assert
    const ids = result.map(e => e.id);
    expect(ids).toEqual([2, 4, 3, 1]);
  });

  test('Gère les statuts inconnus en dernier', () => {
    // ARRANGE
    const events = [
      { id: 1, statut: 'inconnu', name: '???', description: '', dateDebut: '', dateFin: '' },
      { id: 2, statut: 'actif', name: 'Urgent', description: '', dateDebut: '', dateFin: '' },
    ];

    // ACT
    // @ts-ignore
    const result = sortEventsByStatus(events);

    // ASSERT
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(1);
  });
});
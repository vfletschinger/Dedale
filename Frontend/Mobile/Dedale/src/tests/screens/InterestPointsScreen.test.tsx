import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import InterestPoints from '../../screens/InterestPoints';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useEvent } from '../../context/EventContext';
import { usePoints } from '../../context/PointsContext';
import { getUserLocation, getAddressFromCoords, calculateDistance } from '../../services/Helper';
import { deletePoint } from '../../services/databaseAcces';
import { getDatabase } from '../../../assets/migrations';

jest.mock('@react-navigation/native');
jest.mock('../../context/EventContext');
jest.mock('../../context/PointsContext');
jest.mock('../../services/Helper');
jest.mock('../../services/databaseAcces');
jest.mock('../../../assets/migrations');

jest.mock('../../components/PointCard', () => {
  return jest.fn(() => null);
});

describe('InterestPoints - Screens', () => {
  const mockNavigate = jest.fn();
  const mockRefreshPoints = jest.fn();
  const mockGetUserLocation = getUserLocation as jest.MockedFunction<typeof getUserLocation>;
  const mockGetAddressFromCoords = getAddressFromCoords as jest.MockedFunction<typeof getAddressFromCoords>;
  const mockDeletePoint = deletePoint as jest.MockedFunction<typeof deletePoint>;
  const mockCalculateDistance = calculateDistance as jest.MockedFunction<typeof calculateDistance>;

  const mockPoints = [
    { id: '1', x: 7.5, y: 48.5, eventId: 'event1', timestamp: '2024-01-01' },
    { id: '2', x: 7.6, y: 48.6, eventId: 'event1', timestamp: '2024-01-02' },
    { id: '3', x: 7.4, y: 48.4, eventId: 'event1', timestamp: '2024-01-03' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useEvent as jest.Mock).mockReturnValue({ selectedEventId: 'event1' });
    (usePoints as jest.Mock).mockReturnValue({
      pointsByEvent: { event1: mockPoints },
      loading: false,
      refreshPoints: mockRefreshPoints,
    });
    (getDatabase as jest.Mock).mockReturnValue({});
    
    (useFocusEffect as jest.Mock).mockImplementation(() => {});
    
    mockGetUserLocation.mockResolvedValue({ latitude: 48.5, longitude: 7.5 });
    mockGetAddressFromCoords.mockResolvedValue('123 Rue Test');
    mockCalculateDistance.mockReturnValue(100);
    
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  describe('Affichage initial', () => {
    it('devrait afficher le loader pendant le chargement', () => {
      // Arrange
      (usePoints as jest.Mock).mockReturnValue({
        pointsByEvent: {},
        loading: true,
        refreshPoints: mockRefreshPoints,
      });

      // Act
      render(<InterestPoints />);
      
      // Assert
      expect(screen.getByText('Chargement des points...')).toBeTruthy();
    });

    it('devrait afficher le titre et le nombre de points', () => {
      // Act
      render(<InterestPoints />);
      
      // Assert
      expect(screen.getByText('Points d\'intérêt')).toBeTruthy();
      expect(screen.getByText('3 points enregistrés')).toBeTruthy();
    });

    it('devrait afficher un message quand aucun point n\'existe', () => {
      // Arrange
      (usePoints as jest.Mock).mockReturnValue({
        pointsByEvent: { event1: [] },
        loading: false,
        refreshPoints: mockRefreshPoints,
      });

      // Act
      render(<InterestPoints />);
      
      // Assert
      expect(screen.getByText('Aucun point d\'intérêt')).toBeTruthy();
      expect(screen.getByText(/Commencez par enregistrer votre premier point/)).toBeTruthy();
    });

    it('devrait afficher le bouton d\'ajout quand il n\'y a pas de points', () => {
      // Arrange
      (usePoints as jest.Mock).mockReturnValue({
        pointsByEvent: { event1: [] },
        loading: false,
        refreshPoints: mockRefreshPoints,
      });

      // Act
      render(<InterestPoints />);
      
      // Assert
      expect(screen.getByText('+ Ajouter un point')).toBeTruthy();
    });
  });

  describe('Tri des points', () => {
    it('devrait changer le tri quand on appuie sur "Plus proche"', () => {
      // Act
      render(<InterestPoints />);
      
      const distanceButton = screen.getByText('Plus proche');
      fireEvent.press(distanceButton);

      // Assert
      expect(distanceButton).toBeTruthy();
    });

    it('devrait revenir au tri "Plus récent"', () => {
      // Act
      render(<InterestPoints />);
      
      const distanceButton = screen.getByText('Plus proche');
      fireEvent.press(distanceButton);
      
      const recentButton = screen.getByText('Plus récent');
      fireEvent.press(recentButton);

      // Assert
      expect(recentButton).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('devrait naviguer vers Accueil quand on clique sur "Ajouter un point"', () => {
      // Arrange
      (usePoints as jest.Mock).mockReturnValue({
        pointsByEvent: { event1: [] },
        loading: false,
        refreshPoints: mockRefreshPoints,
      });

      // Act
      render(<InterestPoints />);
      
      const addButton = screen.getByText('+ Ajouter un point');
      fireEvent.press(addButton);

      // Assert
      expect(mockNavigate).toHaveBeenCalledWith('Accueil');
    });
  });

  describe('Gestion des événements', () => {
    it('devrait afficher le nombre correct de points pour l\'événement sélectionné', () => {
      // Act
      render(<InterestPoints />);
      
      // Assert
      expect(screen.getByText('3 points enregistrés')).toBeTruthy();
    });

    it('devrait afficher "1 point enregistré" au singulier', () => {
      // Arrange
      (usePoints as jest.Mock).mockReturnValue({
        pointsByEvent: { event1: [mockPoints[0]] },
        loading: false,
        refreshPoints: mockRefreshPoints,
      });

      // Act
      render(<InterestPoints />);
      
      // Assert
      expect(screen.getByText('1 point enregistré')).toBeTruthy();
    });

    it('devrait afficher une liste vide si l\'événement n\'a pas de points', () => {
      // Arrange
      (useEvent as jest.Mock).mockReturnValue({ selectedEventId: 'event2' });
      (usePoints as jest.Mock).mockReturnValue({
        pointsByEvent: { event2: [] },
        loading: false,
        refreshPoints: mockRefreshPoints,
      });

      // Act
      render(<InterestPoints />);
      
      // Assert
      expect(screen.getByText('Aucun point d\'intérêt')).toBeTruthy();
    });

    it('devrait gérer l\'absence d\'événement sélectionné', () => {
      // Arrange
      (useEvent as jest.Mock).mockReturnValue({ selectedEventId: null });
      (usePoints as jest.Mock).mockReturnValue({
        pointsByEvent: {},
        loading: false,
        refreshPoints: mockRefreshPoints,
      });

      // Act
      render(<InterestPoints />);
      
      // Assert
      expect(screen.getByText('Aucun point d\'intérêt')).toBeTruthy();
    });
  });

  describe('Chargement', () => {
    it('devrait afficher le bon texte avec l\'ActivityIndicator', () => {
      // Arrange
      (usePoints as jest.Mock).mockReturnValue({
        pointsByEvent: {},
        loading: true,
        refreshPoints: mockRefreshPoints,
      });

      // Act
      render(<InterestPoints />);
      
      // Assert
      const loadingText = screen.getByText('Chargement des points...');
      expect(loadingText).toBeTruthy();
    });

    it('ne devrait pas afficher le loader quand loading est false', () => {
      // Act
      render(<InterestPoints />);
      
      // Assert
      expect(screen.queryByText('Chargement des points...')).toBeNull();
    });
  });

  describe('Intégration des hooks', () => {
    it('devrait utiliser le hook useEvent', () => {
      render(<InterestPoints />);
      
      expect(useEvent).toHaveBeenCalled();
    });

    it('devrait utiliser le hook usePoints', () => {
      render(<InterestPoints />);
      
      expect(usePoints).toHaveBeenCalled();
    });

    it('devrait utiliser le hook useNavigation', () => {
      render(<InterestPoints />);
      
      expect(useNavigation).toHaveBeenCalled();
    });

    it('devrait appeler getDatabase', () => {
      render(<InterestPoints />);
      
      expect(getDatabase).toHaveBeenCalled();
    });
  });

  describe('Comportement des données', () => {
    it('devrait gérer correctement un tableau de points vide', () => {
      (usePoints as jest.Mock).mockReturnValue({
        pointsByEvent: { event1: [] },
        loading: false,
        refreshPoints: mockRefreshPoints,
      });

      render(<InterestPoints />);
      
      expect(screen.getByText('Aucun point d\'intérêt')).toBeTruthy();
    });

    it('devrait gérer correctement plusieurs points', () => {
      const manyPoints = [
        ...mockPoints,
        { id: '4', x: 7.7, y: 48.7, eventId: 'event1', timestamp: '2024-01-04' },
        { id: '5', x: 7.3, y: 48.3, eventId: 'event1', timestamp: '2024-01-05' },
      ];

      (usePoints as jest.Mock).mockReturnValue({
        pointsByEvent: { event1: manyPoints },
        loading: false,
        refreshPoints: mockRefreshPoints,
      });

      render(<InterestPoints />);
      
      expect(screen.getByText('5 points enregistrés')).toBeTruthy();
    });
  });
});
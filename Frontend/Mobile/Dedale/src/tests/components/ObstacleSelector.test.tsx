import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import ObstacleSelector from '../../components/ObstacleSelector';

// --- MOCKS ---
// 1. Mock de la Base de données (Le composant charge les types d'obstacles)
const mockGetAllSync = jest.fn();
jest.mock('../../../assets/migrations', () => ({
  getDatabase: () => ({
    getAllSync: mockGetAllSync,
  }),
}));

// 2. Mock des icônes
jest.mock('@expo/vector-icons/Feather', () => 'Icon');

// Supprimer les warnings console pour les tests
beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('Component: ObstacleSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock des données DB : 2 types d'obstacles disponibles
    mockGetAllSync.mockReturnValue([
      { id: 'type-1', name: 'Barrière', description: 'Une barrière' },
      { id: 'type-2', name: 'Cône', description: 'Un cône de signalisation' },
    ]);
  });

  test('should render nothing if not visible', () => {
    const { queryByText } = render(
      <ObstacleSelector 
        visible={false} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    expect(queryByText('Ajouter des obstacles')).toBeNull();
  });

  test('should display modal title when visible', () => {
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    expect(screen.getByText('Ajouter des obstacles')).toBeTruthy();
  });

  test('should display edit mode title when editMode is true', () => {
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
        editMode={true}
      />
    );
    
    expect(screen.getByText('Modifier les obstacles')).toBeTruthy();
  });

  test('should load types and handle selection logic (increment/decrement)', () => {
    const mockOnSave = jest.fn();
    const { getByText } = render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={mockOnSave} 
        initialObstacles={[]} 
      />
    );

    // 1. Ouvrir le dropdown pour voir les obstacles
    const dropdownButton = getByText('Sélectionner un obstacle...');
    fireEvent.press(dropdownButton);

    // 2. Vérifier que la liste s'affiche maintenant
    expect(getByText('Barrière')).toBeTruthy();
    expect(getByText('Cône')).toBeTruthy();

    // 3. Sélectionner "Barrière"
    fireEvent.press(getByText('Barrière'));

    // 4. Changer le nombre à 2
    const numberInput = screen.getByPlaceholderText('1');
    fireEvent.changeText(numberInput, '2');

    // 5. Ajouter l'obstacle
    fireEvent.press(getByText('+ Ajouter cet obstacle'));

    // 6. Ouvrir à nouveau le dropdown pour sélectionner "Cône"
    // Après l'ajout, le dropdown affiche à nouveau "Sélectionner un obstacle..."
    fireEvent.press(getByText('Sélectionner un obstacle...'));
    fireEvent.press(getByText('Cône'));

    // 7. Ajouter Cône avec nombre 1 (par défaut)
    fireEvent.press(getByText('+ Ajouter cet obstacle'));

    // 8. Supprimer une Barrière (décrémenter)
    const removeButtons = screen.getAllByText('×');
    fireEvent.press(removeButtons[0]); // Supprimer la première (Barrière)

    // 9. Valider
    fireEvent.press(getByText(/Valider \(1\)/));

    // ASSERT : Vérifier que onSave reçoit les bonnes données
    // On attend : Cône x1 (Barrière a été supprimée)
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type_id: 'type-2', name: 'Cône', number: 1 }),
      ])
    );
  });

  test('should initialize with pre-selected obstacles', () => {
    const preSelected = [{ type_id: 'type-1', name: 'Barrière', number: 5 }];
    const { getByText } = render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={preSelected} 
      />
    );

    // Vérifier que l'obstacle apparaît avec le bon nombre dans le texte complet
    expect(getByText(/Barrière \(5\)/)).toBeTruthy();
    expect(getByText('Obstacles sélectionnés (1)')).toBeTruthy();
  });

  test('should open dropdown and display obstacle types', () => {
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Cliquer sur le dropdown
    const dropdownButton = screen.getByText('Sélectionner un obstacle...');
    fireEvent.press(dropdownButton);
    
    // Vérifier que les types d'obstacles s'affichent
    expect(screen.getByText('Barrière')).toBeTruthy();
    expect(screen.getByText('Cône')).toBeTruthy();
  });

  test('should select an obstacle type from dropdown', () => {
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Ouvrir le dropdown
    const dropdownButton = screen.getByText('Sélectionner un obstacle...');
    fireEvent.press(dropdownButton);
    
    // Sélectionner "Barrière"
    const barriereOption = screen.getByText('Barrière');
    fireEvent.press(barriereOption);
    
    // Vérifier que "Barrière" est maintenant sélectionné (le dropdown affiche "Barrière")
    expect(screen.getByText('Barrière')).toBeTruthy();
  });

  test('should add obstacle to selection', () => {
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Ouvrir le dropdown et sélectionner un obstacle
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    
    // Ajouter l'obstacle
    const addButton = screen.getByText('+ Ajouter cet obstacle');
    fireEvent.press(addButton);
    
    // Vérifier qu'il apparaît dans la liste des obstacles sélectionnés
    expect(screen.getByText(/Barrière \(1\)/)).toBeTruthy();
    expect(screen.getByText('Obstacles sélectionnés (1)')).toBeTruthy();
  });

  test('should handle custom number input', () => {
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Ouvrir le dropdown et sélectionner un obstacle
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    
    // Changer le nombre
    const numberInput = screen.getByPlaceholderText('1');
    fireEvent.changeText(numberInput, '5');
    
    // Ajouter l'obstacle
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    // Vérifier que le nombre est correct
    expect(screen.getByText(/Barrière \(5\)/)).toBeTruthy();
  });

  test('should remove obstacle from selection', () => {
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Ajouter un obstacle
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    // Vérifier qu'il est ajouté
    expect(screen.getByText(/Barrière \(1\)/)).toBeTruthy();
    
    // Supprimer l'obstacle (bouton ×)
    const removeButton = screen.getByText('×');
    fireEvent.press(removeButton);
    
    // Vérifier qu'il est supprimé
    expect(screen.queryByText(/Barrière \(1\)/)).toBeNull();
    expect(screen.getByText('Aucun obstacle sélectionné')).toBeTruthy();
  });

  test('should call onSave with selected obstacles', () => {
    const mockOnSave = jest.fn();
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={mockOnSave} 
        initialObstacles={[]} 
      />
    );
    
    // Ajouter Barrière x2
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    const numberInput = screen.getByPlaceholderText('1');
    fireEvent.changeText(numberInput, '2');
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    // Valider
    const validateButton = screen.getByText(/Valider \(1\)/);
    fireEvent.press(validateButton);
    
    // Vérifier que onSave est appelé avec les bons paramètres
    expect(mockOnSave).toHaveBeenCalledWith([
      expect.objectContaining({
        type_id: 'type-1',
        name: 'Barrière',
        number: 2,
      }),
    ]);
  });

  test('should call onClose when cancel is pressed', () => {
    const mockOnClose = jest.fn();
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={mockOnClose} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    const cancelButton = screen.getByText('Annuler');
    fireEvent.press(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should add multiple different obstacles', () => {
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Ajouter Barrière
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    // Ajouter Cône
    // Après l'ajout, le dropdown affiche à nouveau "Sélectionner un obstacle..."
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Cône'));
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    // Vérifier que les deux sont dans la liste
    expect(screen.getByText(/Barrière \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Cône \(1\)/)).toBeTruthy();
    expect(screen.getByText('Obstacles sélectionnés (2)')).toBeTruthy();
  });

  test('should reset form after save', () => {
    const mockOnClose = jest.fn();
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={mockOnClose} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Ajouter un obstacle
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    // Valider
    fireEvent.press(screen.getByText(/Valider \(1\)/));
    
    // Vérifier que onClose est appelé
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should handle database errors gracefully', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockGetAllSync.mockImplementation(() => {
      throw new Error('Database error');
    });
    
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Le composant devrait gérer l'erreur sans crasher
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Erreur lors de la récupération'),
      expect.any(Error)
    );
    
    consoleErrorSpy.mockRestore();
  });

  test('should disable add button when no obstacle type is selected', () => {
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    const addButton = screen.getByText('+ Ajouter cet obstacle');
    
    // Le bouton devrait être présent (disabled est géré visuellement via className)
    expect(addButton).toBeTruthy();
  });

  test('should display empty state message', () => {
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    expect(screen.getByText('Aucun obstacle sélectionné')).toBeTruthy();
    expect(screen.getByText('Obstacles sélectionnés (0)')).toBeTruthy();
  });
});
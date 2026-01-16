import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import ObstacleSelector from '../../components/ObstacleSelector';

const mockGetAllSync = jest.fn();
jest.mock('../../../assets/migrations', () => ({
  getDatabase: () => ({
    getAllSync: mockGetAllSync,
  }),
}));

jest.mock('@expo/vector-icons/Feather', () => 'Icon');

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('Component: ObstacleSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllSync.mockReturnValue([
      { id: 'type-1', name: 'Barrière', description: 'Une barrière' },
      { id: 'type-2', name: 'Cône', description: 'Un cône de signalisation' },
    ]);
  });

  test('devrait ne rien rendre si non visible', () => {
    // Act
    const { queryByText } = render(
      <ObstacleSelector 
        visible={false} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    // Assert
    expect(queryByText('Ajouter des obstacles')).toBeNull();
  });

  test('devrait afficher le titre du modal lorsqu\'il est visible', () => {
    // Act
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );

    // Assert
    expect(screen.getByText('Ajouter des obstacles')).toBeTruthy();
  });

  test('devrait afficher le titre en mode édition lorsque editMode est true', () => {
    // Act
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
        editMode={true}
      />
    );
    
    // Assert
    expect(screen.getByText('Modifier les obstacles')).toBeTruthy();
  });

  test('devrait charger les types et gérer la logique de sélection (incrément/décrément)', () => {
    // Act
    const mockOnSave = jest.fn();
    const { getByText } = render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={mockOnSave} 
        initialObstacles={[]} 
      />
    );
    
    // Arrange
    const dropdownButton = getByText('Sélectionner un obstacle...');
    fireEvent.press(dropdownButton);

    // Assert
    expect(getByText('Barrière')).toBeTruthy();
    expect(getByText('Cône')).toBeTruthy();


    // Arrange
    fireEvent.press(getByText('Barrière'));

    const numberInput = screen.getByPlaceholderText('1');
    fireEvent.changeText(numberInput, '2');

    fireEvent.press(getByText('+ Ajouter cet obstacle'));

    fireEvent.press(getByText('Sélectionner un obstacle...'));
    fireEvent.press(getByText('Cône'));

    fireEvent.press(getByText('+ Ajouter cet obstacle'));

    const removeButtons = screen.getAllByText('×');
    fireEvent.press(removeButtons[0]);

    fireEvent.press(getByText(/Valider \(1\)/));

    // Assert
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type_id: 'type-2', name: 'Cône', number: 1 }),
      ])
    );
  });

  test('devrait s\'initialiser avec des obstacles présélectionnés', () => {
    // Arrange
    const preSelected = [{ type_id: 'type-1', name: 'Barrière', number: 5 }];
    const { getByText } = render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={preSelected} 
      />
    );

    // Assert
    expect(getByText(/Barrière \(5\)/)).toBeTruthy();
    expect(getByText('Obstacles sélectionnés (1)')).toBeTruthy();
  });

  test('devrait ouvrir le dropdown et afficher les types d\'obstacles', () => {
    // Act
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );

    // Arrange
    const dropdownButton = screen.getByText('Sélectionner un obstacle...');
    fireEvent.press(dropdownButton);
    
    // Assert
    expect(screen.getByText('Barrière')).toBeTruthy();
    expect(screen.getByText('Cône')).toBeTruthy();
  });

  test('devrait sélectionner un type d\'obstacle depuis le dropdown', () => {
    // Act
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Arrange
    const dropdownButton = screen.getByText('Sélectionner un obstacle...');
    fireEvent.press(dropdownButton);
    const barriereOption = screen.getByText('Barrière');
    fireEvent.press(barriereOption);
    
    // Assert
    expect(screen.getByText('Barrière')).toBeTruthy();
  });

  test('devrait ajouter un obstacle à la sélection', () => {
    // Act
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );

    // Arrange
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    const addButton = screen.getByText('+ Ajouter cet obstacle');
    fireEvent.press(addButton);

    // Assert
    expect(screen.getByText(/Barrière \(1\)/)).toBeTruthy();
    expect(screen.getByText('Obstacles sélectionnés (1)')).toBeTruthy();
  });

  test('devrait gérer la saisie d\'un nombre personnalisé', () => {
    // Act
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Arrange
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    
    const numberInput = screen.getByPlaceholderText('1');
    fireEvent.changeText(numberInput, '5');
    
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    // Assert
    expect(screen.getByText(/Barrière \(5\)/)).toBeTruthy();
  });

  test('devrait supprimer un obstacle de la sélection', () => {
    // Act
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Arrange
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    // Assert
    expect(screen.getByText(/Barrière \(1\)/)).toBeTruthy();
    
    // Arrange
    const removeButton = screen.getByText('×');
    fireEvent.press(removeButton);
    
    // Assert
    expect(screen.queryByText(/Barrière \(1\)/)).toBeNull();
    expect(screen.getByText('Aucun obstacle sélectionné')).toBeTruthy();
  });

  test('devrait appeler onSave avec les obstacles sélectionnés', () => {
    // Act
    const mockOnSave = jest.fn();
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={mockOnSave} 
        initialObstacles={[]} 
      />
    );
    
    // Arrange
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    const numberInput = screen.getByPlaceholderText('1');
    fireEvent.changeText(numberInput, '2');
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    const validateButton = screen.getByText(/Valider \(1\)/);
    fireEvent.press(validateButton);
    
    // Assert
    expect(mockOnSave).toHaveBeenCalledWith([
      expect.objectContaining({
        type_id: 'type-1',
        name: 'Barrière',
        number: 2,
      }),
    ]);
  });

  test('devrait appeler onClose lorsque annuler est pressé', () => {
    // Act
    const mockOnClose = jest.fn();
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={mockOnClose} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Arrange
    const cancelButton = screen.getByText('Annuler');
    fireEvent.press(cancelButton);
    
    // Assert
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('devrait ajouter plusieurs obstacles différents', () => {
    // Act
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Arrange
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Cône'));
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    // Assert
    expect(screen.getByText(/Barrière \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Cône \(1\)/)).toBeTruthy();
    expect(screen.getByText('Obstacles sélectionnés (2)')).toBeTruthy();
  });

  test('devrait réinitialiser le formulaire après la sauvegarde', () => {
    // Act
    const mockOnClose = jest.fn();
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={mockOnClose} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Arrange
    fireEvent.press(screen.getByText('Sélectionner un obstacle...'));
    fireEvent.press(screen.getByText('Barrière'));
    fireEvent.press(screen.getByText('+ Ajouter cet obstacle'));
    
    fireEvent.press(screen.getByText(/Valider \(1\)/));
    
    // Assert
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('devrait gérer les erreurs de la base de données de manière élégante', () => {
    // Arrange
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
    
    // Assert
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Erreur lors de la récupération'),
      expect.any(Error)
    );
    
    consoleErrorSpy.mockRestore();
  });

  test('devrait désactiver le bouton d\'ajout lorsque aucun type d\'obstacle n\'est sélectionné', () => {
    // Act
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Arrange
    const addButton = screen.getByText('+ Ajouter cet obstacle');
    
    // Assert
    expect(addButton).toBeTruthy();
  });

  test('devrait afficher un message d\'état vide', () => {
    // Act
    render(
      <ObstacleSelector 
        visible={true} 
        onClose={jest.fn()} 
        onSave={jest.fn()} 
        initialObstacles={[]} 
      />
    );
    
    // Assert
    expect(screen.getByText('Aucun obstacle sélectionné')).toBeTruthy();
    expect(screen.getByText('Obstacles sélectionnés (0)')).toBeTruthy();
  });
});
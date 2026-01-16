import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { EventProvider, useEvent } from '../../context/EventContext';
import { getDatabase } from '../../../assets/migrations';

// Mock de la base de données
jest.mock('../../../assets/migrations', () => ({
  getDatabase: jest.fn(),
}));

const mockGetAllSync = jest.fn();

describe('EventContext', () => {
  beforeAll(() => {
    // Arrange
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterAll(() => {
    // Arrange
    jest.useRealTimers();
  });

  beforeEach(() => {
    // Arrange
    jest.clearAllMocks();
    (getDatabase as jest.Mock).mockReturnValue({
      getAllSync: mockGetAllSync,
    });
  });

  it('devrait lancer une erreur si utilisé en dehors du fournisseur', () => {
    // Arrange
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Act & Assert
    expect(() => renderHook(() => useEvent())).toThrow(
      'useEvent must be used within an EventProvider'
    );
    consoleSpy.mockRestore();
  });

  it('devrait récupérer les événements, calculer correctement leur statut et les trier', async () => {
    // Arrange
    const mockEvents = [
      { id: '1', name: 'Event Passé', dateDebut: '2024-01-01', dateFin: '2024-01-02' },
      { id: '2', name: 'Event Actif', dateDebut: '2024-06-01', dateFin: '2024-06-30' }, // Contient le 15 juin
      { id: '3', name: 'Event Planifié', dateDebut: '2024-12-01', dateFin: '2024-12-31' },
    ];
    mockGetAllSync.mockReturnValue(mockEvents);

    // Act
    const { result } = renderHook(() => useEvent(), { wrapper: EventProvider });
    
    // Assert
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    const events = result.current.events;
    expect(events).toHaveLength(3);

    expect(events[0].id).toBe('2'); // Actif
    expect(events[0].calculatedStatus).toBe('actif');

    expect(events[1].id).toBe('3'); // Planifié
    expect(events[1].calculatedStatus).toBe('planifié');

    expect(events[2].id).toBe('1'); // Passé
    expect(events[2].calculatedStatus).toBe('passé');
  });

  it('devrait trier les événements avec le même statut par date', async () => {
    // Arrange
    const mockEvents = [
      { id: '1', name: 'Planifié Loin', dateDebut: '2024-12-01', dateFin: '2024-12-02' },
      { id: '2', name: 'Planifié Proche', dateDebut: '2024-08-01', dateFin: '2024-08-02' },
    ];
    mockGetAllSync.mockReturnValue(mockEvents);

    // Act
    const { result } = renderHook(() => useEvent(), { wrapper: EventProvider });

    // Assert
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    expect(result.current.events[0].id).toBe('2');
    expect(result.current.events[1].id).toBe('1');
  });

  it('devrait gérer la sélection d\'événement', async () => {
    // Arrange
    const mockEvents = [
      { id: '100', name: 'Test Event', dateDebut: '2024-06-15', dateFin: '2024-06-15' },
    ];
    mockGetAllSync.mockReturnValue(mockEvents);
    const { result } = renderHook(() => useEvent(), { wrapper: EventProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Act
    act(() => {
      result.current.setSelectedEventId('100');
    });

    // Assert
    expect(result.current.selectedEventId).toBe('100');
    expect(result.current.getSelectedEvent()?.id).toBe('100');
  });

  it('devrait retourner null lorsqu\'on récupère un événement sélectionné inexistant', async () => {
    // Arrange
    mockGetAllSync.mockReturnValue([]);
    const { result } = renderHook(() => useEvent(), { wrapper: EventProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Act
    act(() => {
      result.current.setSelectedEventId('999');
    });

    // Assert
    expect(result.current.getSelectedEvent()).toBeNull();
  });

  it('devrait gérer les erreurs de la base de données de manière appropriée', async () => {
    // Arrange
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetAllSync.mockImplementation(() => {
      throw new Error('DB Error');
    });

    // Act
    const { result } = renderHook(() => useEvent(), { wrapper: EventProvider });
    
    // Assert
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith('Erreur chargement événements:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });
});
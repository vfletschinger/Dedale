import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { Text, Button } from 'react-native';
import { GeometriesProvider, useGeometries } from '../../context/GeometriesContext';

const mockGetAllAsync = jest.fn();

jest.mock('../../../assets/migrations', () => ({
  __esModule: true,
  getDatabase: () => ({
    getAllAsync: mockGetAllAsync,
  }),
  default: () => ({
    getAllAsync: mockGetAllAsync,
  }),
}));

const TestConsumer = () => {
  const { geometriesByEvent, loading, refreshGeometries } = useGeometries();
  
  if (loading) return <Text>Loading...</Text>;

  return (
    <>
      <Text testID="event-1-count">Event 1: {geometriesByEvent['1']?.length || 0}</Text>
      <Text testID="event-2-count">Event 2: {geometriesByEvent['2']?.length || 0}</Text>
      <Button title="Refresh" onPress={refreshGeometries} testID="refresh-btn" />
    </>
  );
};

describe('Contexte : Intégration GeometriesContext', () => {
  
  beforeEach(() => {
    jest.resetAllMocks(); 
  });

  test('devrait charger et grouper les géométries par event_id', async () => {
    // Arrange
    const fakeGeometries = [
      { id: 1, event_id: 1, wkt: 'POINT(0 0)', created_at: '2023-01-01' },
      { id: 2, event_id: 1, wkt: 'POLYGON(...)', created_at: '2023-01-01' },
      { id: 3, event_id: 2, wkt: 'LINESTRING(...)', created_at: '2023-01-01' },
    ];

    mockGetAllAsync
      .mockResolvedValueOnce(fakeGeometries) 
      .mockResolvedValueOnce([]); 

    // Act
    const { getByText, queryByText } = render(
      <GeometriesProvider>
        <TestConsumer />
      </GeometriesProvider>
    );

    // Assert
    await waitFor(() => expect(queryByText('Loading...')).toBeNull());
    expect(getByText('Event 1: 2')).toBeTruthy();
    expect(getByText('Event 2: 1')).toBeTruthy();
  });

  test('devrait gérer le rafraîchissement des données', async () => {
    // Arrange
    mockGetAllAsync
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
    
    const { getByTestId, queryByText, getByText } = render(
      <GeometriesProvider>
        <TestConsumer />
      </GeometriesProvider>
    );

    await waitFor(() => expect(queryByText('Loading...')).toBeNull());
    expect(getByText('Event 1: 0')).toBeTruthy();
    
    mockGetAllAsync
        .mockResolvedValueOnce([{ id: 99, event_id: 1, wkt: 'POINT(1 1)', created_at: '2023' }])
        .mockResolvedValueOnce([]);

    // Act
    await act(async () => {
        const btn = getByTestId('refresh-btn');
        fireEvent.press(btn);
    });

    // Assert
    await waitFor(() => {
        expect(getByText('Event 1: 1')).toBeTruthy();
    });
  });
});
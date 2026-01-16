import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { Text, Button } from 'react-native';
import { PointsProvider, usePoints } from '../../context/PointsContext';

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
  const { pointsByEvent, loading, refreshPoints } = usePoints();
  
  if (loading) return <Text>Loading...</Text>;

  return (
    <>
      <Text testID="event-1-count">Event 1: {pointsByEvent['1']?.length || 0}</Text>
      <Text testID="event-2-count">Event 2: {pointsByEvent['2']?.length || 0}</Text>
      <Button title="Refresh" onPress={refreshPoints} testID="refresh-btn" />
    </>
  );
};

describe('Context: PointsContext Integration', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Charge et trie les points correctement au démarrage', async () => {
    // Arrange
    const fakeDBData = [
      { id: '10', x: 1, y: 1, event_id: 1 },
      { id: '11', x: 1, y: 1, event_id: 1 },
      { id: '20', x: 2, y: 2, event_id: 2 },
    ];
    mockGetAllAsync.mockResolvedValue(fakeDBData);

    // Act
    const { getByText, queryByText } = render(
      <PointsProvider>
        <TestConsumer />
      </PointsProvider>
    );

    // Assert
    await waitFor(() => expect(queryByText('Loading...')).toBeNull());
    expect(getByText('Event 1: 2')).toBeTruthy();
    expect(getByText('Event 2: 1')).toBeTruthy();
  });

  test('Rafraichit les données quand refreshPoints est appelé', async () => {
    // Arrange
    mockGetAllAsync.mockResolvedValueOnce([]); 
    
    const { getByTestId, queryByText, getByText } = render(
      <PointsProvider>
        <TestConsumer />
      </PointsProvider>
    );

    await waitFor(() => expect(queryByText('Loading...')).toBeNull());
    expect(getByText('Event 1: 0')).toBeTruthy();
    
    mockGetAllAsync.mockResolvedValueOnce([
        { id: '99', x: 1, y: 1, event_id: 1 }
    ]);

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
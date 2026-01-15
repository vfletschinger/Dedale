import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { WebSocketProvider, useWebSocket } from '../../context/WebSocketContext';

const mockWsClient = {
  setOnResponse: jest.fn(),
  send: jest.fn(),
};

describe('WebSocketContext', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw an error if used outside of WebSocketProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => renderHook(() => useWebSocket())).toThrow(
      'useWebSocket must be used within a WebSocketProvider'
    );
    
    consoleSpy.mockRestore();
  });

  it('should provide default values', () => {
    const { result } = renderHook(() => useWebSocket(), {
      wrapper: WebSocketProvider,
    });

    expect(result.current.wsClient).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it('should update wsClient and isConnected state', () => {
    const { result } = renderHook(() => useWebSocket(), {
      wrapper: WebSocketProvider,
    });

    act(() => {
      result.current.setWsClient(mockWsClient as any);
      result.current.setIsConnected(true);
    });

    expect(result.current.wsClient).toBe(mockWsClient);
    expect(result.current.isConnected).toBe(true);
  });

  it('sendEvent should fail if wsClient is null', () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useWebSocket(), {
      wrapper: WebSocketProvider,
    });

    const success = result.current.sendEvent({}, jest.fn(), onError);

    expect(success).toBe(false);
    expect(onError).toHaveBeenCalledWith('Client WebSocket non initialisé');
  });

  it('sendEvent should fail if not connected', () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useWebSocket(), {
      wrapper: WebSocketProvider,
    });

    act(() => {
      result.current.setWsClient(mockWsClient as any);
      result.current.setIsConnected(false);
    });

    const success = result.current.sendEvent({}, jest.fn(), onError);

    expect(success).toBe(false);
    expect(onError).toHaveBeenCalledWith('Non connecté au serveur');
  });

  it('sendEvent should successfully send data', () => {
    const onResponse = jest.fn();
    const eventData = { type: 'TEST_EVENT' };
    const { result } = renderHook(() => useWebSocket(), {
      wrapper: WebSocketProvider,
    });

    act(() => {
      result.current.setWsClient(mockWsClient as any);
      result.current.setIsConnected(true);
    });

    const success = result.current.sendEvent(eventData, onResponse);

    expect(success).toBe(true);
    expect(mockWsClient.setOnResponse).toHaveBeenCalledWith(onResponse);
    expect(mockWsClient.send).toHaveBeenCalledWith(JSON.stringify(eventData));
  });

  it('sendEvent should handle exceptions during send', () => {
    const onError = jest.fn();
    mockWsClient.send.mockImplementationOnce(() => {
      throw new Error('Network failure');
    });

    const { result } = renderHook(() => useWebSocket(), {
      wrapper: WebSocketProvider,
    });

    act(() => {
      result.current.setWsClient(mockWsClient as any);
      result.current.setIsConnected(true);
    });

    const success = result.current.sendEvent({}, jest.fn(), onError);

    expect(success).toBe(false);
    expect(onError).toHaveBeenCalledWith('Network failure');
  });
});
import React, { createContext, useContext, useState, ReactNode } from "react";
import WebSocketClient, { WebSocketResponse } from "../components/WebSocketClient";

interface WebSocketContextType {
  wsClient: WebSocketClient | null;
  isConnected: boolean;
  setWsClient: (client: WebSocketClient | null) => void;
  setIsConnected: (connected: boolean) => void;
  sendEvent: (event: any, onResponse: (response: WebSocketResponse) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const sendEvent = (event: any, onResponse: (response: WebSocketResponse) => void) => {
    if (wsClient && isConnected) {
      wsClient.setOnResponse(onResponse);
      wsClient.send(JSON.stringify(event));
    }
  };

  return (
    <WebSocketContext.Provider
      value={{ wsClient, isConnected, setWsClient, setIsConnected, sendEvent }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}

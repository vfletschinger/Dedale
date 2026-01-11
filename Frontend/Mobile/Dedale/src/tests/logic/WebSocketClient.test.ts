import WebSocketClient from '../../components/WebSocketClient';

class MockWebSocket {
  onopen: () => void = () => {};
  onmessage: (e: any) => void = () => {};
  onclose: (e: any) => void = () => {};
  onerror: (e: any) => void = () => {};
  send = jest.fn();
  close = jest.fn();
  readyState = 1;

  constructor(public url: string) {
    setTimeout(() => {
        if (this.onopen) this.onopen();
    }, 10);
  }
}

const originalWebSocket = global.WebSocket;

describe('Logic: WebSocketClient', () => {
  let client: WebSocketClient;

  beforeAll(() => {
    global.WebSocket = MockWebSocket as any;
  });

  afterAll(() => {
    global.WebSocket = originalWebSocket;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.WebSocket = MockWebSocket as any;
    client = new WebSocketClient('ws://test.local');
  });

  test('Se connecte et reçoit des messages JSON valides', async () => {
    // ARRANGE
    const onMessageMock = jest.fn();
    const mockEvents = [{ id: 1, name: "Event Test" }];
    
    // ACT
    const connectPromise = client.connect(onMessageMock);
    await new Promise(r => setTimeout(r, 20));
    await connectPromise;
    const mockWsInstance = client['ws'] as unknown as MockWebSocket;
    if (mockWsInstance.onmessage) {
        mockWsInstance.onmessage({ data: JSON.stringify(mockEvents) });
    }

    // ASSERT
    expect(client.isConnected).toBe(true);
    expect(onMessageMock).toHaveBeenCalledWith(mockEvents);
  });

  test('Gère le message spécial "fini"', async () => {
    // ARRANGE
    const onFinishedMock = jest.fn();
    client.setCallbacks(onFinishedMock);
    await client.connect();
    await new Promise(r => setTimeout(r, 20));
    const mockWsInstance = client['ws'] as unknown as MockWebSocket;

    // ACT
    mockWsInstance.onmessage({ data: "fini" });

    // ASSERT
    expect(onFinishedMock).toHaveBeenCalled();
  });

  test('Envoie des données correctement', async () => {
    // ARRANGE
    await client.connect();
    await new Promise(r => setTimeout(r, 20));
    const mockWsInstance = client['ws'] as unknown as MockWebSocket;

    // ACT
    client.send("Hello Server");

    // ASSERT
    expect(mockWsInstance.send).toHaveBeenCalledWith("Hello Server");
  });

  test('Détecte une erreur de connexion', async () => {
    // ARRANGE
    class FailWebSocket {
        onopen: any;
        onerror: any;
        close = jest.fn();
        
        constructor(url: string) {
            setTimeout(() => {
                if (this.onerror) this.onerror(new Event('error'));
            }, 10);
        }
    }
    
    global.WebSocket = FailWebSocket as any;
    
    client = new WebSocketClient('ws://fail.local');

    // ACT & ASSERT
    await expect(client.connect()).rejects.toEqual("Erreur de connexion WebSocket");
  });
});
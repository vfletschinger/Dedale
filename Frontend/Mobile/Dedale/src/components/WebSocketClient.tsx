import { EventType } from "../types/database";

/**
 * Gère la connexion et la communication avec une WebSocket.
 */
class WebSocketClient {
  private uri: string;
  private ws: WebSocket | null = null;
  public isConnected: boolean = false;
  private onMessageCallback?: (events: EventType[]) => void;

  constructor(uri: string) {
    this.uri = uri;
    console.log(`WebSocketClient initialisé pour l'URI: ${this.uri}`);
  }

  /**
   * Tente d'établir la connexion WebSocket.
   */
  public connect(onMessage?: (events: EventType[]) => void): Promise<boolean> {
    this.onMessageCallback = onMessage;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.uri);

      this.ws.onopen = () => {
        console.log("✅ WebSocket connectée avec succès.");
        this.isConnected = true;
        resolve(true);
      };

      this.ws.onmessage = (e: WebSocketMessageEvent) => {
        console.log("🔔 Message reçu:", e.data);
        try {
          const events: EventType[] = JSON.parse(e.data);
          console.log("📦 Événements reçus:", events);
          if (this.onMessageCallback) {
            this.onMessageCallback(events);
          }
        } catch (error) {
          console.error("❌ Erreur lors du parsing des événements:", error);
        }
      };

      this.ws.onerror = (e: Event) => {
        const err = e as WebSocketErrorEvent;
        console.error("❌ Erreur WebSocket:", err?.message ?? e);
        this.isConnected = false;
        reject(err?.message ?? "WebSocket error");
      };

      this.ws.onclose = (e: WebSocketCloseEvent) => {
        console.log("🚪 WebSocket fermée.", e.code, e.reason);
        this.isConnected = false;
      };
    });
  }

  /**
   * Ferme la connexion WebSocket.
   */
  public close(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export default WebSocketClient;

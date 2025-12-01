import { EventType } from "../types/database";

export interface WebSocketResponse {
  code: 1 | 2 | 3;
  message: string;
}

/**
 * Gère la connexion et la communication avec une WebSocket.
 */
class WebSocketClient {
  private uri: string;
  private ws: WebSocket | null = null;
  public isConnected: boolean = false;
  private onMessageCallback?: (events: EventType[]) => void;
  private onResponseCallback?: (response: WebSocketResponse) => void;

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
          const data = JSON.parse(e.data);
          
          // Check if it's a response with code (from desktop)
          if (data.code !== undefined) {
            const response: WebSocketResponse = data;
            console.log("📨 Réponse reçue du desktop:", response);
            if (this.onResponseCallback) {
              this.onResponseCallback(response);
            }
          } else {
            // It's events data (from desktop initial sync)
            const events: EventType[] = data;
            console.log("📦 Événements reçus:", events);
            if (this.onMessageCallback) {
              this.onMessageCallback(events);
            }
          }
        } catch (error) {
          console.error("❌ Erreur lors du parsing des données:", error);
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
   * Définit le callback pour les réponses du serveur.
   */
  public setOnResponse(callback: (response: WebSocketResponse) => void): void {
    this.onResponseCallback = callback;
  }

  /**
   * Envoie un message via la WebSocket.
   */
  public send(message: string): void {
    if (this.ws && this.isConnected) {
      console.log("📤 Envoi du message:", message);
      this.ws.send(message);
    } else {
      console.error("❌ WebSocket non connectée, impossible d'envoyer le message");
    }
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

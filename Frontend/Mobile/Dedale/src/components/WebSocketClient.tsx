import { PointDetailType } from "../types/database";

/**
 * Gère la connexion et la communication avec une WebSocket.
 */
class WebSocketClient {
  private uri: string;
  private ws: WebSocket | null = null;
  private messageQueue: PointDetailType[][] = []; 
  public isConnected: boolean = false;

  constructor(uri: string) {
    this.uri = uri;
    console.log(`WebSocketClient initialisé pour l'URI: ${this.uri}`);
  }

  /**
   * Tente d'établir la connexion WebSocket.
   */
  public connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.uri);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connectée avec succès.');
        this.isConnected = true;
        this.flushQueue(); 
        resolve(true);
      };

      this.ws.onmessage = (e: WebSocketMessageEvent) => {
        console.log('🔔 Message reçu:', e.data);
      };

      this.ws.onerror = (e: WebSocketErrorEvent) => {
        console.error('❌ Erreur WebSocket:', e.message);
        this.isConnected = false;
        reject(e.message);
      };

      this.ws.onclose = (e: WebSocketCloseEvent) => {
        console.log('🚪 WebSocket fermée.', e.code, e.reason);
        this.isConnected = false;
      };
    });
  }

  /**
   * Envoie un message JSON.
   * @param data L'objet JSON (typé CommandMessage) à envoyer.
   */
  public send(data: PointDetailType[]): void {
    if (!this.isConnected || this.ws?.readyState !== WebSocket.OPEN) {
      console.log('⏳ Connexion non établie. Mise en file d\'attente du message.');
      this.messageQueue.push(data);
    } else {
      try {
        const jsonString = JSON.stringify(data);
        this.ws.send(jsonString);
        console.log('⬆️ Message JSON envoyé:', jsonString);
      } catch (e) {
        console.error('Erreur lors de l\'envoi du message:', e);
      }
    }
  }

  /**
   * Envoie tous les messages en attente.
   */
  private flushQueue(): void {
    while (this.messageQueue.length > 0) {
      // Le type 'CommandMessage' est inféré ici
      const data = this.messageQueue.shift(); 
      if (data) {
        this.send(data);
      }
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
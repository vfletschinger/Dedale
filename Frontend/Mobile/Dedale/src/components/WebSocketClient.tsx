import { PointDetailType } from "../types/database";

/**
 * Gère la connexion et la communication avec une WebSocket.
 */
class WebSocketClient {
  private uri: string;
  private ws: WebSocket | null = null;
  private messageQueue: PointDetailType[][] = []; 
  public isConnected: boolean = false;
  public isLoading: boolean = false;
  private onFinishedCallback?: () => void;
  private onErrorCallback?: (error: string) => void;
  private onLoadingChangeCallback?: (isLoading: boolean) => void;
  private finishedSuccessfully: boolean = false;

  constructor(uri: string) {
    this.uri = uri;
    console.log(`WebSocketClient initialisé pour l'URI: ${this.uri}`);
  }

  /**
   * Définit les callbacks pour les messages de fin, d'erreur et de changement d'état de chargement
   */
  public setCallbacks(
    onFinished?: () => void, 
    onError?: (error: string) => void,
    onLoadingChange?: (isLoading: boolean) => void
  ): void {
    this.onFinishedCallback = onFinished;
    this.onErrorCallback = onError;
    this.onLoadingChangeCallback = onLoadingChange;
  }

  /**
   * Met à jour l'état de chargement
   */
  private setLoading(loading: boolean): void {
    this.isLoading = loading;
    if (this.onLoadingChangeCallback) {
      this.onLoadingChangeCallback(loading);
    }
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

      this.ws.onmessage = (e: MessageEvent) => {
        console.log('🔔 Message reçu du serveur:', e.data);
        console.log('🔍 Type de message:', typeof e.data);
        console.log('🔍 Longueur du message:', e.data?.length);
        console.log('📡 État WebSocket à la réception:', this.ws?.readyState);
        
        // Traiter les messages spéciaux
        if (e.data === 'fini') {
          console.log('✅ Message "fini" reçu ! Insertion terminée avec succès !');
          this.finishedSuccessfully = true; // Marquer le succès
          this.setLoading(false);
          if (this.onFinishedCallback) {
            console.log('🔄 Appel du callback onFinished');
            this.onFinishedCallback();
          } else {
            console.log('⚠️ Callback onFinished non défini');
          }
        } else if (e.data.startsWith('erreur:')) {
          console.log('❌ Erreur d\'insertion reçue:', e.data);
          this.setLoading(false);
          if (this.onErrorCallback) {
            this.onErrorCallback(e.data);
          }
        } else if (e.data.startsWith('erreur_json:')) {
          console.log('❌ Erreur JSON reçue:', e.data);
          this.setLoading(false);
          if (this.onErrorCallback) {
            this.onErrorCallback(e.data);
          }
        } else {
          console.log('🤔 Message non reconnu:', e.data);
          // Si c'est un message non reconnu mais qu'on est en loading, peut-être que c'est un écho
          if (this.isLoading) {
            console.log('📝 Message reçu pendant le chargement, possiblement un écho');
          }
        }
      };

      this.ws.onerror = (e: Event) => {
        console.error('❌ Erreur WebSocket:', e);
        this.isConnected = false;
        this.setLoading(false);
        reject('Erreur de connexion WebSocket');
      };

      this.ws.onclose = (e: CloseEvent) => {
        console.log('🚪 WebSocket fermée. Code:', e.code, 'Raison:', e.reason);
        
        // Interpréter les codes de fermeture
        let errorMessage = '';
        switch (e.code) {
          case 1000:
            console.log('✅ Fermeture normale');
            return; // Pas d'erreur pour les fermetures normales
          case 1006:
            console.log('❌ Fermeture anormale - Problème de connexion/serveur');
            // Ne pas traiter comme une erreur si on a déjà reçu "fini"
            if (this.finishedSuccessfully) {
              console.log('ℹ️ Fermeture après succès - pas d\'erreur');
              return;
            }
            errorMessage = 'Connexion perdue - Vérifiez que l\'application Tauri est démarrée';
            break;
          case 1001:
            errorMessage = 'Serveur arrêté';
            break;
          case 1002:
            errorMessage = 'Erreur de protocole';
            break;
          default:
            errorMessage = `Connexion fermée (code: ${e.code})`;
        }
        
        this.isConnected = false;
        this.setLoading(false);
        
        // Déclencher l'erreur seulement si nécessaire
        if (this.onErrorCallback) {
          this.onErrorCallback(errorMessage || 'Connexion interrompue');
        }
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
        this.setLoading(true); // Démarrer le chargement
        const jsonString = JSON.stringify(data);
        console.log('⬆️ Envoi du message JSON (taille:', jsonString.length, 'caractères)');
        console.log('📡 État WebSocket avant envoi:', this.ws?.readyState);
        
        this.ws.send(jsonString);
        console.log('✅ Message JSON envoyé avec succès');
        console.log('📡 État WebSocket après envoi:', this.ws?.readyState);
        
        // Ajouter un timeout de sécurité au cas où le message "fini" ne viendrait jamais
        setTimeout(() => {
          if (this.isLoading) {
            console.log('⏰ Timeout: Aucune réponse du serveur après 30 secondes');
            this.setLoading(false);
            if (this.onErrorCallback) {
              this.onErrorCallback('Timeout: Aucune réponse du serveur');
            }
          }
        }, 30000); // 30 secondes timeout
        
      } catch (e) {
        console.error('Erreur lors de l\'envoi du message:', e);
        this.setLoading(false); // Arrêter le chargement en cas d'erreur
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

  /**
   * Diagnostic de connectivité
   */
  public static async testConnectivity(uri: string): Promise<{success: boolean, error?: string}> {
    return new Promise((resolve) => {
      const testWs = new WebSocket(uri);
      
      const timeout = setTimeout(() => {
        testWs.close();
        resolve({
          success: false, 
          error: 'Timeout - Le serveur ne répond pas (5s)'
        });
      }, 5000);
      
      testWs.onopen = () => {
        clearTimeout(timeout);
        testWs.close();
        resolve({success: true});
      };
      
      testWs.onerror = () => {
        clearTimeout(timeout);
        resolve({
          success: false, 
          error: 'Impossible de se connecter - Vérifiez que l\'application Tauri est démarrée'
        });
      };
    });
  }
}

export default WebSocketClient;
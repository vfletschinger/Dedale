import {
  EventType,
  TransferEventType,
  PointDetailType,
} from "../types/database";

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
  public isLoading: boolean = false;
  private onFinishedCallback?: () => void;
  private onErrorCallback?: (error: string) => void;
  private onLoadingChangeCallback?: (isLoading: boolean) => void;
  private onCloseCallback?: () => void;
  private finishedSuccessfully: boolean = false;
  private expectedClose: boolean = false;
  private onMessageCallback?: (
    events: (EventType | TransferEventType)[]
  ) => void;
  private onResponseCallback?: (response: WebSocketResponse) => void;

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
  public connect(
    onMessage?: (events: (EventType | TransferEventType)[]) => void
  ): Promise<boolean> {
    this.onMessageCallback = onMessage;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.uri);

      this.ws.onopen = () => {
        console.log("✅ WebSocket connectée avec succès.");
        this.isConnected = true;
        resolve(true);
      };

      this.ws.onmessage = (e: MessageEvent) => {
        console.log("🔔 Message reçu du serveur:", e.data);
        console.log("🔍 Type de message:", typeof e.data);

        // Log détaillé des données brutes
        try {
          const rawData = JSON.parse(e.data);
          console.log("📋 DONNÉES BRUTES REÇUES:");
          console.log(JSON.stringify(rawData, null, 2));
          console.log("📊 Clés présentes:", Object.keys(rawData));
          if (rawData.type) console.log("   - type:", rawData.type);
          if (rawData.data) {
            console.log("   - data keys:", Object.keys(rawData.data || {}));
            if (Array.isArray(rawData.data)) {
              console.log(
                "   - data est un array de",
                rawData.data.length,
                "éléments"
              );
              if (rawData.data[0]) {
                console.log(
                  "   - Premier élément keys:",
                  Object.keys(rawData.data[0])
                );
                console.log(
                  "   - teams?:",
                  rawData.data[0].teams?.length || "absent"
                );
                console.log(
                  "   - actions?:",
                  rawData.data[0].actions?.length || "absent"
                );
              }
            }
          }
        } catch (parseErr) {
          console.log("📋 Message non-JSON:", e.data);
        }

        // Traiter les messages spéciaux (format texte)
        if (e.data === "fini") {
          console.log(
            '✅ Message "fini" reçu ! Insertion terminée avec succès !'
          );
          this.finishedSuccessfully = true;
          this.setLoading(false);
          if (this.onFinishedCallback) {
            console.log("🔄 Appel du callback onFinished");
            this.onFinishedCallback();
          } else {
            console.log("⚠️ Callback onFinished non défini");
          }
          return;
        } else if (e.data.startsWith("erreur:")) {
          console.log("❌ Erreur d'insertion reçue:", e.data);
          this.setLoading(false);
          if (this.onErrorCallback) {
            this.onErrorCallback(e.data);
          }
          return;
        } else if (e.data.startsWith("erreur_json:")) {
          console.log("❌ Erreur JSON reçue:", e.data);
          this.setLoading(false);
          if (this.onErrorCallback) {
            this.onErrorCallback(e.data);
          }
          return;
        }

        // Traiter les messages JSON (events ou responses)
        try {
          const data = JSON.parse(e.data);

          // Check if it's a message with type (new protocol)
          if (data.type !== undefined) {
            switch (data.type) {
              case "connected":
                // Serveur confirme la connexion, ne plus demander automatiquement les events
                console.log(
                  "🔗 Connecté au serveur, en attente d'événements..."
                );
                break;
              case "events":
                // Serveur envoie tous les events (batch)
                if (data.data && Array.isArray(data.data)) {
                  const events: (EventType | TransferEventType)[] = data.data;
                  console.log("📦 Événements reçus (batch):", events.length);
                  if (this.onMessageCallback) {
                    this.onMessageCallback(events);
                  }
                }
                break;
              case "event":
                // Serveur envoie un seul event (envoi individuel)
                if (data.data) {
                  const event: EventType | TransferEventType = data.data;
                  console.log(
                    "📦 Événement individuel reçu:",
                    event.id,
                    event.name
                  );
                  // Log des données associées
                  const transferData = data.data as TransferEventType;
                  console.log("   📋 teams:", transferData.teams?.length || 0);
                  console.log(
                    "   📋 actions:",
                    transferData.actions?.length || 0
                  );
                  console.log(
                    "   📋 points:",
                    transferData.points?.length || 0
                  );
                  if (transferData.actions && transferData.actions.length > 0) {
                    console.log(
                      "   📋 Première action:",
                      JSON.stringify(transferData.actions[0])
                    );
                  }
                  if (this.onMessageCallback) {
                    this.onMessageCallback([event]);
                  }
                }
                break;
              case "goodbye":
                console.log("👋 Serveur a fermé la connexion");
                this.expectedClose = true;
                if (this.onCloseCallback) {
                  this.onCloseCallback();
                }
                // Ne pas appeler ws.close() ici, le serveur ferme déjà la connexion
                // L'événement onclose sera déclenché automatiquement
                break;
              case "planning_data":
                // Traiter le planning_data - passer directement data (pas un tableau)
                console.log("📋 Planning reçu, traitement...");
                if (this.onMessageCallback) {
                  this.onMessageCallback(data);
                }
                break;
              default:
                console.log("🤔 Type de message inconnu:", data.type);
            }
            return;
          }

          // Check if it's a response with code (from desktop)
          if (data.code !== undefined) {
            const response: WebSocketResponse = data;
            console.log("📨 Réponse reçue du desktop:", response);
            if (this.onResponseCallback) {
              this.onResponseCallback(response);
            }
          } else if (data.event !== undefined && data.points !== undefined) {
            // Format d'export: { event: {...}, points: [...] }
            const event: EventType = data.event;
            const points: PointDetailType[] = data.points;
            console.log(
              "📦 Événement avec points reçu:",
              event.name,
              "- Points:",
              points.length
            );
            if (this.onMessageCallback) {
              this.onMessageCallback([event]);
            }
            // TODO: Stocker les points si nécessaire
          } else if (Array.isArray(data)) {
            // It's events data (legacy format - direct array)
            const events: EventType[] = data;
            console.log("📦 Événements reçus (format legacy):", events.length);
            if (this.onMessageCallback) {
              this.onMessageCallback(events);
            }
          } else {
            console.log(
              "⚠️ Format de message non reconnu:",
              JSON.stringify(data).substring(0, 100)
            );
          }
        } catch {
          console.log("🤔 Message non reconnu:", e.data);
          if (this.isLoading) {
            console.log(
              "📝 Message reçu pendant le chargement, possiblement un écho"
            );
          }
        }
      };

      this.ws.onerror = (e: Event) => {
        // Ne pas traiter comme erreur si on attend la fermeture
        if (!this.expectedClose) {
          console.error("❌ Erreur WebSocket - Type:", e.type);
        }
        this.isConnected = false;
        this.setLoading(false);
        if (!this.expectedClose) {
          reject("Erreur de connexion WebSocket");
        }
      };

      this.ws.onclose = (e: CloseEvent) => {
        console.log("🚪 WebSocket fermée. Code:", e.code, "Raison:", e.reason);

        // Interpréter les codes de fermeture
        let errorMessage = "";
        switch (e.code) {
          case 1000:
            console.log("✅ Fermeture normale");
            this.isConnected = false;
            return; // Pas d'erreur pour les fermetures normales
          case 1006:
            // Ne pas traiter comme une erreur si on attend la fermeture ou si terminé avec succès
            if (this.expectedClose || this.finishedSuccessfully) {
              console.log("ℹ️ Fermeture normale après goodbye/succès");
              this.isConnected = false;
              return;
            }
            console.log(
              "❌ Fermeture anormale - Problème de connexion/serveur"
            );
            errorMessage =
              "Connexion perdue - Vérifiez que l'application Tauri est démarrée";
            break;
          case 1001:
            errorMessage = "Serveur arrêté";
            break;
          case 1002:
            errorMessage = "Erreur de protocole";
            break;
          default:
            errorMessage = `Connexion fermée (code: ${e.code})`;
        }

        this.isConnected = false;
        this.setLoading(false);

        // Appeler le callback de fermeture
        if (this.onCloseCallback) {
          this.onCloseCallback();
        }

        // Déclencher l'erreur seulement si nécessaire
        if (this.onErrorCallback && errorMessage) {
          this.onErrorCallback(errorMessage);
        }
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
   * Définit le callback pour la fermeture de la connexion.
   */
  public setOnClose(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  /**
   * Envoie des données PointDetailType via la WebSocket.
   */
  public sendPointDetails(data: PointDetailType[]): void {
    if (!this.isConnected || this.ws?.readyState !== WebSocket.OPEN) {
      console.log("⏳ Connexion non établie.");
      if (this.onErrorCallback) {
        this.onErrorCallback("Connexion non établie");
      }
    } else {
      try {
        this.setLoading(true);
        const jsonString = JSON.stringify(data);
        console.log(
          "⬆️ Envoi du message JSON (taille:",
          jsonString.length,
          "caractères)"
        );
        console.log("📡 État WebSocket avant envoi:", this.ws?.readyState);

        this.ws.send(jsonString);
        console.log("✅ Message JSON envoyé avec succès");
        console.log("📡 État WebSocket après envoi:", this.ws?.readyState);

        // Ajouter un timeout de sécurité au cas où le message "fini" ne viendrait jamais
        setTimeout(() => {
          if (this.isLoading) {
            console.log(
              "⏰ Timeout: Aucune réponse du serveur après 30 secondes"
            );
            this.setLoading(false);
            if (this.onErrorCallback) {
              this.onErrorCallback("Timeout: Aucune réponse du serveur");
            }
          }
        }, 30000); // 30 secondes timeout
      } catch (e) {
        console.error("Erreur lors de l'envoi du message:", e);
        this.setLoading(false);
      }
    }
  }

  /**
   * Envoie un message texte via la WebSocket.
   */
  public send(message: string): void {
    if (this.ws && this.isConnected) {
      console.log("📤 Envoi du message:", message);
      this.ws.send(message);
    } else {
      console.error(
        "❌ WebSocket non connectée, impossible d'envoyer le message"
      );
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
  public static async testConnectivity(
    uri: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const testWs = new WebSocket(uri);

      const timeout = setTimeout(() => {
        testWs.close();
        resolve({
          success: false,
          error: "Timeout - Le serveur ne répond pas (5s)",
        });
      }, 5000);

      testWs.onopen = () => {
        clearTimeout(timeout);
        testWs.close();
        resolve({ success: true });
      };

      testWs.onerror = () => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error:
            "Impossible de se connecter - Vérifiez que l'application Tauri est démarrée",
        });
      };
    });
  }
}

export default WebSocketClient;

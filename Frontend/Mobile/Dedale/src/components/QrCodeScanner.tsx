import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  Button,
  Dimensions,
  Modal,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import WebSocketClient, { WebSocketResponse } from "./WebSocketClient";
const { width } = Dimensions.get("window");
const SCANNER_SIZE = width * 0.7;
import { getDatabase } from "../../assets/migrations";
import { useWebSocket } from "../context/WebSocketContext";
import { useEvent } from "../context/EventContext";
import { usePoints } from "../context/PointsContext";
import { useGeometries } from "../context/GeometriesContext";
import {
  EventType,
  TransferEventType,
  InterestPointsType,
  PictureType,
  EquipementType,
  ParcoursType,
  ZoneType,
} from "../types/database";

// Types pour l'export
type PointWithDetails = InterestPointsType & {
  pictures: PictureType[];
  equipements: EquipementType[];
};

type EventExportData = {
  event: any;
  points: PointWithDetails[];
};

// Nouveau type pour les données reçues du desktop
interface IncomingEventData {
  type: "event";
  data: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    points: Array<{
      id: string;
      eventId: string;
      x: number;
      y: number;
      name: string;
      comment: string | null;
      type: string | null;
      status: boolean;
    }>;
    parcours: Array<{
      id: string;
      eventId: string;
      geometryJson?: string;
      wkt?: string;
    }>;
    zones: Array<{
      id: string;
      eventId: string;
      geometryJson?: string;
      wkt?: string;
    }>;
    teams: Array<{
      id: string;
      eventId: string;
      name: string;
      members: any[];
    }>;
    actions: Array<{
      id: string;
      teamId: string;
      equipementId: string;
      actionType?: string;
      type?: string;
      scheduledTime?: string;
      scheduled_time?: string;
      isDone?: boolean;
      is_done?: number;
    }>;
    equipements: Array<{
      id: string;
      eventId: string;
      typeId: string;
      quantity: number;
      lengthPerUnit: number;
      datePose: string;
      dateDepose: string;
      coordinates: Array<{
        id: string;
        equipementId: string;
        x: number;
        y: number;
        orderIndex: number;
      }>;
    }>;
  };
}

interface QRCodeScannerProps {
  setScanQR: (value: boolean) => void;
  mode?: "receive" | "send"; // Mode: recevoir des events ou envoyer
  eventToSend?: any; // L'événement à envoyer (si mode 'send')
  onExportSuccess?: () => void; // Callback quand l'export réussit
}

const QRCodeScanner = ({
  setScanQR,
  mode = "receive",
  eventToSend,
  onExportSuccess,
}: QRCodeScannerProps) => {
  const { setWsClient, setIsConnected } = useWebSocket();
  const { refreshEvents } = useEvent();
  const { refreshPoints } = usePoints();
  const { refreshGeometries } = useGeometries();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState("Connexion en cours...");
  const [receivedCount, setReceivedCount] = useState(0);
  const [currentClient, setCurrentClient] = useState<WebSocketClient | null>(
    null
  );
  const db = getDatabase();

  if (!permission || !permission.granted) {
    return (
      <View className="scanner-container center">
        {!permission ? (
          <Text className="text-white">Chargement...</Text>
        ) : (
          <View>
            <Text className="text-white mb-4">
              Nous avons besoin de la caméra.
            </Text>
            <Button onPress={requestPermission} title="Accorder" />
          </View>
        )}
      </View>
    );
  }

  const insertEvents = (eventsData: (EventType | TransferEventType | IncomingEventData)[]) => {
    try {
      let insertedCount = 0;
      let updatedCount = 0;
      let parcoursCount = 0;
      let zonesCount = 0;
      let pointsCount = 0;
      let teamsCount = 0;
      let actionsCount = 0;
      let equipementsCount = 0;

      for (const incomingData of eventsData) {
        // Vérifier si c'est le nouveau format {type: "event", data: {...}}
        let eventData: any;
        if ((incomingData as IncomingEventData).type === "event" && (incomingData as IncomingEventData).data) {
          eventData = (incomingData as IncomingEventData).data;
        } else {
          eventData = incomingData;
        }

        // Normaliser les noms de champs (camelCase vers snake_case)
        const event: EventType = {
          id: eventData.id,
          name: eventData.name,
          description: eventData.description || "",
          dateDebut: eventData.dateDebut || eventData.startDate || "",
          dateFin: eventData.dateFin || eventData.endDate || "",
          statut: eventData.statut || "actif",
        };

        console.log("📦 Traitement événement:", event.name);

        const existing = db.getFirstSync<EventType>(
          "SELECT id FROM event WHERE id = ?",
          [event.id]
        );

        if (existing) {
          db.runSync(
            "UPDATE event SET name = ?, description = ?, dateDebut = ?, dateFin = ?, statut = ? WHERE id = ?",
            [
              event.name || "",
              event.description || "",
              event.dateDebut || "",
              event.dateFin || "",
              event.statut || "actif",
              event.id,
            ]
          );
          updatedCount++;
        } else {
          db.runSync(
            "INSERT INTO event (id, name, description, dateDebut, dateFin, statut) VALUES (?, ?, ?, ?, ?, ?)",
            [
              event.id,
              event.name || "",
              event.description || "",
              event.dateDebut || "",
              event.dateFin || "",
              event.statut || "actif",
            ]
          );
          insertedCount++;
        }

        // Insérer les parcours si présents
        if (eventData.parcours && Array.isArray(eventData.parcours)) {
          for (const parcours of eventData.parcours) {
            const existingParcours = db.getFirstSync(
              "SELECT id FROM parcours WHERE id = ?",
              [parcours.id]
            );

            const wkt = parcours.geometryJson || parcours.wkt || "";

            if (!existingParcours) {
              db.runSync(
                "INSERT INTO parcours (id, event_id, wkt) VALUES (?, ?, ?)",
                [parcours.id, event.id, wkt]
              );
              parcoursCount++;
            } else {
              db.runSync("UPDATE parcours SET wkt = ? WHERE id = ?", [
                wkt,
                parcours.id,
              ]);
            }
          }
        }

        // Insérer les zones si présentes
        if (eventData.zones && Array.isArray(eventData.zones)) {
          for (const zone of eventData.zones) {
            const existingZone = db.getFirstSync(
              "SELECT id FROM zone WHERE id = ?",
              [zone.id]
            );

            const wkt = zone.geometryJson || zone.wkt || "";

            if (!existingZone) {
              db.runSync(
                "INSERT INTO zone (id, event_id, wkt) VALUES (?, ?, ?)",
                [zone.id, event.id, wkt]
              );
              zonesCount++;
            } else {
              db.runSync("UPDATE zone SET wkt = ? WHERE id = ?", [
                wkt,
                zone.id,
              ]);
            }
          }
        }

        // Insérer les points si présents
        if (eventData.points && Array.isArray(eventData.points)) {
          for (const point of eventData.points) {
            const existingPoint = db.getFirstSync(
              "SELECT id FROM point WHERE id = ?",
              [point.id]
            );

            if (!existingPoint) {
              db.runSync(
                "INSERT INTO point (id, event_id, x, y, name, comment, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  point.id,
                  event.id,
                  point.x,
                  point.y,
                  point.name || "Point",
                  point.comment || null,
                  point.type || null,
                  point.status !== undefined ? (point.status ? 1 : 0) : 0,
                ]
              );
              pointsCount++;
            } else {
              db.runSync(
                "UPDATE point SET x = ?, y = ?, name = ?, comment = ?, type = ?, status = ? WHERE id = ?",
                [
                  point.x,
                  point.y,
                  point.name || "Point",
                  point.comment || null,
                  point.type || null,
                  point.status !== undefined ? (point.status ? 1 : 0) : 0,
                  point.id,
                ]
              );
            }
          }
        }

        // Insérer les équipes si présentes
        if (eventData.teams && Array.isArray(eventData.teams)) {
          for (const team of eventData.teams) {
            const teamEventId = team.eventId || team.event_id || event.id;
            
            const existingTeam = db.getFirstSync(
              "SELECT id FROM team WHERE id = ?",
              [team.id]
            );

            if (!existingTeam) {
              db.runSync(
                "INSERT INTO team (id, event_id, name) VALUES (?, ?, ?)",
                [team.id, teamEventId, team.name]
              );
              teamsCount++;
            } else {
              db.runSync("UPDATE team SET name = ? WHERE id = ?", [
                team.name,
                team.id,
              ]);
            }
          }
        }

        // Insérer les équipements si présents (nouveau format)
        if (eventData.equipements && Array.isArray(eventData.equipements)) {
          for (const equipement of eventData.equipements) {
            const existingEquipement = db.getFirstSync(
              "SELECT id FROM equipement WHERE id = ?",
              [equipement.id]
            );

            // Calculer le point_id à partir de la première coordonnée ou null
            let pointId = null;
            if (equipement.coordinates && equipement.coordinates.length > 0) {
              // Créer un point à partir de la première coordonnée de l'équipement
              const firstCoord = equipement.coordinates[0];
              pointId = firstCoord.id;
              
              // Insérer ce point s'il n'existe pas
              const existingCoordPoint = db.getFirstSync(
                "SELECT id FROM point WHERE id = ?",
                [firstCoord.id]
              );
              
              if (!existingCoordPoint) {
                db.runSync(
                  "INSERT INTO point (id, event_id, x, y, name, comment, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                  [
                    firstCoord.id,
                    event.id,
                    firstCoord.x,
                    firstCoord.y,
                    `Équipement - Coord ${firstCoord.orderIndex + 1}`,
                    null,
                    "equipement",
                    0,
                  ]
                );
                pointsCount++;
              }
            }

            if (!existingEquipement) {
              db.runSync(
                "INSERT INTO equipement (id, point_id, type_id, quantity, length) VALUES (?, ?, ?, ?, ?)",
                [
                  equipement.id,
                  pointId,
                  equipement.typeId,
                  equipement.quantity || 1,
                  equipement.lengthPerUnit || 0,
                ]
              );
              equipementsCount++;
            } else {
              db.runSync(
                "UPDATE equipement SET point_id = ?, type_id = ?, quantity = ?, length = ? WHERE id = ?",
                [
                  pointId,
                  equipement.typeId,
                  equipement.quantity || 1,
                  equipement.lengthPerUnit || 0,
                  equipement.id,
                ]
              );
            }

            // Insérer les coordonnées supplémentaires comme points
            if (equipement.coordinates && equipement.coordinates.length > 1) {
              for (let i = 1; i < equipement.coordinates.length; i++) {
                const coord = equipement.coordinates[i];
                const existingCoord = db.getFirstSync(
                  "SELECT id FROM point WHERE id = ?",
                  [coord.id]
                );
                
                if (!existingCoord) {
                  db.runSync(
                    "INSERT INTO point (id, event_id, x, y, name, comment, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                      coord.id,
                      event.id,
                      coord.x,
                      coord.y,
                      `Équipement - Coord ${coord.orderIndex + 1}`,
                      null,
                      "equipement",
                      0,
                    ]
                  );
                  pointsCount++;
                }
              }
            }
          }
        }

        // Insérer les actions si présentes
        if (eventData.actions && Array.isArray(eventData.actions)) {
          for (const actionData of eventData.actions) {
            const action = {
              id: actionData.id,
              team_id: actionData.teamId || actionData.team_id,
              equipement_id: actionData.equipementId || actionData.equipement_id,
              type: actionData.actionType || actionData.type || null,
              scheduled_time: actionData.scheduledTime || actionData.scheduled_time || null,
              is_done: actionData.isDone !== undefined 
                ? (actionData.isDone ? 1 : 0) 
                : (actionData.is_done !== undefined ? actionData.is_done : 0),
            };
            
            console.log("📝 Insertion action:", action);
            
            const existingAction = db.getFirstSync(
              "SELECT id FROM action WHERE id = ?",
              [action.id]
            );

            if (!existingAction) {
              db.runSync(
                "INSERT INTO action (id, team_id, equipement_id, type, scheduled_time, is_done) VALUES (?, ?, ?, ?, ?, ?)",
                [
                  action.id,
                  action.team_id,
                  action.equipement_id,
                  action.type,
                  action.scheduled_time,
                  action.is_done,
                ]
              );
              actionsCount++;
            } else {
              db.runSync(
                "UPDATE action SET team_id = ?, equipement_id = ?, type = ?, scheduled_time = ?, is_done = ? WHERE id = ?",
                [
                  action.team_id,
                  action.equipement_id,
                  action.type,
                  action.scheduled_time,
                  action.is_done,
                  action.id,
                ]
              );
            }
          }
        }

        console.log(`✅ Équipes: ${teamsCount}, Actions: ${actionsCount}, Équipements: ${equipementsCount}`);
      }

      console.log(
        `✅ ${insertedCount} événement(s) inséré(s), ${updatedCount} mis à jour`
      );
      console.log(
        `✅ ${parcoursCount} parcours, ${zonesCount} zones, ${pointsCount} points`
      );
      console.log(
        `✅ ${equipementsCount} équipements, ${teamsCount} équipes, ${actionsCount} actions`
      );
      setTransferStatus(
        `${insertedCount + updatedCount} événement(s)\n${pointsCount} points, ${equipementsCount} équipements\n${teamsCount} équipes, ${actionsCount} actions`
      );
    } catch (error) {
      console.error("❌ Erreur lors de l'insertion des événements:", error);
      throw error;
    }
  };

  // Récupérer les données complètes d'un événement pour l'export
  const getEventExportData = (eventId: number): EventExportData | null => {
    try {
      const event = db.getFirstSync<EventType>(
        "SELECT * FROM event WHERE id = ?",
        [eventId]
      );
      if (!event) return null;

      const points = db.getAllSync<InterestPointsType>(
        `SELECT p.* FROM point p WHERE p.event_id = ?`,
        [eventId]
      );

      const pointsWithDetails: PointWithDetails[] = points.map((point) => {
        const pictures = db.getAllSync<PictureType>(
          "SELECT * FROM picture WHERE point_id = ?",
          [point.id]
        );
        const equipements = db.getAllSync<EquipementType>(
          "SELECT * FROM equipement WHERE point_id = ?",
          [point.id]
        );

        return { ...point, pictures, equipements };
      });

      return { event: eventToSend || event, points: pointsWithDetails };
    } catch (error) {
      console.error("Erreur récupération données export:", error);
      return null;
    }
  };

  const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
    if (!scanned) {
      setScanned(true);
      setIsTransferring(true);
      setTransferStatus("Connexion en cours...");
      setReceivedCount(0);

      const websocketUri: string = data.startsWith("ws")
        ? data
        : `ws://${data}`;
      const client = new WebSocketClient(websocketUri);
      setCurrentClient(client);

      if (mode === "send" && eventToSend) {
        // Mode ENVOI: connecter et envoyer l'événement
        client.setCallbacks(
          () => {
            // onFinished
            setTransferStatus("Export terminé avec succès !");
            setTimeout(() => {
              handleCloseConnection();
              onExportSuccess?.();
            }, 2000);
          },
          (error) => {
            // onError
            setTransferStatus(`Erreur: ${error}`);
          }
        );

        // Configurer le callback de fermeture
        client.setOnClose(() => {
          console.log("🚪 Connexion fermée par le serveur");
          handleCloseConnection();
        });

        client.setOnResponse((response: WebSocketResponse) => {
          console.log("📨 Réponse serveur:", response);
          if (response.code === 3) {
            setTransferStatus("✅ " + response.message);
            setTimeout(() => {
              handleCloseConnection();
              onExportSuccess?.();
            }, 2000);
          } else {
            setTransferStatus(`Erreur: ${response.message}`);
          }
        });

        client
          .connect()
          .then(() => {
            console.log("✅ Connecté, envoi de l'événement...");
            setTransferStatus("Connecté ! Envoi des données...");

            // Récupérer et envoyer les données
            const exportData = getEventExportData(eventToSend.id);
            if (exportData) {
              console.log(
                "📤 Envoi:",
                exportData.event.name,
                "avec",
                exportData.points.length,
                "points"
              );
              client.send(JSON.stringify(exportData));
              setTransferStatus(
                `Envoi de ${exportData.points.length} point(s)...`
              );
            } else {
              setTransferStatus("Erreur: données non trouvées");
            }
          })
          .catch((error: string) => {
            console.error("❌ Erreur connexion:", error);
            setTransferStatus(`Erreur: ${error}`);
            setTimeout(() => {
              client.close();
              setCurrentClient(null);
              setIsTransferring(false);
              setScanned(false);
              setScanQR(false);
            }, 3000);
          });
      } else {
        // Mode RÉCEPTION: attendre les événements du desktop
        const onEventsReceived = (data: any) => {
          console.log("📦 Données reçues:", JSON.stringify(data).substring(0, 200));
          try {
            // Normaliser les données reçues en tableau
            let eventsArray: any[];
            if (Array.isArray(data)) {
              eventsArray = data;
            } else if (data.type === "event" && data.data) {
              // Nouveau format: {type: "event", data: {...}}
              eventsArray = [data];
            } else {
              // Ancien format: objet événement unique
              eventsArray = [data];
            }
            
            insertEvents(eventsArray);
            // Rafraîchir tous les contextes pour afficher immédiatement les données
            refreshEvents();
            refreshPoints();
            refreshGeometries();
            setReceivedCount((prev) => prev + eventsArray.length);
            setTransferStatus(`Événement reçu avec succès !`);
          } catch (error) {
            console.error("Erreur insertion:", error);
            setTransferStatus(`Erreur: ${error}`);
          }
        };

        // Configurer le callback de fermeture
        client.setOnClose(() => {
          console.log("🚪 Connexion fermée par le serveur");
          handleCloseConnection();
        });

        client
          .connect(onEventsReceived)
          .then(() => {
            console.log("✅ Connexion WebSocket établie");
            setTransferStatus("Connecté ! En attente des événements...");

            setWsClient(client);
            setIsConnected(true);
          })
          .catch((error: string) => {
            console.error("❌ Erreur connexion:", error);
            setTransferStatus(`Erreur: ${error}`);
            setTimeout(() => {
              client.close();
              setCurrentClient(null);
              setIsTransferring(false);
              setScanned(false);
              setScanQR(false);
            }, 3000);
          });
      }
    }
  };

  // Fonction pour fermer la connexion et le modal
  const handleCloseConnection = () => {
    if (currentClient) {
      currentClient.close();
      setCurrentClient(null);
    }
    setWsClient(null);
    setIsConnected(false);
    setIsTransferring(false);
    setScanned(false);
    setScanQR(false);
  };

  return (
    <View className="scanner-container">
      {!isTransferring && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          facing="back"
        />
      )}

      {!isTransferring && (
        <View className="full-absolute justify-center items-center">
          <View className="flex-1 bg-black/60 w-full justify-center items-center" />
          <View className="flex-row" style={{ height: SCANNER_SIZE }}>
            <View className="flex-1 bg-black/60" />
            <View
              className="bg-transparent border-2 border-white"
              style={{ width: SCANNER_SIZE, height: SCANNER_SIZE }}
            />
            <View className="flex-1 bg-black/60" />
          </View>
          <View className="flex-1 bg-black/60 w-full justify-center items-center">
            <Text className="scanner-text">
              {scanned ? "Code scanné!" : "Scannez le Code QR dans le carré."}
            </Text>
          </View>
        </View>
      )}

      <Modal visible={isTransferring} transparent={true} animationType="fade">
        <View className="modal-overlay bg-black/80">
          <View className="bg-white rounded-2xl p-10 items-center min-w-[280px] shadow-lg">
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text className="text-xl font-bold mt-5 mb-2 text-gray-800">
              {mode === "send" ? "Export en cours" : "Synchronisation"}
            </Text>
            <Text className="text-base text-gray-600 text-center mb-2">
              {transferStatus}
            </Text>
            {mode === "send" && eventToSend && (
              <Text className="text-sm text-blue-600 mb-2">
                Événement: {eventToSend.name}
              </Text>
            )}
            {mode === "receive" && receivedCount > 0 && (
              <Text className="text-sm text-green-600 mb-4">
                Total reçu: {receivedCount} événement(s)
              </Text>
            )}
            <TouchableOpacity
              onPress={handleCloseConnection}
              className="mt-4 bg-red-500 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-semibold">
                {mode === "send" ? "Annuler" : "Fermer la connexion"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default QRCodeScanner;

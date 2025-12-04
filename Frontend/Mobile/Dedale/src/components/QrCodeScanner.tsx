import React, { useState } from "react";
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
import { EventType, InterestPointsType, CommentType, PictureType, ObstacleType } from "../types/database";

// Types pour l'export
type PointWithDetails = InterestPointsType & {
  comments: CommentType[];
  pictures: PictureType[];
  obstacles: ObstacleType[];
};

type EventExportData = {
  event: any;
  points: PointWithDetails[];
};

interface QRCodeScannerProps {
  setScanQR: (value: boolean) => void;
  mode?: 'receive' | 'send';  // Mode: recevoir des events ou envoyer
  eventToSend?: any;  // L'événement à envoyer (si mode 'send')
  onExportSuccess?: () => void;  // Callback quand l'export réussit
}

const QRCodeScanner = ({
  setScanQR,
  mode = 'receive',
  eventToSend,
  onExportSuccess,
}: QRCodeScannerProps) => {
  const { setWsClient, setIsConnected } = useWebSocket();
  const { refreshEvents } = useEvent();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState("Connexion en cours...");
  const [receivedCount, setReceivedCount] = useState(0);
  const [currentClient, setCurrentClient] = useState<WebSocketClient | null>(null);
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

  const insertEvents = (events: EventType[]) => {
    try {
      let insertedCount = 0;
      let updatedCount = 0;

      for (const event of events) {
        const existing = db.getFirstSync<EventType>(
          "SELECT id FROM event WHERE id = ?",
          [event.id]
        );

        if (existing) {
          db.runSync(
            "UPDATE event SET name = ?, description = ?, dateDebut = ?, dateFin = ?, statut = ?, geometry = ? WHERE id = ?",
            [
              event.name,
              event.description,
              event.dateDebut,
              event.dateFin,
              event.statut,
              event.geometry,
              event.id,
            ]
          );
          updatedCount++;
        } else {
          db.runSync(
            "INSERT INTO event (id, name, description, dateDebut, dateFin, statut, geometry) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              event.id,
              event.name,
              event.description,
              event.dateDebut,
              event.dateFin,
              event.statut,
              event.geometry,
            ]
          );
          insertedCount++;
        }
      }

      console.log(
        `✅ ${insertedCount} événement(s) inséré(s), ${updatedCount} mis à jour`
      );
      setTransferStatus(
        `${insertedCount} événement(s) ajouté(s), ${updatedCount} mis à jour`
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
        `SELECT p.id, p.x, p.y, pe.event_id 
         FROM point p 
         INNER JOIN point_event pe ON p.id = pe.point_id 
         WHERE pe.event_id = ?`,
        [eventId]
      );

      const pointsWithDetails: PointWithDetails[] = points.map((point) => {
        const comments = db.getAllSync<CommentType>(
          "SELECT * FROM comment WHERE point_id = ?",
          [point.id]
        );
        const pictures = db.getAllSync<PictureType>(
          "SELECT * FROM picture WHERE point_id = ?",
          [point.id]
        );
        const obstacles = db.getAllSync<ObstacleType>(
          "SELECT * FROM obstacle WHERE point_id = ?",
          [point.id]
        );

        return { ...point, comments, pictures, obstacles };
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

      if (mode === 'send' && eventToSend) {
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

        client.connect()
          .then(() => {
            console.log("✅ Connecté, envoi de l'événement...");
            setTransferStatus("Connecté ! Envoi des données...");
            
            // Récupérer et envoyer les données
            const exportData = getEventExportData(eventToSend.id);
            if (exportData) {
              console.log("📤 Envoi:", exportData.event.name, "avec", exportData.points.length, "points");
              client.send(JSON.stringify(exportData));
              setTransferStatus(`Envoi de ${exportData.points.length} point(s)...`);
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
        const onEventsReceived = (events: EventType[]) => {
          console.log("📦 Événements reçus:", events.length);
          try {
            insertEvents(events);
            refreshEvents();
            setReceivedCount(prev => prev + events.length);
            setTransferStatus(`${events.length} événement(s) reçu(s) !`);
          } catch (error) {
            console.error("Erreur insertion:", error);
            setTransferStatus(`Erreur: ${error}`);
          }
        };

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
              {mode === 'send' ? 'Export en cours' : 'Synchronisation'}
            </Text>
            <Text className="text-base text-gray-600 text-center mb-2">
              {transferStatus}
            </Text>
            {mode === 'send' && eventToSend && (
              <Text className="text-sm text-blue-600 mb-2">
                Événement: {eventToSend.name}
              </Text>
            )}
            {mode === 'receive' && receivedCount > 0 && (
              <Text className="text-sm text-green-600 mb-4">
                Total reçu: {receivedCount} événement(s)
              </Text>
            )}
            <TouchableOpacity
              onPress={handleCloseConnection}
              className="mt-4 bg-red-500 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-semibold">
                {mode === 'send' ? 'Annuler' : 'Fermer la connexion'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default QRCodeScanner;

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
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import WebSocketClient from "./WebSocketClient";
import { getDatabase } from "../../assets/migrations";
import { useWebSocket } from "../context/WebSocketContext";
import { useEvent } from "../context/EventContext";
import { usePoints } from "../context/PointsContext";
import { useGeometries } from "../context/GeometriesContext";

const { width } = Dimensions.get("window");
const SCANNER_SIZE = width * 0.7;

interface QRCodeScannerPlanningProps {
  setScanQR: (value: boolean) => void;
  mode?: "receive" | "send";
  eventToSend?: any;
  onExportSuccess?: () => void;
}

const QRCodeScannerPlanning = ({
  setScanQR,
  mode = "receive",
  eventToSend,
  onExportSuccess,
}: QRCodeScannerPlanningProps) => {
  const { setWsClient, setIsConnected } = useWebSocket();
  const { refreshEvents, currentEvent } = useEvent();
  const { refreshPoints } = usePoints();
  const { refreshGeometries } = useGeometries();
  const selectedEventId = currentEvent?.id;

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

  const insertPlanningData = (planningData: any) => {
    let teams = 0, equipements = 0, actions = 0, coordinates = 0;
    // Le format attendu : planningData.actions est un tableau de blocs
    // Chaque bloc : { team, equipements, actions, coordonees }
    const blocks = planningData.actions ?? [];
    // On prend l'eventId du premier bloc si non fourni
    const eventId = selectedEventId ?? blocks[0]?.team?.eventId ?? blocks[0]?.team?.event_id;
    if (!eventId) {
      console.error("❌ Aucun eventId trouvé");
      return { teams: 0, equipements: 0, actions: 0, coordinates: 0 };
    }
    try {
      db.runSync("BEGIN TRANSACTION");
      for (const block of blocks) {
        // TEAM
        const team = block.team;
        if (team) {
          const teamId = team.id;
          const existingTeam = db.getFirstSync(
            "SELECT id FROM team WHERE id = ?",
            [teamId]
          );
          if (!existingTeam) {
            db.runSync(
              "INSERT INTO team (id, event_id, name) VALUES (?, ?, ?)",
              [teamId, team.eventId ?? team.event_id ?? eventId, team.name]
            );
            teams++;
          } else {
            db.runSync(
              "UPDATE team SET name = ? WHERE id = ?",
              [team.name, teamId]
            );
          }
        }
        // EQUIPEMENTS
        for (const equip of block.equipements ?? []) {
          const equipId = equip.id;
          const existingEquip = db.getFirstSync(
            "SELECT id FROM equipement WHERE id = ?",
            [equipId]
          );
          if (!existingEquip) {
            db.runSync(
              `INSERT INTO equipement
                (id, event_id, type_id, quantity, length_per_unit, date_pose, date_depose)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                equipId,
                equip.eventId ?? equip.event_id ?? eventId,
                equip.typeId ?? equip.type_id ?? null,
                equip.quantity ?? 1,
                equip.lengthPerUnit ?? equip.length_per_unit ?? 0,
                equip.datePose ?? equip.date_pose ?? null,
                equip.dateDepose ?? equip.date_depose ?? null,
              ]
            );
            equipements++;
          }
          // Supprimer les coordonnées existantes
          db.runSync(
            "DELETE FROM equipement_coordinate WHERE equipement_id = ?",
            [equipId]
          );
          // Ajouter les coordonnées (champ coordinates)
          for (const coord of equip.coordinates ?? []) {
            db.runSync(
              `INSERT INTO equipement_coordinate
                (id, equipement_id, x, y, order_index)
                VALUES (?, ?, ?, ?, ?)`,
              [
                coord.id,
                equipId,
                coord.x,
                coord.y,
                coord.orderIndex ?? coord.order_index ?? 0,
              ]
            );
            coordinates++;
          }
        }
        // COORDONEES (champ à la racine du bloc, pour compatibilité)
        for (const coord of block.coordonees ?? []) {
          // On suppose que equipementId est présent
          db.runSync(
            `INSERT INTO equipement_coordinate
              (id, equipement_id, x, y, order_index)
              VALUES (?, ?, ?, ?, ?)`,
            [
              coord.id,
              coord.equipementId ?? coord.equipement_id,
              coord.x,
              coord.y,
              coord.orderIndex ?? coord.order_index ?? 0,
            ]
          );
          coordinates++;
        }
        // ACTIONS
        for (const action of block.actions ?? []) {
          const exists = db.getFirstSync(
            'SELECT id FROM "action" WHERE id = ?',
            [action.id]
          );
          const isDone =
            action.is_done !== undefined
              ? action.is_done
              : action.isDone !== undefined
              ? action.isDone
              : 0;
          if (!exists) {
            db.runSync(
              `INSERT INTO "action"
                (id, team_id, equipement_id, type, scheduled_time, is_done)
                VALUES (?, ?, ?, ?, ?, ?)`,
              [
                action.id,
                action.team_id ?? team?.id,
                action.equipement_id,
                action.type ?? null,
                action.scheduled_time ?? null,
                isDone ? 1 : 0,
              ]
            );
            actions++;
          } else {
            db.runSync(
              `UPDATE "action"
                SET type = ?, scheduled_time = ?, is_done = ?
                WHERE id = ?`,
              [
                action.type ?? null,
                action.scheduled_time ?? null,
                isDone ? 1 : 0,
                action.id,
              ]
            );
          }
        }
      }
      db.runSync("COMMIT");
      return { teams, equipements, actions, coordinates };
    } catch (e) {
      db.runSync("ROLLBACK");
      throw e;
    }
  };

  const handleBarCodeScanned = ({ data }: BarcodeScanningResult) => {
    if (scanned) return;

    setScanned(true);
    setIsTransferring(true);
    setTransferStatus("Connexion en cours...");
    setReceivedCount(0);

    const websocketUri = data.startsWith("ws") ? data : `ws://${data}`;
    const client = new WebSocketClient(websocketUri);
    setCurrentClient(client);

    const onEventsReceived = (payload: any) => {
      try {
        const message =
          typeof payload === "string" ? JSON.parse(payload) : payload;

        if (message.type === "planning_data") {
          try {
            const result = insertPlanningData(message);

            setTransferStatus(
              `✅ Planning importé\n` +
              `${result.teams} équipes\n` +
              `${result.equipements} équipements\n` +
              `${result.actions} actions`
            );
          } catch (e) {
            console.error("❌ Import échoué", e);
            setTransferStatus("❌ Erreur import planning");
          }

          setReceivedCount((c) => c + 1);
        }
      } catch (error) {
        console.error("💥 Erreur WS:", error);
        setTransferStatus("❌ Erreur import planning");
      }
    };

    client.setOnClose(() => handleCloseConnection());

    client
      .connect(onEventsReceived)
      .then(() => {
        setWsClient(client);
        setIsConnected(true);
        setTransferStatus("Connecté ! En attente des données...");
      })
      .catch((error: string) => {
        setTransferStatus(`Erreur: ${error}`);
        setTimeout(handleCloseConnection, 3000);
      });
  };

  const handleCloseConnection = () => {
    currentClient?.close();
    setCurrentClient(null);
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
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          facing="back"
        />
      )}

      {!isTransferring && (
        <View className="full-absolute justify-center items-center">
          <View className="flex-1 bg-black/60 w-full" />
          <View className="flex-row" style={{ height: SCANNER_SIZE }}>
            <View className="flex-1 bg-black/60" />
            <View
              style={{
                width: SCANNER_SIZE,
                height: SCANNER_SIZE,
                borderWidth: 2,
                borderColor: "white",
              }}
            />
            <View className="flex-1 bg-black/60" />
          </View>
          <View className="flex-1 bg-black/60 w-full justify-center items-center">
            <Text className="text-white">
              {scanned ? "Code scanné" : "Scanne le QR code"}
            </Text>
          </View>
        </View>
      )}

      <Modal visible={isTransferring} transparent animationType="fade">
        <View className="modal-overlay bg-black/80">
          <View className="bg-white rounded-2xl p-10 items-center min-w-[280px]">
            <ActivityIndicator size="large" />
            <Text className="text-xl font-bold mt-5 mb-2">
              Synchronisation
            </Text>
            <Text className="text-base text-center mb-2">
              {transferStatus}
            </Text>
            <TouchableOpacity
              onPress={handleCloseConnection}
              className="mt-4 bg-red-500 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-semibold">
                Fermer la connexion
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default QRCodeScannerPlanning;

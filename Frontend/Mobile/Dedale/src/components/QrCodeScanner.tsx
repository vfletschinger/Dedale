import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  Button,
  Dimensions,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import WebSocketClient from "./WebSocketClient";
const { width } = Dimensions.get("window");
const SCANNER_SIZE = width * 0.7;
import { getDatabase } from "../../assets/migrations";
import { EventType } from "../types/database";

const QRCodeScanner = ({
  setScanQR,
}: {
  setScanQR: (value: boolean) => void;
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState("Connexion en cours...");
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
        // Check if event already exists
        const existing = db.getFirstSync<EventType>(
          "SELECT id FROM event WHERE id = ?",
          [event.id]
        );

        if (existing) {
          // Update existing event
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
          // Insert new event
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

  const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
    if (!scanned) {
      setScanned(true);
      setIsTransferring(true);
      setTransferStatus("Connexion en cours...");

      const websocketUri: string = data.startsWith("ws")
        ? data
        : `ws://${data}`;
      const client = new WebSocketClient(websocketUri);

      client
        .connect((events: EventType[]) => {
          setTransferStatus("Réception des événements...");
          try {
            insertEvents(events);
            setTransferStatus("Synchronisation réussie !");

            setTimeout(() => {
              client.close();
              setIsTransferring(false);
              setScanned(false);
              setScanQR(false);
            }, 2000);
          } catch (error) {
            setTransferStatus(`Erreur: ${error}`);
            setTimeout(() => {
              client.close();
              setIsTransferring(false);
              setScanned(false);
              setScanQR(false);
            }, 3000);
          }
        })
        .then(() => {
          setTransferStatus("En attente des événements...");
        })
        .catch((error: string) => {
          setTransferStatus(`Erreur de connexion: ${error}`);
          setTimeout(() => {
            client.close();
            setIsTransferring(false);
            setScanned(false);
            setScanQR(false);
          }, 3000);
        });
    }
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
              Synchronisation
            </Text>
            <Text className="text-base text-gray-600 text-center">
              {transferStatus}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default QRCodeScanner;

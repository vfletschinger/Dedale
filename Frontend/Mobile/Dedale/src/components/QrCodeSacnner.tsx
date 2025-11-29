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
import {
  CommentType,
  InterestPointsType,
  ObstacleType,
  PictureType,
  PointDetailType,
} from "../types/database";

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

  const fetchData = async () => {
    const points = db.getAllSync<InterestPointsType>(
      "SELECT id, x, y FROM point"
    );
    const allPointDetails: PointDetailType[] = [];

    for (const point of points) {
      const comments = db.getAllSync<CommentType>(
        "SELECT id, point_id, value FROM comment WHERE point_id = ?",
        [point.id]
      );
      const pictures = db.getAllSync<PictureType>(
        "SELECT id, point_id, image FROM picture WHERE point_id = ?",
        [point.id]
      );
      const obstacles = db.getAllSync<ObstacleType>(
        `SELECT 
            o.id, 
            o.point_id, 
            o.type_id, 
            o.number,
            ot.name,
            ot.description,
            ot.width,
            ot.length
          FROM obstacle o
          LEFT JOIN obstacle_type ot ON o.type_id = ot.id
          WHERE o.point_id = ?`,
        [point.id]
      );

      allPointDetails.push({
        point: point,
        comments: comments,
        pictures: pictures,
        obstacles: obstacles,
      });
    }
    return allPointDetails;
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
        .connect()
        .then(async () => {
          setTransferStatus("Récupération des données...");
          const pointsData = await fetchData();

          setTransferStatus("Envoi des données...");
          await client.send(pointsData);

          setTransferStatus("Transfert terminé !");

          setTimeout(() => {
            client.close();
            setIsTransferring(false);
            setScanned(false);
            setScanQR(false);
          }, 2000);
        })
        .catch((error: string) => {
          setTransferStatus(`Erreur: ${error}`);
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
              Transfert en cours
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

import React from "react";
import OfflineMap from "../components/OfflineMap";

import "../style/global.css";
import {
  AppState,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  Pressable,
} from "react-native";
import {} from "react-native";

import QRCodeScanner from "../components/QrCodeSacnner";
import { useState } from "react";
import CustomButton from "../components/CustomButton";
export default function HomeScreen() {
  const [scanQR, setScanQR] = useState(false);
  return (
    <SafeAreaView style={styles.container}>
      <View className="bg-blue-500 pt-4 pb-4 px-4 shadow-lg flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <Text style={{ color: "white", fontSize: 24, fontWeight: "bold" }}>
            Home
          </Text>
        </View>

        <View className="flex-row gap-2">
          <CustomButton onPress={() => setScanQR(true)} title="Transfert" />
        </View>
      </View>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {scanQR && <QRCodeScanner setScanQR={setScanQR} />}
      <OfflineMap />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none",
  },
  headerContent: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3b82f6",
  },
});

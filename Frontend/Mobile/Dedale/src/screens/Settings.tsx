import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import CustomButton from "../components/CustomButton";
import QRCodeScanner from "../components/QrCodeSacnner";
import Feather from "@expo/vector-icons/Feather";

export default function SettingsScreen() {
  const [scanQR, setScanQR] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View className="bg-blue-500 pt-4 pb-4 px-4 shadow-lg flex-row items-center justify-between">
        {scanQR && (
          <TouchableOpacity
            onPress={() => setScanQR(false)}
            style={{ marginRight: 16 }}
          >
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
        )}
        <View className="flex-row items-center flex-1">
          <Text style={{ color: "white", fontSize: 24, fontWeight: "bold" }}>
            Settings
          </Text>
        </View>
      </View>

      {scanQR ? (
        <QRCodeScanner setScanQR={setScanQR} />
      ) : (
        <View style={styles.content}>
          <Feather name="settings" size={64} color="#3b82f6" />
          <Text style={styles.title}>Data Synchronization</Text>
          <Text style={styles.description}>
            To synchronize your data, please scan the QR code provided by the
            desktop application. This will establish a secure connection and
            allow for data transfer.
          </Text>
          <CustomButton onPress={() => setScanQR(true)} title="Scan QR Code" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4f8",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginTop: 20,
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24,
  },
});

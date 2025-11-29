import React, { useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity } from "react-native";
import CustomButton from "../components/CustomButton";
import QRCodeScanner from "../components/QrCodeScanner";
import Feather from "@expo/vector-icons/Feather";

export default function SettingsScreen() {
  const [scanQR, setScanQR] = useState(false);

  return (
    <SafeAreaView className="container">
      <View className="header header-row">
        {scanQR && (
          <TouchableOpacity onPress={() => setScanQR(false)} className="mr-4">
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
        )}
        <View className="flex-row items-center flex-1">
          <Text className="header-title">Settings</Text>
        </View>
      </View>

      {scanQR ? (
        <QRCodeScanner setScanQR={setScanQR} />
      ) : (
        <View className="center p-5">
          <Feather name="settings" size={64} color="#3b82f6" />
          <Text className="settings-title">Data Synchronization</Text>
          <Text className="settings-description">
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

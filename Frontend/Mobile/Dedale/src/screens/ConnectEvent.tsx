import { View, Text } from "react-native";
import QRCodeScanner from "../components/QrCodeSacnner";
import { useState } from "react";

export default function ConnectEvent() {
  const [scanQR, setScanQR] = useState(false);
  return (
    <View>
      <Text> Please Connect the app to an event</Text>
      <QRCodeScanner setScanQR={setScanQR} />
    </View>
  );
}

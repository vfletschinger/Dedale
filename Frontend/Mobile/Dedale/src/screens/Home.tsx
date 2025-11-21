import {
  AppState,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  Pressable
} from "react-native";
import {  } from "react-native";

import QRCodeScanner from "../components/QrCodeSacnner"; 
import { useState } from "react";
import CustomButton from "../components/CustomButton";
export default function HomeScreen() {
  const [scanQR, setScanQR] = useState(false);
  return (
    <SafeAreaView style={styles.container}>
        <View className="bg-blue-500 pt-12 pb-4 px-4 shadow-lg flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  
                  <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>Home</Text>
                </View>
                
                <View className="flex-row gap-2">
                  <CustomButton 
                    onPress={() => setScanQR(true)}
                    title="Transfert"
                  />
                </View>
              </View>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {scanQR && <QRCodeScanner setScanQR={setScanQR} />}
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    backgroundColor: '#000', 
  },
});
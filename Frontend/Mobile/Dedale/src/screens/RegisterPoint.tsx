import { View, Text, Alert } from "react-native";
import { useState } from "react";
import CustomButton from "../components/CustomButton";
import MapView from "react-native-maps";
import React from "react";
import * as Location from 'expo-location';

export default function RegisterPointScreen() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [coords, setCoords] = useState({
    latitude: 48.8566, // Coordonnées par défaut (Paris)
    longitude: 2.3522,
  });

  const requestLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Impossible d\'accéder à la localisation.');
      return null;
    }

    let loc = await Location.getCurrentPositionAsync({});

    const newCoords = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };

    setCoords(newCoords);
    setLocation(newCoords);
    return newCoords;
  };

  return (
    <View className="flex-1">
      <Text className="text-center mt-4">Register Point Screen</Text>
      
      <CustomButton 
        title="Obtenir ma position" 
        onPress={requestLocation}
      />

      <MapView
        style={{ width: '100%', height: '80%' }}
        region={{
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      />
    </View>
  );
}
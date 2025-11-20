import * as Location from 'expo-location';
import { Alert } from 'react-native';

export const requestLocation = async () => {
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

  return newCoords;
};
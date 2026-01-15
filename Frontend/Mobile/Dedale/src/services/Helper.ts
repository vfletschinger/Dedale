import * as Location from 'expo-location';
import { Alert } from 'react-native';

/**
 * Génère un UUID v4
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Retourne une version courte de l'UUID pour l'affichage (8 premiers caractères)
 */
export const shortId = (id: string): string => {
  if (!id) return '';
  return id.substring(0, 8);
};

export const getUserLocation = async () => {
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


export const calculateDistance = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
};

export const getAddressFromCoords = async (latitude: number, longitude: number) => {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude })
    const addressString = `${address.name ? address.name + ', ' : ''}${address.street ? address.street + ', ' : ''}${address.city ? address.city + ', ' : ''}${address.region ? address.region + ', ' : ''}${address.postalCode ? address.postalCode + ', ' : ''}${address.country ? address.country : ''}`;
    return addressString;
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return null;
  }
};

export const getShortAddressFromCoords = async (latitude: number, longitude: number) => {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const parts: string[] = [];
    if (address.street) {
      parts.push(address.street);
    } else if (address.name) {
      parts.push(address.name);
    }
    if (address.city) parts.push(address.city);
    return parts.length > 0 ? parts.join(', ') : null;
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return null;
  }
};
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { useRoute, useNavigation, useIsFocused } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { usePoints } from "../context/PointsContext";
import { InterestPointsType } from "../types/database";
import "../style/global.css";
import Colors from "../constants/colors";

type RouteParams = {
  startPointId?: string;
  endPointId?: string;
};

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  let bearing = Math.atan2(y, x);
  bearing = ((bearing * 180) / Math.PI + 360) % 360;
  return bearing;
};

const getDirectionText = (bearing: number): string => {
  if (bearing >= 337.5 || bearing < 22.5) return "Nord ↑";
  if (bearing >= 22.5 && bearing < 67.5) return "Nord-Est ↗";
  if (bearing >= 67.5 && bearing < 112.5) return "Est →";
  if (bearing >= 112.5 && bearing < 157.5) return "Sud-Est ↘";
  if (bearing >= 157.5 && bearing < 202.5) return "Sud ↓";
  if (bearing >= 202.5 && bearing < 247.5) return "Sud-Ouest ↙";
  if (bearing >= 247.5 && bearing < 292.5) return "Ouest ←";
  if (bearing >= 292.5 && bearing < 337.5) return "Nord-Ouest ↖";
  return "Nord ↑";
};

export default function PointGuidanceScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { points } = usePoints();
  const isFocused = useIsFocused();
  const mapRef = useRef<MapView | null>(null);

  const params = (route.params || {}) as RouteParams;
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [startPoint, setStartPoint] = useState<InterestPointsType | null>(null);
  const [endPoint, setEndPoint] = useState<InterestPointsType | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [bearing, setBearing] = useState<number>(0);
  const [locationTracking, setLocationTracking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFocused) return;

    if (params?.startPointId && params?.endPointId) {
      const start = points.find((p) => p.id === params.startPointId);
      const end = points.find((p) => p.id === params.endPointId);

      if (start && end) {
        setStartPoint(start);
        setEndPoint(end);
        setError(null);

        const dist = calculateDistance(start.y, start.x, end.y, end.x);
        const bear = calculateBearing(start.y, start.x, end.y, end.x);
        setDistance(dist);
        setBearing(bear);
      } else {
        setError("Points non trouvés");
      }
    } else {
      setError("Paramètres manquants");
    }

    requestLocationPermission();
    setLoading(false);
  }, [params, points, isFocused]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        startLocationTracking();
      }
    } catch (err) {
      console.error("Erreur permission localisation:", err);
    }
  };

  const startLocationTracking = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (isFocused) {
        const locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (location) => {
            setCurrentLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        );

        return () => locationSubscription.remove();
      }
    } catch (err) {
      console.error("Erreur suivi localisation:", err);
    }
  };

  const fitRoute = () => {
    if (!mapRef.current || !startPoint || !endPoint) return;

    mapRef.current.fitToCoordinates(
      [
        { latitude: startPoint.y, longitude: startPoint.x },
        { latitude: endPoint.y, longitude: endPoint.x },
      ],
      {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      }
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      </View>
    );
  }

  if (error || !startPoint || !endPoint) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-4">
          <Feather name="alert-circle" size={48} color={Colors.error} />
          <Text className="text-red-600 font-semibold text-center mt-4">
            {error || "Points non trouvés"}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-6 bg-secondary px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-semibold">Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-4 shadow-md">
        <View className="flex-row items-center justify-between mb-2">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="p-2"
          >
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-bold flex-1 ml-3">
            Guidage
          </Text>
          <TouchableOpacity onPress={fitRoute} className="p-2">
            <Feather name="map" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: (startPoint.y + endPoint.y) / 2,
          longitude: (startPoint.x + endPoint.x) / 2,
          latitudeDelta: Math.abs(startPoint.y - endPoint.y) + 0.01,
          longitudeDelta: Math.abs(startPoint.x - endPoint.x) + 0.01,
        }}
      >
        {/* Marqueur de départ */}
        <Marker
          coordinate={{ latitude: startPoint.y, longitude: startPoint.x }}
          title={`Départ: ${startPoint.name || "Point " + startPoint.id}`}
          pinColor="green"
        />

        {/* Marqueur d'arrivée */}
        <Marker
          coordinate={{ latitude: endPoint.y, longitude: endPoint.x }}
          title={`Arrivée: ${endPoint.name || "Point " + endPoint.id}`}
          pinColor="red"
        />

        {/* Localisation actuelle */}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Position actuelle"
            pinColor="blue"
          />
        )}

        {/* Ligne entre les points */}
        <Polyline
          coordinates={[
            { latitude: startPoint.y, longitude: startPoint.x },
            { latitude: endPoint.y, longitude: endPoint.x },
          ]}
          strokeColor="rgba(0, 102, 204, 0.8)"
          strokeWidth={3}
        />
      </MapView>

      {/* Informations de guidage */}
      <View className="bg-white border-t border-slate-200 px-4 py-4 shadow-lg">
        <View className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 mb-3">
          <Text className="text-slate-600 text-sm mb-1">De:</Text>
          <Text className="text-slate-900 font-bold text-base mb-3">
            {startPoint.name || "Point de départ"}
          </Text>

          <Text className="text-slate-600 text-sm mb-1">Vers:</Text>
          <Text className="text-slate-900 font-bold text-base">
            {endPoint.name || "Point d'arrivée"}
          </Text>
        </View>

        <View className="flex-row items-center justify-around bg-slate-50 rounded-lg p-3">
          <View className="items-center">
            <Feather name="navigation" size={24} color="#0066cc" />
            <Text className="text-slate-600 text-xs mt-1">Direction</Text>
            <Text className="text-slate-900 font-bold text-base">
              {getDirectionText(bearing)}
            </Text>
          </View>

          <View className="items-center">
            <Feather name="map-pin" size={24} color="#00b300" />
            <Text className="text-slate-600 text-xs mt-1">Distance</Text>
            <Text className="text-slate-900 font-bold text-base">
              {distance.toFixed(2)} km
            </Text>
          </View>

          <View className="items-center">
            <Feather name="compass" size={24} color="#ff6600" />
            <Text className="text-slate-600 text-xs mt-1">Azimut</Text>
            <Text className="text-slate-900 font-bold text-base">
              {bearing.toFixed(0)}°
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() =>
            setLocationTracking(!locationTracking)
          }
          className={`mt-3 py-3 px-4 rounded-lg flex-row items-center justify-center ${
            locationTracking ? "bg-secondary" : "bg-slate-400"
          }`}
        >
          <Feather name="navigation-2" size={18} color="white" />
          <Text className="text-white font-semibold ml-2">
            {locationTracking ? "Suivi actif" : "Suivi inactif"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

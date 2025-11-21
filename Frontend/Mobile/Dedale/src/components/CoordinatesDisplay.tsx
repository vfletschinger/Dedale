import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { getAddressFromCoords } from "../services/Helper";

interface CoordinatesDisplayProps {
  latitude: number;
  longitude: number;
  showAddress?: boolean;
  showCoordinates?: boolean;
  index?: number;
}

export default function CoordinatesDisplay({
  latitude,
  longitude,
  showCoordinates = true,
  showAddress = true,
  index,
}: CoordinatesDisplayProps) {
  const [address, setAddress] = useState<string>("Chargement...");

  useEffect(() => {
    if (showAddress) {
      const fetchAddress = async () => {
        const addr = await getAddressFromCoords(latitude, longitude);
        setAddress(addr || "Adresse inconnue");
      };

      fetchAddress();
    }
  }, [latitude, longitude, showAddress]);

  return (
    <View className="flex-1">
      {/* Adresse */}
      {showAddress && (
        <View className="mb-2">
          <Text className="text-gray-500 text-xs mb-1">Adresse</Text>
          <Text className="text-gray-700 text-sm" numberOfLines={2}>
            {address}
          </Text>
        </View>
      )}

      {/* Coordonnées GPS */}
      {showCoordinates && (
        <View>
          <Text className="text-gray-500 text-xs mb-1">Coordonnées GPS</Text>
          <View className="flex-row items-center">
            <View className="flex-1 mr-2">
              <View className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <Text className="text-blue-600 text-xs font-medium mb-0.5">
                  Latitude
                </Text>
                <Text className="text-gray-800 text-sm font-mono font-semibold">
                  {latitude.toFixed(6)}°
                </Text>
              </View>
            </View>
            <View className="flex-1">
              <View className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <Text className="text-green-600 text-xs font-medium mb-0.5">
                  Longitude
                </Text>
                <Text className="text-gray-800 text-sm font-mono font-semibold">
                  {longitude.toFixed(6)}°
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

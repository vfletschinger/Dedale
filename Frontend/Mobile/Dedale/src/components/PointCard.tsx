import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { InterestPointsType } from "../types/database";
import { getAddressFromCoords, shortId } from "../services/Helper";
import CoordinatesDisplay from "./CoordinatesDisplay";

interface PointCardProps {
  item: InterestPointsType;
  index: number;
  onPress: () => void;
  onDelete: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
  displayCoordinates?: boolean;
  displayAddress?: boolean;
  displayDeleteButton?: boolean;
  displayNavigationArrow?: boolean;
  displayKnob?: boolean;
}

export default function PointCard({
  item,
  index,
  onPress,
  onDelete,
  onLongPress,
  onPressOut,
  displayCoordinates = true,
  displayAddress = true,
  displayDeleteButton = true,
  displayNavigationArrow = true,
  displayKnob = true,
}: PointCardProps) {
  const [, setAddress] = useState<string>("Chargement...");

  useEffect(() => {
    const fetchAddress = async () => {
      const addr = await getAddressFromCoords(item.y, item.x);
      setAddress(addr || "Adresse inconnue");
    };

    fetchAddress();
  }, [item.x, item.y]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressOut={onPressOut}
      className="bg-white rounded-2xl p-5 mb-4 shadow-md active:shadow-lg"
      style={{
        transform: [{ scale: 1 }],
      }}
    >
      <View className="flex-row items-center mb-3">
        {/* Poignée */}
        {displayKnob && (
          <View className="mr-3 p-2 flex-row gap-1">
            <View className="space-y-1 gap-1">
              <View className="w-1 h-1 bg-gray-400 rounded-full" />
              <View className="w-1 h-1 bg-gray-400 rounded-full" />
              <View className="w-1 h-1 bg-gray-400 rounded-full" />
            </View>
            <View className="space-y-1 gap-1">
              <View className="w-1 h-1 bg-gray-400 rounded-full" />
              <View className="w-1 h-1 bg-gray-400 rounded-full" />
              <View className="w-1 h-1 bg-gray-400 rounded-full" />
            </View>
          </View>
        )}

        {/* Contenu principal */}
        <View className="flex-1">
          {/* Badge numéro */}
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View>
                <Text className="text-gray-800 font-bold text-lg">
                  {item.name || `Point #${shortId(item.id)}`}
                </Text>
              </View>
            </View>
            {displayNavigationArrow && (
              <View className="bg-blue-50 rounded-full px-3 py-1">
                <Text className="text-blue-600 text-xs font-semibold">→</Text>
              </View>
            )}
          </View>

          {displayAddress || displayCoordinates || displayDeleteButton ? (
            <>
              <View className="h-px bg-gray-100 mb-3" />

              {/* Coordonnées et bouton supprimer */}
              <View className="flex-row items-start justify-between">
                {(displayCoordinates || displayAddress) && (
                  <CoordinatesDisplay
                    showCoordinates={displayCoordinates}
                    latitude={item.y}
                    longitude={item.x}
                    showAddress={displayAddress}
                  />
                )}

                {displayDeleteButton && (
                  <Pressable
                    onPress={onDelete}
                    className="bg-red-500 w-12 h-12 rounded-full items-center justify-center shadow-sm active:bg-red-600 ml-2"
                  >
                    <Text className="text-white text-xl">🗑️</Text>
                  </Pressable>
                )}
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

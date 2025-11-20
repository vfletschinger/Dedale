import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { InterestPointsType } from '../types/database';
import { getAddressFromCoords } from '../services/Helper';
import CoordinatesDisplay from './CoordinatesDisplay';

interface PointCardProps {
  item: InterestPointsType;
  index: number;
  onPress: () => void;
  onDelete: () => void;
  displayCoordinates?: boolean;
  displayAddress?: boolean;
  displayDeleteButton?: boolean;
}

export default function PointCard({
  item,
  index,
  onPress,
  onDelete,
  displayCoordinates = true,
  displayAddress = true,
  displayDeleteButton = true,
}: PointCardProps) {
  const [address, setAddress] = useState<string>('Chargement...');

  useEffect(() => {
    const fetchAddress = async () => {
      const addr = await getAddressFromCoords(item.y, item.x);
      setAddress(addr || 'Adresse inconnue');
    };
    
    fetchAddress();
  }, [item.x, item.y]);

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl p-5 mb-4 shadow-sm active:shadow-md"
      style={{
        transform: [{ scale: 1 }],
      }}
    >
      {/* Badge numéro */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="bg-blue-500 rounded-full w-10 h-10 items-center justify-center mr-3">
            <Text className="text-white font-bold text-base">
              #{item.id}
            </Text>
          </View>
          <View>
            <Text className="text-gray-800 font-bold text-lg">
              Point #{item.id}
            </Text>
          </View>
        </View>
        <View className="bg-blue-50 rounded-full px-3 py-1">
          <Text className="text-blue-600 text-xs font-semibold">→</Text>
        </View>
      </View>

      <View className="h-px bg-gray-100 mb-3" />
            
      {/* Coordonnées et bouton supprimer */}
      <View className="flex-row items-start justify-between">
        {displayCoordinates &&
        <CoordinatesDisplay
          showCoordinates={displayCoordinates}
          latitude={item.y}
          longitude={item.x}
          showAddress={displayAddress}
        />
        }
        

        {displayDeleteButton &&
        <Pressable
          onPress={onDelete}
          className="bg-red-500 w-12 h-12 rounded-full items-center justify-center shadow-sm active:bg-red-600 ml-2"
        >
          <Text className="text-white text-xl">🗑️</Text>
        </Pressable>
        }
      </View>
    </Pressable>
  );
}
import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useNavigation, useRoute } from "@react-navigation/native";
import { InterestPointsType } from "../types/database";
import DragList, { DragListRenderItemInfo } from "react-native-draglist";

interface CreateRouteProps {
  points?: InterestPointsType[];
}

export default function CreateRouteScreen(_: CreateRouteProps) {
  const navigation = useNavigation();
  const route = useRoute();
  const points: InterestPointsType[] = (route.params as any)?.points ?? [];
  const [data, setData] = useState<InterestPointsType[]>(points);

  useEffect(() => {
    setData(points);
  }, [points]);
  return (
    <View className="container">
      <Pressable onPress={() => navigation.goBack()} className="back-btn">
        <Text className="back-btn-text">←</Text>
      </Pressable>

      {points && points.length > 0 ? (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <DragList
            data={data}
            keyExtractor={(item) => item.id.toString()}
            onReordered={(fromIndex: number, toIndex: number) => {
              // simple array move
              setData((prev) => {
                const copy = [...prev];
                const [moved] = copy.splice(fromIndex, 1);
                copy.splice(toIndex, 0, moved);
                return copy;
              });
            }}
            renderItem={({
              item,
              index,
              isActive,
              onDragStart,
              onDragEnd,
            }: DragListRenderItemInfo<InterestPointsType>) => (
              <Pressable
                onLongPress={onDragStart}
                onPressOut={onDragEnd}
                delayLongPress={200}
                className={`p-4 border-b border-gray-200 ${isActive ? "bg-gray-300" : "bg-white"}`}
              >
                <Text className="text-lg font-medium">{`Point ${item.id}`}</Text>
                <Text className="text-sm text-gray-500">{`Coords: ${item.x.toFixed(4)}, ${item.y.toFixed(4)}`}</Text>
              </Pressable>
            )}
            style={{ flex: 1 }}
          />
        </GestureHandlerRootView>
      ) : (
        <View className="flex-1 justify-center items-center">
          <Text>Aucun point d'intérêt</Text>
        </View>
      )}

      <Text>CreateRoute.tsx</Text>
    </View>
  );
}

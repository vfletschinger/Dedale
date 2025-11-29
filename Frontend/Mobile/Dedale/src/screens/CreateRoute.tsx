import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useNavigation,
  useRoute,
  NavigationProp,
} from "@react-navigation/native";
import { InterestPointsType } from "../types/database";
import PointCard from "../components/PointCard";
import DragList, { DragListRenderItemInfo } from "react-native-draglist";

interface CreateRouteProps {
  points?: InterestPointsType[];
}

export default function CreateRouteScreen(_: CreateRouteProps) {
  type RootStackParamList = {
    RouteNavigation: { points: InterestPointsType[] };
  };
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute();
  const points: InterestPointsType[] = (route.params as any)?.points ?? [];
  const [data, setData] = useState<InterestPointsType[]>(points);

  const validateRoute = () => {
    if (data.length === 0) {
      Alert.alert(
        "Aucun point sélectionné",
        "Veuillez sélectionner au moins un point pour créer un itinéraire."
      );
      return;
    }
    navigation.navigate("RouteNavigation", { points: data });
  };

  useEffect(() => {
    setData(points);
  }, [points]);

  return (
    <View className="container">
      <Pressable onPress={() => navigation.goBack()} className="back-btn">
        <View className="back-btn-gray">
          <Text className="back-btn-gray-text">←</Text>
        </View>
      </Pressable>

      <View className="floating-header" style={{ pointerEvents: "none" }}>
        <View className="floating-header-content">
          <Text className="floating-header-text">Ordonner l'itinéraire</Text>
        </View>
      </View>

      {points && points.length > 0 ? (
        <GestureHandlerRootView className="flex-1 pt-24 pb-24 w-3/4 self-center">
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
              <View className="w-full flex-row items-center">
                <View className="flex-1">
                  <PointCard
                    item={item}
                    index={index}
                    onPress={() => {}}
                    onLongPress={onDragStart}
                    onPressOut={onDragEnd}
                    onDelete={() => {}}
                    displayCoordinates={false}
                    displayDeleteButton={false}
                    displayAddress={true}
                    displayNavigationArrow={false}
                  />
                </View>
              </View>
            )}
          />
          <Pressable
            onPress={validateRoute}
            className="btn-fab"
            style={{ zIndex: 1000 }}
          >
            <Text className="text-white font-bold text-lg">
              Lancer la navigation
            </Text>
          </Pressable>
        </GestureHandlerRootView>
      ) : (
        <View className="center">
          <Text className="text-gray-500">Aucun point d'intérêt</Text>
        </View>
      )}
    </View>
  );
}

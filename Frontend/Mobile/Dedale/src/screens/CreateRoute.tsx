import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
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
        <Text className="back-btn-text">←</Text>
      </Pressable>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerText}>Ordonner l'itinéraire</Text>
        </View>
      </View>

      {points && points.length > 0 ? (
        <GestureHandlerRootView
          style={{
            flex: 1,
            paddingTop: 100,
            paddingBottom: 100,
            width: "75%",
          }}
        >
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
            className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-blue-500 rounded-full p-4 shadow-lg active:bg-blue-600"
            style={{
              transform: [{ scale: 1 }],
              zIndex: 1000,
            }}
          >
            <Text className="text-white font-bold text-lg">
              Lancer la navigation
            </Text>
          </Pressable>
        </GestureHandlerRootView>
      ) : (
        <View className="flex-1 justify-center items-center">
          <Text>Aucun point d'intérêt</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none",
    zIndex: 100,
  },
  headerContent: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3b82f6",
  },
});

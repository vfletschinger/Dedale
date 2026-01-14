import React, { useState } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { usePoints } from "../context/PointsContext";
import { useEvent } from "../context/EventContext";
import PointCard from "../components/PointCard";
import { InterestPointsType } from "../types/database";

export default function SelectPointGuidanceScreen() {
  const navigation = useNavigation<any>();
  const { points } = usePoints();
  const [step, setStep] = useState<"start" | "end">("start");
  const [startPoint, setStartPoint] = useState<InterestPointsType | null>(null);
  const [endPoint, setEndPoint] = useState<InterestPointsType | null>(null);

  const handleSelectPoint = (point: InterestPointsType) => {
    if (step === "start") {
      setStartPoint(point);
      setStep("end");
    } else {
      if (point.id === startPoint?.id) {
        Alert.alert(
          "Point identique",
          "Le point de départ et d'arrivée doivent être différents"
        );
        return;
      }
      setEndPoint(point);
      // Naviguer vers le guidage
      setTimeout(() => {
        navigation.navigate("PointGuidance", {
          startPointId: startPoint!.id,
          endPointId: point.id,
        });
      }, 300);
    }
  };

  const handleReset = () => {
    setStep("start");
    setStartPoint(null);
    setEndPoint(null);
  };

  const filteredPoints =
    step === "end" && startPoint
      ? points.filter((p: InterestPointsType) => p.id !== startPoint.id)
      : points;

  return (
    <View className="flex-1 bg-gradient-to-b from-slate-50 to-slate-100">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <View className="flex-row items-center mb-3">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Feather name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-slate-800 flex-1 ml-2">
            🧭 Guidage
          </Text>
        </View>

        {/* Étapes */}
        <View className="flex-row items-center gap-2 mt-2">
          <View
            className={`flex-1 h-1 rounded ${
              step === "start" ? "bg-secondary" : "bg-accent"
            }`}
          />
          <View
            className={`flex-1 h-1 rounded ${
              step === "end" ? "bg-secondary" : "bg-slate-300"
            }`}
          />
        </View>

        <Text className="text-sm text-slate-600 mt-3">
          {step === "start"
            ? "Sélectionnez le point de départ"
            : "Sélectionnez le point d'arrivée"}
        </Text>
      </View>

      {/* Points sélectionnés */}
      {startPoint && (
        <View className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
          <View className="flex-row items-center gap-2 mb-2">
            <Feather name="map-pin" size={18} color="#22c55e" />
            <Text className="font-semibold text-slate-700">
              Point de départ
            </Text>
          </View>
          <View className="bg-green-50 rounded-lg p-3 border border-green-200">
            <Text className="font-bold text-slate-800">
              {startPoint.name || `Point #${startPoint.id.slice(0, 8)}`}
            </Text>
            <Text className="text-xs text-slate-500 mt-1">
              {startPoint.x.toFixed(4)}, {startPoint.y.toFixed(4)}
            </Text>
          </View>
          {step === "end" && (
            <TouchableOpacity
              onPress={() => setStep("start")}
              className="mt-2 p-2"
            >
              <Text className="text-secondary text-sm font-semibold">
                ✏️ Modifier
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Liste des points */}
      <ScrollView
        className="flex-1 px-4 py-4"
        showsVerticalScrollIndicator={false}
      >
        {filteredPoints.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Feather name="inbox" size={48} color="#cbd5e1" />
            <Text className="text-slate-500 mt-4">
              {step === "end"
                ? "Aucun autre point disponible"
                : "Aucun point disponible"}
            </Text>
          </View>
        ) : (
          filteredPoints.map((point: InterestPointsType) => (
            <TouchableOpacity
              key={point.id}
              onPress={() => handleSelectPoint(point)}
              activeOpacity={0.7}
            >
              <View className="bg-white rounded-lg p-4 mb-3 border-2 border-slate-200 active:border-secondary">
                <View className="flex-row items-center">
                  <View className="flex-1">
                    <Text className="font-bold text-slate-800 text-base">
                      {point.name || `Point #${point.id.slice(0, 8)}`}
                    </Text>
                    <Text className="text-xs text-slate-500 mt-2">
                      {point.x.toFixed(4)}, {point.y.toFixed(4)}
                    </Text>
                    {point.comment && (
                      <Text className="text-xs text-slate-600 mt-1 italic">
                        {point.comment}
                      </Text>
                    )}
                  </View>
                  <View className="ml-4 bg-secondary rounded-full p-3">
                    <Feather name="chevron-right" size={20} color="white" />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Bouton reset */}
      {startPoint && step === "end" && (
        <TouchableOpacity
          onPress={handleReset}
          className="bg-white border-t border-slate-200 px-4 py-3"
        >
          <Text className="text-center text-red-500 font-semibold">
            ✕ Annuler et recommencer
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

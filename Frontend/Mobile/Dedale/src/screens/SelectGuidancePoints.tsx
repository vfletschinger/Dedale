import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StatusBar,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { usePoints } from "../context/PointsContext";
import { InterestPointsType } from "../types/database";
import { getAddressFromCoords, shortId } from "../services/Helper";
import "../style/global.css";
import Colors from "../constants/colors";

interface SelectionState {
  start: string | null;
  end: string | null;
}

export default function SelectGuidancePointsScreen() {
  const navigation = useNavigation<any>();
  const { points } = usePoints();
  const [selection, setSelection] = useState<SelectionState>({
    start: null,
    end: null,
  });
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Charger les adresses pour tous les points
    const loadAddresses = async () => {
      const newAddresses: Record<string, string> = {};
      for (const point of points) {
        const addr = await getAddressFromCoords(point.y, point.x);
        newAddresses[point.id] = addr || "Adresse inconnue";
      }
      setAddresses(newAddresses);
    };

    if (points.length > 0) {
      loadAddresses();
    }
  }, [points]);

  const toggleSelection = (pointId: string, type: "start" | "end") => {
    setSelection((prev) => ({
      ...prev,
      [type]: prev[type] === pointId ? null : pointId,
    }));
  };

  const handleStartNavigation = () => {
    if (!selection.start || !selection.end) {
      Alert.alert("Erreur", "Veuillez sélectionner un point de départ et d'arrivée");
      return;
    }

    if (selection.start === selection.end) {
      Alert.alert("Erreur", "Les points de départ et d'arrivée doivent être différents");
      return;
    }

    navigation.navigate("PointGuidance", {
      startPointId: selection.start,
      endPointId: selection.end,
    });
  };

  const renderPointItem = (point: InterestPointsType) => {
    const isStartSelected = selection.start === point.id;
    const isEndSelected = selection.end === point.id;

    return (
      <View className="flex-row mb-3 gap-2">
        {/* Sélection départ */}
        <TouchableOpacity
          onPress={() => toggleSelection(point.id, "start")}
          className={`flex-1 p-3 rounded-lg border-2 ${
            isStartSelected
              ? "bg-green-100 border-green-500"
              : "bg-white border-slate-200"
          }`}
        >
          <View className="flex-row items-center mb-1">
            <Text className="text-sm font-bold text-slate-700">Départ</Text>
            {isStartSelected && (
              <Feather name="check-circle" size={16} color="#16a34a" className="ml-1" />
            )}
          </View>
          <Text className="font-semibold text-slate-900">
            {point.name || `Point #${shortId(point.id)}`}
          </Text>
          <Text className="text-xs text-slate-500 mt-1">
            {addresses[point.id] || "Chargement..."}
          </Text>
        </TouchableOpacity>

        {/* Sélection arrivée */}
        <TouchableOpacity
          onPress={() => toggleSelection(point.id, "end")}
          className={`flex-1 p-3 rounded-lg border-2 ${
            isEndSelected
              ? "bg-red-100 border-red-500"
              : "bg-white border-slate-200"
          }`}
        >
          <View className="flex-row items-center mb-1">
            <Text className="text-sm font-bold text-slate-700">Arrivée</Text>
            {isEndSelected && (
              <Feather name="check-circle" size={16} color="#dc2626" className="ml-1" />
            )}
          </View>
          <Text className="font-semibold text-slate-900">
            {point.name || `Point #${shortId(point.id)}`}
          </Text>
          <Text className="text-xs text-slate-500 mt-1">
            {addresses[point.id] || "Chargement..."}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-4 shadow-md">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-bold flex-1 ml-3">
            Guidage entre deux points
          </Text>
        </View>
      </View>

      {/* Content */}
      {points.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <Feather name="inbox" size={48} color="#cbd5e1" />
          <Text className="text-slate-600 text-center mt-4 text-base">
            Aucun point disponible
          </Text>
        </View>
      ) : (
        <>
          <View className="flex-1 px-4 py-4">
            {/* Résumé de la sélection */}
            {(selection.start || selection.end) && (
              <View className="bg-secondary/10 rounded-lg p-3 mb-4 border border-secondary/30">
                <Text className="text-sm font-semibold text-secondary">
                  Sélection actuelle:
                </Text>
                {selection.start && (
                  <Text className="text-sm text-slate-700 mt-1">
                    ✓ Départ: {points.find((p) => p.id === selection.start)?.name || "Point"}
                  </Text>
                )}
                {selection.end && (
                  <Text className="text-sm text-slate-700 mt-1">
                    ✓ Arrivée: {points.find((p) => p.id === selection.end)?.name || "Point"}
                  </Text>
                )}
              </View>
            )}

            <Text className="text-base font-bold text-slate-800 mb-3">
              Sélectionner les points:
            </Text>

            <FlatList
              data={points}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderPointItem(item)}
              scrollEnabled={true}
            />
          </View>

          {/* Bouton d'action */}
          <View className="px-4 py-4 border-t border-slate-200">
            <TouchableOpacity
              onPress={handleStartNavigation}
              disabled={!selection.start || !selection.end}
              className={`py-3 px-4 rounded-lg items-center justify-center flex-row ${
                selection.start && selection.end
                  ? "bg-secondary"
                  : "bg-slate-300"
              }`}
            >
              <Feather
                name="navigation"
                size={20}
                color="white"
              />
              <Text className="text-white font-bold ml-2">
                Commencer le guidage
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

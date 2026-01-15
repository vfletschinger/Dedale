import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { getDatabase } from "../../assets/migrations";

type ObstacleType = {
  id: string;
  name: string;
  description?: string;
};

export type SelectedObstacle = {
  type_id: string;
  name: string;
  number: number;
};

type ObstacleSelectorProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (obstacles: SelectedObstacle[]) => void;
  initialObstacles?: SelectedObstacle[];
  editMode?: boolean;
};

export default function ObstacleSelector({
  visible,
  onClose,
  onSave,
  initialObstacles = [],
  editMode = false,
}: ObstacleSelectorProps) {
  const db = getDatabase();
  const [availableObstacles, setAvailableObstacles] = useState<ObstacleType[]>(
    []
  );
  const [selectedObstacles, setSelectedObstacles] =
    useState<SelectedObstacle[]>(initialObstacles);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ObstacleType | null>(null);
  const [obstacleNumber, setObstacleNumber] = useState("1");

  useEffect(() => {
    if (visible) {
      fetchObstacleTypes();
      setSelectedObstacles(initialObstacles);
      setSelectedType(null);
      setObstacleNumber("1");
      setIsDropdownOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialObstacles]);

  const fetchObstacleTypes = () => {
    try {
      const types = db.getAllSync<ObstacleType>(
        "SELECT * FROM type"
      );
      setAvailableObstacles(types || []);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des types d'obstacles:",
        error
      );
    }
  };

  const handleAddObstacle = () => {
    if (!selectedType) return;

    const number = parseInt(obstacleNumber) || 1;

    const newObstacle: SelectedObstacle = {
      type_id: selectedType.id,
      name: selectedType.name,
      number: number,
    };

    setSelectedObstacles([...selectedObstacles, newObstacle]);
    setSelectedType(null);
    setObstacleNumber("1");
    setIsDropdownOpen(false);
  };

  const handleRemoveObstacle = (index: number) => {
    setSelectedObstacles(selectedObstacles.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(selectedObstacles);
    setSelectedObstacles([]);
    onClose();
  };

  const handleCancel = () => {
    setSelectedObstacles([]);
    setSelectedType(null);
    setObstacleNumber("1");
    setIsDropdownOpen(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View className="flex-1 justify-center items-center bg-black/50 p-4">
        <View className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[85%]">
          <Text className="text-2xl font-bold mb-4 text-center">
            {editMode ? "Modifier les obstacles" : "Ajouter des obstacles"}
          </Text>

          {/* Dropdown de sélection */}
          <View className="mb-4">
            <Text className="text-sm font-semibold mb-2 text-gray-700">
              Type d&apos;obstacle
            </Text>
            <Pressable
              onPress={() => setIsDropdownOpen(!isDropdownOpen)}
              className="border border-gray-300 rounded-lg p-3 bg-white"
            >
              <Text
                className={selectedType ? "text-gray-900" : "text-gray-400"}
              >
                {selectedType
                  ? selectedType.name
                  : "Sélectionner un obstacle..."}
              </Text>
            </Pressable>

            {isDropdownOpen && (
              <View className="border border-gray-300 rounded-lg mt-1 bg-white max-h-48">
                <ScrollView>
                  {availableObstacles.map((obstacle) => (
                    <Pressable
                      key={obstacle.id}
                      onPress={() => {
                        setSelectedType(obstacle);
                        setIsDropdownOpen(false);
                      }}
                      className="p-3 border-b border-gray-100"
                    >
                      <Text className="font-semibold">{obstacle.name}</Text>
                      {obstacle.description && (
                        <Text className="text-xs text-gray-600 mt-1">
                          {obstacle.description}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Nombre d'obstacles */}
          <View className="mb-4">
            <Text className="text-sm font-semibold mb-2 text-gray-700">
              Nombre
            </Text>
            <TextInput
              value={obstacleNumber}
              onChangeText={setObstacleNumber}
              keyboardType="numeric"
              className="border border-gray-300 rounded-lg p-3"
              placeholder="1"
            />
          </View>

          {/* Bouton ajouter */}
          <Pressable
            onPress={handleAddObstacle}
            disabled={!selectedType}
            className={`py-3 rounded-lg mb-4 ${
              selectedType ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <Text className="text-center text-white font-semibold">
              + Ajouter cet obstacle
            </Text>
          </Pressable>

          {/* Liste des obstacles sélectionnés */}
          <View className="mb-4">
            <Text className="text-sm font-semibold mb-2 text-gray-700">
              Obstacles sélectionnés ({selectedObstacles.length})
            </Text>
            <ScrollView className="max-h-32">
              <View className="flex-row flex-wrap gap-2">
                {selectedObstacles.map((obstacle, index) => (
                  <View
                    key={index}
                    className="bg-blue-100 flex-row items-center px-3 py-2 rounded-full"
                  >
                    <Text className="text-blue-800 font-medium mr-2">
                      {obstacle.name} ({obstacle.number})
                    </Text>
                    <Pressable
                      onPress={() => handleRemoveObstacle(index)}
                      className="bg-blue-500 w-5 h-5 rounded-full items-center justify-center"
                    >
                      <Text className="text-white text-xs font-bold">×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              {selectedObstacles.length === 0 && (
                <Text className="text-gray-400 text-sm italic">
                  Aucun obstacle sélectionné
                </Text>
              )}
            </ScrollView>
          </View>

          {/* Boutons d'action */}
          <View className="flex-row gap-3 mt-4">
            <Pressable
              onPress={handleCancel}
              className="flex-1 bg-gray-300 py-3 rounded-lg"
            >
              <Text className="text-center font-semibold">Annuler</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              className="flex-1 bg-blue-500 py-3 rounded-lg"
            >
              <Text className="text-center text-white font-semibold">
                {editMode ? "Mettre à jour" : "Valider"} (
                {selectedObstacles.length})
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

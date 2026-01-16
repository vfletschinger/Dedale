import {
  View,
  Text,
  Alert,
  Modal,
  TextInput,
  Image,
  Pressable,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import React, { useState, useRef } from "react";
import CustomButton from "../components/CustomButton";
import Map from "../components/Map";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { getDatabase } from "../../assets/migrations";
import * as ImageHelper from "../services/ImageHelper";
import { useEvent } from "../context/EventContext";
import { usePoints } from "../context/PointsContext";
import { generateUUID } from "../services/Helper";
import Colors from "../constants/colors";
import { Feather } from "@expo/vector-icons";

type SelectedObstacle = {
  type_id: string;
  name: string;
  number: number;
};

export default function RegisterPointScreen() {
  const { selectedEventId } = useEvent();
  const { refreshPoints } = usePoints();
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const db: any = getDatabase();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [pointComment, setPointComment] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedObstacles, setSelectedObstacles] = useState<
    SelectedObstacle[]
  >([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  React.useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission refusée",
        "Impossible d'accéder à la localisation."
      );
      return null;
    }

    let loc = await Location.getCurrentPositionAsync({});

    const newCoords = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };

    setCoords(newCoords);
    setLocation(newCoords);
    if (mapRef.current) {
      try {
        mapRef.current.animateToRegion(
          {
            latitude: newCoords.latitude,
            longitude: newCoords.longitude,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          },
          800
        );
      } catch {
        // ignore animate errors
      }
    }
    return newCoords;
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Autorisation caméra refusée.");
        return;
      }

      const result: any = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });

      const uri = result?.assets?.[0]?.uri ?? result?.uri;
      if (uri) {
        setSelectedImages((prevImages) => [...prevImages, uri]);
      }
    } catch (error) {
      console.error("Erreur lors de la prise de photo :", error);
      Alert.alert("Erreur", "Impossible d'accéder à la caméra.");
    }
  };

  const removeImage = (uriToRemove: string) => {
    setSelectedImages((prevImages) =>
      prevImages.filter((uri) => uri !== uriToRemove)
    );
  };

  const savePointToDB = async (
    x: number,
    y: number,
    commentValue: string = ""
  ) => {
    try {
      const pointId = generateUUID();

      db.runSync(
        "INSERT INTO point (id, event_id, x, y, comment) VALUES (?, ?, ?, ?, ?)",
        [pointId, selectedEventId, x, y, commentValue.trim() || null]
      );

      // Sauvegarder les images
      if (selectedImages.length > 0) {
        for (const imageUri of selectedImages) {
          try {
            await ImageHelper.saveImageToBDD(imageUri, pointId);
          } catch (imgErr) {
            console.error(
              `Erreur lors de la sauvegarde de l'image ${imageUri} :`,
              imgErr
            );
            const errMessage =
              (imgErr && (imgErr as any).message) || String(imgErr);
            Alert.alert(
              "Attention",
              `Le point a été enregistré mais la sauvegarde d'une image a échoué. (${errMessage})`
            );
          }
        }
      }

      if (selectedObstacles.length > 0 && selectedEventId && location) {
        for (const obstacle of selectedObstacles) {
          try {
            const equipementId = generateUUID();
            db.runSync(
              "INSERT INTO equipement (id, event_id, type_id, quantity, length_per_unit) VALUES (?, ?, ?, ?, ?)",
              [
                equipementId,
                selectedEventId,
                obstacle.type_id,
                obstacle.number,
                0,
              ]
            );
            const coordId = generateUUID();
            db.runSync(
              "INSERT INTO equipement_coordinate (id, equipement_id, x, y, order_index) VALUES (?, ?, ?, ?, ?)",
              [coordId, equipementId, location.longitude, location.latitude, 0]
            );
          } catch (equipErr) {
            console.error(
              "Erreur lors de la sauvegarde de l'équipement:",
              equipErr
            );
            Alert.alert(
              "Attention",
              `Le point a été enregistré mais un équipement n'a pas pu être ajouté.`
            );
          }
        }
      }

      return pointId;
    } catch (error: any) {
      console.error(
        "Erreur lors de la sauvegarde du point/commentaire :",
        error
      );
      Alert.alert(
        "Erreur",
        "Impossible d'enregistrer le point et son commentaire."
      );
      return null;
    }
  };

  const handleSaveObstacles = (obstacles: SelectedObstacle[]) => {
    setSelectedObstacles(obstacles);
  };

  return (
    <View className="flex-1 bg-white">
      <Map
        mapRef={mapRef}
        initialRegion={
          coords
            ? {
              latitude: coords.latitude,
              longitude: coords.longitude,
              latitudeDelta: 0.003,
              longitudeDelta: 0.003,
            }
            : undefined
        }
        onMapPress={(e) => {
          const clickedCoords = e.nativeEvent.coordinate;
          setLocation(clickedCoords);
          setIsModalVisible(true);
        }}
        hideDefaultMarkers={false}
        hideButtons={true}
        customMarker={
          location ? (
            <Marker
              coordinate={location}
              title="Nouveau point"
              description="Point à enregistrer"
            >
              {/* Pin personnalisé */}
              <View style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: Colors.secondary,
                    borderRadius: 15,
                    borderTopLeftRadius: 15,
                    borderTopRightRadius: 15,
                    borderBottomLeftRadius: 15,
                    borderBottomRightRadius: 0,
                    transform: [{ rotate: "45deg" }],
                    borderWidth: 3,
                    borderColor: "white",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 3,
                    elevation: 5,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {/* Cercle intérieur */}
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      backgroundColor: "#1d4ed8",
                      borderRadius: 5,
                      transform: [{ rotate: "-45deg" }],
                    }}
                  />
                </View>
              </View>
            </Marker>
          ) : null
        }
      />

      <View className="absolute bottom-5 left-5 right-5 flex-row justify-between gap-2">
        <Pressable
          onPress={requestLocation}
          className="flex-1 p-4 rounded-xl items-center active:bg-violet-600"
          style={{ backgroundColor: Colors.secondary }}
        >
          <Text className="text-white font-bold">Centrer</Text>
        </Pressable>

        <Pressable
          onPress={() => setIsModalVisible(true)}
          className="flex-1 p-4 rounded-xl items-center active:bg-violet-600"
          style={{ backgroundColor: Colors.secondary }}
        >
          <Text className="text-white font-bold">Ajouter un point</Text>
        </Pressable>
      </View>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end"
        >
          <View className="bg-white rounded-t-3xl" style={{ maxHeight: '85%' }}>
            {/* Header avec barre accent */}
            <View style={{ backgroundColor: Colors.secondary }} className="rounded-t-3xl px-5 py-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View style={{ backgroundColor: Colors.accent }} className="w-10 h-10 rounded-full items-center justify-center mr-3">
                    <Feather name="map-pin" size={20} color="white" />
                  </View>
                  <View>
                    <Text className="text-white font-bold text-lg">Nouveau point</Text>
                    <Text className="text-white/70 text-xs">Ajoutez les détails du point</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    setIsModalVisible(false);
                    setPointComment("");
                    setSelectedImages([]);
                    setSelectedObstacles([]);
                  }}
                  className="w-8 h-8 rounded-full bg-white/20 items-center justify-center"
                >
                  <Feather name="x" size={18} color="white" />
                </Pressable>
              </View>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              className="px-5 py-4"
            >
              {/* Section Commentaire */}
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <Feather name="message-circle" size={20} color={Colors.secondary} style={{ marginRight: 8 }} />
                  <Text className="font-semibold text-gray-800">Commentaire</Text>
                </View>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 min-h-[80px]"
                  placeholder="Décrivez ce point d'intérêt..."
                  placeholderTextColor="#9ca3af"
                  value={pointComment}
                  onChangeText={setPointComment}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Badges obstacles */}
              {selectedObstacles.length > 0 && (
                <View className="flex-row flex-wrap gap-2">
                  {selectedObstacles.map((obs, idx) => (
                    <View
                      key={idx}
                      style={{ backgroundColor: Colors.accent + '20' }}
                      className="px-3 py-1.5 rounded-full flex-row items-center"
                    >
                      <Text style={{ color: Colors.secondary }} className="font-medium text-sm">
                        {obs.name}
                      </Text>
                      <View style={{ backgroundColor: Colors.secondary }} className="ml-2 w-5 h-5 rounded-full items-center justify-center">
                        <Text className="text-white text-xs font-bold">{obs.number}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Section Photos */}
              <View className="mb-6">
                <View className="flex-row items-center mb-2">
                  <Feather name="camera" size={20} color={Colors.secondary} style={{ marginRight: 8 }} />
                  <Text className="font-semibold text-gray-800">Photos</Text>
                </View>

                {/* Galerie photos */}
                <View className="flex-row flex-wrap">
                  {/* Photos existantes */}
                  {selectedImages.map((item, index) => (
                    <View key={item} style={{ position: 'relative', marginRight: 12, marginBottom: 12 }}>
                      <Pressable onPress={() => setPreviewImage(item)}>
                        <Image
                          source={{ uri: item }}
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: 12,
                          }}
                        />
                      </Pressable>
                      <TouchableOpacity
                        onPress={() => removeImage(item)}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          backgroundColor: Colors.error,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderWidth: 2,
                          borderColor: 'white',
                        }}
                      >
                        <Feather name="x" size={10} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Bouton ajouter photo */}
                  <Pressable
                    onPress={pickImage}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: Colors.secondary,
                      borderStyle: 'dashed',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: Colors.secondary + '10',
                    }}
                  >
                    <Feather name="plus" size={24} color={Colors.secondary} />
                    <Text style={{ color: Colors.secondary, fontSize: 10, marginTop: 2 }}>Photo</Text>
                  </Pressable>
                </View>
              </View>

              {/* Boutons d'action */}
              <View className="mb-6">
                {/* Bouton Enregistrer */}
                <Pressable
                  onPress={async () => {
                    if (location) {
                      const insertedId = await savePointToDB(
                        location.longitude,
                        location.latitude,
                        pointComment
                      );
                      if (insertedId) {
                        await refreshPoints();
                        Alert.alert("Succès", "Point enregistré avec succès");
                        setIsModalVisible(false);
                        setPointComment("");
                        setSelectedImages([]);
                        setSelectedObstacles([]);
                        setLocation(null);
                      }
                    } else {
                      Alert.alert("Erreur", "Aucune position à enregistrer.");
                    }
                  }}
                  style={{ backgroundColor: Colors.success }}
                  className="py-4 rounded-xl flex-row items-center justify-center mb-3"
                >
                  <Feather name="check" size={18} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-base">Enregistrer le point</Text>
                </Pressable>

                {/* Bouton Annuler */}
                <Pressable
                  onPress={() => {
                    setIsModalVisible(false);
                    setPointComment("");
                    setSelectedImages([]);
                    setSelectedObstacles([]);
                  }}
                  className="py-3 rounded-xl flex-row items-center justify-center border border-gray-300"
                >
                  <Text className="text-gray-600 font-medium">Annuler</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView >
      </Modal >

      {/* Modal de prévisualisation d'image */}
      <Modal
        visible={previewImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View className="flex-1 bg-black/90 justify-center items-center">
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              className="w-full h-4/5"
              resizeMode="contain"
            />
          )}
          <View className="absolute bottom-10 flex-row gap-4">
            <Pressable
              onPress={() => setPreviewImage(null)}
              className="bg-white px-6 py-3 rounded-xl"
            >
              <Text className="text-gray-800 font-bold">Fermer</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (previewImage) {
                  removeImage(previewImage);
                  setPreviewImage(null);
                }
              }}
              className="bg-red-500 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-bold">Supprimer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
} from "react-native";
import React, { useState, useRef } from "react";
import CustomButton from "../components/CustomButton";
import ObstacleSelector from "../components/ObstacleSelector";
import Map from "../components/Map";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import getDatabase from "../../assets/migrations";
import * as ImageHelper from "../services/ImageHelper";
import { useEvent } from "../context/EventContext";
import { usePoints } from "../context/PointsContext";

type SelectedObstacle = {
  type_id: number;
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
  const [isObstacleSelectorVisible, setIsObstacleSelectorVisible] =
    useState(false);
  const [pointComment, setPointComment] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedObstacles, setSelectedObstacles] = useState<
    SelectedObstacle[]
  >([]);

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
      } catch (e) {
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
      const pointResult: any = db.runSync(
        "INSERT INTO point (x, y) VALUES (?, ?)",
        [x, y]
      );

      const insertedPointId = pointResult.lastInsertRowId as number;
      if (!insertedPointId || insertedPointId === 0) {
        throw new Error(
          "Impossible de récupérer l'ID du point qui vient d'être créé."
        );
      }

      // Associate point with current event via junction table
      if (selectedEventId) {
        db.runSync(
          "INSERT INTO point_event (point_id, event_id) VALUES (?, ?)",
          [insertedPointId, selectedEventId]
        );
      }

      // Sauvegarder les images
      if (selectedImages.length > 0) {
        for (const imageUri of selectedImages) {
          try {
            await ImageHelper.saveImageToBDD(imageUri, insertedPointId);
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

      // Sauvegarder le commentaire
      if (commentValue.trim()) {
        db.runSync("INSERT INTO comment (point_id, value) VALUES (?, ?)", [
          insertedPointId,
          commentValue,
        ]);
      }

      // Sauvegarder les obstacles
      if (selectedObstacles.length > 0) {
        for (const obstacle of selectedObstacles) {
          try {
            db.runSync(
              "INSERT INTO obstacle (point_id, type_id, number) VALUES (?, ?, ?)",
              [insertedPointId, obstacle.type_id, obstacle.number]
            );
          } catch (obstErr) {
            console.error(
              "Erreur lors de la sauvegarde de l'obstacle:",
              obstErr
            );
            Alert.alert(
              "Attention",
              `Le point a été enregistré mais un obstacle n'a pas pu être ajouté.`
            );
          }
        }
      }

      return insertedPointId;
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
    <View className="container-white">
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
                    backgroundColor: "#3b82f6",
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
        <Pressable onPress={requestLocation} className="flex-1 btn-violet">
          <Text className="text-white font-bold">Obtenir ma position</Text>
        </Pressable>

        <Pressable
          onPress={() => setIsModalVisible(true)}
          className="flex-1 btn-violet"
        >
          <Text className="text-white font-bold">Ajouter un point</Text>
        </Pressable>
      </View>

      {/* Modal principale */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View className="modal-bottom">
          <View className="modal-bottom-content max-h-[80%]">
            <Text className="text-lg font-semibold mb-3">
              Ajouter un point d'intérêt
            </Text>

            {/* Commentaire */}
            <TextInput
              className="input-multiline mb-3"
              placeholder="Entrez le commentaire du point"
              value={pointComment}
              onChangeText={setPointComment}
              multiline
            />

            {/* Bouton pour ajouter des obstacles */}
            <CustomButton
              title={`Ajouter des obstacles ${selectedObstacles.length > 0 ? `(${selectedObstacles.length})` : ""}`}
              onPress={() => setIsObstacleSelectorVisible(true)}
            />

            {/* Affichage des obstacles sélectionnés */}
            {selectedObstacles.length > 0 && (
              <View className="my-2">
                <Text className="font-semibold mb-1">
                  Obstacles sélectionnés :
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {selectedObstacles.map((obs, idx) => (
                    <View key={idx} className="obstacle-tag">
                      <Text className="obstacle-tag-text">
                        {obs.name} ({obs.number})
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Bouton pour prendre une photo */}
            <CustomButton title="Prendre une photo" onPress={pickImage} />

            {/* Liste des images */}
            {selectedImages.length > 0 ? (
              <FlatList
                horizontal
                data={selectedImages}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <View className="relative mr-2 my-2">
                    <Image source={{ uri: item }} className="image-thumbnail" />
                    <TouchableOpacity
                      onPress={() => removeImage(item)}
                      className="image-remove-btn"
                    >
                      <Text className="image-remove-text">X</Text>
                    </TouchableOpacity>
                  </View>
                )}
                className="my-2"
              />
            ) : null}

            {/* Bouton enregistrer */}
            <CustomButton
              title="Enregistrer le point"
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
            />

            {/* Bouton annuler */}
            <CustomButton
              title="Annuler"
              onPress={() => {
                setIsModalVisible(false);
                setPointComment("");
                setSelectedImages([]);
                setSelectedObstacles([]);
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Composant ObstacleSelector */}
      <ObstacleSelector
        visible={isObstacleSelectorVisible}
        onClose={() => setIsObstacleSelectorVisible(false)}
        onSave={handleSaveObstacles}
        initialObstacles={selectedObstacles}
      />
    </View>
  );
}

import { View, Text, ActivityIndicator, ScrollView, Image, Alert, Modal, Pressable } from "react-native";
import { useNavigation, useRoute, useFocusEffect, } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { getDatabase } from "../../assets/migrations";
import {
  PointDetailType,
  PictureType,
  InterestPointsType,
} from "../types/database";
import {
  deletePoint,
  updateComment,
  deleteComment,
  addComment,
  deletePicture,
  addPicture,
  updatePointCoordinates,
  updateTimeStamp,
} from "../services/databaseAcces";
import { imageToBase64, pickImage } from "../services/ImageHelper";
import { shortId } from "../services/Helper";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import CoordinatesDisplay from "../components/CoordinatesDisplay";
import EditModal from "../components/EditModal";
import { useEvent } from "../context/EventContext";
import { usePoints } from "../context/PointsContext";
import Colors from "../constants/colors";

type RouteParams = { pointId: string };

export default function PointDetails() {
  const db = getDatabase();
  const route = useRoute();
  const { pointId } = route.params as RouteParams;
  const navigation = useNavigation();
  const { getSelectedEvent } = useEvent();
  const { refreshPoints } = usePoints();
  const selectedEvent = getSelectedEvent();
  const [pointData, setPointData] = useState<PointDetailType | null>(null);
  const [loading, setLoading] = useState(true);

  // États pour modal de commentaire
  const [isCommentModalVisible, setIsCommentModalVisible] = useState(false);
  const [commentText, setCommentText] = useState("");

  // États pour modal de coordonnées
  const [isCoordinatesModalVisible, setIsCoordinatesModalVisible] =
    useState(false);
  const [tempCoordinates, setTempCoordinates] = useState<{
    latitude: number;
    longitude: number;
  }>({ latitude: 0, longitude: 0 });

  const fetchPoint = async () => {
    setLoading(true);
    try {
      const point = db.getFirstSync<InterestPointsType>(
        "SELECT * FROM point WHERE id = ?",
        [pointId]
      );

      if (!point) {
        Alert.alert("Erreur", "Point non trouvé");
        navigation.goBack();
        return;
      }

      const pictures = db.getAllSync<PictureType>(
        "SELECT * FROM picture WHERE point_id = ?",
        [pointId]
      );

      setPointData({
        point,
        pictures: pictures || [],
        equipements: [],
      });

      setTempCoordinates({
        latitude: point.y,
        longitude: point.x,
      });
    } catch (e) {
      console.error("Erreur:", e);
      Alert.alert("Erreur", "Impossible de charger les données");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPoint();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pointId])
  );

  const handleDelete = () => {
    Alert.alert(
      "Confirmer la suppression",
      "Êtes-vous sûr de vouloir supprimer ce point ? Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            const success = deletePoint(pointId, db);
            if (success) {
              await refreshPoints();
              navigation.goBack();
            } else {
              Alert.alert("Erreur", "Impossible de supprimer le point");
            }
          },
        },
      ]
    );
  };

  const handleDeleteComment = () => {
    Alert.alert("Confirmer", "Supprimer ce commentaire ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          deleteComment(pointId, db);
          updateTimeStamp(pointId, db);
          fetchPoint();
        },
      },
    ]);
  };

  const handleEditComment = () => {
    setCommentText(pointData?.point.comment || "");
    setIsCommentModalVisible(true);
  };

  const handleAddComment = () => {
    setCommentText("");
    setIsCommentModalVisible(true);
  };

  const handleSaveComment = () => {
    if (!commentText.trim()) {
      Alert.alert("Erreur", "Le commentaire ne peut pas être vide");
      return;
    }

    try {
      addComment(pointId, commentText, db);
      updateTimeStamp(pointId, db);
      setIsCommentModalVisible(false);
      fetchPoint();
    } catch (error) {
      console.error("Erreur:", error);
      Alert.alert("Erreur", "Impossible de sauvegarder le commentaire");
    }
  };

  const handleDeletePicture = (pictureId: string) => {
    Alert.alert("Confirmer", "Supprimer cette image ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          deletePicture(pictureId, db);
          updateTimeStamp(pointId, db);
          fetchPoint();
        },
      },
    ]);
  };

  const handleAddPicture = async () => {
    try {
      const uri = await pickImage();
      if (uri) {
        const base64 = await imageToBase64(uri);
        addPicture(pointId, base64, db);
        updateTimeStamp(pointId, db);
        Alert.alert("Succès", "Image ajoutée");
        fetchPoint();
      }
    } catch (error) {
      console.error("Erreur:", error);
      Alert.alert("Erreur", "Impossible d'ajouter l'image");
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    const { coordinate } = event.nativeEvent;
    setTempCoordinates({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
  };

  const handleSaveCoordinates = () => {
    try {
      updatePointCoordinates(
        pointId,
        tempCoordinates.longitude,
        tempCoordinates.latitude,
        db
      );
      updateTimeStamp(pointId, db);
      Alert.alert("Succès", "Position modifiée avec succès");
      setIsCoordinatesModalVisible(false);
      fetchPoint();
    } catch (error) {
      console.error("Erreur:", error);
      Alert.alert("Erreur", "Impossible de modifier la position");
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  if (!pointData) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Point introuvable</Text>
      </View>
    );
  }

  return (
    <>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between pt-12 pb-3 bg-primary">
          <View className="flex-row items-center flex-1">
            <Pressable onPress={() => navigation.goBack()} className="mr-3">
              <View className="bg-accent/20 w-10 h-10 rounded-full items-center justify-center">
                <Text className="text-accent text-2xl font-bold">←</Text>
              </View>
            </Pressable>
            <Text className="text-accent text-3xl font-bold" numberOfLines={1}>
              {pointData.point.name || `Point #${shortId(pointData.point.id)}`}
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1">
          <View className="p-4">
            {/* Coordonnées */}
            <View>
              <View className="mb-3">
                <CoordinatesDisplay
                  latitude={pointData.point.y}
                  longitude={pointData.point.x}
                  showAddress={true}
                  showCoordinates={false}
                />
              </View>
              <View className="overflow-hidden rounded-lg mb-2">
                <MapView
                  style={{ width: "100%", height: 200 }}
                  initialRegion={{
                    latitude: pointData.point.y,
                    longitude: pointData.point.x,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  zoomEnabled={true}
                  scrollEnabled={false}
                  minZoomLevel={17}
                  maxZoomLevel={18}
                >
                  <Marker
                    coordinate={{
                      latitude: pointData.point.y,
                      longitude: pointData.point.x,
                    }}
                    title={
                      pointData.point.name ||
                      `Point #${shortId(pointData.point.id)}`
                    }
                  />
                </MapView>
              </View>
              <Pressable
                onPress={() => {
                  setTempCoordinates({
                    latitude: pointData.point.y,
                    longitude: pointData.point.x,
                  });
                  setIsCoordinatesModalVisible(true);
                }}
                className="bg-secondary py-3 rounded-lg"
              >
                <Text className="text-white text-center font-semibold">
                  📍 Modifier la position
                </Text>
              </Pressable>
            </View>

            {/* Commentaires */}
            <View className="bg-gray-100 p-4 rounded-lg mb-4 mt-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-lg font-semibold">Commentaire</Text>
                {pointData.point.comment ? (
                  <Pressable
                    onPress={handleEditComment}
                    className="px-3 py-1 rounded-lg"
                    style={{ backgroundColor: Colors.secondary }}
                  >
                    <Text className="text-white text-xs font-semibold">
                      ✏️ Modifier
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleAddComment}
                    className="px-3 py-1 rounded-lg"
                    style={{ backgroundColor: Colors.secondary }}
                  >
                    <Text className="text-white text-xs font-semibold">
                      + Ajouter
                    </Text>
                  </Pressable>
                )}
              </View>
              {pointData.point.comment ? (
                <View className="bg-white p-3 rounded-lg mb-2">
                  <Text className="mb-2">{pointData.point.comment}</Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={handleEditComment}
                      className="px-3 py-1 rounded"
                      style={{ backgroundColor: Colors.secondary }}
                    >
                      <Text className="text-white text-xs font-semibold">Modifier</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleDeleteComment}
                      className="bg-red-100 px-3 py-1 rounded"
                    >
                      <Text className="text-red-600 text-xs">Supprimer</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Text className="text-sm text-gray-500">Aucun commentaire</Text>
              )}
            </View>

            {/* Images */}
            <View className="bg-gray-100 p-4 rounded-lg mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-lg font-semibold">
                  Images ({pointData.pictures.length})
                </Text>
                <Pressable
                  onPress={handleAddPicture}
                  className="px-3 py-1 rounded-lg"
                  style={{ backgroundColor: Colors.secondary }}
                >
                  <Text className="text-white text-xs font-semibold">
                    + Ajouter
                  </Text>
                </Pressable>
              </View>
              {pointData.pictures.length > 0 ? (
                pointData.pictures.map((picture) => (
                  <View
                    key={picture.id}
                    className="bg-white p-3 rounded-lg mb-2"
                  >
                    <Image
                      source={{
                        uri: `data:image/jpeg;base64,${picture.image}`,
                      }}
                      style={{
                        width: "100%",
                        height: 200,
                        resizeMode: "contain",
                      }}
                      className="mb-2"
                    />
                    <Pressable
                      onPress={() => handleDeletePicture(picture.id)}
                      className="bg-red-100 px-3 py-1 rounded self-start"
                    >
                      <Text className="text-red-600 text-xs">Supprimer</Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text className="text-sm text-gray-500">Aucune image</Text>
              )}
            </View>
          </View>

          <Pressable
            onPress={handleDelete}
            className="mx-4 mb-6 py-4 bg-white border border-red-500 rounded-lg"
          >
            <Text className="text-red-500 text-center font-semibold text-base">
              Supprimer le point
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Modal de modification de position */}
      <Modal
        visible={isCoordinatesModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsCoordinatesModalVisible(false)}
      >
        <View className="flex-1 bg-white">
          <View className="bg-primary pt-4 pb-4 px-4 shadow-sm">
            <Text className="text-accent text-2xl font-bold mb-2">
              Modifier la position
            </Text>
            <Text className="text-accent-light text-base text-sm">
              Appuyez sur la carte pour déplacer le point
            </Text>
          </View>

          <View className="flex-1">
            <MapView
              style={{ flex: 1 }}
              initialRegion={{
                latitude: tempCoordinates.latitude,
                longitude: tempCoordinates.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              onPress={handleMapPress}
              zoomEnabled={true}
              scrollEnabled={true}
              minZoomLevel={15}
              maxZoomLevel={20}
            >
              <Marker
                coordinate={tempCoordinates}
                title="Nouvelle position"
                draggable
                onDragEnd={(e) => setTempCoordinates(e.nativeEvent.coordinate)}
              />
            </MapView>

            <View className="absolute top-4 left-4 right-4 bg-white/95 p-3 rounded-lg shadow-lg">
              <Text className="text-xs text-gray-600 mb-1">
                Nouvelles coordonnées :
              </Text>
              <Text className="font-mono text-sm">
                Lat: {tempCoordinates.latitude.toFixed(6)}
              </Text>
              <Text className="font-mono text-sm">
                Lon: {tempCoordinates.longitude.toFixed(6)}
              </Text>
            </View>
          </View>

          <View className="p-4 bg-white border-t border-gray-200">
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setIsCoordinatesModalVisible(false)}
                className="flex-1 bg-gray-300 py-3 px-6 rounded-lg active:bg-gray-400"
              >
                <Text className="text-gray-800 text-center font-semibold text-base">
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveCoordinates}
                className="flex-1 bg-blue-500 py-3 px-6 rounded-lg active:bg-blue-600"
              >
                <Text className="text-white text-center font-semibold text-base">
                  ✓ Enregistrer
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de commentaire */}
      <EditModal
        visible={isCommentModalVisible}
        title={
          pointData?.point.comment
            ? "Modifier le commentaire"
            : "Ajouter un commentaire"
        }
        value={commentText}
        onChangeText={setCommentText}
        onSave={handleSaveComment}
        onCancel={() => setIsCommentModalVisible(false)}
        placeholder="Votre commentaire..."
        multiline={true}
        numberOfLines={4}
      />

    </>
  );
}

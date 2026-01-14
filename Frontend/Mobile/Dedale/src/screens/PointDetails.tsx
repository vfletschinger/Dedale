import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { getDatabase } from "../../assets/migrations";
import {
  PointDetailType,
  PictureType,
  EquipementType,
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
  addEquipement,
  deleteEquipement,
  updateTimeStamp,
} from "../services/databaseAcces";
import { imageToBase64, pickImage } from "../services/ImageHelper";
import { shortId } from "../services/Helper";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import CoordinatesDisplay from "../components/CoordinatesDisplay";
import EditModal from "../components/EditModal";
import ObstacleSelector, { SelectedObstacle } from "../components/ObstacleSelector";
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

  // États pour modal d'obstacles
  const [isObstacleSelectorVisible, setIsObstacleSelectorVisible] =
    useState(false);
  const [editingObstacles, setEditingObstacles] = useState(false);

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

      const equipements = db.getAllSync<EquipementType>(
        `SELECT e.*, t.name, t.description
         FROM equipement e
         LEFT JOIN type t ON e.type_id = t.id
         INNER JOIN equipement_coordinate ec ON ec.equipement_id = e.id
         WHERE ec.x = ? AND ec.y = ?`,
        [point.x, point.y]
      );

      setPointData({
        point,
        pictures: pictures || [],
        equipements: equipements || [],
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

  const handleSaveEquipements = (equipements: SelectedObstacle[]) => {
    if (equipements.length === 0) {
      if (editingObstacles) {
        // Mode édition : supprimer tous les équipements existants
        Alert.alert("Confirmer", "Supprimer tous les équipements ?", [
          { text: "Annuler", style: "cancel" },
          {
            text: "Supprimer",
            style: "destructive",
            onPress: () => {
              try {
                pointData?.equipements.forEach((equipement) => {
                  deleteEquipement(equipement.id, db);
                });
                updateTimeStamp(pointId, db);
                fetchPoint();
                Alert.alert("Succès", "Équipements supprimés");
              } catch (error) {
                console.error("Erreur:", error);
                Alert.alert(
                  "Erreur",
                  "Impossible de supprimer les équipements"
                );
              }
            },
          },
        ]);
      }
      return;
    }

    try {
      if (editingObstacles) {
        // Mode édition : supprimer les anciens équipements
        pointData?.equipements.forEach((equipement) => {
          deleteEquipement(equipement.id, db);
        });
      }

      // Ajouter les nouveaux équipements (maintenant au niveau event)
      if (selectedEvent?.id) {
        for (const equipement of equipements) {
          addEquipement(selectedEvent.id, equipement.type_id, equipement.number, db);
        }
      }

      updateTimeStamp(pointId, db);
      Alert.alert(
        "Succès",
        editingObstacles ? "Équipements mis à jour" : "Équipements ajoutés"
      );
      fetchPoint();
      setEditingObstacles(false);
    } catch (error) {
      console.error("Erreur:", error);
      Alert.alert("Erreur", "Impossible de sauvegarder les équipements");
    }
  };

  const handleEditObstacles = () => {
    setEditingObstacles(true);
    setIsObstacleSelectorVisible(true);
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
      <View className="container-white">
        <View className="header-lg header-row pt-12 pb-3 bg-primary">
          <View className="row flex-1">
            <Pressable onPress={() => navigation.goBack()} className="mr-3">
              <View className="back-btn-circle">
                <Text className="back-btn-text">←</Text>
              </View>
            </Pressable>
            <Text className="header-title-lg" numberOfLines={1}>
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
          <View className="section-box mt-4">
            <View className="section-header">
              <Text className="text-section-title">Commentaire</Text>
              {pointData.point.comment ? (
                <Pressable
                  onPress={handleEditComment}
                  className="btn-add-small"
                >
                  <Text className="btn-add-small-text">✏️ Modifier</Text>
                </Pressable>
              ) : (
                <Pressable onPress={handleAddComment} className="btn-add-small">
                  <Text className="btn-add-small-text">+ Ajouter</Text>
                </Pressable>
              )}
            </View>
            {pointData.point.comment ? (
              <View className="section-item">
                <Text className="mb-2">{pointData.point.comment}</Text>
                <View className="row-gap">
                  <Pressable
                    onPress={handleEditComment}
                    className="action-btn-edit"
                  >
                    <Text className="action-btn-edit-text">Modifier</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDeleteComment}
                    className="action-btn-delete"
                  >
                    <Text className="action-btn-delete-text">Supprimer</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text className="text-caption">Aucun commentaire</Text>
            )}
          </View>

          {/* Équipements */}
          <View className="section-box">
            <View className="section-header">
              <Text className="text-section-title">
                Équipements ({pointData.equipements.length})
              </Text>
              <View className="row-gap">
                <Pressable
                  onPress={handleEditObstacles}
                  className="btn-add-small"
                >
                  <Text className="btn-add-small-text">
                    {pointData.equipements.length > 0
                      ? "✏️ Modifier"
                      : "+ Ajouter"}
                  </Text>
                </Pressable>
              </View>
            </View>
            {pointData.equipements.length > 0 ? (
              pointData.equipements.map((equipement) => (
                <View key={equipement.id} className="section-item">
                  <Text className="font-semibold">{equipement.name}</Text>
                  {equipement.description && (
                    <Text className="text-caption">
                      {equipement.description}
                    </Text>
                  )}
                  <Text className="text-sm mt-1">
                    Quantité: {equipement.quantity}
                  </Text>
                  {equipement.length_per_unit && equipement.length_per_unit > 0 && (
                    <Text className="text-sm">
                      Longueur par unité: {equipement.length_per_unit}m
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text className="text-caption">Aucun équipement</Text>
            )}
          </View>

          {/* Images */}
          <View className="section-box">
            <View className="section-header">
              <Text className="text-section-title">
                Images ({pointData.pictures.length})
              </Text>
              <Pressable onPress={handleAddPicture} className="btn-add-small">
                <Text className="btn-add-small-text">+ Ajouter</Text>
              </Pressable>
            </View>
            {pointData.pictures.length > 0 ? (
              pointData.pictures.map((picture) => (
                <View key={picture.id} className="section-item">
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${picture.image}` }}
                    style={{
                      width: "100%",
                      height: 200,
                      resizeMode: "contain",
                    }}
                    className="mb-2"
                  />
                  <Pressable
                    onPress={() => handleDeletePicture(picture.id)}
                    className="action-btn-delete self-start"
                  >
                    <Text className="action-btn-delete-text">Supprimer</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <Text className="text-caption">Aucune image</Text>
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
        <View className="container-white">
          <View className="header-lg">
            <Text className="header-title mb-2">Modifier la position</Text>
            <Text className="header-subtitle text-sm">
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

            <View className="map-coord-overlay">
              <Text className="text-xs text-gray-600 mb-1">
                Nouvelles coordonnées :
              </Text>
              <Text className="coord-text">
                Lat: {tempCoordinates.latitude.toFixed(6)}
              </Text>
              <Text className="coord-text">
                Lon: {tempCoordinates.longitude.toFixed(6)}
              </Text>
            </View>
          </View>

          <View className="p-4 bg-white border-t border-gray-200">
            <View className="modal-actions">
              <Pressable
                onPress={() => setIsCoordinatesModalVisible(false)}
                className="flex-1 btn-secondary"
              >
                <Text className="btn-text-dark">Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveCoordinates}
                className="flex-1 btn-primary"
              >
                <Text className="btn-text">✓ Enregistrer</Text>
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

      {/* Modal de sélection d'équipements */}
      <ObstacleSelector
        visible={isObstacleSelectorVisible}
        onClose={() => {
          setIsObstacleSelectorVisible(false);
          setEditingObstacles(false);
        }}
        onSave={handleSaveEquipements}
        initialObstacles={
          editingObstacles
            ? pointData?.equipements.map((equipement) => ({
                type_id: equipement.type_id,
                name: equipement.name ?? "Nom inconnu",
                number: equipement.quantity,
              })) || []
            : []
        }
        editMode={editingObstacles}
      />
    </>
  );
}

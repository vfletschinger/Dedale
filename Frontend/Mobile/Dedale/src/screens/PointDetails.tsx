import { View, Text, ActivityIndicator, ScrollView, Image, Alert, Modal, Pressable } from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import getDatabase from "../../assets/migrations";
import { PointDetailType, CommentType, PictureType, ObstacleType, InterestPointsType } from "../types/database";
import {
  deletePoint,
  updateComment,
  deleteComment,
  addComment,
  deletePicture,
  addPicture,
  updatePointCoordinates,
  addObstacle,
  deleteObstacle,
  updateTimeStamp
} from "../services/databaseAcces";
import { imageToBase64, pickImage } from "../services/ImageHelper";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import CoordinatesDisplay from "../components/CoordinatesDisplay";
import EditModal from "../components/EditModal";
import ObstacleSelector from "../components/ObstacleSelector";

type RouteParams = { pointId: number; };

type SelectedObstacle = {
  type_id: number;
  name: string;
  number: number;
};

export default function PointDetails() {
  const db = getDatabase();
  const route = useRoute();
  const { pointId } = route.params as RouteParams;
  const navigation = useNavigation();
  const [pointData, setPointData] = useState<PointDetailType | null>(null);
  const [loading, setLoading] = useState(true);

  // États pour modal de commentaire
  const [isCommentModalVisible, setIsCommentModalVisible] = useState(false);
  const [currentComment, setCurrentComment] = useState<CommentType | null>(null);
  const [commentText, setCommentText] = useState('');

  // États pour modal de coordonnées
  const [isCoordinatesModalVisible, setIsCoordinatesModalVisible] = useState(false);
  const [tempCoordinates, setTempCoordinates] = useState<{ latitude: number; longitude: number }>({ latitude: 0, longitude: 0 });

  // États pour modal d'obstacles
  const [isObstacleSelectorVisible, setIsObstacleSelectorVisible] = useState(false);
  const [editingObstacles, setEditingObstacles] = useState(false);

  const fetchPoint = async () => {
    setLoading(true);
    try {
      const point = db.getFirstSync<InterestPointsType>(
        'SELECT * FROM point WHERE id = ?',
        [pointId]
      );

      if (!point) {
        Alert.alert('Erreur', 'Point non trouvé');
        navigation.goBack();
        return;
      }

      const comments = db.getAllSync<CommentType>(
        'SELECT * FROM comment WHERE point_id = ?',
        [pointId]
      );

      const pictures = db.getAllSync<PictureType>(
        'SELECT * FROM picture WHERE point_id = ?',
        [pointId]
      );

      const obstacles = db.getAllSync<ObstacleType>(
        `SELECT o.*, ot.name, ot.description, ot.width, ot.length
         FROM obstacle o
         LEFT JOIN obstacle_type ot ON o.type_id = ot.id
         WHERE o.point_id = ?`,
        [pointId]
      );

      setPointData({
        point,
        comments: comments || [],
        pictures: pictures || [],
        obstacles: obstacles || []
      });

      setTempCoordinates({
        latitude: point.y,
        longitude: point.x
      });

    } catch (e) {
      console.error('Erreur:', e);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPoint();
    }, [pointId])
  );


  const handleDelete = () => {
    Alert.alert(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer ce point ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            const success = deletePoint(pointId, db);
            if (success) {
              Alert.alert('Succès', 'Point supprimé avec succès');
              navigation.goBack();
            } else {
              Alert.alert('Erreur', 'Impossible de supprimer le point');
            }
          }
        }
      ]
    );
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert(
      'Confirmer',
      'Supprimer ce commentaire ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteComment(commentId, db);
            updateTimeStamp(pointId, db);
            fetchPoint();
          }
        }
      ]
    );
  };

  const handleEditComment = (comment: CommentType) => {
    setCurrentComment(comment);
    setCommentText(comment.value);
    setIsCommentModalVisible(true);
  };

  const handleAddComment = () => {
    setCurrentComment(null);
    setCommentText('');
    setIsCommentModalVisible(true);
  };

  const handleSaveComment = () => {
    if (!commentText.trim()) {
      Alert.alert('Erreur', 'Le commentaire ne peut pas être vide');
      return;
    }

    try {
      if (currentComment) {
        updateComment(currentComment.id, commentText, db);
      } else {
        addComment(pointId, commentText, db);
      }
      updateTimeStamp(pointId, db);
      setIsCommentModalVisible(false);
      fetchPoint();
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder le commentaire');
    }
  };

  const handleDeletePicture = (pictureId: number) => {
    Alert.alert(
      'Confirmer',
      'Supprimer cette image ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deletePicture(pictureId, db);
            updateTimeStamp(pointId, db);
            fetchPoint();
          }
        }
      ]
    );
  };

  const handleAddPicture = async () => {
    try {
      const uri = await pickImage();
      if (uri) {
        const base64 = await imageToBase64(uri);
        addPicture(pointId, base64, db);
        updateTimeStamp(pointId, db);
        Alert.alert('Succès', 'Image ajoutée');
        fetchPoint();
      }
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter l\'image');
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    const { coordinate } = event.nativeEvent;
    setTempCoordinates({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude
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
      Alert.alert('Succès', 'Position modifiée avec succès');
      setIsCoordinatesModalVisible(false);
      fetchPoint();
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de modifier la position');
    }
  };

  const handleSaveObstacles = (obstacles: SelectedObstacle[]) => {
    if (obstacles.length === 0) {
      if (editingObstacles) {
        // Mode édition : supprimer tous les obstacles existants
        Alert.alert(
          'Confirmer',
          'Supprimer tous les obstacles ?',
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Supprimer',
              style: 'destructive',
              onPress: () => {
                try {
                  pointData?.obstacles.forEach(obstacle => {
                    deleteObstacle(obstacle.id, db);
                  });
                  updateTimeStamp(pointId, db);
                  fetchPoint();
                  Alert.alert('Succès', 'Obstacles supprimés');
                } catch (error) {
                  console.error('Erreur:', error);
                  Alert.alert('Erreur', 'Impossible de supprimer les obstacles');
                }
              }
            }
          ]
        );
      }
      return;
    }

    try {
      if (editingObstacles) {
        // Mode édition : supprimer les anciens obstacles
        pointData?.obstacles.forEach(obstacle => {
          deleteObstacle(obstacle.id, db);
        });
      }

      // Ajouter les nouveaux obstacles
      for (const obstacle of obstacles) {
        addObstacle(pointId, obstacle.type_id, obstacle.number, db);
      }

      updateTimeStamp(pointId, db);
      Alert.alert('Succès', editingObstacles ? 'Obstacles mis à jour' : 'Obstacles ajoutés');
      fetchPoint();
      setEditingObstacles(false);
      
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les obstacles');
    }
  };

  const handleAddObstacles = () => {
    setEditingObstacles(false);
    setIsObstacleSelectorVisible(true);
  };

  const handleEditObstacles = () => {

    setEditingObstacles(true);
    setIsObstacleSelectorVisible(true);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
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
      <ScrollView className="flex-1 bg-white">
        <View className="bg-blue-500 pt-12 pb-4 px-4 shadow-lg flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Pressable
              onPress={() => navigation.goBack()}
              className="mr-3"
            >
              <View className="bg-white/20 w-10 h-10 rounded-full items-center justify-center">
                <Text className="text-white text-2xl font-bold">←</Text>
              </View>
            </Pressable>
            <Text className="text-white text-3xl font-bold">Détail du point</Text>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              onPress={handleDelete}
              className="bg-red-500/70 w-10 h-10 rounded-full items-center justify-center"
            >
              <Text className="text-white text-xl">🗑️</Text>
            </Pressable>
          </View>
        </View>

        <View className="p-4">
          <Text className="text-3xl font-bold mb-4">Point #{pointData.point.id}</Text>

          {/* Coordonnées */}
          <View>
            <View className="mb-3">
              <CoordinatesDisplay
                latitude={pointData.point.y}
                longitude={pointData.point.x}
                showAddress={true}
              />
            </View>
            <View className="overflow-hidden rounded-lg mb-2">
              <MapView
                style={{ width: '100%', height: 200 }}
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
                  title={`Point #${pointData.point.id}`}
                />
              </MapView>
            </View>
            <Pressable
              onPress={() => {
                setTempCoordinates({
                  latitude: pointData.point.y,
                  longitude: pointData.point.x
                });
                setIsCoordinatesModalVisible(true);
              }}
              className="bg-blue-500 py-3 rounded-lg"
            >
              <Text className="text-white text-center font-semibold">📍 Modifier la position</Text>
            </Pressable>
          </View>

          {/* Commentaires */}
          <View className="bg-gray-100 p-4 rounded-lg mb-4 mt-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-lg font-semibold">
                Commentaires ({pointData.comments.length})
              </Text>
              <Pressable
                onPress={handleAddComment}
                className="bg-blue-500 px-3 py-1 rounded-lg"
              >
                <Text className="text-white text-xs font-semibold">+ Ajouter</Text>
              </Pressable>
            </View>
            {pointData.comments.length > 0 ? (
              pointData.comments.map((comment) => (
                <View key={comment.id} className="bg-white p-3 rounded-lg mb-2">
                  <Text className="mb-2">{comment.value}</Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => handleEditComment(comment)}
                      className="bg-blue-100 px-3 py-1 rounded"
                    >
                      <Text className="text-blue-600 text-xs">Modifier</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteComment(comment.id)}
                      className="bg-red-100 px-3 py-1 rounded"
                    >
                      <Text className="text-red-600 text-xs">Supprimer</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text className="text-gray-500 text-sm">Aucun commentaire</Text>
            )}
          </View>

          {/* Obstacles */}
          <View className="bg-gray-100 p-4 rounded-lg mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-lg font-semibold">
                Obstacles ({pointData.obstacles.length})
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={handleEditObstacles}
                  className="bg-blue-500 px-3 py-1 rounded-lg"
                >
                  <Text className="text-white text-xs font-semibold">{pointData.obstacles.length > 0 ? '✏️ Modifier' : '+ Ajouter'}</Text>
                </Pressable>
              </View>
            </View>
            {pointData.obstacles.length > 0 ? (
              pointData.obstacles.map((obstacle) => (
                <View key={obstacle.id} className="bg-white p-3 rounded-lg mb-2">
                  <Text className="font-semibold">{obstacle.name}</Text>
                  {obstacle.description && (
                    <Text className="text-sm text-gray-600">{obstacle.description}</Text>
                  )}
                  <Text className="text-sm mt-1">Nombre: {obstacle.number}</Text>
                  {(obstacle.length || obstacle.width) && (
                    <Text className="text-sm">
                      Dimensions: {obstacle.length}m x {obstacle.width}m
                    </Text>
                  )}

                </View>
              ))
            ) : (
              <Text className="text-gray-500 text-sm">Aucun obstacle</Text>
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
                className="bg-blue-500 px-3 py-1 rounded-lg"
              >
                <Text className="text-white text-xs font-semibold">+ Ajouter</Text>
              </Pressable>
            </View>
            {pointData.pictures.length > 0 ? (
              pointData.pictures.map((picture) => (
                <View key={picture.id} className="bg-white p-3 rounded-lg mb-2">
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${picture.image}` }}
                    style={{ width: '100%', height: 200, resizeMode: 'contain' }}
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
              <Text className="text-gray-500 text-sm">Aucune image</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Modal de modification de position */}
      <Modal
        visible={isCoordinatesModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsCoordinatesModalVisible(false)}
      >
        <View className="flex-1 bg-white">
          <View className="bg-blue-500 pt-12 pb-4 px-4 shadow-lg">
            <Text className="text-white text-2xl font-bold mb-2">Modifier la position</Text>
            <Text className="text-blue-100 text-sm">Appuyez sur la carte pour déplacer le point</Text>
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
              <Text className="text-xs text-gray-600 mb-1">Nouvelles coordonnées :</Text>
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
                className="flex-1 bg-gray-300 py-4 rounded-lg"
              >
                <Text className="text-center font-semibold text-base">Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveCoordinates}
                className="flex-1 bg-blue-500 py-4 rounded-lg"
              >
                <Text className="text-center text-white font-semibold text-base">✓ Enregistrer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de commentaire */}
      <EditModal
        visible={isCommentModalVisible}
        title={currentComment ? 'Modifier le commentaire' : 'Ajouter un commentaire'}
        value={commentText}
        onChangeText={setCommentText}
        onSave={handleSaveComment}
        onCancel={() => setIsCommentModalVisible(false)}
        placeholder="Votre commentaire..."
        multiline={true}
        numberOfLines={4}
      />

      {/* Modal de sélection d'obstacles - Maintenant centré */}
      <ObstacleSelector
        visible={isObstacleSelectorVisible}
        onClose={() => {
          setIsObstacleSelectorVisible(false);
          setEditingObstacles(false);
        }}
        onSave={handleSaveObstacles}
        initialObstacles={
          editingObstacles
            ? pointData?.obstacles.map(obstacle => ({
              type_id: obstacle.type_id,
              name: obstacle.name ?? 'Nom inconnu',
              number: obstacle.number
            })) || []
            : []
        }
        editMode={editingObstacles}
      />
    </>
  );
}

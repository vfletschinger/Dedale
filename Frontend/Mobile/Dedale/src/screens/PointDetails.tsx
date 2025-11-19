import { View, Text, ActivityIndicator, ScrollView, Image, Alert, Modal, TextInput, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import getDatabase from "../../assets/migrations";
import { PointDetailType, CommentType, PictureType, ObstacleType, InterestPointsType } from "../types/database";
import { 
  deletePoint, 
  updateComment, 
  deleteComment, 
  addComment,
  deletePicture,
  addPicture,
  updatePointCoordinates 
} from "../services/databaseAcces";
import { imageToBase64, pickImage } from "../services/ImageHelper";

type RouteParams = { pointId: number; };

export default function PointDetails() {
  const db = getDatabase();
  const route = useRoute();
  const { pointId } = route.params as RouteParams;
  const navigation = useNavigation();
  const [pointData, setPointData] = useState<PointDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isCommentModalVisible, setIsCommentModalVisible] = useState(false);
  const [currentComment, setCurrentComment] = useState<CommentType | null>(null);
  const [commentText, setCommentText] = useState('');

  const fetchPoint = async () => {
    try {
      // Récupérer le point
      const point = db.getFirstSync<InterestPointsType>(
        'SELECT * FROM point WHERE id = ?',
        [pointId]
      );

      if (!point) {
        Alert.alert('Erreur', 'Point non trouvé');
        navigation.goBack();
        return;
      }

      // Récupérer tous les commentaires
      const comments = db.getAllSync<CommentType>(
        'SELECT * FROM comment WHERE point_id = ?',
        [pointId]
      );

      // Récupérer toutes les images
      const pictures = db.getAllSync<PictureType>(
        'SELECT * FROM picture WHERE point_id = ?',
        [pointId]
      );

      // Récupérer tous les obstacles avec leurs types
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

    } catch (e) {
      console.error('Erreur:', e);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoint();
  }, [pointId]);

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
        Alert.alert('Succès', 'Image ajoutée');
        fetchPoint();
      }
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter l\'image');
    }
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
              className="bg-red-500/50 w-10 h-10 rounded-full items-center justify-center"
            >
              <Text className="text-white text-xl">🗑️</Text>
            </Pressable>
          </View>
        </View>

        <View className="p-4">
          <Text className="text-3xl font-bold mb-4">Point #{pointData.point.id}</Text>
          
          {/* Coordonnées */}
          <View className="bg-gray-100 p-4 rounded-lg mb-4">
            <Text className="text-lg font-semibold mb-2">Coordonnées</Text>
            <Text>X: {pointData.point.x}</Text>
            <Text>Y: {pointData.point.y}</Text>
          </View>

          {/* Commentaires */}
          <View className="bg-gray-100 p-4 rounded-lg mb-4">
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

          {/* Obstacles */}
          {pointData.obstacles.length > 0 && (
            <View className="bg-gray-100 p-4 rounded-lg mb-4">
              <Text className="text-lg font-semibold mb-2">
                Obstacles ({pointData.obstacles.length})
              </Text>
              {pointData.obstacles.map((obstacle) => (
                <View key={obstacle.id} className="bg-white p-3 rounded-lg mb-2">
                  <Text className="font-semibold">{obstacle.name}</Text>
                  {obstacle.description && (
                    <Text className="text-sm text-gray-600">{obstacle.description}</Text>
                  )}
                  <Text className="text-sm mt-1">Nombre: {obstacle.nombre}</Text>
                  {(obstacle.length || obstacle.width) && (
                    <Text className="text-sm">
                      Dimensions: {obstacle.length}m x {obstacle.width}m
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal de commentaire */}
      <Modal
        visible={isCommentModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCommentModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-2xl font-bold mb-4">
              {currentComment ? 'Modifier le commentaire' : 'Ajouter un commentaire'}
            </Text>
            
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              multiline
              numberOfLines={4}
              className="border border-gray-300 rounded-lg p-3 mb-4"
              placeholder="Votre commentaire..."
            />
            
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setIsCommentModalVisible(false)}
                className="flex-1 bg-gray-300 py-3 rounded-lg"
              >
                <Text className="text-center font-semibold">Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveComment}
                className="flex-1 bg-blue-500 py-3 rounded-lg"
              >
                <Text className="text-center text-white font-semibold">Enregistrer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

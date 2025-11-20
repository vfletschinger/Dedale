import { View, Text, Alert, Modal, TextInput, StyleSheet, Image, Pressable, FlatList, TouchableOpacity } from "react-native";
import React, { useState, useRef } from "react";
import CustomButton from "../components/CustomButton";
import MapView from "react-native-maps";
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import getDatabase from "../../assets/migrations";
import * as ImageHelper from '../services/ImageHelper';

export default function RegisterPointScreen() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const db: any = getDatabase();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [pointComment, setPointComment] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  React.useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Impossible d\'accéder à la localisation.');
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
        mapRef.current.animateToRegion({
          latitude: newCoords.latitude,
          longitude: newCoords.longitude,
          latitudeDelta: 0.002,
          longitudeDelta: 0.002,
        }, 800);
      } catch (e) {
          // ignore animate errors
      }
    }
    return newCoords;
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Autorisation caméra refusée.');
        return;
      }

      const result: any = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });

      const uri = result?.assets?.[0]?.uri ?? result?.uri;
      if (uri) {
        setSelectedImages(prevImages => [...prevImages, uri]);
      }
    } catch (error) {
      console.error('Erreur lors de la prise de photo :', error);
      Alert.alert('Erreur', "Impossible d'accéder à la caméra.");
    }
  };

  const removeImage = (uriToRemove: string) => {
    setSelectedImages(prevImages => prevImages.filter(uri => uri !== uriToRemove));
  };

  const savePointToDB = async (x: number, y: number, commentValue: string = '') => {
  try {
    const pointResult: any = db.runSync(
      'INSERT INTO point (x, y) VALUES (?, ?)',
      [x, y]
    );

    const insertedPointId = pointResult.lastInsertRowId as number;
    if (!insertedPointId || insertedPointId === 0) {
      throw new Error("Impossible de récupérer l'ID du point qui vient d'être créé.");
    }

    db.runSync(
      'INSERT INTO comment (point_id, value) VALUES (?, ?)',
      [insertedPointId, commentValue]
    );

    if (selectedImages.length > 0) {
      for (const imageUri of selectedImages) {
        try {
          try {
            const cols: any[] = db.getAllSync("PRAGMA table_info('picture')");
            const hasImageCol = Array.isArray(cols) && cols.some(c => c.name === 'image');
            if (!hasImageCol) {
              try {
                db.execSync('ALTER TABLE picture ADD COLUMN image TEXT');
                console.log('Colonne `image` ajoutée à la table pictures');
              } catch (alterErr) {
                console.warn('Impossible d\'ajouter la colonne image :', alterErr);
              }
            }
          } catch (pragmaErr) {
            console.warn('Impossible de vérifier les colonnes de la table pictures :', pragmaErr);
          }

          try {
            const info = await FileSystem.getInfoAsync(imageUri);
            console.log('Image file info before save:', info);
            if (!info.exists) {
              console.warn('Le fichier image n\'existe pas ou n\'est pas accessible :', imageUri);
              Alert.alert('Attention', "Le point a été enregistré mais un fichier image n'est pas accessible.");
            }
          } catch (fsErr) {
            console.warn('Erreur lors de la vérification du fichier image :', fsErr);
          }

          await ImageHelper.saveImageToBDD(imageUri, insertedPointId);
        } catch (imgErr) {
          console.error(`Erreur lors de la sauvegarde de l'image ${imageUri} :`, imgErr);
          const errMessage = (imgErr && (imgErr as any).message) || String(imgErr);
          Alert.alert('Attention', `Le point a été enregistré mais la sauvegarde d'une image a échoué. (${errMessage})`);
        }
      }
    }

    return insertedPointId;
  } catch (error: any) {
    console.error("Erreur lors de la sauvegarde du point/commentaire :", error);
    Alert.alert('Erreur', "Impossible d'enregistrer le point et son commentaire.");
    return null;
  }
  };

  const getSavedPoints = () => {
  try {
    const results = db.getAllSync('SELECT * FROM point');
    console.log("Saved Points:", results);
    return results;
  } catch (error) {
    console.error("Erreur lors de la récupération des points :", error); 
    Alert.alert('Erreur', 'Impossible de récupérer les points enregistrés.');
    return [];
  }
  };

  const getSavedComments = () => {
  try {
    const results = db.getAllSync('SELECT * FROM comment');
    console.log("Saved Comments:", results);
    return results;
  } catch (error) {
    console.error("Erreur lors de la récupération des commentaires :", error); 
    Alert.alert('Erreur', 'Impossible de récupérer les commentaires enregistrés.');
    return [];
  }
  };

  const getSavedPictures = () => {
  try {
    const results = db.getAllSync('SELECT * FROM picture');
    console.log("Saved Pictures:", results);
    return results;
  } catch (error) {
    console.error("Erreur lors de la récupération des images :", error); 
    Alert.alert('Erreur', 'Impossible de récupérer les images enregistrées.');
    return [];
  }
  };

  return (
    <View style={styles.container}>
      {coords ? (
        <MapView
          ref={ref => { mapRef.current = ref }}
          style={styles.map}
          initialRegion={{
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.003,
            longitudeDelta: 0.003,
          }}
          showsUserLocation
        />
      ) : (
        <View style={styles.map}>
          <Text>Chargement de la carte...</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Pressable
          onPress={requestLocation}
          style={[styles.button, { backgroundColor: '#8B5CF6' }]}
        >
          <Text style={styles.buttonText}>Obtenir ma position</Text>
        </Pressable>

        <Pressable
          onPress={() => setIsModalVisible(true)}
          style={[styles.button, { backgroundColor: '#8B5CF6' }]}
        >
          <Text style={styles.buttonText}>Ajouter un point</Text>
        </Pressable>
      </View>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ajouter un commentaire</Text>
            <TextInput
              style={[styles.input,{marginBottom: 10}]}
              placeholder="Entrez le commentaire du point"
              value={pointComment}
              onChangeText={setPointComment}
            />
            <CustomButton
              title="Prendre une photo"
              onPress={pickImage}
            />
            {selectedImages.length > 0 ? (
              <FlatList
                horizontal
                data={selectedImages}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <View style={{ position: 'relative', marginRight: 10, marginVertical: 8 }}>
                    <Image source={{ uri: item }} style={styles.thumbnail} />
                    <TouchableOpacity onPress={() => removeImage(item)} style={styles.removeButton}>
                      <Text style={styles.removeButtonText}>X</Text>
                    </TouchableOpacity>
                  </View>
                )}
                style={{ marginVertical: 8 }}
              />
            ) : null}
            <CustomButton
              title="Enregistrer le point"
              onPress={async () => {
                if (location) {
                  const insertedId = await savePointToDB(location.longitude, location.latitude, pointComment);
                  if (insertedId) {
                    //getSavedPoints();
                    setIsModalVisible(false);
                    setPointComment("");
                    setSelectedImages([]);
                    //getSavedComments();
                    //getSavedPictures();
                  }
                } else {
                  Alert.alert('Erreur', 'Aucune position à enregistrer.');
                }
              }}
            />
            <CustomButton
              title="Annuler"
              onPress={() => {
                setIsModalVisible(false);
                setPointComment("");
                setSelectedImages([]);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

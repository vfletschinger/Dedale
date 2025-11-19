import { View, Text, Alert, Modal, TextInput, StyleSheet } from "react-native";
import React, { useEffect, useState, useRef } from "react";
import CustomButton from "../components/CustomButton";
import MapView from "react-native-maps";
import * as Location from 'expo-location';
import getDatabase from "../../assets/migrations";

export default function RegisterPointScreen() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const db: any = getDatabase();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [pointComment, setPointComment] = useState("");

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
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        }, 800);
      } catch (e) {
          // ignore animate errors
      }
    }
    return newCoords;
  };


const savePointToDB = (x: number, y: number, commentValue: string = '') => {
  if (!commentValue.trim()) {
    Alert.alert('Erreur', 'Veuillez entrer un commentaire pour le point.');
    return null;
  }

  try {
    const pointResult: any = db.runSync(
      'INSERT INTO interest_points (x, y) VALUES (?, ?)',
      [x, y]
    );

    const insertedPointId = pointResult.lastInsertRowId as number;
    if (!insertedPointId || insertedPointId === 0) {
      throw new Error("Impossible de récupérer l'ID du point qui vient d'être créé.");
    }

    db.runSync(
      'INSERT INTO comments (point_id, value) VALUES (?, ?)',
      [insertedPointId, commentValue]
    );

    console.log(`Point (ID: ${insertedPointId}) et son commentaire enregistrés.`);
    return insertedPointId;
  } catch (error: any) {
    console.error("Erreur lors de la sauvegarde du point/commentaire :", error);
    Alert.alert('Erreur', "Impossible d'enregistrer le point et son commentaire.");
    return null;
  }
};

const getSavedPoints = () => {
  try {
    const results = db.getAllSync('SELECT * FROM interest_points');
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
    const results = db.getAllSync('SELECT * FROM comments');
    console.log("Saved Comments:", results);
    return results;
  } catch (error) {
    console.error("Erreur lors de la récupération des commentaires :", error); 
    Alert.alert('Erreur', 'Impossible de récupérer les commentaires enregistrés.');
    return [];
  }
};


  return (
    <View className="flex-1">
      <Text className="text-center mt-4">Register Point Screen</Text>
      
      <CustomButton 
        title="Obtenir ma position" 
        onPress={requestLocation}
      />
      <CustomButton 
        title="Ajouter un commentaire et enregistrer le point" 
        onPress={() => setIsModalVisible(true)}
      />
      
      {coords ? (
        <MapView
          ref={ref => { mapRef.current = ref }}
          style={{ width: '100%', height: '80%' }}
          initialRegion={{
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.003,
            longitudeDelta: 0.003,
          }}
          showsUserLocation={true}
        />
      ) : (
        <View style={{ width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' }}>
          <Text>Position non disponible</Text>
        </View>
      )}
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
              style={styles.input}
              placeholder="Entrez le commentaire du point"
              value={pointComment}
              onChangeText={setPointComment}
            />
            <CustomButton
              title="Enregistrer le point"
              onPress={() => {
                if (location) {
                  savePointToDB(location.latitude, location.longitude, pointComment);
                  getSavedPoints();
                  setIsModalVisible(false);
                  setPointComment("");
                  getSavedComments();
                } else {
                  Alert.alert('Erreur', 'Aucune position à enregistrer.');
                }
              }}
            />
            <CustomButton
              title="Annuler"
              onPress={() => setIsModalVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
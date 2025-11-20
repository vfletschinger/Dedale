import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import WebSocketClient from './WebSocketClient';
const { width } = Dimensions.get('window');
const SCANNER_SIZE = width * 0.7; 
import { getDatabase } from '../../assets/migrations';
import { CommentType, InterestPointsType, ObstacleType, PictureType, PointDetailType } from '../types/database';

const QRCodeScanner = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const db = getDatabase();

  if (!permission || !permission.granted) {
      return (
        <View style={styles.fullContainer}>
          {!permission ? <Text>Chargement...</Text> : (
            <View>
              <Text>Nous avons besoin de la caméra.</Text>
              <Button onPress={requestPermission} title="Accorder" />
            </View>
          )}
        </View>
      );
  }
  const fetchData = async () => {
    const points = db.getAllSync<InterestPointsType>('SELECT id, x, y FROM point');
    const allPointDetails: PointDetailType[] = [];

    for (const point of points) {
      
      const comments = db.getAllSync<CommentType>(
          'SELECT id, point_id, value FROM comment WHERE point_id = ?', [point.id]
      );
      const pictures = db.getAllSync<PictureType>(
          'SELECT id, point_id, image FROM picture WHERE point_id = ?', [point.id]
      );
      const obstacles = db.getAllSync<ObstacleType>(
          `SELECT 
            o.id, 
            o.point_id, 
            o.type_id, 
            o.number,
            ot.name,
            ot.description,
            ot.width,
            ot.length
          FROM obstacle o
          LEFT JOIN obstacle_type ot ON o.type_id = ot.id
          WHERE o.point_id = ?`, 
          [point.id]
      );
      
      allPointDetails.push({ point: point, comments: comments, pictures: pictures, obstacles: obstacles });

    }
    return allPointDetails;
  }
  
 const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
    if (!scanned) {
      setScanned(true); 
      
      const websocketUri: string = data.startsWith('ws') ? data : `ws://${data}`; 
      const client = new WebSocketClient(websocketUri);
      
      client.connect()
        .then(async () => {
          const data = await  fetchData();
          client.send(data);
          alert(`Connexion à ${websocketUri} réussie. JSON envoyé!`);
        })
        .catch((error: string) => {
          alert(`Échec de la connexion à la WebSocket: ${error}`);
          setScanned(false);
        });

    }
  };

  return (
    <View style={styles.fullContainer}>
      
      <CameraView
        style={StyleSheet.absoluteFillObject} 
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        facing="back"
      />

      <View style={styles.overlay}>
        <View style={styles.topAndBottomBar} />
        <View style={styles.middleSection}>
            <View style={styles.sideBar} />
            <View style={styles.scanBox}>
            </View>
            <View style={styles.sideBar} />
        </View>
        <View style={styles.topAndBottomBar}>
            <Text style={styles.scanText}>
                {scanned ? 'Code scanné!' : 'Scannez le Code QR dans le carré.'}
            </Text>
            {scanned && (
                <Button 
                    title={'Scanner à nouveau'} 
                    onPress={() => setScanned(false)} 
                    color="#fff" 
                />
            )}
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', // Centre la section du milieu verticalement
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  middleSection: {
    flexDirection: 'row',
    height: SCANNER_SIZE, // La hauteur de la case
  },

  topAndBottomBar: {
    flex: 1, // Prend l'espace restant
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Opaque pour masquer la caméra
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sideBar: {
    flex: 1, // Prend l'espace restant
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },

 
  scanBox: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    backgroundColor: 'transparent', 
    borderWidth: 2,
    borderColor: 'white', 
  },

  scanText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
});

export default QRCodeScanner;
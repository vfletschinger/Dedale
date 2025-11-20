import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Dimensions, Modal, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import WebSocketClient from './WebSocketClient';
const { width } = Dimensions.get('window');
const SCANNER_SIZE = width * 0.7; 
import { getDatabase } from '../../assets/migrations';
import { CommentType, InterestPointsType, ObstacleType, PictureType, PointDetailType } from '../types/database';

const QRCodeScanner = ({ setScanQR }: { setScanQR: (value: boolean) => void }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState('Connexion en cours...');
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
          'SELECT id, point_id, type_id, number FROM obstacle WHERE point_id = ?', [point.id]
      );
      
      allPointDetails.push({ point: point, comments: comments, pictures: pictures, obstacles: obstacles });
    }
    return allPointDetails;
  }
  
  const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
    if (!scanned) {
      setScanned(true);
      setIsTransferring(true);
      setTransferStatus('Connexion en cours...');
      
      const websocketUri: string = data.startsWith('ws') ? data : `ws://${data}`; 
      const client = new WebSocketClient(websocketUri);
      
      client.connect()
        .then(async () => {
          setTransferStatus('Récupération des données...');
          const pointsData = await fetchData();
          
          setTransferStatus('Envoi des données...');
          await client.send(pointsData); 
          
          setTransferStatus('Transfert terminé !');
          
          setTimeout(() => {
            client.close();
            setIsTransferring(false);
            setScanned(false);
            setScanQR(false);
          }, 2000);
        })
        .catch((error: string) => {
          setTransferStatus(`Erreur: ${error}`);
          setTimeout(() => {
            client.close();
            setIsTransferring(false);
            setScanned(false);
            setScanQR(false);
          }, 3000);
        });
    }
  };

  return (
    <View style={styles.fullContainer}>
      {!isTransferring && (
        <CameraView
          style={StyleSheet.absoluteFillObject} 
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          facing="back"
        />
      )}

      {!isTransferring && (
        <View style={styles.overlay}>
          <View style={styles.topAndBottomBar} />
          <View style={styles.middleSection}>
              <View style={styles.sideBar} />
              <View style={styles.scanBox} />
              <View style={styles.sideBar} />
          </View>
          <View style={styles.topAndBottomBar}>
              <Text style={styles.scanText}>
                  {scanned ? 'Code scanné!' : 'Scannez le Code QR dans le carré.'}
              </Text>
          </View>
        </View>
      )}

      <Modal
        visible={isTransferring}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.modalTitle}>Transfert en cours</Text>
            <Text style={styles.modalStatus}>{transferStatus}</Text>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  middleSection: {
    flexDirection: 'row',
    height: SCANNER_SIZE,
  },

  topAndBottomBar: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sideBar: {
    flex: 1,
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

  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },

  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },

  modalStatus: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default QRCodeScanner;
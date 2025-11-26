import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Dimensions, Modal, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import WebSocketClient from './WebSocketClient';
const { width } = Dimensions.get('window');
const SCANNER_SIZE = width * 0.7; 
import { getDatabase } from '../../assets/migrations';
import { CommentType, InterestPointsType, ObstacleType, PictureType, PointDetailType } from '../types/database';

const QRCodeScanner = ({ setScanQR }: { setScanQR: (value: boolean) => void }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transferStatus, setTransferStatus] = useState('Connexion en cours...');
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null);
  const [showAlert, setShowAlert] = useState(false); // Flag pour éviter les doubles Alerts
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
      setTransferStatus('Connexion en cours...');
      
      console.log('🔍 QR Code scanné:', data);
      
      // Logique corrigée pour créer l'URI WebSocket
      let websocketUri: string;
      if (data.startsWith('ws://') || data.startsWith('wss://')) {
        // Déjà une URI WebSocket
        websocketUri = data;
      } else if (data.startsWith('http://')) {
        // Remplacer http:// par ws://
        websocketUri = data.replace('http://', 'ws://');
      } else if (data.startsWith('https://')) {
        // Remplacer https:// par wss://
        websocketUri = data.replace('https://', 'wss://');
      } else {
        // Ajouter ws:// si pas de protocole
        websocketUri = `ws://${data}`;
      }
      
      console.log('📡 URI WebSocket:', websocketUri);
      
      const client = new WebSocketClient(websocketUri);
      setWsClient(client);
      
      // Configurer les callbacks
      client.setCallbacks(
        () => {
          // Callback appelé quand l'insertion est terminée (message "fini" reçu)
          console.log('🎯 CALLBACK SUCCÈS APPELÉ - Pas d\'Alert ici !');
          console.log('✅ Insertion terminée avec succès !');
          setTransferStatus('Transfert terminé avec succès !');
          // AUCUNE Alert.alert() ici - seulement le modal
          
          // Fermer proprement la connexion immédiatement
          setTimeout(() => {
            try {
              client.close();
            } catch (e) {
              console.log('📝 Connexion déjà fermée');
            }
          }, 100);
          
          // Revenir à l'interface principale après délai
          setTimeout(() => {
            setScanned(false);
            setScanQR(false);
          }, 2000);
        },
        (error: string) => {
          // Callback appelé en cas d'erreur
          console.error('❌ Erreur:', error);
          setTransferStatus(`Erreur: ${error}`);
          Alert.alert('Erreur', `Erreur lors de l'enregistrement: ${error}`);
          
          setTimeout(() => {
            client.close();
            setScanned(false);
            setScanQR(false);
          }, 3000);
        },
        (loading: boolean) => {
          // Callback appelé quand l'état de chargement change
          console.log('⏳ État de chargement:', loading);
          setIsLoading(loading);
          if (loading) {
            setTransferStatus('Envoi des données...');
          }
        }
      );
      
      // Ajouter un timeout pour la connexion
      const connectionTimeout = setTimeout(() => {
        console.log('⏰ Timeout de connexion');
        setTransferStatus('Erreur: Timeout de connexion');
        client.close();
        setTimeout(() => {
          setScanned(false);
          setScanQR(false);
        }, 3000);
      }, 10000); // 10 secondes timeout
      
      client.connect()
        .then(async () => {
          clearTimeout(connectionTimeout);
          console.log('✅ Connexion WebSocket établie');
          setTransferStatus('Récupération des données...');
          
          const pointsData = await fetchData();
          console.log('📊 Données récupérées:', pointsData.length, 'points');
          
          if (pointsData.length === 0) {
            setTransferStatus('Aucune donnée à envoyer');
            Alert.alert('Information', 'Aucune donnée à transférer');
            setTimeout(() => {
              client.close();
              setScanned(false);
              setScanQR(false);
            }, 2000);
            return;
          }
          
          // Le chargement démarre automatiquement dans send()
          client.send(pointsData);
        })
        .catch((error: string) => {
          clearTimeout(connectionTimeout);
          console.error('❌ Erreur de connexion:', error);
          setTransferStatus(`Erreur de connexion: ${error}`);
          Alert.alert('Erreur de connexion', error);
          setTimeout(() => {
            client.close();
            setScanned(false);
            setScanQR(false);
          }, 3000);
        });
    }
  };

  const handleCancel = () => {
    console.log('🚫 Annulation du transfert');
    if (wsClient) {
      wsClient.close();
    }
    setScanned(false);
    setScanQR(false);
  };

  return (
    <View style={styles.fullContainer}>
      {!scanned && (
        <CameraView
          style={StyleSheet.absoluteFillObject} 
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          facing="back"
        />
      )}

      {!scanned && (
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
        visible={scanned}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {isLoading && <ActivityIndicator size="large" color="#4A90E2" />}
            {!isLoading && transferStatus.includes('succès') && (
              <Text style={styles.successIcon}>✅</Text>
            )}
            {!isLoading && transferStatus.includes('Erreur') && (
              <Text style={styles.errorIcon}>❌</Text>
            )}
            <Text style={styles.modalTitle}>
              {isLoading ? 'Transfert en cours' : 
               transferStatus.includes('succès') ? 'Succès' : 
               transferStatus.includes('Erreur') ? 'Erreur' : 'Transfert'}
            </Text>
            <Text style={styles.modalStatus}>{transferStatus}</Text>
            
            {/* Bouton d'annulation visible pendant la connexion et le chargement */}
            {(transferStatus.includes('Connexion') || isLoading) && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            )}
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
    zIndex: 9999, // S'assurer que le modal passe au-dessus de tout
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
    elevation: 10, // Augmenté pour Android
    zIndex: 10000,
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

  successIcon: {
    fontSize: 48,
    textAlign: 'center',
  },

  errorIcon: {
    fontSize: 48,
    textAlign: 'center',
  },

  cancelButton: {
    marginTop: 20,
    backgroundColor: '#FF6B6B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },

  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default QRCodeScanner;
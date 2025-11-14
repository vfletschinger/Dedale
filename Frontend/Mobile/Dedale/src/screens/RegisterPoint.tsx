import React, { useState, useEffect } from 'react';
import { Platform, Text, View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import * as Location from 'expo-location';

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg("nope");
        setLoading(false);
        return;
      }

      try {
        let currentLocation = await Location.getCurrentPositionAsync({
           accuracy: Location.Accuracy.Balanced,
        });
        setLocation(currentLocation);
      } catch (error) {
         setErrorMsg('Erreur lors de la récupération de la position');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  let textToDisplay = 'En attente...';

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text>{textToDisplay}</Text>
      </View>
    );
  }

  if (errorMsg) {
    textToDisplay = errorMsg;
  } else if (location) {
    textToDisplay = `Latitude: ${location.coords.latitude}, Longitude: ${location.coords.longitude}`;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.paragraph}>{textToDisplay}</Text>
      {/* map */}

      <Pressable onPress={() => { console.log(`Point saved! Latitude: ${location?.coords.latitude}, Longitude: ${location?.coords.longitude}`); }} style={{ padding: 10, backgroundColor: '#3498db', borderRadius: 5 }}>
        <Text>Save Point</Text>
      </Pressable> 
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ecf0f1',
  },
  paragraph: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
});

//TODO: 
// wait for map integration
// style the button better
// save the lat and long in the sql base

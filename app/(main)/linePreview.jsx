import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator,Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import {doc,getDoc,updateDoc,collection,addDoc,arrayRemove,arrayUnion,serverTimestamp} from "firebase/firestore";
import { DB } from "../../firebaseConfig";
import { notifyLineBooked } from "../../services/notificationService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import school from '../../assets/images/school.png'
import house from '../../assets/images/house.png'
import miniBus from '../../assets/images/minibus.png'

export default function LinePreview() {
  const params = useLocalSearchParams();
  const line = params?.data ? JSON.parse(params.data) : null;

  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [iconReady, setIconReady] = useState(false);
  const [bookLineLoading,setBookLineLoading] = useState(false)

  const mapRef = useRef(null);

  // Fetch driver home location to display on map
  useEffect(() => {
    const fetchDriver = async () => {
      try {
        const driverId = await AsyncStorage.getItem("safeTransDriver");
        if (!driverId) return;

        const driverSnap = await getDoc(doc(DB, "drivers", driverId));
        if (driverSnap.exists()) {
          const d = driverSnap.data();
          const loc = d.home_location || d.current_location;
          setDriverLocation(loc);

          // Fit markers on map after short delay
          setTimeout(() => {
            if (mapRef.current && loc && line) {
              const coords = [
                loc,
                ...line.suggested_riders.map((r) => r.home_location),
                line.destination_location,
              ];

              mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 80, right: 80, bottom: 120, left: 80 },
                animated: true,
              });
            }
          }, 400);
        }
      } catch (err) {
        console.log("Error fetching driver location:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDriver();
  }, []);

  //Calculate line centre point helper
  const getCenterPoint = (locations) => {
    if (!locations.length) return null;

    const sumLat = locations.reduce((sum, loc) => sum + loc.latitude, 0);
    const sumLng = locations.reduce((sum, loc) => sum + loc.longitude, 0);

    return {
      latitude: sumLat / locations.length,
      longitude: sumLng / locations.length,
    };
  }

  //Book line function
  const handleBookLine = async () => {
    try {
      setBookLineLoading(true)

      const driverId = await AsyncStorage.getItem("safeTransDriver");
      if (!driverId) {
        Alert.alert("خطأ", "تعذر تحديد هوية السائق");
        setBookLineLoading(false);
        return;
      }

      // Fetch driver
      const driverSnap = await getDoc(doc(DB, "drivers", driverId));
      if (!driverSnap.exists()) {
        Alert.alert("خطأ", "بيانات السائق غير موجودة");
        setBookLineLoading(false);
        return;
      }

      const driver = driverSnap.data();
      const riderList = line.suggested_riders;

      if (!riderList || riderList.length === 0) {
        Alert.alert("خطأ", "لا يمكن حجز خط بدون طلاب");
        setBookLineLoading(false);
        return;
      }

      // Calculate line center
      const centerPoint = getCenterPoint(riderList.map((r) => r.home_location));

      // Build new line object
      const newLineData = {
        destination: line.destination,
        destination_location: line.destination_location,
        driver_home_location: driver.home_location || driver.current_location,
        driver_id: driverId,
        driver_phone_number: driver.phone_number || "",
        line_type: driver.car_type || "",
        seats_capacity: Number(driver.car_seats) || 4,
        riders: riderList.map((r) => ({
          id: r.id,
          name: r.name,
          home_location: r.home_location,
          phone_number: r.phone_number || null
        })),
        center_point_location: centerPoint,
        created_at: serverTimestamp(),
      };

      // Create the new line in DB
      const lineRef = await addDoc(collection(DB, "lines"), newLineData);
      const lineId = lineRef.id;

      // Update riders (assign to driver + line)
      const riderUpdates = riderList.map((r) =>
        updateDoc(doc(DB, "riders", r.id), {
          line_id: lineId,
          driver_id: driverId,
        })
      );
      await Promise.all(riderUpdates);

      // Remove riders from pool
      await updateDoc(doc(DB, "pools", line.pool_id), {
        riders: arrayRemove(...riderList.map((r) => ({
          id: r.id,
          name: r.name,
          home_location: r.home_location,
          phone_number: r.phone_number || null
        })))
      });

      // Update driver doc
      await updateDoc(doc(DB, "drivers", driverId), {
        lines: arrayUnion({
          id: lineId,
          destination: line.destination,
          destination_location: line.destination_location,
          riders: riderList.map((r) => ({
            id: r.id,
            name: r.name,
            home_location: r.home_location,
            phone_number: r.phone_number || null
          }))
        })
      });

      const ridersPhonesArray = riderList
        .map(r => r.phone_number)
        .filter(Boolean);

      await notifyLineBooked(ridersPhonesArray, lineId, line.destination);


      // Smooth transition delay
      setTimeout(() => {
        setBookLineLoading(false);
        Alert.alert("تم بنجاح", "تم حجز الخط وإضافته لحسابك بنجاح!");
        router.replace("/(main)/home");
      }, 350);

    } catch (error) {
      console.log("❌ Error booking line:", error);
      setBookLineLoading(false);
      Alert.alert("خطأ", "حدث خطأ أثناء حجز الخط");
    }
  }

  if (loading || !line) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={26} color="#007AFF" />
      </TouchableOpacity>

      <MapView
        ref={mapRef}
        provider="google"
        style={styles.map}
        showsUserLocation={false}
      >
        {/* Driver Location Marker */}
        {driverLocation && (
          <Marker coordinate={driverLocation} tracksViewChanges={!iconReady}>
            <View style={styles.markerContainer}>
              <Image
                source={miniBus}
                style={{ width: 40, height: 40 }}
                onLoad={() => setIconReady(true)}
              />
            </View>
          </Marker>
        )}

        {/* Riders Markers */}
        {line.suggested_riders.map((r, index) => (
          <Marker
            key={r.id || index}
            coordinate={r.home_location}
            tracksViewChanges={!iconReady}
          >
            <View style={styles.markerContainer}>
              <Image
                source={house}
                style={{ width: 40, height: 40 }}
                onLoad={() => setIconReady(true)}
              />
            </View>
          </Marker>
        ))}

        {/* Destination (School) */}
        {line.destination_location && (
          <Marker coordinate={line.destination_location} tracksViewChanges={!iconReady}>
            <View style={styles.markerContainer}>
              <Image
                source={school}
                style={{ width: 40, height: 40 }}
                onLoad={() => setIconReady(true)}
              />
              <Text style={styles.markerText}>{line.destination}</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {bookLineLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#000" />
          <Text style={styles.loadingText}>العملية جارية...</Text>
        </View>
      )}

      {/* Book Line Button (Bottom Fixed) */}
      <View style={styles.bottomBox}>
        <TouchableOpacity style={styles.bookBtn} onPress={handleBookLine}>
          <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
          <Text style={styles.bookBtnText}>إحجز هذا الخط</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fff" 
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff" 
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 30,
    backgroundColor: "#fff",
    padding: 5,
    borderRadius: 50,
    elevation: 3,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: "center",
  },
  markerText: {
    marginTop: 2,
    paddingHorizontal: 4,
    fontSize: 11,
    fontFamily: "NotoArabicBold",
    backgroundColor: "#ffffffcc",
    color:'#000',
    borderRadius: 6,
  },
  bottomBox: {
    position: "absolute",
    bottom: 60,
    left: 20,
    right: 20,
  },
  bookBtn: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  bookBtnText: {
    color: "#fff",
    fontSize: 18,
    marginLeft: 8,
    fontFamily: "NotoArabicBold",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  loadingText: {
    marginTop: 10,
    fontFamily: "NotoArabicRegular",
    fontSize: 16,
    color: "#000",
  },
});

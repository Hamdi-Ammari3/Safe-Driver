import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion } from "firebase/firestore";
import { DB } from "../../firebaseConfig";
import {notifyRequestAccepted} from '../../services/notificationService';
import school from "../../assets/images/school.png";
import house from "../../assets/images/house.png";
import miniBus from "../../assets/images/minibus.png";
import {FontAwesome,Entypo } from '@expo/vector-icons';

export default function RequestDetails() {
  const params = useLocalSearchParams();

  const rider = params?.data ? JSON.parse(params.data) : null;
  const selectedLine = params?.line ? JSON.parse(params.line) : null;

  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [iconReady, setIconReady] = useState(false);

  const mapRef = useRef(null);

  // Fetch Driver Location
  useEffect(() => {
    (async () => {
      try {
        const driverId = await AsyncStorage.getItem("safeTransDriver");
        if (!driverId) return;

        const snap = await getDoc(doc(DB, "drivers", driverId));
        if (snap.exists()) {
          const d = snap.data();
          let loc = null;
          if (d.home_location) {
            loc = d.home_location;
          } else if (d.location?.new) {
            loc = {
              latitude: d.location.new[0],
              longitude: d.location.new[1],
            };
          }

          setDriverLocation(loc);

          // Fit all 3 markers
          setTimeout(() => {
            if (mapRef.current && loc && rider && selectedLine) {
              const coords = [
                loc,
                rider.home_location,
                selectedLine.destination_location
              ];

              mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 80, right: 80, bottom: 120, left: 80 },
                animated: true,
              });
            }
          }, 400);
        }
      } catch (e) {
        console.log("Error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  //Re-calculate line centre point after accepting new rider
  const computeCenterPoint = (ridersArray) => {
    if (!ridersArray || ridersArray.length === 0) return null;

    let sumLat = 0;
    let sumLng = 0;

    ridersArray.forEach((r) => {
      sumLat += r.home_location.latitude;
      sumLng += r.home_location.longitude;
    });

    return {
      latitude: sumLat / ridersArray.length,
      longitude: sumLng / ridersArray.length,
    };
  }

  // Accept request
  const handleAccept = async () => {
    try {
      setProcessing(true);

      const driverId = await AsyncStorage.getItem("safeTransDriver");
      if (!driverId) return;

      const lineRef = doc(DB, "lines", selectedLine.id);
      const riderRef = doc(DB, "riders", rider.id);
      const driverRef = doc(DB, "drivers", driverId);

      // 0 — Re-fetch rider to check if he is still available
      const freshRiderSnap = await getDoc(riderRef);
      if (!freshRiderSnap.exists()) {
        Alert.alert("خطأ", "هذا الطالب غير موجود.");
        return;
      }

      const freshRider = freshRiderSnap.data();

      // ❌ Rider already booked by another driver
      if (freshRider.driver_id) {
        const driverSnap = await getDoc(driverRef);
        const driverData = driverSnap.data();

        const updatedLines = (driverData.lines || []).map((ln) => {
          if (ln.id !== selectedLine.id) return ln;

          return {
            ...ln,
            join_requests: (ln.join_requests || []).filter((req) => req.id !== rider.id)
          };
        });

        await updateDoc(driverRef, { lines: updatedLines });

        Alert.alert(
          "غير متاح",
          "تم قبول هذا الطالب من قبل سائق آخر.",
          [{ text: "حسناً", onPress: () => router.replace("/(main)/home") }]
        );
        return;
      }

      // Rider is free → proceed with accept flow

      // 1 — Add rider to line.riders
      await updateDoc(lineRef, {
        riders: arrayUnion({
          id: rider.id,
          name: rider.name,
          phone_number: rider.phone_number,
          home_location: rider.home_location,
        }),
      });

      // 2 — Update rider doc (assign to this driver)
      await updateDoc(riderRef, {
        line_id: selectedLine.id,
        driver_id: driverId,
        request_to_lines: arrayRemove({ id: selectedLine.id }),
      });

      // 3 — Remove from pool
      if (freshRider.pool_id) {
        const poolRef = doc(DB, "pools", freshRider.pool_id);
        const poolSnap = await getDoc(poolRef);

        if (poolSnap.exists()) {
          const poolData = poolSnap.data();

          const updatedPoolRiders = (poolData.riders || []).filter(
            (r) => r.id !== rider.id
          );

          await updateDoc(poolRef, { riders: updatedPoolRiders });
        }
      }

      // 4 — Recalculate center point
      const updatedLineSnap = await getDoc(lineRef);
      const updatedLine = updatedLineSnap.data();
      const updatedRiders = updatedLine.riders || [];

      const newCenter = computeCenterPoint(updatedRiders);
      if (newCenter) {
        await updateDoc(lineRef, { center_point_location: newCenter });
      }

      // 5 — Update driver doc → update join_requests & riders
      const driverSnapFinal = await getDoc(driverRef);
      const driverDataFinal = driverSnapFinal.data();

      const updatedLinesFinal = (driverDataFinal.lines || []).map((ln) => {
        if (ln.id !== selectedLine.id) return ln;

        return {
          ...ln,
          join_requests: (ln.join_requests || []).filter((req) => req.id !== rider.id),
          riders: [
            ...(ln.riders || []),
            {
              id: rider.id,
              name: rider.name,
              phone_number: rider.phone_number,
              home_location: rider.home_location,
            },
          ],
        };
      });

      await updateDoc(driverRef, { lines: updatedLinesFinal });

      // Notify parent
      await notifyRequestAccepted(rider.phone_number, selectedLine.id);

      Alert.alert(
        "تم القبول",
        "تم إضافة الطالب إلى خطك بنجاح",
        [{ text: "الذهاب للصفحة الرئيسية", onPress: () => router.replace("/(main)/home") }]
      );

    } catch (err) {
      console.log("❌ Accept Error:", err);
      Alert.alert("خطأ", "حدث خطأ أثناء قبول الطلب");
    } finally {
      setProcessing(false);
    }
  }

  // Reject request
  const handleReject = async () => {
    try {
      setProcessing(true);

      const driverId = await AsyncStorage.getItem("safeTransDriver");
      if (!driverId) return;

      const riderRef = doc(DB, "riders", rider.id);
      const driverRef = doc(DB, "drivers", driverId);

      // 1 — Remove line from rider.request_to_lines
      await updateDoc(riderRef, {
        request_to_lines: arrayRemove({ id: selectedLine.id }),
      });

      // 2 — Update driver doc (remove from join_requests)
      const driverSnap = await getDoc(driverRef);
      const driverData = driverSnap.data();

      const updatedLines = (driverData.lines || []).map((ln) => {
        if (ln.id !== selectedLine.id) return ln;

        return {
          ...ln,
          join_requests: (ln.join_requests || []).filter(
            (req) => req.id !== rider.id
          )
        };
      });

      await updateDoc(driverRef, { lines: updatedLines });

      Alert.alert(
        "تم الرفض",
        "تم رفض الطلب بنجاح",
        [{ text: "رجوع", onPress: () => router.replace("/(main)/home") }]
      );

    } catch (err) {
      console.log("❌ Reject Error:", err);
      Alert.alert("خطأ", "حدث خطأ أثناء رفض الطلب");
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !rider || !selectedLine) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={26} color="#007AFF" />
      </TouchableOpacity>

      {/* MAP */}
      <MapView
        ref={mapRef}
        provider="google"
        style={styles.map}
        showsUserLocation={false}
      >
        {/* Driver Marker */}
        {driverLocation && (
          <Marker 
            coordinate={driverLocation} 
            tracksViewChanges={!iconReady}
          >
            <View style={{ alignItems: "center" }}>
              <Image 
                source={miniBus} 
                style={{ width: 40, height: 40 }} 
                onLoad={() => setIconReady(true)}  
              />
            </View>
          </Marker>        
        )}

        {/* Rider Marker */}
        {rider.home_location && (
          <Marker 
            coordinate={rider.home_location} 
            tracksViewChanges={!iconReady}
          >
            <View style={{ alignItems: "center" }}>
              <Image 
                source={house} 
                style={{ width: 40, height: 40 }} 
                onLoad={() => setIconReady(true)}
              />
              <Text style={styles.markerText}>{rider.name}</Text>
            </View>
          </Marker>
        )}

        {/* Destination Marker */}
        {selectedLine.destination_location && (
          <Marker 
            coordinate={selectedLine.destination_location} 
            tracksViewChanges={!iconReady}                  
          >
            <View style={{ alignItems: "center" }}>
              <Image 
                source={school} 
                style={{ width: 40, height: 40 }} 
                onLoad={() => setIconReady(true)} 
              />
              <Text style={styles.markerText}>{selectedLine.destination}</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Processing overlay */}
      {processing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#000" />
          <Text style={styles.loadingText}>جاري تنفيذ العملية...</Text>
        </View>
      )}

      {/* Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.action_button,{backgroundColor:'#FF3B30'}]}
          onPress={handleReject}
        >
          <Text style={styles.action_button_text}>رفض</Text>
          <Entypo name="circle-with-cross" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.action_button,{backgroundColor:'#28A745'}]}
          onPress={handleAccept}
        >
          <Text style={styles.action_button_text}>قبول</Text>
          <FontAwesome name="check-circle-o" size={24} color="white" />
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
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 999,
    backgroundColor: "#fff",
    padding: 6,
    borderRadius: 50,
    elevation: 4,
  },
  map: { 
    flex: 1 
  },
  markerText: {
    paddingHorizontal: 4,
    fontSize: 11,
    marginTop: 2,
    fontFamily: "NotoArabicBold",
    backgroundColor: "#ffffffcc",
    color: "#000",
    borderRadius: 6,
  },
  actions: {
    position: "absolute",
    bottom: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    gap:10
  },
  action_button:{
    paddingVertical: 5,
    flex: 1,
    flexDirection:'row-reverse',
    justifyContent:'center',
    alignItems:'center',
    gap:10,
    borderRadius: 12,
  },
  action_button_text: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "NotoArabicBold",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: "NotoArabicRegular",
  },
});

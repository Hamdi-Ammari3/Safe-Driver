import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet,Alert,ActivityIndicator } from "react-native";
import { collection,getDoc,getDocs,doc } from "firebase/firestore"
import { DB } from "../../../firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Animated, {useSharedValue,withTiming,withRepeat,withSequence,useAnimatedStyle} from "react-native-reanimated";

const AddLine = () => {
  const [loading, setLoading] = useState(false);

  // Simple pulse animation for the small icon
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.2, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  //distance calculation
  const getDistance = (loc1, loc2) => {
    if (!loc1 || !loc2) return Number.MAX_VALUE;

    const R = 6371; // Earth radius in km

    const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

    const lat1 = (loc1.latitude * Math.PI) / 180;
    const lat2 = (loc2.latitude * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  //Search suggested lines from pools
  const handleStartSearch = async () => {
    try {
      setLoading(true);

      const driverId = await AsyncStorage.getItem("safeTransDriver");
      if (!driverId) {
        Alert.alert("خطأ", "تعذر تحديد هوية السائق");
        setLoading(false);
        return;
      }

      // Fetch driver doc
      const driverSnap = await getDoc(doc(DB, "drivers", driverId));
      if (!driverSnap.exists()) {
        Alert.alert("خطأ", "بيانات السائق غير موجودة");
        setLoading(false);
        return;
      }

      const driverData = driverSnap.data();

      const driverLocation = driverData.home_location || driverData.current_location;
      if (!driverLocation) {
        Alert.alert("خطأ", "لم يتم العثور على موقع السائق");
        setLoading(false);
        return;
      }

      // Fetch pools
      const poolsSnap = await getDocs(collection(DB, "pools"));
      let pools = poolsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const capacity = Number(driverData.car_seats) || 4;

      const validPools = pools.filter(
        (pool) => Array.isArray(pool.riders) && pool.riders.length > 0
      );

      if (validPools.length === 0) {
        Alert.alert("لا يوجد خطوط", "لا يوجد أي طلاب متاحين حالياً.");
        setLoading(false);
        return;
      }

      // Build suggested lines
      const suggested = validPools
        .map((pool) => {
          const sorted = pool.riders
          .map((r) => ({
            ...r,
            distance: getDistance(driverLocation, r.home_location)
          }))
          .sort((a, b) => a.distance - b.distance);

        return {
          pool_id: pool.id,
          destination: pool.destination,
          destination_location: pool.destination_location,
          suggested_riders: sorted.slice(0, capacity),
        };
      })
      .filter((line) => line.suggested_riders.length > 0);

      if (suggested.length === 0) {
        Alert.alert("لا يوجد خطوط", "لا يوجد أي طلاب متاحين حالياً.");
        setLoading(false);
        return;
      }

      // Small delay for smooth animation feeling
      setTimeout(() => {
        router.push({
          pathname: "/(main)/suggestedLines",
          params: {
            data: JSON.stringify(suggested),
          },
        });
        setLoading(false);
      }, 300);

    } catch (error) {
      console.log("❌ Error searching lines:", error);
      setLoading(false);
      Alert.alert("خطأ", "حدث خطأ أثناء البحث عن الخطوط");
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {/* Icon Section */}
        <View style={styles.iconBox}>
          <View style={styles.mainCircle}>
            <Ionicons name="search" size={50} color="#007AFF" />
          </View>

          <Animated.View style={[styles.smallPin, pulseStyle]}>
            <Ionicons name="location" size={18} color="#fff" />
          </Animated.View>
        </View>

        {/* Text Content */}
        <Text style={styles.title}>ابحث عن خطوط متاحة</Text>
        <Text style={styles.subtitle}>
          اضغط على زر البحث للعثور على خطوط مقترحة يمكنك إضافتها والبدء برحلتك
        </Text>

        {/* Features (2 icons) */}
        <View style={styles.featuresRow}>
          <View style={styles.featureBox}>
            <View style={styles.featureCircle}>
              <Ionicons name="people" size={28} color="#007AFF" />
            </View>
            <Text style={styles.featureText}>طلاب من نفس المدرسة</Text>
          </View>

          <View style={styles.featureBox}>
            <View style={styles.featureCircle}>
              <Ionicons name="map" size={28} color="#007AFF" />
            </View>
            <Text style={styles.featureText}>خطوط حسب موقعك</Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity style={styles.searchButton} onPress={handleStartSearch}>
          <Ionicons name="search" size={20} color="#fff" style={{ marginLeft: 6 }} />
          <Text style={styles.searchButtonText}>ابدأ البحث</Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.loadingText}>جاري البحث عن خطوط...</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
};

export default AddLine;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    //justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    marginTop:50,
    //borderRadius: 20,
    padding: 25,
    //elevation: 5,
    //shadowColor: "#000",
    //shadowOpacity: 0.1,
    //shadowRadius: 10,
    alignItems: "center",
  },
  iconBox: {
    marginBottom: 20,
  },
  mainCircle: {
    width: 100,
    height: 100,
    backgroundColor: "#007AFF20",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  smallPin: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: "#FF6B00",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontFamily: "NotoArabicBold",
    fontSize: 22,
    color: "#000",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "NotoArabicRegular",
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  featuresRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
    marginVertical: 15,
  },
  featureBox: {
    alignItems: "center",
  },
  featureCircle: {
    width: 55,
    height: 55,
    backgroundColor: "#E5E7EB",
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  featureText: {
    fontFamily: "NotoArabicRegular",
    fontSize: 12,
    color: "#6b7280",
  },
  searchButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    height: 55,
    borderRadius: 14,
    width: "100%",
    marginTop: 20,
  },
  searchButtonText: {
    color: "#fff",
    fontFamily: "NotoArabicBold",
    fontSize: 17,
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
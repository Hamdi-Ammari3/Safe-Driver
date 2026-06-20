import { useEffect, useState } from "react";
import {View,Text,StyleSheet,ScrollView,TouchableOpacity,ActivityIndicator} from "react-native";
import { doc, getDoc,collection,query,where,getDocs } from "firebase/firestore";
import { DB } from "../../../firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LineCard = ({ line }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() =>
        router.push({
          pathname: "/(main)/lineDetails/[lineID]",
          params: { lineID: line.id }
        })
      }
    >
      <View style={styles.iconBox}>
        <Ionicons name="location-sharp" size={22} color="#fff" />
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>
          {line.destination || "خط"}
        </Text>
        <Text style={styles.cardDesc}>
          {line.line_number}
        </Text>
      </View>

      {/* Riders Badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {line.riders?.length || 0}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default function DriverHome() {
  const insets = useSafeAreaInsets();

  const [driver, setDriver] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  //Fetch driver profile and lines
  const loadData = async () => {
    try {
      setLoading(true);

      const stored = await AsyncStorage.getItem("SAFE_DRIVER_USER");

      if (!stored) {
        router.replace("/(auth)/login");
        return;
      }

      // ✅ fetch driver
      const driverRef = doc(DB, "drivers", stored);
      const driverSnap = await getDoc(driverRef);

      if (!driverSnap.exists()) {
        router.replace("/(auth)/login");
        return;
      }

      const driverData = driverSnap.data();
      setDriver(driverData);

      const lineIds = driverData.lines || [];

      if (lineIds.length === 0) {
        setLines([]);
        return;
      }

      // ✅ fetch lines (NO realtime)
      const linesQuery = query(
        collection(DB, "lines"),
        where("__name__", "in", lineIds.slice(0, 10))
      );

      const snap = await getDocs(linesQuery);

      const fetchedLines = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setLines(fetchedLines);

    } catch (error) {
      console.log("Driver home error:", error);
    } finally {
      setLoading(false);
    }
  };

  //Limit name to three name
  const limitNameToThreeWords = (name = "") => {
    return name
      .trim()
      .split(" ")
      .filter(Boolean)     
      .slice(0, 3)      
      .join(" ");
  };

  const HEADER_HEIGHT = 120 + insets.top;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: HEADER_HEIGHT }
        ]}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {limitNameToThreeWords(driver?.name)} - {driver?.car_type}
          </Text>
          <Text style={styles.headerSubtitle}>
            اختر الخط لبدء الرحلة
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{
          paddingTop: HEADER_HEIGHT + 40,
          paddingBottom: 80
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionWrapper}>
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : lines.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                لا يوجد خطوط في حسابك حالياً
              </Text>
            </View>
          ) : (
            lines.map((line) => (
              <LineCard key={line.id} line={line} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    justifyContent: "center",
    backgroundColor:'#2563eb'
  },
  headerContent: {
    flex:1,
    alignItems: "center",
    justifyContent:'center',
  },
  headerTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "NotoArabicBold",
  },
  headerSubtitle: {
    color: "#e5e7eb",
    fontSize: 13,
    fontFamily: "NotoArabicRegular",
  },
  sectionWrapper: {
    paddingHorizontal: 20,
  },
  card: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:'#2563eb'
  },
  cardContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "NotoArabicBold",
    color: "#111",
    textAlign: "right",
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: "NotoArabicRegular",
    color: "#6b7280",
    textAlign: "right",
    marginTop: 2,
  },
  badge: {
    backgroundColor: "#f59e0b",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "NotoArabicBold",
  },
  emptyBox: {
    marginTop: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#6b7280",
    fontFamily: "NotoArabicRegular",
  },
});
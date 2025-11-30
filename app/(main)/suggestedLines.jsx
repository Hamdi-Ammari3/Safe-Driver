import { useLocalSearchParams, router } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons,Feather } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";

const SuggestedLines = () => {
  const params = useLocalSearchParams();

  // Parse suggested lines data sent from AddLine
  const suggested = params?.data ? JSON.parse(params.data) : [];

  const handlePreview = (line) => {
    router.push({
      pathname: "/(main)/linePreview",
      params: { data: JSON.stringify(line) },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.header_inner}>
          <Ionicons name="location-outline" size={32} color="#fff" />
          <Text style={styles.headerTitle}>الخطوط المقترحة</Text>
        </View>
        <Text style={styles.headerSubtitle}>اختر الخط المناسب وابدأ رحلتك</Text>
        <TouchableOpacity
          style={styles.back_button}
          onPress={() => router.replace('/(tabs)/addLine')}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Lines List */}
      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 40 }}>
        {suggested.length > 0 ? (
          suggested.map((line, index) => (
            <Animated.View
              key={line.pool_id}
              entering={FadeInUp.delay(index * 120).duration(300)}
              style={styles.card}
            >
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <Ionicons name="location-sharp" size={22} color="#007AFF" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.destination}>{line.destination}</Text>
                  <Text style={styles.subText}>عدد الطلاب: {line.suggested_riders.length}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handlePreview(line)}
                >
                  <Text style={styles.addBtnText}>عرض التفاصيل</Text>
                  <Feather name="arrow-left" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          ))
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="alert-circle" size={50} color="#999" />
            <Text style={styles.emptyText}>لا توجد خطوط مقترحة حالياً</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F6F8FA" 
  },
  header: {
    backgroundColor: "#007AFF",
    padding: 22,
    paddingTop: 40,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    alignItems: "center",
    position: "relative",
  },
  header_inner:{
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center',
    gap:10
  },
  back_button:{
    position: "absolute",
    top: 20,
    left: 20,
  },
  headerTitle: {
    fontSize: 24,
    color: "#fff",
    fontFamily: "NotoArabicBold",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontFamily: "NotoArabicRegular",
  },
  list: { 
    paddingHorizontal: 16, 
    paddingTop: 20 
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  destination: {
    fontSize: 18,
    fontFamily: "NotoArabicBold",
    color: "#000",
  },
  subText: {
    fontSize: 13,
    color: "#000",
    fontFamily: "NotoArabicRegular",
  },
  actions: {
    justifyContent: "center",
    alignItems:'center',
    marginTop: 10,
  },
  actionBtn: {
    width:150,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap:5,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#007AFF",
  },
  addBtnText: {
    color: "#fff",
    fontFamily: "NotoArabicBold",
  },
  emptyBox: {
    marginTop: 60,
    alignItems: "center",
  },
  emptyText: {
    color: "#777",
    fontSize: 16,
    marginTop: 10,
    fontFamily: "NotoArabicRegular",
  },
});

export default SuggestedLines

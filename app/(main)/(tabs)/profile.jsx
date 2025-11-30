import { useEffect, useState } from "react";
import {View,Text,StyleSheet,TouchableOpacity,Image,Linking,Alert,Platform} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, deleteDoc, getDoc } from "firebase/firestore";
import { DB } from "../../../firebaseConfig";

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  // 🔹 Load user data from Firestore using phone (saved in AsyncStorage)
  useEffect(() => {
    const loadUser = async () => {
      try {
        const phone = await AsyncStorage.getItem("safeTransDriver");
        if (!phone) return;

        const userSnap = await getDoc(doc(DB, "users", phone));
        if (userSnap.exists()) setUser(userSnap.data());
      } catch (err) {
        console.log("Error loading user:", err);
      }
    };
    loadUser();
  }, []);

  // 🔹 Logout logic
  const handleLogout = async () => {
    Alert.alert("تأكيد", "هل ترغب بتسجيل الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تأكيد",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("safeTransDriver");
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  // 🔹 Delete account logic
  const handleDeleteAccount = async () => {
    Alert.alert(
      "تأكيد الحذف",
      "سيتم حذف حسابك وجميع بياناتك نهائياً. لا يمكن التراجع عن هذا الإجراء.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            try {
              const phone = await AsyncStorage.getItem("safeTransDriver");
              if (phone) {
                await deleteDoc(doc(DB, "users", phone));
                await AsyncStorage.removeItem("safeTransDriver");
                Alert.alert("تم الحذف", "تم حذف الحساب بنجاح");
                router.replace("/(auth)/login");
              }
            } catch (err) {
              console.log("Error deleting account:", err);
              Alert.alert("خطأ", "حدث خطأ أثناء حذف الحساب");
            }
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      label: "سياسة الخصوصية",
      icon: "shield-outline",
      onPress: () => Linking.openURL("https://sayartech.com/privacy-policy"),
    },
    {
      label: "شروط الاستخدام",
      icon: "document-text-outline",
      onPress: () => Linking.openURL("https://sayartech.com/terms-of-use"),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.card}>
        <View style={styles.userBox}>
          <View style={styles.avatarBox}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <Ionicons name="person-circle-outline" size={80} color="#ccc" />
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.username || "مستخدم"}</Text>
            <Text style={styles.userPhone}>{user?.phone || "7XX XXX XXXX"}</Text>
          </View>
        </View>
      </View>

      {/* Menu items */}
      <View style={styles.card}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            onPress={item.onPress}
            style={[
              styles.menuItem,
              index !== menuItems.length - 1 && styles.menuDivider,
            ]}
          >
            <Ionicons name="chevron-back" size={20} color="#999" />
            <View style={styles.menuLabelBox}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name={item.icon} size={20} color="#666" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.actionButton, styles.logoutButton]}
        onPress={handleLogout}
      >
        <Ionicons name="chevron-back" size={20} color="#000" />
        <View style={styles.actionLabelBox}>
          <Text style={styles.actionLabel}>تسجيل الخروج</Text>
          <Ionicons name="log-out-outline" size={20} color="#000" />
        </View>
      </TouchableOpacity>

      {/* Delete account */}
      <TouchableOpacity
        style={[styles.actionButton, styles.deleteButton]}
        //onPress={handleDeleteAccount}
      >
        <Ionicons name="chevron-back" size={20} color="#fff" />
        <View style={styles.actionLabelBox}>
          <Text style={[styles.actionLabel, { color: "#fff" }]}>حذف الحساب</Text>
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  userBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 16,
  },
  avatarBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  userInfo: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent:'center',
  },
  userName: {
    fontSize: 22,
    fontFamily: "NotoArabicBold",
    color: "#000",
  },
  userPhone: {
    fontSize: 15,
    color: "#666",
    fontFamily: "NotoArabicRegular",
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  menuDivider: {
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  menuLabelBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuLabel: {
    fontSize: 16,
    color: "#000",
    fontFamily: "NotoArabicRegular",
  },
  actionButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  logoutButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  deleteButton: {
    backgroundColor: "#DC2525",
  },
  actionLabelBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionLabel: {
    fontSize: 16,
    fontFamily: "NotoArabicRegular",
    color: "#000",
  },
});

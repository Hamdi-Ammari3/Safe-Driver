import { useState } from "react";
import {View,Text,TextInput,TouchableOpacity,StyleSheet,ScrollView,Platform,StatusBar,Alert} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { doc,getDoc } from "firebase/firestore";
import { DB } from '../../firebaseConfig';
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage"
import { sendOTP } from "../../services/twilioService"
import { Feather } from "@expo/vector-icons";

// ✅ Iraq phone validation and normalization
const normalizeIraqPhone = (input) => {
  let phone = input.replace(/\D/g, "");

  if (phone.startsWith("07")) phone = phone.slice(1);
  if (!phone.startsWith("7")) throw new Error("رقم الهاتف يجب أن يبدأ بـ 07 أو 7");

  return `+964${phone}`;
};

const Login = () => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!phone) {
      Alert.alert("خطأ", "الرجاء إدخال رقم الهاتف");
      return;
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizeIraqPhone(phone.trim());
    } catch (err) {
      Alert.alert("رقم غير صحيح", err.message);
      return;
    }

    try {
      setLoading(true);

      const userRef = doc(DB, "users", normalizedPhone);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        Alert.alert(
          "الحساب غير موجود",
          "لا يوجد حساب مرتبط بهذا الرقم.قم بإنشاء حساب جديد",
        )
        return;
      }

      // 🔥 APPLE REVIEW BYPASS
      if (normalizedPhone === "+9647000000001") {
        await AsyncStorage.setItem("safeTransDriver", normalizedPhone);
        router.replace("/(main)/(tabs)/home");
        return;
      }
      
      let response = await sendOTP(normalizedPhone, "whatsapp");

      // fallback to SMS if WhatsApp fails
      if (!response.success && response.error?.includes("whatsapp")) {
        response = await sendOTP(normalizedPhone, "sms");
      }

      if (response.success) {
        router.push({
          pathname: "/verify-otp",
          params: { 
            phone: normalizedPhone, 
            isSignup: false           
          },
        });
      } else {
        Alert.alert("فشل الإرسال", response.error || "حدث خطأ أثناء الإرسال");
      }

    } catch (error) {
      console.log("Send OTP error:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء إرسال رمز التحقق");
    } finally{
      setLoading(false);
    }
  }

  //Test Login with +216 code number
  /*
  const handleSubmit = async () => { 
    if (!phone) { 
      Alert.alert("خطأ", "الرجاء إدخال رقم الهاتف"); 
      return; 
    } 

    const completePhone = `+216${phone}`

    try {
      setLoading(true);
      
      let response = await sendOTP(completePhone, "whatsapp");

      console.log("response",response)

      // fallback to SMS if WhatsApp fails
      if (!response.success && response?.error?.includes("whatsapp")) {
        response = await sendOTP(completePhone, "sms");
      }

      if (response.success) {
        router.push({
          pathname: "/verify-otp",
          params: { phone:completePhone, isSignup: false },
        });
      } else {
        Alert.alert("فشل الإرسال", response.error || "حدث خطأ أثناء الإرسال");
      }
    } catch (error) {
      console.log("Send OTP error:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء إرسال رمز التحقق");
    } finally {
      setLoading(false);
    }
  };
  */

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.replace('/welcome')}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>تسجيل الدخول</Text>
          <Text style={styles.subtitle}>أدخل رقم هاتفك لتسجيل الدخول</Text>

          {/* Phone Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>رقم الهاتف</Text>
            <View style={styles.inputWrapper}>
              <Feather name="phone" size={20} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { textAlign: "right", direction: "ltr" }]}
                placeholder="7XX XXX XXXX"
                placeholderTextColor="#aaa"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
            <Text style={styles.helperText}>سنرسل رمز التحقق إلى هذا الرقم</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "جاري الإرسال..." : "التالي"}
            </Text>
          </TouchableOpacity>

          {/* Create account link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>
              ليس لديك حساب؟{" "}
              <Text
                style={styles.signupLink}
                onPress={() => router.push("/signup")}
              >
                إنشاء حساب
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontFamily: "NotoArabicBold",
    color: "#111",
    marginBottom: 8,
    textAlign: "right",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "NotoArabicRegular",
    color: "#6b7280",
    marginBottom: 32,
    textAlign: "right",
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontFamily: "NotoArabicBold",
    fontSize: 15,
    color: "#111",
    marginBottom: 8,
    textAlign: "right",
  },
  inputWrapper: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: {
    marginLeft: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "NotoArabicRegular",
    color: "#111",
  },
  helperText: {
    fontSize: 13,
    fontFamily: "NotoArabicRegular",
    color: "#6b7280",
    marginTop: 4,
    textAlign: "right",
  },
  primaryButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  primaryButtonText: {
    fontFamily: "NotoArabicBold",
    color: "#fff",
    fontSize: 18,
  },
  signupContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  signupText: {
    fontFamily: "NotoArabicRegular",
    fontSize: 15,
    color: "#555",
  },
  signupLink: {
    fontFamily: "NotoArabicBold",
    color: "#007AFF",
  },
});

export default Login;

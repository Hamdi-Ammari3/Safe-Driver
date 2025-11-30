import { useState,useRef } from "react"
import {View,Text,TouchableOpacity,StyleSheet,TextInput,ScrollView,Alert} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams,useRootNavigationState } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Clipboard from "expo-clipboard"
import { verifyOTP,sendOTP  } from "../../services/twilioService"
import { DB } from "../../firebaseConfig"
import { setDoc, doc } from "firebase/firestore"
import { Feather } from "@expo/vector-icons"
import { checkDriverStatus } from "../../utils/authUtils";

const VerifyOtp = () => {
  const { phone,username,expoPushToken,isSignup } = useLocalSearchParams();
  const isSignupBool = isSignup ? JSON.parse(isSignup) : false;
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);
  const navigationState = useRootNavigationState();

  // Handle OTP input change with auto-focus
  const handleOtpChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;  // only digits

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when 6 digits are filled
    if (newOtp.join("").length === 6) {
      handleVerify(newOtp.join(""));
    }
  }

  // Handle backspace - move to previous input
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  //Handle paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const pastedOtp = text.replace(/\D/g, "").slice(0, 6);

      if (pastedOtp.length === 6) {
        const otpArray = pastedOtp.split("");
        setOtp(otpArray);

        // Fill inputs visually
        otpArray.forEach((digit, i) => {
          if (inputRefs.current[i]) {
            inputRefs.current[i].setNativeProps({ text: digit });
          }
        });

        inputRefs.current[5]?.blur();
        handleVerify(pastedOtp);
      }
    } catch (err) {
      console.log("Clipboard read error:", err);
    }
  }

  //Verify OTP
  const handleVerify = async (code = null) => {
    const otpCode = code || otp.join("");

    if (otpCode.length !== 6) {
      Alert.alert("خطأ", "الرجاء إدخال رمز التحقق كاملاً (6 أرقام)");
      return;
    }

    try {
      setLoading(true);
      const result = await verifyOTP(phone, otpCode);

      if (!result.success) {
        Alert.alert("خطأ", "رمز التحقق غير صحيح");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      // ✅ Save user data to Firestore
      if (isSignupBool) {
        const token = await AsyncStorage.getItem("expoPushToken");

        const userRef = doc(DB, "users", phone);
        await setDoc(userRef, {
          username,
          compte_owner_type:'driver',
          phone,
          driver_doc:null,
          notification_token: expoPushToken || token,
          privacy_policy:true,
          terms_of_use:true,
          createdAt: new Date(),
        });
      }

      // ✅ Store session locally
      await AsyncStorage.setItem("safeTransDriver", phone);

      // 🧩 Determine next route
      const status = await checkDriverStatus();

      let nextRoute = "/(auth)/welcome";
      if (status === "incomplete_profile") nextRoute = "/(setup)/completeDriverProfile";
      else if (status === "authenticated") nextRoute = "/(main)/(tabs)/home";

      if (navigationState?.key) {
        router.replace(nextRoute);
      } else {
        const interval = setInterval(() => {
          if (navigationState?.key) {
            clearInterval(interval);
            router.replace(nextRoute);
          }
        }, 100);
      }

    } catch (err) {
      console.error("OTP verification error:", err);
      Alert.alert("خطأ", "حدث خطأ أثناء التحقق من الرمز");
    } finally {
      setLoading(false);
    }
  };

  //Resend code
  const handleResend = async () => {
    try {
      const response = await sendOTP(phone, "whatsapp");
      if (!response.success) response = await sendOTP(phone, "sms");

      if (response.success) {
        Alert.alert("تم الإرسال ✅", "تم إعادة إرسال رمز التحقق");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert("خطأ", "فشل في إعادة إرسال الرمز. يرجى المحاولة مرة أخرى");
      }
    } catch {
      Alert.alert("خطأ", "فشل في إعادة إرسال الرمز");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backBtn}
            disabled={loading}
          >
            <Feather name="arrow-left" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Feather name="lock" size={36} color="#007AFF" />
          </View>

          <Text style={styles.title}>التحقق من الهاتف</Text>
          <Text style={styles.subtitle}>
            أدخل رمز التحقق المرسل إلى{"\n"}
            <Text style={styles.phoneText}>{phone}</Text>
          </Text>

          <View style={styles.otpContainer}>
            {otp?.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={styles.otpBox}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                editable={!loading}
                autoFocus={index === 0}
                selectTextOnFocus
              />
            ))}
          </View>

          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={() => handleVerify()}
            disabled={loading || otp.join("").length !== 6}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "جاري التحقق..." : "التالي"}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>لم تستلم الرمز؟</Text>
            <TouchableOpacity onPress={handleResend} disabled={loading}>
              <Text style={styles.resendLink}>إعادة الإرسال</Text>
            </TouchableOpacity>
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
  },
  container: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginBottom: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E6F0FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: "NotoArabicBold",
    color: "#111",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "NotoArabicRegular",
    color: "#6b7280",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 24,
  },
  phoneText: {
    fontFamily: "NotoArabicBold",
    color: "#007AFF",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems:'center',
    marginBottom: 24,
  },
  pasteButton:{
    marginLeft:10
  },
  otpBox: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    backgroundColor: "#fff",
    marginHorizontal: 5,
    textAlign: "center",
    fontSize: 22,
    color: "#111",
    lineHeight:30,
    fontFamily: "NotoArabicBold",
  },
  primaryButton: {
    height: 54,
    width: "100%",
    borderRadius: 14,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  primaryButtonText: {
    fontFamily: "NotoArabicBold",
    color: "#fff",
    fontSize: 18,
  },
  loadingContainer:{
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    gap:10
  },
  resendContainer: {
    alignItems: "center",
  },
  resendText: {
    fontFamily: "NotoArabicRegular",
    fontSize: 15,
    color: "#555",
    marginBottom: 4,
  },
  resendLink: {
    fontFamily: "NotoArabicBold",
    color: "#007AFF",
  },
});

export default VerifyOtp;
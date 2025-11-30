import { useState,useEffect } from 'react'
import {View,Text,TextInput,TouchableOpacity,StyleSheet,ScrollView,Platform,Alert,Linking} from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context"
import { doc, getDoc } from "firebase/firestore";
import { DB } from '../../firebaseConfig';
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from 'expo-router'
import { sendOTP } from "../../services/twilioService"
import { Feather } from '@expo/vector-icons'
import Checkbox from 'expo-checkbox'

// Iraq phone validation and normalization
const normalizeIraqPhone = (input) => {
  let phone = input.replace(/\D/g, "");

  if (phone.startsWith("07")) phone = phone.slice(1);
  if (!phone.startsWith("7")) throw new Error("رقم الهاتف يجب أن يبدأ بـ 07 أو 7");

  return `+964${phone}`;
};

const Signup = () => {
  const [formData, setFormData] = useState({username: '',phone: ''});
  const [loading, setLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [expoPushToken, setExpoPushToken] = useState(null);

  // Function to register for push notifications and save the token in AsyncStorage
  const registerForPushNotificationsAsync = async () => {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }

      if (!Device.isDevice) {
        console.log("Must use physical device for Push Notifications...");
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification...");
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig.extra.eas.projectId,
      });

      const tokenValue = token.data;
      await AsyncStorage.setItem("expoPushToken", tokenValue);
      return tokenValue;
    } catch (error) {
      console.log("Error registering for notifications:", error);
      return null;
    }
  }

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));
  }, []);
    
  const handleSubmit = async () => {
    if (!formData.username || !formData.phone) {
      Alert.alert("خطأ", "الرجاء ملء جميع الحقول");
      return;
    }

    if (!privacyAccepted) {
      Alert.alert("الرجاء الموافقة على سياسة الخصوصية وشروط الاستخدام");
      return;
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizeIraqPhone(formData.phone.trim());
    } catch (err) {
      Alert.alert("رقم غير صحيح", err.message);
      return;
    }

    try {
      setLoading(true);

      const userRef = doc(DB, "users", normalizedPhone);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        Alert.alert(
          "الحساب موجود بالفعل",
          "يوجد حساب مسجل بهذا الرقم. الرجاء تسجيل الدخول بدلًا من إنشاء حساب جديد."
        )
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
            username: formData.username.trim(),
            expoPushToken:expoPushToken,
            isSignup: true,
          },
        });
      } else {
        Alert.alert("فشل الإرسال", response.error || "حدث خطأ أثناء الإرسال");
      }
    } catch (err) {
      console.log("Send OTP error:", err);
      Alert.alert("خطأ", "حدث خطأ أثناء إرسال رمز التحقق");
    } finally {
      setLoading(false);
    }
  };

  //Test signup with +216 code
  /*
  const handleSubmit = async () => {
    if (!formData.username || !formData.phone) {
      Alert.alert("خطأ", "الرجاء ملء جميع الحقول");
      return;
    }

    if (!privacyAccepted) {
      Alert.alert("الرجاء الموافقة على سياسة الخصوصية وشروط الاستخدام");
      return;
    }

    let normalizedPhone = `+216${formData.phone}`;
    
    try {
      setLoading(true);

      const userRef = doc(DB, "users", normalizedPhone);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        Alert.alert(
          "الحساب موجود بالفعل",
          "يوجد حساب مسجل بهذا الرقم. الرجاء تسجيل الدخول بدلًا من إنشاء حساب جديد."
        )
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
            username: formData.username.trim(),
            expoPushToken:expoPushToken,
            isSignup: true,
          },
        });
      } else {
        Alert.alert("فشل الإرسال", response.error || "حدث خطأ أثناء الإرسال");
      }
    } catch (err) {
      console.log("Send OTP error:", err);
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.replace('/welcome')}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>إنشاء حساب</Text>
          <Text style={styles.subtitle}>أدخل معلوماتك لإنشاء حساب سائق</Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>اسم المستخدم</Text>
            <View style={styles.inputWrapper}>
              <Feather name="user" size={20} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { textAlign: 'right' }]}
                placeholder="أدخل اسم الثلاثي"
                placeholderTextColor="#aaa"
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
              />
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>رقم الهاتف</Text>
            <View style={styles.inputWrapper}>
              <Feather name="phone" size={20} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { textAlign: 'right', direction: 'ltr' }]}
                placeholder="7XX XXX XXXX"
                placeholderTextColor="#aaa"
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
              />
            </View>
            <Text style={styles.helperText}>سنرسل رمز التحقق إلى هذا الرقم</Text>
          </View>

          {/* Privacy Policy Checkbox */}
          <View style={styles.checkboxContainer} dir="rtl">
            <Checkbox
              value={privacyAccepted}
              onValueChange={(checked) => setPrivacyAccepted(checked)}
              color={privacyAccepted ? "#007AFF" : undefined}
            />
            <Text style={styles.checkboxLabel}>
              أوافق على{" "}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL("https://sayartech.com/privacy-policy")}
              >
                سياسة الخصوصية
              </Text>{" "}
              و{" "}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL("https://sayartech.com/terms-of-use")}
              >
                شروط الاستخدام
              </Text>
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "جاري الإرسال..." : "التالي"}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>
              لديك حساب بالفعل؟{' '}
              <Text
                style={styles.loginLink}
                onPress={() => router.push('/login')}
              >
                تسجيل الدخول
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
    backgroundColor: '#f8f9fa',
  },
  container: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontFamily: 'NotoArabicBold',
    color: '#111',
    marginBottom: 8,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'NotoArabicRegular',
    color: '#6b7280',
    marginBottom: 32,
    textAlign: 'right',
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontFamily: 'NotoArabicBold',
    fontSize: 15,
    color: '#111',
    marginBottom: 8,
    textAlign: 'right',
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: {
    marginLeft: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'NotoArabicRegular',
    color: '#111',
  },
  helperText: {
    fontSize: 13,
    fontFamily: 'NotoArabicRegular',
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'right',
  },
  checkboxContainer: { 
    flexDirection: "row-reverse", 
    alignItems: "center", 
    gap: 10, 
    marginTop:5,
    marginBottom: 25,
  },
  checkboxLabel:{
    fontSize: 14, 
    fontFamily: 'NotoArabicRegular',
    color: "#333", 
    flexShrink: 1
  },
  link: { 
    color: "#007AFF", 
    textDecorationLine: "underline" 
  },
  primaryButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    fontFamily: 'NotoArabicBold',
    color: '#fff',
    fontSize: 18,
  },
  loginContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginText: {
    fontFamily: 'NotoArabicRegular',
    fontSize: 15,
    color: '#555',
  },
  loginLink: {
    fontFamily: 'NotoArabicBold',
    color: '#007AFF',
  },
});

export default Signup;


import { View,Text,TouchableOpacity,StyleSheet,ScrollView,Platform,StatusBar } from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from 'expo-router'
import { FontAwesome,Feather,Octicons } from "@expo/vector-icons"

const index = () => {

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo/Brand Area */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Feather name="shield" size={48} color="#fff" />
          </View>

          <Text style={styles.title}>Safe Driver</Text>
          <Text style={styles.subtitle}>انضم إلى شبكة السائقين الموثوقين واربح دخلاً إضافياً</Text>

          {/* Features */}
          <View style={styles.featuresContainer}>
            <FeatureCard
              icon={<FontAwesome name="dollar" size={20} color="#007AFF"/>}
              title="دخل شهري ثابت"
              subtitle="اربح من نقل الطلاب يومياً براتب مضمون"
              bgColor="#fff"
              iconBg="#E6F0FF"
            />
            <FeatureCard
              icon={<Feather name="clock" size={20} color="#FFA500" />}
              title="مرونة بالدوام"
              subtitle="تختار أوقات العمل اللي تناسبك"
              bgColor="#fff"
              iconBg="#FFF8E6"
            />
            <FeatureCard
              icon={<Octicons name="verified" size={20} color="#00B894" />}
              title="منصة موثوقة وآمنة"
              subtitle="نظام يعتمد عليه وآمن لكل السواق"
              bgColor="#fff"
              iconBg="#E9FDF3"
            />
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.push('signup')}
          >
            <Text style={styles.primaryButtonText}>إنشاء حساب سائق</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.outlineButton]}
            onPress={() => router.push('login')}
          >
            <Text style={styles.outlineButtonText}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const FeatureCard = ({ icon, title, subtitle, bgColor,iconBg }) => (
  <View style={[styles.featureCard, { backgroundColor: bgColor }]}>
    <View style={[styles.featureIcon,{backgroundColor:iconBg}]}>{icon}</View>
    <View style={styles.featureText}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureSubtitle}>{subtitle}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  logoContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 36,
    fontFamily:'NotoArabicBold',
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
    textAlign: 'center',
    textTransform:'uppercase'
  },
  subtitle: {
    fontFamily:'NotoArabicRegular',
    color: '#6b7280',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
  },
  featuresContainer: {
    width: '100%',
    maxWidth: 360,
  },
  featureCard: {
    flexDirection:'row-reverse',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  featureText:{
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  featureTitle: {
    fontFamily:'NotoArabicBold',
    fontWeight: '600',
    fontSize: 16,
    color: '#000',
  },
  featureSubtitle: {
    fontFamily:'NotoArabicRegular',
    color: '#6b7280',
    fontSize: 13,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
  },
  button: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    fontFamily:'NotoArabicBold',
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  outlineButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
  },
  outlineButtonText: {
    fontFamily:'NotoArabicBold',
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default index;

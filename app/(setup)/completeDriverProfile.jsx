import { useState } from "react";
import { View,Text,TextInput,TouchableOpacity,StyleSheet,Alert,Image,Modal,ActivityIndicator } from "react-native";
import { SafeAreaView,useSafeAreaInsets } from "react-native-safe-area-context"
import * as ImagePicker from "expo-image-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as Location from "expo-location";
import MapView from "react-native-maps";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { DB } from "../../firebaseConfig";
import { doc,setDoc,serverTimestamp,getDoc,updateDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

const GOOGLE_MAPS_APIKEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const DriverCompleteProfile = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [formData, setFormData] = useState({
    personalImage: "",
    name: "",
    phone: "",
    homeAddress: "",
    homeLocation: null,
    carType: "",
    carPlate: "",
    carSeats: "",
    carImage: "",
  });

  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [tempLocation, setTempLocation] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [showCarTypeModal, setShowCarTypeModal] = useState(false);
  const [submitLoading,setSubmitLoading] = useState(false);

  //Default Baghdad center
  const defaultRegion = {
    latitude: 33.3152,
    longitude: 44.3661,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  //Pick personal or car image
  const handlePickImage = async (type) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("تنبيه", "الرجاء السماح للوصول إلى الصور لاستخدام هذه الميزة");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 1,          
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        Alert.alert("خطأ", "تعذر تحميل الصورة. حاول مرة أخرى.");
        return;
      }

      setFormData((prev) => ({
        ...prev,
        [type === "car" ? "carImage" : "personalImage"]: uri,
      }));
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء اختيار الصورة");
    }
  }

  //Upload image to Firebase Storage and return download URL
  const uploadImageToFirebase = async (uri, folder = "drivers") => {
    if (!uri) return null;
    try {
      const storage = getStorage();
      const response = await fetch(uri);
      const blob = await response.blob();

      // Unique filename: folder/timestamp.ext
      const ext = uri.split(".").pop();
      const filename = `${folder}/${Date.now()}.${ext}`;
      const storageRef = ref(storage, filename);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      return downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert("خطأ", "تعذر تحميل الصورة إلى الخادم");
      return null;
    }
  }

  //Get home address from the corrds
  const getAddressFromCoords = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_APIKEY}&language=ar`
      );
      const data = await response.json();
      if (data.status === "OK" && data.results.length > 0) {
        return data.results[0].formatted_address;
      } else {
        return "عنوان غير معروف";
      }
    } catch (error) {
      console.log("Geocoding error:", error);
      return "عنوان غير معروف";
    }
  }

  //Use current location
  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("تنبيه", "الرجاء السماح للوصول إلى موقعك");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      setLoadingAddress(true);
      const address = await getAddressFromCoords(latitude, longitude);
      setLoadingAddress(false);

      setFormData({
        ...formData,
        homeLocation: { latitude, longitude },
        homeAddress: address,
      });

    } catch (error) {
      console.log("Error fetching current location:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء تحديد موقعك");
    }
  };

  //Pick home location from map
  const handlePickFromMap = async () => {
    try {
      setIsLoadingMap(true);
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setTempLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } else {
        setTempLocation(defaultRegion);
      }

      setTimeout(() => {
        setShowMap(true);
        setIsLoadingMap(false);
      }, 500);
    } catch (error) {
      console.log("Error opening map:", error);
      Alert.alert("خطأ", "تعذر تحميل الخريطة، حاول مرة أخرى");
      setIsLoadingMap(false);
    }
  };

  //Confirm map location
  const handleConfirmLocation = async () => {
    if (tempLocation) {
      setLoadingAddress(true);
      const address = await getAddressFromCoords(tempLocation.latitude, tempLocation.longitude);
      setLoadingAddress(false);
      setFormData({
        ...formData,
        homeLocation: tempLocation,
        homeAddress: address,
      });
      setShowMap(false);
    }
  }

  // 🧾 Validation
  const validateStep = () => {
    if (currentStep === 1 && !formData.personalImage)
      return "الرجاء رفع صورتك الشخصية";

    if (currentStep === 2 && !formData.homeLocation)
      return "الرجاء تحديد موقع المنزل";

    if (currentStep === 3 && (!formData.carType || !formData.carPlate || !formData.carSeats))
      return "الرجاء إدخال بيانات السيارة";

    if (currentStep === 4 && !formData.carImage)
      return "الرجاء رفع صورة السيارة";
    return null;
  };

  //Move to Next Tab
  const handleNext = () => {
    const err = validateStep();
    if (err) {
      Alert.alert("تحقق من البيانات", err);
      return;
    }
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
    else handleSubmit();
  };

  //Move to previous Tab
  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  //Submit driver profile
  const handleSubmit = async () => {
    try {
      setSubmitLoading(true);

      const requiredError = validateStep();
      if (requiredError) {
        setSubmitLoading(false);
        Alert.alert("تحقق من البيانات", requiredError);
        return;
      }

      const driverPhone = await AsyncStorage.getItem("safeTransDriver");
      if (!driverPhone) {
        setSubmitLoading(false);
        Alert.alert("خطأ", "تعذر تحديد هوية السائق");
        return;
      }

      const userRef = doc(DB, "users", driverPhone);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setSubmitLoading(false);
        Alert.alert("خطأ", "تعذر العثور على بيانات المستخدم");
        return;
      }

      const userData = userSnap.data();
      const { username, phone, notification_token } = userData;

      const BAGHDAD_CENTER = [33.3152, 44.3661];

      const homeLoc = formData.homeLocation
        ? [formData.homeLocation.latitude, formData.homeLocation.longitude]
        : BAGHDAD_CENTER;

      const personalImageUrl = await uploadImageToFirebase(formData.personalImage, "drivers/personal");
      const carImageUrl = await uploadImageToFirebase(formData.carImage, "drivers/car");

      const driverData = {
        balance: 0,
        car_image: carImageUrl || "",
        car_plate: formData.carPlate || "",
        car_seats: Number(formData.carSeats) || 5,
        car_type: formData.carType || "",
        location: {old: homeLoc,new: homeLoc},
        name: username || "سائق",
        home_address: formData.homeAddress || "",
        home_location: formData.homeLocation || null,
        intercityTrips: [],
        lines: [],
        personal_image: personalImageUrl || "",
        phone_number: phone || driverPhone,
        rating: [],
        trips_canceled: 0,
        created_at: serverTimestamp(),
      };

      const driverRef = doc(DB, "drivers", driverPhone);
      await setDoc(driverRef, driverData, { merge: true });

      await updateDoc(userRef, {
        driver_doc: driverRef.id,
      });

      const verifySnap = await getDoc(driverRef);
      if (!verifySnap.exists()) {
        setSubmitLoading(false);
        Alert.alert("خطأ", "لم يتم حفظ الملف الشخصي بشكل صحيح، حاول مرة أخرى");
        return;
      }

      setTimeout(() => {
        router.replace("/(main)/home");
        setSubmitLoading(false);
      }, 400);

    } catch (error) {
      console.error("❌ Error submitting driver profile:", error);
      setSubmitLoading(false);
      Alert.alert("خطأ", "حدث خطأ أثناء حفظ البيانات");
    }
  }

  //Render each step
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.add_rider_step}>
            <Text style={styles.title}>الصورة الشخصية</Text>
            <Text style={styles.subtitle}>قم برفع صورتك الشخصية</Text>

            <TouchableOpacity
              onPress={() => handlePickImage("personal")}
              style={styles.imagePicker}
            >
              {formData.personalImage ? (
                <Image
                  source={{ uri: formData.personalImage }}
                  style={{width: 130,height: 130}}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons name="person-circle-outline" size={120} color="#ccc" />
              )}
              <Text style={styles.upload_image_button}>اختر صورة</Text>
            </TouchableOpacity>
          </View>
        );

      case 2:
        if (showMap) {
          return (
            <View style={styles.map_container}>
              <TouchableOpacity
                style={styles.back_button}
                onPress={() => setShowMap(false)}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>

              <MapView
                provider="google"
                style={styles.map}
                initialRegion={tempLocation ? {
                  ...tempLocation,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                } : defaultRegion}
                showsUserLocation={true}
                showsMyLocationButton={true}
                onRegionChangeComplete={(region) =>
                  setTempLocation({ 
                    latitude: region.latitude, 
                    longitude: region.longitude                   
                  })
                }               
              />

              <View style={styles.centerPin}>
                <Ionicons name="location-sharp" size={32} color="#ff3b30" />
              </View>

              <TouchableOpacity
                style={styles.save_location_button}
                onPress={handleConfirmLocation}
              >
                <Text style={styles.save_location_button_text}>تأكيد الموقع</Text>
              </TouchableOpacity>

            </View>
          );
        }

        // Default home-location selection
        return (
          <View style={styles.add_rider_step}>
            <Text style={styles.title}>موقع المنزل</Text>
            <Text style={styles.subtitle}>حدد موقع المنزل باستخدام إحدى الطرق</Text>

            <View style={styles.location_buttons_box}>
              <TouchableOpacity style={styles.locButton} onPress={handleUseCurrentLocation}>
                <Ionicons name="navigate" size={26} color="#000" />
                <Text style={styles.locButtonText}>استخدم موقعي الحالي</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.locButton} onPress={handlePickFromMap}>
                <Ionicons name="map" size={26} color="#000" />
                <Text style={styles.locButtonText}>اختر من الخريطة</Text>
              </TouchableOpacity>
            </View>

            {formData.homeLocation?.latitude && (
              <View style={styles.coordBox}>
                <Text style={styles.coordLabel}>عنوان المنزل:</Text>
                <Text style={styles.coordText}>
                  {loadingAddress
                    ? "جارٍ تحديد العنوان..."
                    : formData.homeAddress || "عنوان غير معروف"}
                </Text>
              </View>
            )}
          </View>
        );

      case 3:
        return (
          <View style={styles.add_rider_step}>
            <Text style={styles.title}>بيانات السيارة</Text>
            <View style={styles.input_box}>
              <TouchableOpacity
                style={styles.selectBox}
                onPress={() => setShowCarTypeModal(true)}
              >
                <Text style={styles.selectText}>
                  {formData.carType || "اختر نوع السيارة"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#777" />
              </TouchableOpacity>
              <Modal
                visible={showCarTypeModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCarTypeModal(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContainer}>
                    {[
                      "صالون",
                      "ميني باص ١٢ راكب",
                      "ميني باص ١٨ راكب",
                      "٧ راكب (جي ام سي / تاهو)",
                    ].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={styles.modalItem}
                        onPress={() => {
                          setFormData({ ...formData, carType: type });
                          setShowCarTypeModal(false);
                        }}
                      >
                        <Text style={styles.modalItemText}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </Modal>

              <TextInput
                placeholder="رقم اللوحة"
                value={formData.carPlate}
                onChangeText={(v) => setFormData({ ...formData, carPlate: v })}
                style={styles.input}
              />
              <TextInput
                placeholder="عدد المقاعد"
                keyboardType="numeric"
                value={formData.carSeats}
                onChangeText={(v) => setFormData({ ...formData, carSeats: v })}
                style={styles.input}
              />
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.add_rider_step}>
            <Text style={styles.title}>صورة السيارة</Text>
            <Text style={styles.subtitle}>قم برفع صورة السيارة</Text>
            <TouchableOpacity
              onPress={() => handlePickImage("car")}
              style={styles.imagePicker}
            >
              {formData.carImage ? (
                <Image
                  source={{ uri: formData.carImage }}
                  style={{width: 130,height: 130}}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons name="car-outline" size={120} color="#ccc" />
              )}
              <Text style={styles.upload_image_button}>اختر صورة</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress */}
      <View style={styles.progressContainer}>
        <Text style={styles.stepText}>
          الخطوة {currentStep} من {totalSteps}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(currentStep / totalSteps) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Step content */}
      <View style={styles.formContainer}>{renderStep()}</View>

      {/* ✅ Loading overlay (shows while fetching location/map) */}
      {isLoadingMap && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#000" />
          <Text style={styles.loadingText}>جارٍ تحميل الخريطة...</Text>
        </View>
      )}

      {submitLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#000" />
          <Text style={styles.loadingText}>جارٍ حفظ بياناتك...</Text>
        </View>
      )}

      {/* Nav buttons */}
      <View
        style={[
          styles.navButtons,
          { paddingBottom: insets.bottom + 20 }, // 👈 keeps above tab bar
        ]}
      >
        {currentStep > 1 && (
          <TouchableOpacity
            style={[styles.button, styles.outlineButton]}
            onPress={handleBack}
          >
            <Ionicons name="chevron-back" size={18} color="#000" />
            <Text style={styles.outlineButtonText}>السابق</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleNext}
        >
          <Text style={styles.primaryButtonText}>
            {currentStep === totalSteps ? "أضف" : "التالي"}
          </Text>
          {currentStep < totalSteps && (
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default DriverCompleteProfile;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fff" 
  },
  progressContainer: { 
    padding: 20, 
    borderBottomWidth: 1, 
    borderColor: "#eee" ,
  },
  stepText: { 
    fontFamily: "NotoArabicRegular",
    textAlign: "center", 
    color: "#000" 
  },
  progressBar: {
    height: 5,
    backgroundColor: "#eee",
    borderRadius: 5,
    marginTop: 5,
  },
  progressFill: {
    height: 5,
    backgroundColor: "#007AFF",
    borderRadius: 5,
  },
  formContainer: {
    flex:1,
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  add_rider_step: { 
    flex: 1 
  },
  title: { 
    fontFamily: "NotoArabicBold",
    fontSize: 22,  
    textAlign: "center", 
    color:"#000",
    marginBottom: 5 
  },
  subtitle: { 
    fontFamily: "NotoArabicRegular",
    textAlign: "center", 
    color: "#777", 
    marginBottom: 20 
  },
  imagePicker:{
    justifyContent:'center',
    alignItems:'center'
  },
  profileImage:{
    backgroundColor:'tomato'
  },
  upload_image_button:{
    width:100,
    marginTop:10,
    paddingHorizontal:3,
    paddingVertical:3,
    backgroundColor:'#000',
    borderRadius:15,
    fontFamily: "NotoArabicRegular",
    fontSize:15,
    textAlign: "center", 
    color: "#fff", 
  },
  input_box:{
    marginTop:20,
    flexDirection:'column',
    gap:15
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 10,
    textAlign: "right",
    fontFamily: "NotoArabicRegular",
    fontSize: 15,
    color:'#000'
  },
  selectBox: {
    height: 50,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  selectText: {
    fontFamily: "NotoArabicRegular",
    fontSize: 16,
    color: "#000",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    width: 250,
    maxHeight: 250,
    borderRadius: 10,
    paddingVertical: 10,
  },
  modalItem: {
    paddingVertical: 10,
    alignItems: "center",
  },
  modalItemText: {
    fontFamily: "NotoArabicRegular",
    fontSize: 18,
    color: "#000",
  },
  location_buttons_box:{
    flexDirection: "row", 
    justifyContent: "center", 
    gap: 10, 
    marginTop: 20,
  },
  locButton: {
    width:150,
    height:100,
    justifyContent: "center", 
    alignItems:'center',
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 15,
  },
  locButtonText: {
    fontFamily: "NotoArabicRegular",
    fontSize: 13,
    marginTop: 5,
    color: "#000",
  },
  coordBox: {
    justifyContent: "center", 
    alignItems:'center',
    backgroundColor: "#f2f2f2",
    borderRadius: 12,
    padding: 10,
    marginTop: 20,
  },
  coordLabel: {
    fontFamily: "NotoArabicBold",
    fontSize: 14,
    color: "#333",
    marginBottom: 5,
  },
  coordText: {
    fontFamily: "NotoArabicRegular",
    fontSize: 13,
    color: "#555",
    textAlign: "center",
  },
  map_container:{
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  map:{
    width: "100%",  
    height: "100%", 
    borderRadius: 20,
    overflow: "hidden",
  },
  centerPin: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -16,
    marginTop: -32,
    zIndex: 10,
  },
  back_button:{
    position: "absolute",
    top: 10,
    left: 20,
    zIndex: 1000,
    backgroundColor: "#000",
    borderRadius: 25,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  save_location_button:{
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    width:130,
    height:42,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    borderRadius: 15,
  },
  save_location_button_text:{ 
    color: "#fff", 
    fontFamily: "NotoArabicBold" 
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
  navButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  button: {
    flex: 1,
    height:45,
    marginHorizontal: 5,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButton: { 
    backgroundColor: "#007AFF",
  },
  primaryButtonText:{
    fontFamily: "NotoArabicRegular",
    color: "#fff", 
    fontSize: 15
  },
  outlineButton: { 
    backgroundColor: "#fff", 
    borderWidth: 1, 
    borderColor: "#ccc" 
  },
  outlineButtonText:{
    fontFamily: "NotoArabicRegular",
    color: "#000", 
    fontSize: 15
  }
});

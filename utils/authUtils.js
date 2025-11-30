// utils/authUtils.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDoc, doc } from "firebase/firestore";
import { DB } from "../firebaseConfig";

export const checkDriverStatus = async () => {
  try {
    const userId = await AsyncStorage.getItem("safeTransDriver");
    if (!userId) return "unauthenticated";

    const userSnap = await getDoc(doc(DB, "users", userId));
    if (!userSnap.exists()) return "unauthenticated";

    const userData = userSnap.data();

    if (!userData.driver_doc) return "incomplete_profile";
    return "authenticated";
  } catch (err) {
    console.error("checkDriverStatus error:", err);
    return "unauthenticated";
  }
};

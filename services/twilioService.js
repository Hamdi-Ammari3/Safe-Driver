// services/twilioService.js
import axios from "axios";

const API_BASE = "https://us-central1-sayartech-871ac.cloudfunctions.net/api";

export async function sendOTP(phone, channel = "whatsapp") {
  try {
    const r = await axios.post(`${API_BASE}/send-otp`, { phone, channel });
    return r.data;
  } catch (err) {
    console.error("sendOTP error:", err?.response?.data || err.message);
    return { success: false, error: err?.response?.data || err.message };
  }
}

export async function verifyOTP(phone, code) {
  try {
    const r = await axios.post(`${API_BASE}/verify-otp`, { phone, code });
    return r.data;
  } catch (err) {
    console.error("verifyOTP error:", err?.response?.data || err.message);
    return { success: false, error: err?.response?.data || err.message };
  }
}


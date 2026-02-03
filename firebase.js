// firebase.js - Configuração do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// Configuração do Firebase (valores reais)
const firebaseConfig = {
  apiKey: "AIzaSyDJZOEN41Dq_5MIxHiQxq7ZA7C9zHKfFo8",
  authDomain: "crm-oftalmo15.firebaseapp.com",
  projectId: "crm-oftalmo15",
  storageBucket: "crm-oftalmo15.firebasestorage.app",
  messagingSenderId: "1012827566083",
  appId: "1:1012827566083:web:fe85a582412b956a2c5e36",
  // URL padrão do Realtime Database
  databaseURL: "https://crm-oftalmo15-default-rtdb.firebaseio.com",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);

// auth.js - Autenticação Firebase (Email/Senha)
import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// Login com email e senha (Firebase Auth)
export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Logout
export function logout() {
  return signOut(auth);
}

// Listener de estado de autenticação
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

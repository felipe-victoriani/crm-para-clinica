// database.js - Funções de banco de dados (Firebase ou localStorage mock)
import { database } from "./firebase.js";
import {
  ref,
  push,
  set,
  onValue,
  update,
  remove,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

const patientsKey = "crm_patients";

// Verificar se Firebase está configurado (não tem placeholders)
const isFirebaseConfigured = !Object.values(database.app.options).some(
  (value) => typeof value === "string" && value.includes("YOUR_"),
);

// Funções mock para localStorage
function mockPush(data) {
  const id = Date.now().toString();
  const patient = { ...data, id };
  const patients = JSON.parse(localStorage.getItem(patientsKey) || "[]");
  patients.push(patient);
  localStorage.setItem(patientsKey, JSON.stringify(patients));
  return { key: id };
}

function mockOnValue(callback) {
  const currentPatients = JSON.parse(localStorage.getItem(patientsKey) || "[]");
  callback({
    forEach: (fn) =>
      currentPatients.forEach((p) => fn({ key: p.id, val: () => p })),
  });
}

function mockUpdate(path, data) {
  const patients = JSON.parse(localStorage.getItem(patientsKey) || "[]");
  const id = path.split("/")[1];
  const index = patients.findIndex((p) => p.id === id);
  if (index !== -1) {
    patients[index] = { ...patients[index], ...data };
    localStorage.setItem(patientsKey, JSON.stringify(patients));
  }
}

function mockRemove(path) {
  const patients = JSON.parse(localStorage.getItem(patientsKey) || "[]");
  const id = path.split("/")[1];
  const updatedPatients = patients.filter((p) => p.id !== id);
  localStorage.setItem(patientsKey, JSON.stringify(updatedPatients));
}

// Funções Firebase reais
function firebasePush(data) {
  const patientsRef = ref(database, "patients");
  return push(patientsRef, data);
}

function firebaseOnValue(callback) {
  const patientsRef = ref(database, "patients");
  return onValue(patientsRef, callback);
}

function firebaseUpdate(path, data) {
  const patientRef = ref(database, path);
  return update(patientRef, data);
}

function firebaseRemove(path) {
  const patientRef = ref(database, path);
  return remove(patientRef);
}

// Exportar funções baseadas na configuração
export const dbPush = isFirebaseConfigured ? firebasePush : mockPush;
export const dbOnValue = isFirebaseConfigured ? firebaseOnValue : mockOnValue;
export const dbUpdate = isFirebaseConfigured ? firebaseUpdate : mockUpdate;
export const dbRemove = isFirebaseConfigured ? firebaseRemove : mockRemove;

export { isFirebaseConfigured };

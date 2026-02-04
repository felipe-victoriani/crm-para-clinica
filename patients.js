// patients.js - Lógica de negócio dos pacientes
import {
  dbOnValue,
  dbPush,
  dbUpdate,
  dbRemove,
  isFirebaseConfigured,
} from "./database.js";

const DEBUG = false;

// Médicos fixos
export const doctors = ["Dr. Dante", "Dr. Alberto", "Dra. Fabiana"];

// Situações
export const statuses = [
  "Paciente solicitado risco",
  "Paciente agendou cirurgia",
  "Paciente fez cirurgia",
  "Paciente não quer operar",
];

// Estado dos pacientes
let patients = [];
let unsubscribe = null;

// Carregar pacientes
export function loadPatients(callback) {
  return new Promise((resolve) => {
    if (isFirebaseConfigured) {
      // Firebase: ouvir mudanças em tempo real
      if (unsubscribe) unsubscribe(); // Remover listener anterior se existir

      unsubscribe = dbOnValue((snapshot) => {
        patients = [];
        snapshot.forEach((childSnapshot) => {
          const patient = { id: childSnapshot.key, ...childSnapshot.val() };
          // Garantir que createdAt existe (para pacientes antigos)
          if (!patient.createdAt) {
            patient.createdAt = Date.now();
          }
          patients.push(patient);
        });
        if (callback) callback(patients);
        resolve(patients);
      });
    } else {
      // localStorage: carregar uma vez
      dbOnValue((snapshot) => {
        patients = [];
        snapshot.forEach((childSnapshot) => {
          const patient = { id: childSnapshot.key, ...childSnapshot.val() };
          // Garantir que createdAt existe (para pacientes antigos)
          if (!patient.createdAt) {
            patient.createdAt = Date.now();
          }
          patients.push(patient);
        });
        if (callback) callback(patients);
        resolve(patients);
      });
    }
  });
}

// Limpar listeners quando necessário
export function cleanup() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

// Função para corrigir pacientes sem createdAt
export async function fixPatientsCreatedAt() {
  if (DEBUG) console.log("Verificando pacientes sem createdAt...");
  const patientsToFix = patients.filter((p) => !p.createdAt);

  if (patientsToFix.length > 0) {
    if (DEBUG)
      console.log(
        `Encontrados ${patientsToFix.length} pacientes para corrigir`,
      );

    for (const patient of patientsToFix) {
      if (DEBUG) console.log("Corrigindo paciente:", patient.id);
      await updatePatient(patient.id, {
        createdAt: Date.now(),
        lastContactAt: patient.lastContactAt || null,
      });
    }

    if (DEBUG) console.log("Correção concluída!");
  } else {
    if (DEBUG) console.log("Todos os pacientes já têm createdAt");
  }
}

// Obter pacientes
export function getPatients() {
  return patients;
}

// Adicionar paciente
export async function addPatient(patientData) {
  const patient = {
    ...patientData,
    createdAt: Date.now(),
    lastContactAt: null,
  };

  if (isFirebaseConfigured) {
    // Firebase: push direto, o listener onValue atualizará automaticamente
    await dbPush(patient);
  } else {
    // localStorage: push e recarregar
    dbPush(patient);
    await loadPatients();
  }
}

// Atualizar paciente
export async function updatePatient(id, data) {
  const path = `patients/${id}`;

  if (isFirebaseConfigured) {
    // Firebase: update direto, o listener onValue atualizará automaticamente
    await dbUpdate(path, data);
  } else {
    // localStorage: update e recarregar
    dbUpdate(path, data);
    await loadPatients();
  }
}

// Remover paciente
export async function removePatient(id) {
  const path = `patients/${id}`;

  if (isFirebaseConfigured) {
    // Firebase: remove direto, o listener onValue atualizará automaticamente
    await dbRemove(path);
  } else {
    // localStorage: remove e recarregar
    dbRemove(path);
    await loadPatients();
  }
}

// Calcular dias desde uma data
export function daysSince(timestamp) {
  if (!timestamp) return 0; // Retornar 0 em vez de null

  let tsNum = 0;

  if (typeof timestamp === "number") {
    tsNum = timestamp;
  } else if (timestamp instanceof Date) {
    tsNum = timestamp.getTime();
  } else if (typeof timestamp === "string") {
    // Se for string numérica, parseInt; senão, tentar Date.parse (para formatos como YYYY-MM-DD)
    if (/^\d+$/.test(timestamp)) {
      tsNum = parseInt(timestamp, 10);
    } else {
      const parsed = Date.parse(timestamp);
      if (isNaN(parsed)) return 0;
      tsNum = parsed;
    }
  } else {
    return 0;
  }

  if (isNaN(tsNum) || tsNum <= 0) return 0;

  const now = Date.now();
  const diff = now - tsNum;

  // Evitar valores negativos
  if (diff < 0) return 0;

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Classificar urgência
export function getUrgency(days) {
  if (days === null || days === 0) return "normal";
  if (days <= 29) return "normal";
  if (days <= 44) return "amarelo";
  if (days <= 59) return "laranja";
  return "vermelho";
}

// Filtrar pacientes
export function filterPatients(
  search = "",
  status = "",
  minDays = null,
  doctor = "",
) {
  let filtered = patients;

  // Filtro de busca
  if (search) {
    filtered = filtered.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()),
    );
  }

  // Filtro de status
  if (status) {
    filtered = filtered.filter((p) => p.status === status);
  }

  // Filtro de médico
  if (doctor) {
    filtered = filtered.filter((p) => p.doctor === doctor);
  }

  // Filtro de dias
  if (minDays !== null) {
    filtered = filtered.filter((p) => {
      const d = daysSince(p.lastContactAt || p.visitDate || p.createdAt);
      return d >= minDays;
    });
  }

  // Ordenar por urgência (vermelho primeiro)
  filtered.sort((a, b) => {
    const aDays = daysSince(a.lastContactAt || a.visitDate || a.createdAt);
    const bDays = daysSince(b.lastContactAt || b.visitDate || b.createdAt);
    const aUrg = getUrgency(aDays);
    const bUrg = getUrgency(bDays);
    const urgOrder = { vermelho: 4, laranja: 3, amarelo: 2, normal: 1 };
    return urgOrder[bUrg] - urgOrder[aUrg];
  });

  return filtered;
}

// Estatísticas do dashboard
export function getDashboardStats() {
  const total = patients.length;
  const byStatus = statuses.map(
    (status) => patients.filter((p) => p.status === status).length,
  );
  const over30 = patients.filter(
    (p) => daysSince(p.lastContactAt || p.visitDate || p.createdAt) >= 30,
  ).length;
  const over45 = patients.filter(
    (p) => daysSince(p.lastContactAt || p.visitDate || p.createdAt) >= 45,
  ).length;
  const over60 = patients.filter(
    (p) => daysSince(p.lastContactAt || p.visitDate || p.createdAt) >= 60,
  ).length;

  return { total, byStatus, over30, over45, over60 };
}

// Relatório mensal
export function generateMonthlyReport() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthlyPatients = patients.filter((p) => {
    const created = new Date(p.createdAt);
    return (
      created.getMonth() === currentMonth &&
      created.getFullYear() === currentYear
    );
  });
  const scheduled = monthlyPatients.filter(
    (p) => p.status === "Paciente agendou cirurgia",
  ).length;
  const conversionRate =
    monthlyPatients.length > 0
      ? ((scheduled / monthlyPatients.length) * 100).toFixed(2)
      : 0;

  return {
    month: now.toLocaleString("pt-BR", { month: "long", year: "numeric" }),
    totalPatients: monthlyPatients.length,
    scheduledSurgeries: scheduled,
    conversionRate: conversionRate,
  };
}

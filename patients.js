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
  responsible = "",
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

  // Filtro de responsável
  if (responsible) {
    filtered = filtered.filter((p) => (p.responsible || "") === responsible);
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

  // Pacientes novos no mês atual
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const newThisMonth = patients.filter((p) => {
    const created = new Date(p.createdAt);
    return (
      created.getMonth() === currentMonth &&
      created.getFullYear() === currentYear
    );
  }).length;

  return { total, byStatus, over30, over45, over60, newThisMonth };
}

// Estatísticas por médico
export function getDoctorStats() {
  const stats = doctors.map((doctor) => {
    const doctorPatients = patients.filter((p) => p.doctor === doctor);
    const total = doctorPatients.length;
    const byStatus = statuses.map(
      (status) => doctorPatients.filter((p) => p.status === status).length,
    );
    const over60 = doctorPatients.filter(
      (p) => daysSince(p.lastContactAt || p.visitDate || p.createdAt) >= 60,
    ).length;
    const scheduled = doctorPatients.filter(
      (p) => p.status === "Paciente agendou cirurgia",
    ).length;
    const conversionRate =
      total > 0 ? ((scheduled / total) * 100).toFixed(1) : 0;

    // Calcular média de tempo desde último contato
    const avgDays =
      total > 0
        ? Math.round(
            doctorPatients.reduce(
              (sum, p) =>
                sum + daysSince(p.lastContactAt || p.visitDate || p.createdAt),
              0,
            ) / total,
          )
        : 0;

    return {
      name: doctor,
      total,
      byStatus,
      over60,
      conversionRate,
      avgDays,
    };
  });

  // Ordenar: primeiro por pacientes urgentes (60+), depois por total de pacientes
  return stats.sort((a, b) => {
    if (b.over60 !== a.over60) return b.over60 - a.over60;
    return b.total - a.total;
  });
}

// Relatório mensal (mantido para compatibilidade)
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

// Função auxiliar para filtrar pacientes por período
function filterPatientsByPeriod(patients, period) {
  const now = new Date();
  let startDate = new Date();

  switch (period) {
    case "week":
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate.setMonth(now.getMonth() - 1);
      break;
    case "quarter":
      startDate.setMonth(now.getMonth() - 3);
      break;
    case "year":
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case "all":
      startDate = new Date(0); // Desde sempre
      break;
  }

  return patients.filter((p) => {
    const created = new Date(p.createdAt);
    return created >= startDate;
  });
}

// Relatório avançado
export function generateAdvancedReport(period = "month", doctorFilter = "all") {
  let filteredPatients = filterPatientsByPeriod(patients, period);

  // Filtrar por médico se especificado
  if (doctorFilter !== "all") {
    filteredPatients = filteredPatients.filter(
      (p) => p.doctor === doctorFilter,
    );
  }

  const now = new Date();

  // Estatísticas básicas
  const total = filteredPatients.length;
  const requested = filteredPatients.filter(
    (p) => p.status === "Paciente solicitado risco",
  ).length;
  const scheduled = filteredPatients.filter(
    (p) => p.status === "Paciente agendou cirurgia",
  ).length;
  const completed = filteredPatients.filter(
    (p) => p.status === "Paciente fez cirurgia",
  ).length;
  const declined = filteredPatients.filter(
    (p) => p.status === "Paciente não quer operar",
  ).length;

  // Taxas
  const conversionRate = total > 0 ? ((scheduled / total) * 100).toFixed(1) : 0;
  const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
  const declineRate = total > 0 ? ((declined / total) * 100).toFixed(1) : 0;

  // Contatos
  const contacted = filteredPatients.filter((p) => p.lastContactAt).length;
  const contactRate = total > 0 ? ((contacted / total) * 100).toFixed(1) : 0;

  // Agradecimentos
  const thanked = filteredPatients.filter((p) => p.thankYouSentAt).length;
  const thankRate = total > 0 ? ((thanked / total) * 100).toFixed(1) : 0;

  // Pacientes críticos (60+ dias)
  const critical = filteredPatients.filter((p) => {
    const baseTs = p.lastContactAt || p.visitDate || p.createdAt;
    const days = Math.floor((now - new Date(baseTs)) / (1000 * 60 * 60 * 24));
    return days >= 60;
  }).length;

  // Tempo médio
  let totalDays = 0;
  filteredPatients.forEach((p) => {
    const baseTs = p.lastContactAt || p.visitDate || p.createdAt;
    const days = Math.floor((now - new Date(baseTs)) / (1000 * 60 * 60 * 24));
    totalDays += days;
  });
  const avgDays = total > 0 ? Math.round(totalDays / total) : 0;

  // Distribuição por status
  const statusDistribution = [
    { status: "Solicitado Risco", count: requested, color: "green" },
    { status: "Agendou Cirurgia", count: scheduled, color: "blue" },
    { status: "Fez Cirurgia", count: completed, color: "gray" },
    { status: "Não Quer Operar", count: declined, color: "red" },
  ];

  // Relatório por médico
  const doctorStats = {};
  filteredPatients.forEach((p) => {
    if (!doctorStats[p.doctor]) {
      doctorStats[p.doctor] = {
        total: 0,
        scheduled: 0,
        completed: 0,
        declined: 0,
        contacted: 0,
      };
    }
    doctorStats[p.doctor].total++;
    if (p.status === "Paciente agendou cirurgia")
      doctorStats[p.doctor].scheduled++;
    if (p.status === "Paciente fez cirurgia") doctorStats[p.doctor].completed++;
    if (p.status === "Paciente não quer operar")
      doctorStats[p.doctor].declined++;
    if (p.lastContactAt) doctorStats[p.doctor].contacted++;
  });

  // Converter para array e calcular taxas
  const doctorArray = Object.keys(doctorStats).map((doctor) => {
    const stats = doctorStats[doctor];
    return {
      doctor,
      total: stats.total,
      scheduled: stats.scheduled,
      completed: stats.completed,
      declined: stats.declined,
      contacted: stats.contacted,
      conversionRate:
        stats.total > 0
          ? ((stats.scheduled / stats.total) * 100).toFixed(1)
          : 0,
      contactRate:
        stats.total > 0
          ? ((stats.contacted / stats.total) * 100).toFixed(1)
          : 0,
    };
  });

  // Ordenar por total decrescente
  doctorArray.sort((a, b) => b.total - a.total);

  return {
    period,
    periodLabel: getPeriodLabel(period),
    total,
    requested,
    scheduled,
    completed,
    declined,
    conversionRate,
    completionRate,
    declineRate,
    contacted,
    contactRate,
    thanked,
    thankRate,
    critical,
    avgDays,
    statusDistribution,
    doctorStats: doctorArray,
    patients: filteredPatients,
  };
}

function getPeriodLabel(period) {
  const labels = {
    week: "Última Semana",
    month: "Último Mês",
    quarter: "Último Trimestre",
    year: "Último Ano",
    all: "Todo o Período",
  };
  return labels[period] || "Período Personalizado";
}

// Obter lista de médicos únicos
export function getUniqueDoctors() {
  const doctors = new Set();
  patients.forEach((p) => {
    if (p.doctor) doctors.add(p.doctor);
  });
  return Array.from(doctors).sort();
}

// Exportar relatório para CSV
export function exportReportToCSV(reportData) {
  let csv = "Relatório de Pacientes - Oftalmo 15\n\n";

  // Cabeçalho
  csv += `Período:,${reportData.periodLabel}\n`;
  csv += `Data de Geração:,${new Date().toLocaleString("pt-BR")}\n\n`;

  // Estatísticas gerais
  csv += "ESTATÍSTICAS GERAIS\n";
  csv += `Total de Pacientes,${reportData.total}\n`;
  csv += `Solicitaram Risco,${reportData.requested}\n`;
  csv += `Agendaram Cirurgia,${reportData.scheduled}\n`;
  csv += `Realizaram Cirurgia,${reportData.completed}\n`;
  csv += `Não Querem Operar,${reportData.declined}\n`;
  csv += `Taxa de Conversão,${reportData.conversionRate}%\n`;
  csv += `Taxa de Conclusão,${reportData.completionRate}%\n`;
  csv += `Pacientes Contatados,${reportData.contacted} (${reportData.contactRate}%)\n`;
  csv += `Agradecimentos Enviados,${reportData.thanked} (${reportData.thankRate}%)\n`;
  csv += `Pacientes Críticos (60+ dias),${reportData.critical}\n`;
  csv += `Tempo Médio (dias),${reportData.avgDays}\n\n`;

  // Distribuição por status
  csv += "DISTRIBUIÇÃO POR STATUS\n";
  csv += "Status,Quantidade,Percentual\n";
  reportData.statusDistribution.forEach((item) => {
    const percent =
      reportData.total > 0
        ? ((item.count / reportData.total) * 100).toFixed(1)
        : 0;
    csv += `${item.status},${item.count},${percent}%\n`;
  });
  csv += "\n";

  // Relatório por médico
  if (reportData.doctorStats.length > 0) {
    csv += "RELATÓRIO POR MÉDICO\n";
    csv +=
      "Médico,Total,Agendaram,Realizaram,Declinaram,Contatados,Taxa Conversão,Taxa Contato\n";
    reportData.doctorStats.forEach((doc) => {
      csv += `${doc.doctor},${doc.total},${doc.scheduled},${doc.completed},${doc.declined},${doc.contacted},${doc.conversionRate}%,${doc.contactRate}%\n`;
    });
  }

  return csv;
}

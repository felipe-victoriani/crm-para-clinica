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

// Responsáveis pelo acompanhamento (fonte única para todos os selects)
export const responsibles = ["Felipe", "Gabi"];

// Situações (valor gravado no banco — não alterar sem migrar os dados)
export const statuses = [
  "Paciente solicitado risco",
  "Paciente agendou cirurgia",
  "Paciente fez cirurgia",
  "Cirurgias Refrativas",
  "Paciente não quer operar",
];

// Rótulo amigável exibido na interface para cada situação
export const statusLabels = {
  "Paciente solicitado risco": "Pedido de risco cirúrgico",
  "Paciente agendou cirurgia": "Agendou cirurgia",
  "Paciente fez cirurgia": "Pós-cirurgia",
  "Cirurgias Refrativas": "Cirurgias Refrativas",
  "Paciente não quer operar": "Não vai operar",
};

// Retorna o rótulo amigável de uma situação (ou o próprio valor, se desconhecido)
export function statusLabel(status) {
  return statusLabels[status] || status;
}

// Quantos dias após a visita a ativação acontece por padrão
const DEFAULT_ACTIVATION_DAYS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Data base usada quando o paciente não tem ativação programada:
 * a data da visita (meia-noite local) ou, na falta dela, o cadastro.
 */
function activationBaseDate(patient) {
  if (patient.visitDate) {
    const visit = new Date(`${patient.visitDate}T00:00:00`).getTime();
    if (!isNaN(visit)) return visit;
  }
  return patient.createdAt || Date.now();
}

/** Data de ativação padrão (visita + 20 dias), em timestamp. */
export function defaultActivationDate(patient) {
  return activationBaseDate(patient) + DEFAULT_ACTIVATION_DAYS * DAY_MS;
}

// Situações que encerram o acompanhamento: não contam dias nem urgência
export const CLOSED_STATUSES = [
  "Paciente fez cirurgia",
  "Paciente não quer operar",
];

/** true enquanto o paciente ainda está em acompanhamento (follow-up). */
export function isFollowUpActive(patient) {
  return !CLOSED_STATUSES.includes(patient.status);
}

/**
 * Dias sem contato (desde o último contato, a visita ou o cadastro).
 * Retorna null para acompanhamento encerrado — não entra em nenhuma contagem.
 */
export function daysWithoutContact(patient) {
  if (!isFollowUpActive(patient)) return null;
  return daysSince(
    patient.lastContactAt || patient.visitDate || patient.createdAt,
  );
}

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

// Função removida - causava lentidão ao atualizar todos os pacientes no carregamento

// Obter pacientes
export function getPatients() {
  return patients;
}

// Normaliza nome para comparação (remove acentos, espaços extras, caixa)
function normalizeName(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Busca pacientes já cadastrados com o mesmo telefone ou mesmo nome,
// para alertar sobre possível cadastro duplicado (comum com múltiplos usuários)
export function findDuplicatePatients(name, phone, excludeId = null) {
  const normalizedName = normalizeName(name);
  const normalizedPhone = (phone || "").replace(/\D/g, "");

  return patients.filter((p) => {
    if (excludeId && p.id === excludeId) return false;

    const phoneMatches =
      normalizedPhone && p.phone && p.phone.replace(/\D/g, "") === normalizedPhone;
    const nameMatches =
      normalizedName && normalizeName(p.name) === normalizedName;

    return phoneMatches || nameMatches;
  });
}

// Adicionar paciente
export async function addPatient(patientData) {
  const now = Date.now();

  // Se não foi definida data de ativação, usar padrão (visita + 20 dias)
  let scheduledActivationDate = patientData.scheduledActivationDate;
  if (!scheduledActivationDate || isNaN(scheduledActivationDate)) {
    scheduledActivationDate = defaultActivationDate({
      visitDate: patientData.visitDate,
      createdAt: now,
    });
  }

  // Monta o registro final (sem logar dados do paciente — LGPD)
  const patient = {
    ...patientData,
    createdAt: now,
    lastContactAt: null,
    scheduledActivationDate,
  };

  try {
    if (isFirebaseConfigured) {
      // Firebase: push direto, o listener onValue atualizará automaticamente
      await dbPush(patient);
    } else {
      // localStorage: push e recarregar
      dbPush(patient);
      await loadPatients();
    }
  } catch (error) {
    console.error("addPatient - Erro ao salvar:", error);
    throw error;
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

/**
 * Restaura um paciente excluído (botão "Desfazer"), recriando o registro
 * no MESMO id para não quebrar referências.
 */
export async function restorePatient(patient) {
  const { id, ...data } = patient;
  await updatePatient(id, data);
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

// Calcular dias restantes até a ativação programada
export function daysRemaining(patient) {
  // Acompanhamento encerrado (operou ou não vai operar): sem contagem
  if (!isFollowUpActive(patient)) return null;

  // Sem data programada: usar o padrão (visita + 20 dias), igual ao cadastro
  const scheduledDate =
    patient.scheduledActivationDate || defaultActivationDate(patient);

  // Compara dias de calendário locais (meia-noite a meia-noite), sem
  // depender da hora atual — evita mostrar 1 dia a menos durante o dia
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(scheduledDate);
  target.setHours(0, 0, 0, 0);

  const days = Math.round((target - today) / DAY_MS);
  return Math.max(0, days); // Não retornar negativo
}

// Classificar urgência baseado em dias RESTANTES
export function getUrgency(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return "normal";
  if (daysLeft <= 3) return "vermelho"; // 3 dias ou menos = VERMELHO
  if (daysLeft <= 7) return "amarelo";
  if (daysLeft <= 14) return "laranja";
  return "normal";
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

  // Filtro "sem contato há X+ dias": só pacientes em acompanhamento
  if (minDays !== null) {
    filtered = filtered.filter((p) => {
      const d = daysWithoutContact(p);
      return d !== null && d >= minDays;
    });
  }

  // Ordenar por urgência (vermelho primeiro) - usando dias RESTANTES;
  // acompanhamentos encerrados vão para o fim
  const urgOrder = { vermelho: 4, laranja: 3, amarelo: 2, normal: 1 };
  const rank = (p) => (isFollowUpActive(p) ? urgOrder[getUrgency(daysRemaining(p))] : 0);
  filtered = [...filtered].sort((a, b) => rank(b) - rank(a));

  return filtered;
}

// Estatísticas do dashboard
export function getDashboardStats() {
  const total = patients.length;
  const byStatus = statuses.map(
    (status) => patients.filter((p) => p.status === status).length,
  );
  // Contagens de "sem contato" ignoram quem já operou ou não vai operar
  const countOver = (min) =>
    patients.filter((p) => (daysWithoutContact(p) ?? -1) >= min).length;
  const over30 = countOver(30);
  const over45 = countOver(45);
  const over60 = countOver(60);

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
    // Só pacientes em acompanhamento entram nas métricas de tempo
    const activePatients = doctorPatients.filter(isFollowUpActive);
    const over60 = activePatients.filter((p) => daysWithoutContact(p) >= 60).length;
    const scheduled = doctorPatients.filter(
      (p) => p.status === "Paciente agendou cirurgia",
    ).length;
    const conversionRate =
      total > 0 ? ((scheduled / total) * 100).toFixed(1) : 0;

    // Média de dias sem contato (só quem ainda está em acompanhamento)
    const avgDays =
      activePatients.length > 0
        ? Math.round(
            activePatients.reduce((sum, p) => sum + daysWithoutContact(p), 0) /
              activePatients.length,
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
  const refractive = filteredPatients.filter(
    (p) => p.status === "Cirurgias Refrativas",
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

  // Métricas de tempo só consideram quem ainda está em acompanhamento
  const activeDays = filteredPatients
    .filter(isFollowUpActive)
    .map(daysWithoutContact);

  // Pacientes críticos (60+ dias sem contato)
  const critical = activeDays.filter((d) => d >= 60).length;

  // Tempo médio sem contato
  const avgDays = activeDays.length
    ? Math.round(activeDays.reduce((sum, d) => sum + d, 0) / activeDays.length)
    : 0;

  // Distribuição por status (mesmos rótulos usados no resto da interface)
  const statusDistribution = [
    { status: statusLabel("Paciente solicitado risco"), count: requested, color: "green" },
    { status: statusLabel("Paciente agendou cirurgia"), count: scheduled, color: "blue" },
    { status: statusLabel("Paciente fez cirurgia"), count: completed, color: "gray" },
    { status: statusLabel("Cirurgias Refrativas"), count: refractive, color: "purple" },
    { status: statusLabel("Paciente não quer operar"), count: declined, color: "red" },
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
    week: "Últimos 7 dias",
    month: "Últimos 30 dias",
    quarter: "Últimos 3 meses",
    year: "Últimos 12 meses",
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

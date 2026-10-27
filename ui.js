// ui.js - Manipulação de DOM e interface do usuário
import {
  getPatients,
  filterPatients,
  getDashboardStats,
  getDoctorStats,
  generateAdvancedReport,
  getUniqueDoctors,
  exportReportToCSV,
  updatePatient,
  removePatient,
  restorePatient,
  addPatient,
  findDuplicatePatients,
  daysRemaining,
  daysWithoutContact,
  getUrgency,
  statuses,
  statusLabel,
  doctors,
  responsibles,
  defaultActivationDate,
} from "./patients.js";
import { populateSurgeryDateInEditModal } from "./surgery-form.js";
// Import circular seguro: só é usado dentro de funções, depois do carregamento
import {
  getPendingRemindersToday,
  sendPendingReminder,
  getUpcomingSurgeries,
  formatDateWithWeekday,
} from "./surgery-schedule.js";
import {
  escapeHtml,
  showToast,
  confirmDialog,
  promptDialog,
  toLocalISODate,
  dateInputToTimestamp,
  setupDialog,
} from "./utils.js";

// Reexporta o toast para módulos que já importavam daqui
export { showToast };

// Elementos DOM
const patientForm = document.getElementById("patientForm");
const newPatientPanel = document.getElementById("newPatientPanel");
const patientsList = document.getElementById("patientsList");
const activeFilters = document.getElementById("activeFilters");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const daysFilter = document.getElementById("daysFilter");
const doctorFilter = document.getElementById("doctorFilter");
const responsibleFilter = document.getElementById("responsibleFilter");
const dashboard = document.getElementById("dashboard");
const reportSection = document.getElementById("reportSection");

// Modal de edição
const editModal = document.getElementById("editModal");
const editModalTitle = document.getElementById("editModalTitle");
const editForm = document.getElementById("editForm");
const editResponsible = document.getElementById("editResponsible");
const editDoctor = document.getElementById("editDoctor");
const editPhone = document.getElementById("editPhone");
const editBirthDate = document.getElementById("editBirthDate");
const editConvenio = document.getElementById("editConvenio");
const editSurgeryType = document.getElementById("editSurgeryType");
const editStatus = document.getElementById("editStatus");
const editNotes = document.getElementById("editNotes");
const editScheduledActivation = document.getElementById(
  "editScheduledActivation",
);
let currentEditId = null;

// Modal de observações
const notesModal = document.getElementById("notesModal");
const notesTitle = document.getElementById("notesTitle");
const notesContent = document.getElementById("notesContent");

// Modal de preview do cartão de confirmação
const cardPreviewModal = document.getElementById("cardPreviewModal");

// Seções válidas da navegação por hash (#dashboard, #patients...)
const SECTIONS = [
  "dashboard",
  "patients",
  "reports",
  "surgery-schedule",
  "contact-lenses",
  "settings",
];

// ============================================================
// Selects com opções vindas de uma fonte única (patients.js)
// ============================================================

/**
 * Preenche todo <select data-options="doctors|responsibles|statuses">,
 * mantendo a opção placeholder já escrita no HTML.
 * Assim, adicionar um médico novo exige editar só patients.js.
 */
export function populateSelectOptions() {
  const sources = {
    doctors: doctors.map((d) => ({ value: d, label: d })),
    responsibles: responsibles.map((r) => ({ value: r, label: r })),
    statuses: statuses.map((s) => ({ value: s, label: statusLabel(s) })),
  };

  document.querySelectorAll("select[data-options]").forEach((select) => {
    const items = sources[select.dataset.options] || [];
    items.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
  });
}

// ============================================================
// Dashboard
// ============================================================

// Garante que a delegação de eventos do dashboard só é ligada uma vez
let dashboardListenersBound = false;

// Renderizar dashboard
export function renderDashboard() {
  const stats = getDashboardStats();
  const doctorStats = getDoctorStats();

  // Classe de cor do card por médico (fixa por nome, não pela ordem de urgência)
  const doctorClassByName = {
    "Dr. Dante": "doctor-dante",
    "Dr. Alberto": "doctor-alberto",
    "Dra. Fabiana": "doctor-fabiana",
  };

  dashboard.innerHTML = `
    ${buildTodaySection()}

    <div class="dashboard-section">
      <h3 class="section-title"><i class="fas fa-chart-bar" aria-hidden="true"></i> Visão Geral</h3>
      <div class="mini-cards-grid">
        <button type="button" class="mini-card clickable" data-filter="all">
          <span class="mini-card-icon" aria-hidden="true"><i class="fas fa-users"></i></span>
          <span class="mini-card-content">
            <span class="mini-card-value">${stats.total}</span>
            <span class="mini-card-label">Total</span>
          </span>
        </button>
        <div class="mini-card new-month">
          <span class="mini-card-icon" aria-hidden="true"><i class="fas fa-calendar-plus"></i></span>
          <div class="mini-card-content">
            <span class="mini-card-value">${stats.newThisMonth}</span>
            <span class="mini-card-label">Novos no mês</span>
          </div>
        </div>
        <button type="button" class="mini-card clickable" data-filter="over30">
          <span class="mini-card-icon" aria-hidden="true"><i class="fas fa-clock"></i></span>
          <span class="mini-card-content">
            <span class="mini-card-value">${stats.over30}</span>
            <span class="mini-card-label">Sem contato 30+ dias</span>
          </span>
        </button>
        <button type="button" class="mini-card clickable" data-filter="over45">
          <span class="mini-card-icon" aria-hidden="true"><i class="fas fa-triangle-exclamation"></i></span>
          <span class="mini-card-content">
            <span class="mini-card-value">${stats.over45}</span>
            <span class="mini-card-label">Sem contato 45+ dias</span>
          </span>
        </button>
        <button type="button" class="mini-card clickable ${stats.over60 > 0 ? "urgent" : ""}" data-filter="over60">
          <span class="mini-card-icon" aria-hidden="true"><i class="fas fa-bell"></i></span>
          <span class="mini-card-content">
            <span class="mini-card-value">${stats.over60}</span>
            <span class="mini-card-label">Sem contato 60+ dias</span>
          </span>
        </button>
      </div>
    </div>

    <div class="dashboard-section">
      <h3 class="section-title"><i class="fas fa-user-doctor" aria-hidden="true"></i> Médicos</h3>
      <div class="doctors-grid">
        ${doctorStats.map((doctor) => buildDoctorCard(doctor, doctorClassByName[doctor.name] || "")).join("")}
      </div>
    </div>
  `;

  // Delegação: um único listener cobre todos os cards, mesmo após re-render
  if (!dashboardListenersBound) {
    dashboard.addEventListener("click", handleDashboardClick);
    dashboardListenersBound = true;
  }
}

// Quantos itens cada bloco do "Hoje" lista antes do link "ver todos"
const TODAY_LIST_LIMIT = 5;

/**
 * Bloco "Hoje": reúne o que exige ação no dia (contatos atrasados,
 * lembretes da agenda e cirurgias próximas) no topo do dashboard.
 */
function buildTodaySection() {
  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // 1. Pacientes sem contato há 60+ dias, do mais antigo para o mais recente
  // (quem já operou ou não vai operar fica de fora: daysWithoutContact = null)
  const overdue = getPatients()
    .map((p) => ({ p, days: daysWithoutContact(p) }))
    .filter(({ days }) => days !== null && days >= 60)
    .sort((a, b) => b.days - a.days);

  const overdueRows = overdue
    .slice(0, TODAY_LIST_LIMIT)
    .map(
      ({ p, days }) => `
      <li class="today-row">
        <button type="button" class="today-row-main" data-action="edit" data-id="${escapeHtml(p.id)}">
          <span class="today-row-name">${escapeHtml(p.name)}</span>
          <span class="today-row-meta">${escapeHtml(p.doctor || "")} · ${days} dias</span>
        </button>
        <button type="button" class="icon-btn" data-action="whatsapp" data-id="${escapeHtml(p.id)}" aria-label="WhatsApp para ${escapeHtml(p.name)}" title="WhatsApp">
          <i class="fab fa-whatsapp" aria-hidden="true"></i>
        </button>
        <button type="button" class="icon-btn" data-action="contact-now" data-id="${escapeHtml(p.id)}" aria-label="Registrar contato de hoje com ${escapeHtml(p.name)}" title="Registrar contato de hoje">
          <i class="fas fa-check" aria-hidden="true"></i>
        </button>
      </li>`,
    )
    .join("");

  // 2. Lembretes da agenda que vencem hoje
  const reminders = getPendingRemindersToday();
  const reminderRows = reminders
    .map(({ patient, type }) => {
      const cardId = `${patient.id}-${patient._displayDate}`;
      const label = type === "friday" ? "Lembrete de sexta" : "Cartão de confirmação";
      return `
      <li class="today-row">
        <div class="today-row-main is-static">
          <span class="today-row-name">${escapeHtml(patient.name)}</span>
          <span class="today-row-meta">${label}</span>
        </div>
        <button type="button" class="btn-small" data-dash-send="${escapeHtml(cardId)}" data-type="${type}">
          <i class="${type === "friday" ? "fab fa-whatsapp" : "fas fa-id-card"}" aria-hidden="true"></i> Enviar
        </button>
      </li>`;
    })
    .join("");

  // 3. Cirurgias nos próximos 7 dias
  const upcoming = getUpcomingSurgeries(7);
  const upcomingRows = upcoming
    .slice(0, TODAY_LIST_LIMIT)
    .map(({ patient }) => {
      const info = formatDateWithWeekday(patient._displayDate);
      return `
      <li class="today-row">
        <button type="button" class="today-row-main" data-action="edit" data-id="${escapeHtml(patient.id)}">
          <span class="today-row-name">${escapeHtml(patient.name)}</span>
          <span class="today-row-meta">${info.short.slice(0, 5)} · ${info.dayName} · ${escapeHtml(patient.surgeryTime || "07h15")}</span>
        </button>
      </li>`;
    })
    .join("");

  // Estado vazio de cada bloco (positivo: nada pendente)
  const empty = (text) =>
    `<p class="today-empty"><i class="fas fa-circle-check" aria-hidden="true"></i> ${text}</p>`;

  return `
    <div class="dashboard-section">
      <div class="today-heading">
        <h3 class="section-title">Hoje</h3>
        <span class="today-date">${todayLabel}</span>
      </div>
      <div class="today-grid">
        <article class="today-card ${overdue.length ? "is-alert" : ""}">
          <div class="today-card-header">
            <span class="today-card-label">Sem contato há 60+ dias</span>
            <span class="today-card-count">${overdue.length}</span>
          </div>
          ${overdue.length ? `<ul class="today-list">${overdueRows}</ul>` : empty("Todos os pacientes foram contatados recentemente.")}
          ${overdue.length > TODAY_LIST_LIMIT ? `<button type="button" class="today-more" data-filter="over60">Ver todos (${overdue.length})</button>` : ""}
        </article>

        <article class="today-card ${reminders.length ? "is-warning" : ""}">
          <div class="today-card-header">
            <span class="today-card-label">Lembretes da agenda cirúrgica</span>
            <span class="today-card-count">${reminders.length}</span>
          </div>
          ${reminders.length ? `<ul class="today-list">${reminderRows}</ul>` : empty("Nenhum lembrete pendente hoje.")}
        </article>

        <article class="today-card">
          <div class="today-card-header">
            <span class="today-card-label">Cirurgias nos próximos 7 dias</span>
            <span class="today-card-count">${upcoming.length}</span>
          </div>
          ${upcoming.length ? `<ul class="today-list">${upcomingRows}</ul>` : empty("Nenhuma cirurgia nos próximos 7 dias.")}
          <a class="today-more" href="#surgery-schedule">Abrir agenda</a>
        </article>
      </div>
    </div>
  `;
}

// Monta o card de um médico com badges clicáveis por situação
function buildDoctorCard(doctor, doctorClass) {
  const name = escapeHtml(doctor.name);

  // Badges por situação: ícone + quantidade, rótulo acessível completo
  const badgeDefs = [
    { cls: "badge-risk", icon: "fa-stethoscope" },
    { cls: "badge-scheduled", icon: "fa-calendar-check" },
    { cls: "badge-surgery", icon: "fa-circle-check" },
    { cls: "badge-refractive", icon: "fa-eye" },
    { cls: "badge-no-surgery", icon: "fa-ban" },
  ];
  const badges = statuses
    .map((status, i) => {
      const label = statusLabel(status);
      return `
        <button type="button" class="badge ${badgeDefs[i].cls} clickable"
          data-filter-doctor="${name}" data-filter-status="${escapeHtml(status)}"
          title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}: ${doctor.byStatus[i]}">
          <i class="fas ${badgeDefs[i].icon}" aria-hidden="true"></i> ${doctor.byStatus[i]}
        </button>`;
    })
    .join("");

  return `
    <div class="doctor-card ${doctorClass} ${doctor.over60 > 0 ? "has-urgent" : ""} ${doctor.total === 0 ? "no-patients" : ""}" data-doctor="${name}">
      <div class="doctor-header">
        <div class="doctor-title">
          <span class="doctor-icon" aria-hidden="true"><i class="fas fa-user-doctor"></i></span>
          <h4><button type="button" class="doctor-name-btn" data-filter-doctor="${name}">${name}</button></h4>
        </div>
        <span class="doctor-total">${doctor.total} paciente${doctor.total !== 1 ? "s" : ""}</span>
      </div>
      ${
        doctor.total === 0
          ? `<div class="no-patients-msg"><span><i class="fas fa-inbox" aria-hidden="true"></i> Nenhum paciente atribuído</span></div>`
          : `
      <div class="doctor-stats">
        <div class="stat-badges">${badges}</div>
        ${
          doctor.over60 > 0
            ? `<div class="urgent-alert pulse"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ${doctor.over60} paciente${doctor.over60 > 1 ? "s" : ""} sem contato há 60+ dias</div>`
            : ""
        }
        <div class="doctor-metrics">
          <div class="metric">
            <span class="metric-label">Média sem contato:</span>
            <span class="metric-value">${doctor.avgDays} dias</span>
          </div>
          <div class="metric">
            <span class="metric-label">Conversão:</span>
            <span class="metric-value conversion">${doctor.conversionRate}%</span>
          </div>
        </div>
      </div>`
      }
    </div>
  `;
}

// Trata cliques no dashboard: mini-cards, badges, nome do médico ou o card inteiro
async function handleDashboardClick(e) {
  // Ações de paciente no bloco "Hoje" (editar, WhatsApp, registrar contato)
  if (e.target.closest("[data-action]")) {
    handlePatientAction(e);
    return;
  }

  // Envio de lembrete direto do dashboard
  const sendBtn = e.target.closest("[data-dash-send]");
  if (sendBtn) {
    sendBtn.disabled = true;
    try {
      await sendPendingReminder(sendBtn.dataset.dashSend, sendBtn.dataset.type);
      renderDashboard();
    } catch (error) {
      console.error("Erro ao enviar lembrete pelo dashboard:", error);
      showToast(error.message || "Erro ao enviar lembrete", "error");
      sendBtn.disabled = false;
    }
    return;
  }

  // Mini-card de visão geral (Total, 30+, 45+, 60+) e "Ver todos"
  const miniCard = e.target.closest("[data-filter]");
  if (miniCard) {
    showFilteredPatients({ preset: miniCard.dataset.filter });
    return;
  }

  // Badge de situação ou botão com nome do médico
  const filterBtn = e.target.closest("[data-filter-doctor]");
  if (filterBtn) {
    showFilteredPatients({
      doctor: filterBtn.dataset.filterDoctor,
      status: filterBtn.dataset.filterStatus || "",
    });
    return;
  }

  // Clique em qualquer área do card do médico (atalho de mouse)
  const doctorCard = e.target.closest(".doctor-card");
  if (doctorCard) {
    showFilteredPatients({ doctor: doctorCard.dataset.doctor });
  }
}

/**
 * Vai para a seção de pacientes com os filtros indicados já aplicados.
 * preset: "all" | "over30" | "over45" | "over60"
 */
function showFilteredPatients({ preset = null, doctor = "", status = "" }) {
  // Sempre parte de filtros limpos para o resultado ser previsível
  searchInput.value = "";
  doctorFilter.value = doctor;
  responsibleFilter.value = "";
  statusFilter.value = status;
  daysFilter.value = "";

  // Presets de tempo sem contato
  const daysByPreset = { over30: "30", over45: "45", over60: "60" };
  if (preset && daysByPreset[preset]) {
    daysFilter.value = daysByPreset[preset];
  }

  navigateTo("patients");
  renderPatients();
}

// ============================================================
// Cards e lista de pacientes
// ============================================================

// Formata telefone (só dígitos) para exibição
function formatPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

// Texto do badge de ativação, explícito para não confundir com "dias sem contato"
function activationBadgeText(daysLeft) {
  if (daysLeft === 0) return "Ativar hoje";
  if (daysLeft === 1) return "Ativação amanhã";
  return `Ativação em ${daysLeft} dias`;
}

// Helper: construir o card de paciente (todo dado dinâmico passa por escapeHtml)
function buildPatientCard(patient) {
  const daysLeft = daysRemaining(patient);
  const phoneDisplay = patient.phone ? formatPhone(patient.phone) : "";
  const status = patient.status || "";
  const statusClass = status.replace(/\s+/g, "-").toLowerCase();
  const id = escapeHtml(patient.id);
  const name = escapeHtml(patient.name);

  // Cor do badge conforme dias RESTANTES até a ativação
  const urgencyLevel = getUrgency(daysLeft);
  const daysClass =
    {
      vermelho: "critical",
      amarelo: "medium",
      laranja: "high",
    }[urgencyLevel] || "low";

  // Acompanhamento encerrado: selo neutro no lugar da contagem de dias
  let badge;
  if (status === "Paciente fez cirurgia") {
    badge = `<span class="urgency-badge badge-operated"><i class="fas fa-circle-check" aria-hidden="true"></i> Operado(a)</span>`;
  } else if (status === "Paciente não quer operar") {
    badge = `<span class="urgency-badge badge-operated"><i class="fas fa-ban" aria-hidden="true"></i> Encerrado</span>`;
  } else {
    badge = `<span class="urgency-badge ${daysClass}">${activationBadgeText(daysLeft)}</span>`;
  }

  // Linha opcional reutilizável
  const infoRow = (label, value) =>
    value
      ? `<div class="patient-info-row"><span class="info-label">${label}:</span><span>${escapeHtml(value)}</span></div>`
      : "";

  const lastContact = patient.lastContactAt
    ? new Date(patient.lastContactAt).toLocaleDateString("pt-BR")
    : "";

  return `
    <article class="patient-card status-${escapeHtml(statusClass)}" data-status="${escapeHtml(status)}" data-id="${id}">
      <div class="patient-card-header">
        <div class="patient-header-left">
          <h3 class="patient-name">${name}${patient.notes ? ' <i class="fas fa-note-sticky note-flag" title="Tem observações" aria-label="Tem observações"></i>' : ""}</h3>
          <span class="patient-status">${escapeHtml(statusLabel(status))}</span>
        </div>
        ${badge}
      </div>

      <div class="patient-card-body">
        ${infoRow("Médico", patient.doctor)}
        ${infoRow("Responsável", patient.responsible)}
        ${infoRow("Cirurgia", patient.surgeryType)}
        ${infoRow("Telefone", phoneDisplay)}
        ${infoRow("Último contato", lastContact)}
      </div>

      <div class="patient-card-actions">
        <!-- Ações frequentes visíveis; o restante fica no menu "Mais" -->
        <button type="button" class="btn-action btn-action-primary" data-action="whatsapp" data-id="${id}" aria-label="Enviar WhatsApp para ${name}">
          <i class="fab fa-whatsapp" aria-hidden="true"></i> <span>WhatsApp</span>
        </button>
        <button type="button" class="btn-action ${patient.lastContactAt ? "btn-contacted" : ""}" data-action="contact" data-id="${id}"
          title="${patient.lastContactAt ? "Contato realizado (clique para desmarcar)" : "Registrar contato"}"
          aria-label="${patient.lastContactAt ? "Desmarcar contato" : "Registrar contato"} de ${name}"
          aria-pressed="${patient.lastContactAt ? "true" : "false"}">
          <i class="fas ${patient.lastContactAt ? "fa-check-circle" : "fa-phone-alt"}" aria-hidden="true"></i>
          <span>${patient.lastContactAt ? "Contatado" : "Contato"}</span>
        </button>
        <button type="button" class="btn-action btn-action-icon" data-action="edit" data-id="${id}" title="Editar" aria-label="Editar ${name}">
          <i class="fas fa-pen" aria-hidden="true"></i>
        </button>
        <details class="card-menu">
          <summary class="btn-action btn-action-icon" title="Mais ações" aria-label="Mais ações para ${name}">
            <i class="fas fa-ellipsis" aria-hidden="true"></i>
          </summary>
          <div class="card-menu-list">
            <button type="button" data-action="thanks" data-id="${id}">
              <i class="fas fa-heart" aria-hidden="true"></i>
              ${patient.thankYouSentAt ? "Reenviar agradecimento" : "Enviar agradecimento"}
            </button>
            ${
              patient.notes
                ? `<button type="button" data-action="notes" data-id="${id}"><i class="fas fa-note-sticky" aria-hidden="true"></i> Ver observações</button>`
                : ""
            }
            <button type="button" class="is-danger" data-action="delete" data-id="${id}">
              <i class="fas fa-trash" aria-hidden="true"></i> Excluir
            </button>
          </div>
        </details>
      </div>
    </article>
  `;
}

// Função para ordenar pacientes
function sortPatients(patients, sortBy) {
  const sorted = [...patients];

  switch (sortBy) {
    case "name":
      return sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    case "recent":
      return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    case "oldest":
      return sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    case "doctor":
      return sorted.sort((a, b) => (a.doctor || "").localeCompare(b.doctor || ""));
    case "urgency":
    default:
      // Já vem ordenado por urgência do filterPatients
      return sorted;
  }
}

// Atualizar contador de pacientes
function updatePatientsCounter(count) {
  const counter = document.getElementById("patientsCounter");
  if (counter) {
    counter.textContent = `(${count})`;
  }
}

// Lê do localStorage com fallback (modo privado pode bloquear o acesso)
function readPref(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

// Grava no localStorage ignorando falhas (preferência não é crítica)
function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sem persistência: a preferência vale só até recarregar
  }
}

/**
 * Mostra os filtros ativos como chips removíveis acima da lista,
 * para o usuário entender por que a lista está reduzida.
 */
function renderActiveFilters() {
  const chips = [];

  if (searchInput.value.trim()) {
    chips.push({ field: "searchInput", label: `Nome: "${searchInput.value.trim()}"` });
  }
  if (doctorFilter.value) {
    chips.push({ field: "doctorFilter", label: doctorFilter.value });
  }
  if (responsibleFilter.value) {
    chips.push({ field: "responsibleFilter", label: `Resp.: ${responsibleFilter.value}` });
  }
  if (statusFilter.value) {
    chips.push({ field: "statusFilter", label: statusLabel(statusFilter.value) });
  }
  if (daysFilter.value) {
    chips.push({ field: "daysFilter", label: `Sem contato ${daysFilter.value}+ dias` });
  }

  // Contador no botão "Filtros" (só filtros do painel, sem a busca)
  const panelCount = chips.filter((c) => c.field !== "searchInput").length;
  const filtersCount = document.getElementById("filtersCount");
  filtersCount.hidden = panelCount === 0;
  filtersCount.textContent = panelCount;

  activeFilters.hidden = chips.length === 0;
  activeFilters.innerHTML = chips
    .map(
      (chip) => `
      <button type="button" class="filter-chip" data-clear="${chip.field}" aria-label="Remover filtro ${escapeHtml(chip.label)}">
        ${escapeHtml(chip.label)} <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>`,
    )
    .join("");
}

// Renderizar lista de pacientes
export function renderPatients() {
  const search = searchInput.value;
  const status = statusFilter.value;
  const days = daysFilter.value ? parseInt(daysFilter.value, 10) : null;
  const doctor = doctorFilter.value;
  const responsible = responsibleFilter.value;
  let filtered = filterPatients(search, status, days, doctor, responsible);

  // Aplicar ordenação salva
  const sortBy = readPref("patientsSortBy", "urgency");
  filtered = sortPatients(filtered, sortBy);

  updatePatientsCounter(filtered.length);
  renderActiveFilters();

  // Modo de visualização (grade/lista)
  const viewMode = readPref("patientsViewMode", "grid");
  patientsList.className =
    viewMode === "list" ? "patients-list list-view" : "patients-list grid-view";

  // Estado vazio reaproveitado nos dois modos
  const emptyState = `
    <div class="empty-state">
      <i class="fas fa-user-group" aria-hidden="true"></i>
      <p>Nenhum paciente encontrado</p>
      <span>Tente ajustar os filtros ou cadastre um novo paciente.</span>
    </div>
  `;

  // Com situação selecionada: lista simples
  if (status) {
    patientsList.innerHTML = filtered.length
      ? filtered.map(buildPatientCard).join("")
      : emptyState;
    return;
  }

  // Sem situação selecionada: agrupar por situação (respeitando a ordenação)
  const groupsHtml = statuses
    .map((st) => {
      const group = filtered.filter((p) => p.status === st);
      if (group.length === 0) return "";
      return `
        <section class="status-group" data-status-group="${escapeHtml(st.replace(/\s+/g, "-").toLowerCase())}">
          <h3 class="status-title">${escapeHtml(statusLabel(st))} <span class="status-count">(${group.length})</span></h3>
          <div class="status-group-cards">${group.map(buildPatientCard).join("")}</div>
        </section>
      `;
    })
    .join("");

  patientsList.innerHTML = groupsHtml || emptyState;
}

// ============================================================
// Ações dos cards de paciente
// ============================================================

// Obter configurações salvas (código do país e DDD)
function getSettings() {
  const defaults = { countryCode: "55", areaCode: "67" };
  try {
    const raw = localStorage.getItem("crm_settings");
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

/**
 * Monta o número completo (país + DDD + número) só com dígitos.
 * Retorna "" se o paciente não tiver telefone.
 */
export function buildFullPhone(phone) {
  const settings = getSettings();
  const cc = String(settings.countryCode || "55").replace(/\D/g, "");
  const ddd = String(settings.areaCode || "").replace(/\D/g, "");

  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";

  // Prefixar DDD quando o número parece não ter (8/9 dígitos)
  if (ddd && digits.length <= 9 && !digits.startsWith(ddd)) {
    digits = ddd + digits;
  }
  return cc + digits;
}

// Abre o WhatsApp Web (QR) já com a mensagem preenchida
function openWhatsAppWeb(fullNumber, message) {
  const url = `https://web.whatsapp.com/send?phone=${fullNumber}&text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener");
}

// Mensagem de follow-up para paciente que ainda não deu retorno
function sendFollowUp(patient) {
  const fullNumber = buildFullPhone(patient.phone);
  if (!fullNumber) {
    showToast("Este paciente não possui telefone cadastrado.", "error");
    return;
  }

  const message = `Bom dia! Aqui é da equipe da Oftalmo 15, verificamos que o(a) Sr(a) ${patient.name} tinha realizado uma consulta com ${patient.doctor}, e ele(a) sugeriu uma cirurgia, como não tivemos um retorno, entrei em contato para saber se está tudo bem e caso queira dar prosseguimento estamos à disposição. Lembrando! Que independente da cirurgia é recomendado retorno anual ao médico oftalmologista.`;
  openWhatsAppWeb(fullNumber, message);
}

// Enviar mensagem de agradecimento pós-cirurgia e registrar o envio
async function sendThankYou(patient) {
  const fullNumber = buildFullPhone(patient.phone);
  if (!fullNumber) {
    showToast("Este paciente não possui telefone válido cadastrado.", "error");
    return;
  }

  // Garantir nome do médico (pede no diálogo se faltar)
  let docName = (patient.doctor || "").trim();
  if (!docName) {
    docName =
      (await promptDialog({
        title: "Nome do médico",
        label: "Informe o nome do médico para a mensagem:",
      })) || "";
    if (!docName) return;
  }

  const message = [
    `Olá, ${patient.name},`,
    "",
    "A equipe da Oftalmo 15 agradece a confiança em nosso trabalho.",
    "Sua cirurgia foi concluída com sucesso, e ficamos muito felizes em fazer parte desse momento tão importante.",
    "",
    `O procedimento foi realizado pelo Dr.(a) ${docName}, e agora inicia-se a fase de recuperação.`,
    "",
    "Qualquer dúvida, desconforto ou necessidade, estamos sempre à disposição para te ajudar.",
    "",
    "Desejamos uma recuperação tranquila e uma nova fase com mais qualidade de vida!",
    "",
    "Um abraço,",
    "Equipe Oftalmo 15",
  ].join("\n");

  openWhatsAppWeb(fullNumber, message);
  await updatePatient(patient.id, { thankYouSentAt: Date.now() });
  refreshPatientViews();
}

// Marca/desmarca o registro de contato
async function toggleContact(patient) {
  const newContactAt = patient.lastContactAt ? null : Date.now();
  await updatePatient(patient.id, { lastContactAt: newContactAt });
  refreshPatientViews();
  showToast(newContactAt ? "Contato registrado." : "Registro de contato removido.", "info");
}

// Exclui o paciente com opção de desfazer (sem confirm() bloqueante)
async function deletePatientWithUndo(patient) {
  const snapshot = structuredClone(patient);
  await removePatient(patient.id);
  refreshPatientViews();

  showToast(`${patient.name} foi excluído(a).`, "info", {
    label: "Desfazer",
    onClick: async () => {
      try {
        await restorePatient(snapshot);
        refreshPatientViews();
        showToast("Exclusão desfeita.");
      } catch (error) {
        console.error("Erro ao restaurar paciente:", error);
        showToast("Não foi possível desfazer a exclusão.", "error");
      }
    },
  });
}

// Abre o modal com as observações do paciente (texto puro)
function viewNotes(patient) {
  notesTitle.textContent = `Observações — ${patient.name}`;
  notesContent.textContent = patient.notes || "";
  notesModal.showModal();
}

/**
 * Abre o modal de edição preenchido com os dados do paciente.
 * Exportado para a Agenda Cirúrgica ("Ver Paciente").
 */
export function openEditModal(id) {
  const patient = getPatients().find((p) => p.id === id);
  if (!patient) {
    showToast("Paciente não encontrado.", "error");
    return;
  }

  currentEditId = id;
  editModalTitle.textContent = `Editar — ${patient.name}`;
  editResponsible.value = patient.responsible || "";
  editDoctor.value = patient.doctor || "";
  editPhone.value = patient.phone || "";
  editBirthDate.value = patient.birthDate || "";
  editConvenio.value = patient.convenio || "";
  editSurgeryType.value = patient.surgeryType || "";
  editStatus.value = patient.status;
  editNotes.value = patient.notes || "";

  // Data de ativação: a programada ou o padrão (visita + 20 dias), no fuso local
  editScheduledActivation.value = toLocalISODate(
    patient.scheduledActivationDate || defaultActivationDate(patient),
  );

  // Preencher data da cirurgia
  populateSurgeryDateInEditModal(patient);

  editModal.showModal();
}

// Delegação: um listener na lista trata todos os botões de ação dos cards
async function handlePatientAction(e) {
  const button = e.target.closest("[data-action]");
  if (!button) return;

  const patient = getPatients().find((p) => p.id === button.dataset.id);
  if (!patient) return;

  // Fecha o menu "Mais" de onde a ação veio
  button.closest(".card-menu")?.removeAttribute("open");

  try {
    switch (button.dataset.action) {
      case "whatsapp":
        sendFollowUp(patient);
        break;
      case "thanks":
        await sendThankYou(patient);
        break;
      case "contact":
        await toggleContact(patient);
        break;
      case "contact-now":
        // Sempre registra contato de hoje (no dashboard não pode desmarcar)
        await updatePatient(patient.id, { lastContactAt: Date.now() });
        refreshPatientViews();
        showToast(`Contato com ${patient.name} registrado.`);
        break;
      case "notes":
        viewNotes(patient);
        break;
      case "edit":
        openEditModal(patient.id);
        break;
      case "delete":
        await deletePatientWithUndo(patient);
        break;
    }
  } catch (error) {
    console.error("Erro na ação do paciente:", error);
    showToast("Não foi possível concluir a ação. Tente novamente.", "error");
  }
}

// Re-renderiza as telas que dependem da lista de pacientes
function refreshPatientViews() {
  renderDashboard();
  renderPatients();
  if (typeof window.refreshSurgerySchedule === "function") {
    window.refreshSurgerySchedule();
  }
}

// ============================================================
// Navegação por hash (#patients etc.) — F5 e botão Voltar funcionam
// ============================================================

/** Navega para uma seção atualizando a URL (cria entrada no histórico). */
export function navigateTo(sectionName) {
  if (location.hash === `#${sectionName}`) {
    showSection(sectionName);
  } else {
    location.hash = sectionName;
  }
}

/** Mostra a seção indicada na URL atual (ou o dashboard). */
export function showSectionFromHash() {
  const fromHash = location.hash.replace("#", "");
  showSection(SECTIONS.includes(fromHash) ? fromHash : "dashboard");
}

// ============================================================
// Configuração dos event listeners
// ============================================================

export function setupEventListeners() {
  setupTheme();
  setupMobileMenu();
  setupPatientForm();
  setupFilters();
  setupViewControls();
  setupReports();
  setupSettings();
  setupModals();

  // Ações dos cards (delegação: funciona após qualquer re-render)
  patientsList.addEventListener("click", handlePatientAction);

  // Menu "Mais" dos cards: fecha ao clicar fora, ao abrir outro ou com Esc
  document.addEventListener("click", (e) => {
    document.querySelectorAll(".card-menu[open]").forEach((menu) => {
      if (!menu.contains(e.target)) menu.removeAttribute("open");
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = document.querySelector(".card-menu[open]");
    if (open) {
      open.removeAttribute("open");
      open.querySelector("summary").focus();
    }
  });

  // Navegação: links da sidebar só mudam o hash; o hashchange troca a seção
  window.addEventListener("hashchange", showSectionFromHash);
}

// Toggle de tema (a classe fica no <html>, aplicada cedo por theme-init.js)
function setupTheme() {
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = themeToggle.querySelector("i");
  const root = document.documentElement;

  // Ícone mostra o tema para o qual o clique vai mudar
  const syncIcon = () => {
    const isDark = root.classList.contains("dark-theme");
    themeIcon.className = isDark ? "fas fa-sun" : "fas fa-moon";
  };
  syncIcon();

  themeToggle.addEventListener("click", () => {
    root.classList.toggle("dark-theme");
    syncIcon();
    writePref("theme", root.classList.contains("dark-theme") ? "dark" : "light");
  });
}

// Menu hamburguer mobile
function setupMobileMenu() {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");

  // Overlay escuro atrás do menu aberto
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  document.body.appendChild(overlay);

  // Abre/fecha mantendo aria-expanded em sincronia
  const setOpen = (open) => {
    sidebar.classList.toggle("active", open);
    overlay.classList.toggle("active", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  };

  menuToggle.addEventListener("click", () =>
    setOpen(!sidebar.classList.contains("active")),
  );
  overlay.addEventListener("click", () => setOpen(false));

  // Fecha com Esc e ao escolher um item no mobile
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("active")) setOpen(false);
  });
  sidebar.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) setOpen(false);
    });
  });
}

// Formulário de cadastro de paciente
function setupPatientForm() {
  patientForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(patientForm);
    const submitBtn = patientForm.querySelector('button[type="submit"]');

    const patient = {
      name: formData.get("name").trim(),
      visitDate: formData.get("visitDate"),
      birthDate: formData.get("birthDate") || "",
      convenio: formData.get("convenio") || "",
      doctor: formData.get("doctor"),
      responsible: formData.get("responsible") || "",
      surgeryType: formData.get("surgeryType"),
      notes: formData.get("notes"),
      phone: formData.get("phone").replace(/\D/g, ""),
      status: formData.get("status"),
      // Data opcional convertida no fuso local
      scheduledActivationDate: dateInputToTimestamp(formData.get("scheduledActivation")),
      surgeryDate: formData.get("surgeryDate") || null,
      surgeryDate2: formData.get("surgeryDate2") || null,
      eye: formData.get("eye") || "",
      qty: formData.get("qty") || "",
      lio: formData.get("lio") || "",
      eye2: formData.get("eye2") || "",
      qty2: formData.get("qty2") || "",
      lio2: formData.get("lio2") || "",
    };

    // Alerta de possível duplicidade (mesmo nome ou telefone)
    const duplicates = findDuplicatePatients(patient.name, patient.phone);
    if (duplicates.length > 0) {
      const lista = duplicates
        .map((p) => `• ${p.name} — ${statusLabel(p.status)}${p.doctor ? ` (${p.doctor})` : ""}`)
        .join("\n");
      const proceed = await confirmDialog({
        title: "Possível cadastro duplicado",
        message: `Já existe cadastro com o mesmo nome ou telefone:\n\n${lista}\n\nDeseja cadastrar mesmo assim?`,
        confirmLabel: "Cadastrar mesmo assim",
      });
      if (!proceed) return;
    }

    // Evita duplo envio enquanto salva
    submitBtn.disabled = true;
    try {
      await addPatient(patient);
      patientForm.reset(); // dispara "reset": surgery-form.js esconde os campos de cirurgia
      newPatientPanel.open = false;
      refreshPatientViews();
      showToast("Paciente cadastrado com sucesso!");
    } catch (error) {
      console.error("Erro ao cadastrar paciente:", error);
      showToast("Erro ao cadastrar paciente. Verifique a conexão e tente novamente.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Ao abrir o painel de cadastro, foca no primeiro campo
  newPatientPanel.addEventListener("toggle", () => {
    if (newPatientPanel.open) document.getElementById("pName").focus();
  });
}

// Filtros da lista (busca com debounce) e chips removíveis
function setupFilters() {
  // Debounce simples para não re-renderizar a cada tecla
  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderPatients, 300);
  });

  [statusFilter, daysFilter, doctorFilter, responsibleFilter].forEach((el) =>
    el.addEventListener("change", renderPatients),
  );

  // Botão Limpar Filtros
  document.getElementById("clearFilters").addEventListener("click", () => {
    [searchInput, statusFilter, daysFilter, doctorFilter, responsibleFilter].forEach(
      (el) => (el.value = ""),
    );
    renderPatients();
  });

  // Remover um filtro individual pelo chip
  activeFilters.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-clear]");
    if (!chip) return;
    const field = document.getElementById(chip.dataset.clear);
    if (field) field.value = "";
    renderPatients();
  });

  // Botão "Filtros": mostra/esconde o painel de selects
  const filtersToggle = document.getElementById("filtersToggle");
  const filtersPanel = document.getElementById("filtersPanel");
  filtersToggle.addEventListener("click", () => {
    const open = filtersPanel.hidden;
    filtersPanel.hidden = !open;
    filtersToggle.setAttribute("aria-expanded", String(open));
    if (open) filtersPanel.querySelector("select").focus();
  });

  // Busca global do header: leva para Pacientes já filtrado
  const globalSearch = document.getElementById("globalSearch");
  let globalTimer;
  globalSearch.addEventListener("input", () => {
    clearTimeout(globalTimer);
    globalTimer = setTimeout(() => {
      searchInput.value = globalSearch.value;
      if (globalSearch.value.trim()) navigateTo("patients");
      renderPatients();
    }, 250);
  });
  // Enter: vai para a lista e passa o foco para o primeiro resultado
  globalSearch.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    searchInput.value = globalSearch.value;
    navigateTo("patients");
    renderPatients();
    patientsList.querySelector("[data-action]")?.focus();
  });

  // Atalho "/" foca a busca global (fora de campos de texto)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey) return;
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    e.preventDefault();
    globalSearch.focus();
  });
}

// Controles de visualização (grade/lista) e ordenação
function setupViewControls() {
  const viewGrid = document.getElementById("viewGrid");
  const viewList = document.getElementById("viewList");
  const sortSelect = document.getElementById("sortSelect");

  // Marca visual + aria-pressed do modo escolhido
  const setViewMode = (mode) => {
    writePref("patientsViewMode", mode);
    viewGrid.classList.toggle("active", mode === "grid");
    viewList.classList.toggle("active", mode === "list");
    viewGrid.setAttribute("aria-pressed", String(mode === "grid"));
    viewList.setAttribute("aria-pressed", String(mode === "list"));
  };

  // Restaurar preferências salvas
  setViewMode(readPref("patientsViewMode", "grid"));
  sortSelect.value = readPref("patientsSortBy", "urgency");

  viewGrid.addEventListener("click", () => {
    setViewMode("grid");
    renderPatients();
  });
  viewList.addEventListener("click", () => {
    setViewMode("list");
    renderPatients();
  });
  sortSelect.addEventListener("change", () => {
    writePref("patientsSortBy", sortSelect.value);
    renderPatients();
  });
}

// Relatórios: geração em tela e exportação CSV
function setupReports() {
  // Preenche o dropdown de médicos mantendo a seleção atual
  function initReportDoctors() {
    const reportDoctor = document.getElementById("reportDoctor");
    const selected = reportDoctor.value;
    reportDoctor.innerHTML = '<option value="all">Todos</option>';
    getUniqueDoctors().forEach((doc) => {
      const option = document.createElement("option");
      option.value = doc;
      option.textContent = doc;
      reportDoctor.appendChild(option);
    });
    if ([...reportDoctor.options].some((o) => o.value === selected)) {
      reportDoctor.value = selected;
    }
  }

  // Renderizar relatório avançado
  function renderAdvancedReport() {
    const period = document.getElementById("reportPeriod").value;
    const doctor = document.getElementById("reportDoctor").value;
    const report = generateAdvancedReport(period, doctor);

    // Card de indicador reutilizável
    const card = (title, value, description, extraClass = "") => `
      <div class="report-card">
        <div class="report-card-title">${title}</div>
        <div class="report-card-value ${extraClass}">${value}</div>
        <div class="report-card-description">${description}</div>
      </div>`;

    reportSection.innerHTML = `
      <div class="report-content">
        <div class="report-header">
          <h3>Relatório detalhado</h3>
          <p class="report-period">${escapeHtml(report.periodLabel)}${doctor !== "all" ? ` — ${escapeHtml(doctor)}` : ""}</p>
        </div>

        <div class="report-stats">
          ${card("Total de pacientes", report.total, "Cadastrados no período")}
          ${card("Taxa de conversão", `${report.conversionRate}%`, `${report.scheduled} agendaram cirurgia`)}
          ${card("Taxa de conclusão", `${report.completionRate}%`, `${report.completed} realizaram cirurgia`)}
          ${card("Tempo médio sem contato", report.avgDays, "dias")}
          ${card("Taxa de contato", `${report.contactRate}%`, `${report.contacted} pacientes contatados`)}
          ${card("Pacientes críticos", report.critical, "60+ dias sem contato", "is-critical")}
        </div>

        <div class="report-details">
          <h4 class="report-section-title">Distribuição por situação</h4>
          <table class="report-table">
            <thead>
              <tr><th scope="col">Situação</th><th scope="col">Quantidade</th><th scope="col">Percentual</th></tr>
            </thead>
            <tbody>
              ${report.statusDistribution
                .map(
                  (item) => `
                <tr>
                  <td><span class="status-badge-report ${item.color}">${escapeHtml(item.status)}</span></td>
                  <td>${item.count}</td>
                  <td>${report.total > 0 ? ((item.count / report.total) * 100).toFixed(1) : 0}%</td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>

          ${
            report.doctorStats.length > 0
              ? `
          <h4 class="report-section-title">Performance por médico</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th scope="col">Médico</th><th scope="col">Total</th><th scope="col">Agendaram</th>
                <th scope="col">Realizaram</th><th scope="col">Taxa conversão</th><th scope="col">Taxa contato</th>
              </tr>
            </thead>
            <tbody>
              ${report.doctorStats
                .map(
                  (doc) => `
                <tr>
                  <td><strong>${escapeHtml(doc.doctor)}</strong></td>
                  <td>${doc.total}</td>
                  <td>${doc.scheduled}</td>
                  <td>${doc.completed}</td>
                  <td>${doc.conversionRate}%</td>
                  <td>${doc.contactRate}%</td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>`
              : ""
          }
        </div>
      </div>
    `;
  }

  document.getElementById("generateReport").addEventListener("click", () => {
    initReportDoctors();
    renderAdvancedReport();
  });

  // Exporta CSV com BOM para o Excel reconhecer acentos
  document.getElementById("exportReport").addEventListener("click", () => {
    const period = document.getElementById("reportPeriod").value;
    const doctor = document.getElementById("reportDoctor").value;
    const csv = exportReportToCSV(generateAdvancedReport(period, doctor));

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_${period}_${toLocalISODate()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  // Atualiza o dropdown ao entrar na seção (pode ter médico novo)
  document.addEventListener("sectionChanged", (e) => {
    if (e.detail === "reports") initReportDoctors();
  });
  initReportDoctors();
}

// Configurações de WhatsApp (código do país e DDD) salvas no navegador
function setupSettings() {
  const settingsForm = document.getElementById("settingsForm");
  const countryCode = document.getElementById("countryCode");
  const areaCode = document.getElementById("areaCode");

  // Carrega valores salvos nos campos
  const settings = getSettings();
  countryCode.value = settings.countryCode;
  areaCode.value = settings.areaCode;

  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      localStorage.setItem(
        "crm_settings",
        JSON.stringify({
          countryCode: countryCode.value.replace(/\D/g, "") || "55",
          areaCode: areaCode.value.replace(/\D/g, ""),
        }),
      );
      showToast("Configurações salvas!");
    } catch {
      showToast("Não foi possível salvar neste navegador.", "error");
    }
  });
}

// Modais (dialog nativo) e envio do formulário de edição
function setupModals() {
  [editModal, notesModal, cardPreviewModal].forEach(setupDialog);

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentEditId) return;

    // Lê um campo opcional criado dinamicamente por surgery-form.js
    const optionalValue = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : undefined;
    };

    const updatedData = {
      responsible: editResponsible.value,
      doctor: editDoctor.value,
      phone: editPhone.value.replace(/\D/g, ""),
      birthDate: editBirthDate.value,
      convenio: editConvenio.value,
      surgeryType: editSurgeryType.value,
      status: editStatus.value,
      notes: editNotes.value,
      // Meia-noite LOCAL (antes usava UTC e gravava 1 dia antes)
      scheduledActivationDate: dateInputToTimestamp(editScheduledActivation.value),
      surgeryDate: optionalValue("editSurgeryDate") || null,
      surgeryDate2: optionalValue("editSurgeryDate2") || null,
      eye: optionalValue("editEye"),
      qty: optionalValue("editQty"),
      lio: optionalValue("editLio"),
      eye2: optionalValue("editEye2"),
      qty2: optionalValue("editQty2"),
      lio2: optionalValue("editLio2"),
    };

    // Firebase rejeita undefined: remove campos ausentes
    Object.keys(updatedData).forEach((key) => {
      if (updatedData[key] === undefined) delete updatedData[key];
    });

    const submitBtn = editForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await updatePatient(currentEditId, updatedData);
      editModal.close();
      refreshPatientViews();
      showToast("Dados do paciente atualizados!");
    } catch (error) {
      console.error("Erro ao atualizar paciente:", error);
      showToast("Erro ao salvar. Verifique a conexão e tente novamente.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// Função para mostrar seção
function showSection(sectionName) {
  // Ocultar todas as seções e desmarcar links
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
    link.removeAttribute("aria-current");
  });

  // Mostrar seção selecionada
  const targetSection = document.getElementById(`${sectionName}-section`);
  if (targetSection) targetSection.classList.add("active");

  // Ativar link correspondente (aria-current para leitores de tela)
  const targetLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
  if (targetLink) {
    targetLink.classList.add("active");
    targetLink.setAttribute("aria-current", "page");
  }

  // Disparar evento customizado para informar mudança de seção
  document.dispatchEvent(new CustomEvent("sectionChanged", { detail: sectionName }));
}

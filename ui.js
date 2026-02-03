// ui.js - Manipulação de DOM e interface do usuário
import {
  getPatients,
  filterPatients,
  getDashboardStats,
  generateMonthlyReport,
  updatePatient,
  removePatient,
  addPatient,
  daysSince,
  getUrgency,
  statuses,
} from "./patients.js";
import { isFirebaseConfigured } from "./database.js";

// Elementos DOM
const patientForm = document.getElementById("patientForm");
const patientsList = document.getElementById("patientsList");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const daysFilter = document.getElementById("daysFilter");
const dashboard = document.getElementById("dashboard");
const reportSection = document.getElementById("reportSection");

// Modal de edição
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editStatus = document.getElementById("editStatus");
const editNotes = document.getElementById("editNotes");
const closeModal = document.querySelector(".close");
let currentEditId = null;

// Modal de observações
const notesModal = document.getElementById("notesModal");
const notesTitle = document.getElementById("notesTitle");
const notesContent = document.getElementById("notesContent");
const closeNotesModal = document.querySelector(".notes-close");

// Renderizar dashboard
export function renderDashboard() {
  const stats = getDashboardStats();
  const storageMode = isFirebaseConfigured
    ? "Firebase (Tempo Real)"
    : "LocalStorage (Mock)";

  dashboard.innerHTML = `
    <div class="card storage-mode">
      <h3>Modo de Armazenamento</h3>
      <p class="${isFirebaseConfigured ? "firebase-mode" : "mock-mode"}">${storageMode}</p>
    </div>
    <div class="card clickable" data-filter="all">
      <h3>Total de Pacientes</h3>
      <p>${stats.total}</p>
    </div>
    ${statuses
      .map(
        (status, i) => `
      <div class="card clickable" data-filter="${status}">
        <h3>${status}</h3>
        <p>${stats.byStatus[i]}</p>
      </div>
    `,
      )
      .join("")}
    <div class="card clickable" data-filter="over30">
      <h3>30+ dias sem contato</h3>
      <p>${stats.over30}</p>
    </div>
    <div class="card clickable" data-filter="over45">
      <h3>45+ dias</h3>
      <p>${stats.over45}</p>
    </div>
    <div class="card clickable" data-filter="over60">
      <h3>60+ dias</h3>
      <p>${stats.over60}</p>
    </div>
  `;

  // Adicionar event listeners para os cards clicáveis
  const clickableCards = dashboard.querySelectorAll(".clickable");
  clickableCards.forEach((card) => {
    card.addEventListener("click", () => {
      const filter = card.dataset.filter;
      showFilteredPatients(filter);
    });
  });
}

// Função para mostrar pacientes filtrados
function showFilteredPatients(filter) {
  // Navegar para a seção de pacientes
  const patientsLink = document.querySelector('[data-section="patients"]');
  if (patientsLink) {
    patientsLink.click();
  }

  // Aplicar filtro correspondente
  switch (filter) {
    case "all":
      searchInput.value = "";
      statusFilter.value = "";
      daysFilter.value = "";
      break;
    case "over30":
      searchInput.value = "";
      statusFilter.value = "";
      daysFilter.value = "30";
      break;
    case "over45":
      searchInput.value = "";
      statusFilter.value = "";
      daysFilter.value = "45";
      break;
    case "over60":
      searchInput.value = "";
      statusFilter.value = "";
      daysFilter.value = "60";
      break;
    default:
      // Para status específicos
      searchInput.value = "";
      statusFilter.value = filter;
      daysFilter.value = "";
      break;
  }

  // Renderizar pacientes com o filtro aplicado
  renderPatients();
}

// Renderizar lista de pacientes
export function renderPatients() {
  const search = searchInput.value;
  const status = statusFilter.value;
  const days = daysFilter.value ? parseInt(daysFilter.value) : null;

  const filtered = filterPatients(search, status, days);

  patientsList.innerHTML = filtered
    .map((patient) => {
      const baseTs =
        patient.lastContactAt || patient.visitDate || patient.createdAt;
      const baseDays = daysSince(baseTs);
      const urgency = getUrgency(baseDays);

      const infoLine = patient.lastContactAt
        ? `<p>Último contato: ${new Date(patient.lastContactAt).toLocaleDateString("pt-BR")}</p>`
        : patient.visitDate
          ? `<p>Dias desde solicitação: ${baseDays}</p>`
          : `<p>Dias desde cadastro: ${baseDays}</p>`;

      return `
      <div class="patient-card" data-status="${patient.status}">
        <h4>${patient.name}</h4>
        <p>Médico: ${patient.doctor}</p>
        <p>Cirurgia: ${patient.surgeryType}</p>
        ${infoLine}
        <span class="badge status-${patient.status.replace(/\s+/g, "-").toLowerCase()}">${patient.status}</span>
        <div class="actions">
          <button onclick="openWhatsApp('${patient.phone}', '${patient.name}', '${patient.doctor}', '${patient.surgeryType}', ${baseDays}, '${patient.id}')">📱 WhatsApp</button>
          <button onclick="toggleContact('${patient.id}')" class="${patient.lastContactAt ? "contact-done" : "contact-pending"}">
            ${patient.lastContactAt ? "✅ Contato realizado" : "📞 Fazer contato"}
          </button>
          ${patient.notes ? `<button onclick="viewNotes('${patient.name}', '${patient.notes.replace(/'/g, "\\'")}')">👁️ Ver Obs</button>` : ""}
          <button onclick="editPatient('${patient.id}')">✏️ Editar</button>
          <button onclick="deletePatient('${patient.id}')">🗑️ Excluir</button>
        </div>
      </div>
    `;
    })
    .join("");
}

// Funções globais para os botões
// Obter configurações salvas
function getSettings() {
  const defaults = { countryCode: "55", areaCode: "67" };
  try {
    const raw = localStorage.getItem("crm_settings");
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

window.openWhatsApp = function (phone, name, doctor, surgery, days, patientId) {
  const settings = getSettings();
  const cc = (settings.countryCode || "55").replace(/\D/g, "");
  const ddd = (settings.areaCode || "").replace(/\D/g, "");

  // Normalizar número do paciente
  let digits = String(phone || "").replace(/\D/g, "");

  // Prefixar DDD se configurado e número parecer sem DDD (8/9 dígitos) e não começar com o DDD
  if (ddd && digits && digits.length <= 9 && !digits.startsWith(ddd)) {
    digits = ddd + digits;
  }

  // Montar número completo com código do país
  const fullNumber = cc + digits;

  const message = `Olá, ${name}. Estamos entrando em contato sobre o risco cirúrgico solicitado pelo ${doctor} para a cirurgia de ${surgery}. Já se passaram ${days} dias desde a solicitação do médico. Ficamos à disposição para ajudar!`;

  // Usar WhatsApp Web (QR) — se não estiver logado, pedirá QR
  const url = `https://web.whatsapp.com/send?phone=${fullNumber}&text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
};

window.toggleContact = async function (id) {
  const patients = getPatients();
  const patient = patients.find((p) => p.id === id);

  if (patient) {
    // Se já teve contato, remove a marcação; senão, marca como realizado
    const newContactAt = patient.lastContactAt ? null : Date.now();
    await updatePatient(id, { lastContactAt: newContactAt });
    renderDashboard();
    renderPatients();
  }
};

window.editPatient = function (id) {
  const patients = getPatients();
  const patient = patients.find((p) => p.id === id);
  if (patient) {
    currentEditId = id;
    editStatus.value = patient.status;
    editNotes.value = patient.notes || "";
    editModal.style.display = "block";
  }
};

window.viewNotes = function (name, notes) {
  notesTitle.textContent = `Observações - ${name}`;
  notesContent.textContent = notes;
  notesModal.style.display = "block";
};

window.deletePatient = async function (id) {
  if (confirm("Tem certeza que deseja excluir este paciente?")) {
    await removePatient(id);
    renderDashboard();
    renderPatients();
  }
};

// Configurar event listeners
export function setupEventListeners() {
  // Toggle de tema
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = themeToggle.querySelector("i");

  // Carregar tema salvo
  const savedTheme = localStorage.getItem("theme") || "light";
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
    themeIcon.className = "fas fa-sun";
  } else {
    themeIcon.className = "fas fa-moon";
  }

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-theme");
    const isDark = document.body.classList.contains("dark-theme");

    // Atualizar ícone
    themeIcon.className = isDark ? "fas fa-sun" : "fas fa-moon";

    // Salvar preferência
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
  // Navegação lateral
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const section = e.target.closest(".nav-link").dataset.section;
      showSection(section);
    });
  });

  // Formulário de adicionar paciente
  patientForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(patientForm);
    const patient = {
      name: formData.get("name"),
      visitDate: formData.get("visitDate"),
      doctor: formData.get("doctor"),
      surgeryType: formData.get("surgeryType"),
      notes: formData.get("notes"),
      phone: formData.get("phone"),
      status: "Paciente solicitado risco", // Status inicial
    };
    await addPatient(patient);
    patientForm.reset();
    renderDashboard();
    renderPatients();
  });

  // Filtros
  searchInput.addEventListener("input", renderPatients);
  statusFilter.addEventListener("change", renderPatients);
  daysFilter.addEventListener("change", renderPatients);

  // Relatório mensal
  document.getElementById("generateReport").addEventListener("click", () => {
    const report = generateMonthlyReport();
    reportSection.innerHTML = `
      <h3>Relatório Mensal - ${report.month}</h3>
      <p>Pacientes cadastrados: ${report.totalPatients}</p>
      <p>Pacientes que agendaram cirurgia: ${report.scheduledSurgeries}</p>
      <p>Taxa de conversão: ${report.conversionRate}%</p>
    `;
  });

  // Modal de edição
  closeModal.onclick = function () {
    editModal.style.display = "none";
  };

  closeNotesModal.onclick = function () {
    notesModal.style.display = "none";
  };

  window.onclick = function (event) {
    if (event.target === editModal) {
      editModal.style.display = "none";
    }
    if (event.target === notesModal) {
      notesModal.style.display = "none";
    }
  };

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (currentEditId) {
      const updatedData = {
        status: editStatus.value,
        notes: editNotes.value,
      };
      await updatePatient(currentEditId, updatedData);
      editModal.style.display = "none";
      renderDashboard();
      renderPatients();
    }
  });
}

// Função para mostrar seção
function showSection(sectionName) {
  // Ocultar todas as seções
  const sections = document.querySelectorAll(".section");
  sections.forEach((section) => section.classList.remove("active"));

  // Remover classe active dos links
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => link.classList.remove("active"));

  // Mostrar seção selecionada
  const targetSection = document.getElementById(`${sectionName}-section`);
  if (targetSection) {
    targetSection.classList.add("active");
  }

  // Ativar link correspondente
  const targetLink = document.querySelector(`[data-section="${sectionName}"]`);
  if (targetLink) {
    targetLink.classList.add("active");
  }
}

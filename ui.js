// ui.js - Manipulação de DOM e interface do usuário
import {
  getPatients,
  filterPatients,
  getDashboardStats,
  getDoctorStats,
  generateMonthlyReport,
  generateAdvancedReport,
  getUniqueDoctors,
  exportReportToCSV,
  updatePatient,
  removePatient,
  addPatient,
  daysSince,
  getUrgency,
  statuses,
  doctors,
} from "./patients.js";
import { isFirebaseConfigured } from "./database.js";

// Elementos DOM
const patientForm = document.getElementById("patientForm");
const patientsList = document.getElementById("patientsList");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const daysFilter = document.getElementById("daysFilter");
const doctorFilter = document.getElementById("doctorFilter");
const responsibleFilter = document.getElementById("responsibleFilter");
const dashboard = document.getElementById("dashboard");
const reportSection = document.getElementById("reportSection");

// Modal de edição
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editResponsible = document.getElementById("editResponsible");
const editDoctor = document.getElementById("editDoctor");
const editPhone = document.getElementById("editPhone");
const editStatus = document.getElementById("editStatus");
const editNotes = document.getElementById("editNotes");
const closeModal = document.querySelector(".close");
let currentEditId = null;

// Modal de observações
const notesModal = document.getElementById("notesModal");
const notesTitle = document.getElementById("notesTitle");
const notesContent = document.getElementById("notesContent");
const closeNotesModal = document.querySelector(".notes-close");

// Mapeamento de rótulos amigáveis por situação
const statusDisplayMap = {
  "Paciente solicitado risco": "Pedido de risco cirúrgico",
  "Paciente agendou cirurgia": "Agendou cirurgia",
  "Paciente fez cirurgia": "Pós-cirurgia",
  "Cirurgias Refrativas": "Cirurgias Refrativas",
  "Paciente não quer operar": "Não vai operar",
};

function displayStatusLabel(status) {
  return statusDisplayMap[status] || status;
}

// Renderizar dashboard
export function renderDashboard() {
  const stats = getDashboardStats();
  const doctorStats = getDoctorStats();

  dashboard.innerHTML = `
    <div class="dashboard-section">
      <h3 class="section-title">📊 Visão Geral</h3>
      <div class="mini-cards-grid">
        <div class="mini-card clickable" data-filter="all">
          <span class="mini-card-icon">👥</span>
          <div class="mini-card-content">
            <span class="mini-card-value">${stats.total}</span>
            <span class="mini-card-label">Total</span>
          </div>
        </div>
        <div class="mini-card new-month">
          <span class="mini-card-icon">✨</span>
          <div class="mini-card-content">
            <span class="mini-card-value">${stats.newThisMonth}</span>
            <span class="mini-card-label">Novos no mês</span>
          </div>
        </div>
        <div class="mini-card clickable" data-filter="over30">
          <span class="mini-card-icon">⏱️</span>
          <div class="mini-card-content">
            <span class="mini-card-value">${stats.over30}</span>
            <span class="mini-card-label">30+ dias</span>
          </div>
        </div>
        <div class="mini-card clickable" data-filter="over45">
          <span class="mini-card-icon">⚠️</span>
          <div class="mini-card-content">
            <span class="mini-card-value">${stats.over45}</span>
            <span class="mini-card-label">45+ dias</span>
          </div>
        </div>
        <div class="mini-card clickable ${stats.over60 > 0 ? "urgent" : ""}" data-filter="over60">
          <span class="mini-card-icon">🚨</span>
          <div class="mini-card-content">
            <span class="mini-card-value">${stats.over60}</span>
            <span class="mini-card-label">60+ dias</span>
          </div>
        </div>
      </div>
    </div>

    <div class="dashboard-section">
      <h3 class="section-title">👨‍⚕️ Médicos</h3>
      <div class="doctors-grid">
        ${doctorStats
          .map((doctor, index) => {
            const doctorClass = [
              "doctor-dante",
              "doctor-alberto",
              "doctor-fabiana",
            ][index];
            const doctorIcons = ["👨‍⚕️", "🧑‍⚕️", "👩‍⚕️"];
            const doctorIcon = doctorIcons[index] || "👨‍⚕️";

            return `
          <div class="doctor-card ${doctorClass} ${doctor.over60 > 0 ? "has-urgent" : ""} ${doctor.total === 0 ? "no-patients" : ""}" data-doctor="${doctor.name}">
            <div class="doctor-header">
              <div class="doctor-title">
                <span class="doctor-icon">${doctorIcon}</span>
                <h4>${doctor.name}</h4>
              </div>
              <span class="doctor-total">${doctor.total} paciente${doctor.total !== 1 ? "s" : ""}</span>
            </div>
            ${
              doctor.total === 0
                ? `
              <div class="no-patients-msg">
                <span>📭 Nenhum paciente atribuído</span>
              </div>
            `
                : `
            <div class="doctor-stats">
              <div class="stat-badges">
                <span class="badge badge-risk clickable" data-filter="${doctor.name}:Paciente solicitado risco" title="Pedido de risco">
                  🩺 ${doctor.byStatus[0]}
                </span>
                <span class="badge badge-scheduled clickable" data-filter="${doctor.name}:Paciente agendou cirurgia" title="Agendou cirurgia">
                  📅 ${doctor.byStatus[1]}
                </span>
                <span class="badge badge-surgery clickable" data-filter="${doctor.name}:Paciente fez cirurgia" title="Pós-cirurgia">
                  ✅ ${doctor.byStatus[2]}
                </span>
                <span class="badge badge-no-surgery clickable" data-filter="${doctor.name}:Paciente não quer operar" title="Não vai operar">
                  ❌ ${doctor.byStatus[3]}
                </span>
              </div>
              ${
                doctor.over60 > 0
                  ? `
                <div class="urgent-alert pulse">
                  🚨 ${doctor.over60} paciente${doctor.over60 > 1 ? "s" : ""} com 60+ dias
                </div>
              `
                  : ""
              }
              <div class="doctor-metrics">
                <div class="metric">
                  <span class="metric-label">Média de tempo:</span>
                  <span class="metric-value">${doctor.avgDays} dias</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Conversão:</span>
                  <span class="metric-value conversion">${doctor.conversionRate}%</span>
                </div>
              </div>
            </div>
            `
            }
          </div>
        `;
          })
          .join("")}
      </div>
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

  // Adicionar event listeners para os cards de médicos
  const doctorCards = dashboard.querySelectorAll(".doctor-card");
  doctorCards.forEach((card) => {
    if (!card.classList.contains("clickable")) {
      card.addEventListener("click", (e) => {
        // Evitar conflito com cliques em badges
        if (!e.target.closest(".badge")) {
          const doctorName = card.dataset.doctor;
          showFilteredPatients(doctorName);
        }
      });
    }
  });
}

// Função para mostrar pacientes filtrados
function showFilteredPatients(filter) {
  // Navegar para a seção de pacientes
  const patientsLink = document.querySelector('[data-section="patients"]');
  if (patientsLink) {
    patientsLink.click();
  }

  // Verificar se é filtro combinado (médico:status)
  if (filter.includes(":")) {
    const [doctorName, status] = filter.split(":");
    searchInput.value = "";
    if (doctorFilter) doctorFilter.value = doctorName;
    statusFilter.value = status;
    daysFilter.value = "";
    renderPatients();
    return;
  }

  // Verificar se é nome de médico
  if (doctors.includes(filter)) {
    searchInput.value = "";
    if (doctorFilter) doctorFilter.value = filter;
    statusFilter.value = "";
    daysFilter.value = "";
    renderPatients();
    return;
  }

  // Aplicar filtro correspondente
  switch (filter) {
    case "all":
      searchInput.value = "";
      statusFilter.value = "";
      daysFilter.value = "";
      if (doctorFilter) doctorFilter.value = "";
      if (responsibleFilter) responsibleFilter.value = "";
      break;
    case "over30":
      searchInput.value = "";
      statusFilter.value = "";
      daysFilter.value = "30";
      if (doctorFilter) doctorFilter.value = "";
      if (responsibleFilter) responsibleFilter.value = "";
      break;
    case "over45":
      searchInput.value = "";
      statusFilter.value = "";
      daysFilter.value = "45";
      if (doctorFilter) doctorFilter.value = "";
      if (responsibleFilter) responsibleFilter.value = "";
      break;
    case "over60":
      searchInput.value = "";
      statusFilter.value = "";
      daysFilter.value = "60";
      if (doctorFilter) doctorFilter.value = "";
      if (responsibleFilter) responsibleFilter.value = "";
      break;
    default:
      // Para status específicos
      searchInput.value = "";
      statusFilter.value = filter;
      daysFilter.value = "";
      if (doctorFilter) doctorFilter.value = "";
      if (responsibleFilter) responsibleFilter.value = "";
      break;
  }

  // Renderizar pacientes com o filtro aplicado
  renderPatients();
}

function formatPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length > 0) {
    return digits;
  }
  return "";
}

// Helper: construir o card de paciente
function buildPatientCard(patient) {
  const baseTs =
    patient.lastContactAt || patient.visitDate || patient.createdAt;
  const baseDays = daysSince(baseTs);
  const infoLine = patient.lastContactAt
    ? `<p>Último contato: ${new Date(patient.lastContactAt).toLocaleDateString("pt-BR")}</p>`
    : patient.visitDate
      ? `<p>Dias desde solicitação: ${baseDays}</p>`
      : `<span class="days-info"><i class="fas fa-clock"></i> ${baseDays} dias desde cadastro</span>`;

  const phoneDisplay = patient.phone ? formatPhone(patient.phone) : "";
  const statusClass = patient.status.replace(/\s+/g, "-").toLowerCase();

  // Classe baseada no status (não no tempo)
  const categoryClass = statusClass;

  // Determinar cor do badge de dias
  const daysClass =
    baseDays >= 60
      ? "critical"
      : baseDays >= 45
        ? "high"
        : baseDays >= 30
          ? "medium"
          : "low";

  return `
    <div class="patient-card status-${categoryClass}" data-status="${patient.status}" data-id="${patient.id}">
      <div class="patient-card-header">
        <div class="patient-header-left">
          <h3 class="patient-name">${patient.name}</h3>
          <span class="patient-status">${displayStatusLabel(patient.status)}</span>
        </div>
        <span class="urgency-badge ${daysClass}">${baseDays} dias</span>
      </div>
      
      <div class="patient-card-body">
        <div class="patient-info-row">
          <span class="info-label">Médico:</span>
          <span>${patient.doctor}</span>
        </div>
        ${
          patient.responsible
            ? `
        <div class="patient-info-row">
          <span class="info-label">Responsável:</span>
          <span>${patient.responsible}</span>
        </div>
        `
            : ""
        }
        <div class="patient-info-row">
          <span class="info-label">Cirurgia:</span>
          <span>${patient.surgeryType}</span>
        </div>
        ${
          phoneDisplay
            ? `
        <div class="patient-info-row">
          <span class="info-label">Telefone:</span>
          <span>${phoneDisplay}</span>
        </div>
        `
            : ""
        }
      </div>
      
      <div class="patient-card-actions">
        <button class="btn-action" onclick="openWhatsApp('${patient.phone}', '${patient.name}', '${patient.doctor}', '${patient.surgeryType}', ${baseDays}, '${patient.id}')" title="WhatsApp">
          <i class="fab fa-whatsapp"></i>
        </button>
        <button class="btn-action ${patient.thankYouSentAt ? "btn-thanked" : ""}" onclick="sendThankYou('${patient.phone}', '${patient.name}', '${patient.doctor}', '${patient.id}')" title="${patient.thankYouSentAt ? "Agradecimento enviado" : "Enviar agradecimento"}">
          <i class="fas fa-heart"></i>
        </button>
        <button class="btn-action ${patient.lastContactAt ? "btn-contacted" : ""}" onclick="toggleContact('${patient.id}')" title="${patient.lastContactAt ? "Contato realizado" : "Registrar contato"}">
          <i class="fas ${patient.lastContactAt ? "fa-check-circle" : "fa-phone-alt"}"></i>
        </button>
        ${patient.notes ? `<button class="btn-action" onclick="viewNotes('${patient.name}', '${(patient.notes || "").replace(/'/g, "\\'")}')"><i class="fas fa-sticky-note"></i></button>` : ""}
        <button class="btn-action" onclick="editPatient('${patient.id}')" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-action btn-delete" onclick="deletePatient('${patient.id}')" title="Excluir">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

// Função para ordenar pacientes
function sortPatients(patients, sortBy) {
  const sorted = [...patients];

  switch (sortBy) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "recent":
      return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    case "oldest":
      return sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    case "doctor":
      return sorted.sort((a, b) => a.doctor.localeCompare(b.doctor));
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

// Renderizar lista de pacientes
export function renderPatients() {
  const search = searchInput.value;
  const status = statusFilter.value;
  const days = daysFilter.value ? parseInt(daysFilter.value) : null;
  const doctor = doctorFilter ? doctorFilter.value : "";
  const responsible = responsibleFilter ? responsibleFilter.value : "";
  let filtered = filterPatients(search, status, days, doctor, responsible);

  // Aplicar ordenação se definida
  const sortBy = localStorage.getItem("patientsSortBy") || "urgency";
  filtered = sortPatients(filtered, sortBy);

  // Atualizar contador
  updatePatientsCounter(filtered.length);

  // Verificar modo de visualização
  const viewMode = localStorage.getItem("patientsViewMode") || "grid";
  patientsList.className =
    viewMode === "list" ? "patients-list list-view" : "patients-list grid-view";

  // Se um status específico estiver selecionado, manter lista simples
  if (status) {
    patientsList.innerHTML = filtered.map(buildPatientCard).join("");
    return;
  }

  // Agrupar por situação quando nenhum status está selecionado
  const baseFiltered = filterPatients(search, "", days, doctor, responsible);
  const groupsHtml = statuses
    .map((st) => {
      const group = baseFiltered.filter((p) => p.status === st);
      if (group.length === 0) return "";
      const cards = group.map(buildPatientCard).join("");
      return `
        <section class="status-group" data-status-group="${st.replace(/\s+/g, "-").toLowerCase()}">
          <h3 class="status-title">${displayStatusLabel(st)} <span class="status-count">(${group.length})</span></h3>
          <div class="status-group-cards">${cards}</div>
        </section>
      `;
    })
    .join("");

  patientsList.innerHTML = groupsHtml || "<p>Nenhum paciente encontrado.</p>";
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

  const message = `Bom dia! Aqui é da equipe da Oftalmo 15, verificamos que o(a) Sr(a) ${name} tinha realizado uma consulta com ${doctor}, e ele(a) sugeriu uma cirurgia, como não tivemos um retorno, entrei em contato para saber se está tudo bem e caso queira dar prosseguimento estamos à disposição. Lembrando! Que independente da cirurgia é recomendado retorno anual ao médico oftalmologista.`;

  // Usar WhatsApp Web (QR) — se não estiver logado, pedirá QR
  const url = `https://web.whatsapp.com/send?phone=${fullNumber}&text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
};

// Enviar mensagem de agradecimento pós-cirurgia
window.sendThankYou = async function (phone, name, doctor, id) {
  const settings = getSettings();
  const cc = (settings.countryCode || "55").replace(/\D/g, "");
  const ddd = (settings.areaCode || "").replace(/\D/g, "");

  // Normalizar número do paciente
  let digits = String(phone || "").replace(/\D/g, "");

  // Se faltar telefone, avisar
  if (!digits) {
    alert("Este paciente não possui telefone válido cadastrado.");
    return;
  }

  // Prefixar DDD se configurado e número parecer sem DDD (8/9 dígitos) e não começar com o DDD
  if (ddd && digits.length <= 9 && !digits.startsWith(ddd)) {
    digits = ddd + digits;
  }

  // Montar número completo com código do país
  const fullNumber = cc + digits;

  // Garantir nome do médico
  let docName = (doctor || "").trim();
  if (!docName) {
    docName = (
      prompt("Informe o nome do médico para a mensagem:") || ""
    ).trim();
  }

  const message = [
    `Olá, ${name} 😊`,
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

  const url = `https://web.whatsapp.com/send?phone=${fullNumber}&text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");

  // Registrar que o agradecimento foi enviado
  if (id) {
    await updatePatient(id, { thankYouSentAt: Date.now() });
    renderDashboard();
    renderPatients();
  }
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
    if (editResponsible) editResponsible.value = patient.responsible || "";
    if (editDoctor) editDoctor.value = patient.doctor || "";
    if (editPhone) editPhone.value = (patient.phone || "").replace(/\D/g, "");
    editStatus.value = patient.status;
    editNotes.value = patient.notes || "";
    editModal.style.display = "flex"; // Usar flex para centralizar
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

  // Menu hamburguer mobile
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.querySelector(".sidebar");

  // Criar overlay
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  document.body.appendChild(overlay);

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active");
      overlay.classList.toggle("active");
    });

    overlay.addEventListener("click", () => {
      sidebar.classList.remove("active");
      overlay.classList.remove("active");
    });

    // Fechar menu ao clicar em um link
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove("active");
          overlay.classList.remove("active");
        }
      });
    });
  }

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
      responsible: formData.get("responsible") || "",
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
  if (doctorFilter) doctorFilter.addEventListener("change", renderPatients);
  if (responsibleFilter)
    responsibleFilter.addEventListener("change", renderPatients);

  // Botão Limpar Filtros
  const clearFiltersBtn = document.getElementById("clearFilters");
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      searchInput.value = "";
      statusFilter.value = "";
      daysFilter.value = "";
      if (doctorFilter) doctorFilter.value = "";
      if (responsibleFilter) responsibleFilter.value = "";
      renderPatients();
    });
  }

  // Controles de visualização
  const viewGrid = document.getElementById("viewGrid");
  const viewList = document.getElementById("viewList");
  const sortSelect = document.getElementById("sortSelect");
  const resetForm = document.getElementById("resetForm");

  // Restaurar modo de visualização salvo
  const savedViewMode = localStorage.getItem("patientsViewMode") || "grid";
  if (savedViewMode === "list") {
    viewList.classList.add("active");
    viewGrid.classList.remove("active");
  }

  // Restaurar ordenação salva
  const savedSortBy = localStorage.getItem("patientsSortBy") || "urgency";
  if (sortSelect) sortSelect.value = savedSortBy;

  if (viewGrid) {
    viewGrid.addEventListener("click", () => {
      localStorage.setItem("patientsViewMode", "grid");
      viewGrid.classList.add("active");
      viewList.classList.remove("active");
      renderPatients();
    });
  }

  if (viewList) {
    viewList.addEventListener("click", () => {
      localStorage.setItem("patientsViewMode", "list");
      viewList.classList.add("active");
      viewGrid.classList.remove("active");
      renderPatients();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      localStorage.setItem("patientsSortBy", sortSelect.value);
      renderPatients();
    });
  }

  if (resetForm) {
    resetForm.addEventListener("click", () => {
      patientForm.reset();
    });
  }

  // Inicializar dropdown de médicos no relatório
  function initReportDoctors() {
    const reportDoctor = document.getElementById("reportDoctor");
    if (reportDoctor) {
      const doctors = getUniqueDoctors();
      // Limpar options exceto "Todos"
      reportDoctor.innerHTML = '<option value="all">Todos</option>';
      doctors.forEach((doc) => {
        const option = document.createElement("option");
        option.value = doc;
        option.textContent = doc;
        reportDoctor.appendChild(option);
      });
    }
  }

  // Renderizar relatório avançado
  function renderAdvancedReport() {
    const period = document.getElementById("reportPeriod").value;
    const doctor = document.getElementById("reportDoctor").value;
    const report = generateAdvancedReport(period, doctor);

    const html = `
      <div class="report-content">
        <div class="report-header">
          <h3>Relatório Detalhado</h3>
          <p class="report-period">${report.periodLabel} ${doctor !== "all" ? `- Dr. ${doctor}` : ""}</p>
        </div>

        <div class="report-stats">
          <div class="report-card">
            <div class="report-card-title">Total de Pacientes</div>
            <div class="report-card-value">${report.total}</div>
            <div class="report-card-description">Cadastrados no período</div>
          </div>

          <div class="report-card">
            <div class="report-card-title">Taxa de Conversão</div>
            <div class="report-card-value">${report.conversionRate}%</div>
            <div class="report-card-description">${report.scheduled} agendaram cirurgia</div>
          </div>

          <div class="report-card">
            <div class="report-card-title">Taxa de Conclusão</div>
            <div class="report-card-value">${report.completionRate}%</div>
            <div class="report-card-description">${report.completed} realizaram cirurgia</div>
          </div>

          <div class="report-card">
            <div class="report-card-title">Tempo Médio</div>
            <div class="report-card-value">${report.avgDays}</div>
            <div class="report-card-description">dias desde cadastro</div>
          </div>

          <div class="report-card">
            <div class="report-card-title">Taxa de Contato</div>
            <div class="report-card-value">${report.contactRate}%</div>
            <div class="report-card-description">${report.contacted} pacientes contatados</div>
          </div>

          <div class="report-card">
            <div class="report-card-title">Pacientes Críticos</div>
            <div class="report-card-value" style="color: #dc3545;">${report.critical}</div>
            <div class="report-card-description">60+ dias sem contato</div>
          </div>
        </div>

        <div class="report-details">
          <h4 class="report-section-title">Distribuição por Status</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Quantidade</th>
                <th>Percentual</th>
              </tr>
            </thead>
            <tbody>
              ${report.statusDistribution
                .map(
                  (item) => `
                <tr>
                  <td><span class="status-badge-report ${item.color}">${item.status}</span></td>
                  <td>${item.count}</td>
                  <td>${report.total > 0 ? ((item.count / report.total) * 100).toFixed(1) : 0}%</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>

          ${
            report.doctorStats.length > 0
              ? `
          <h4 class="report-section-title">Performance por Médico</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>Médico</th>
                <th>Total</th>
                <th>Agendaram</th>
                <th>Realizaram</th>
                <th>Taxa Conversão</th>
                <th>Taxa Contato</th>
              </tr>
            </thead>
            <tbody>
              ${report.doctorStats
                .map(
                  (doc) => `
                <tr>
                  <td><strong>${doc.doctor}</strong></td>
                  <td>${doc.total}</td>
                  <td>${doc.scheduled}</td>
                  <td>${doc.completed}</td>
                  <td>${doc.conversionRate}%</td>
                  <td>${doc.contactRate}%</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          `
              : ""
          }
        </div>
      </div>
    `;

    reportSection.innerHTML = html;
  }

  // Event listeners para relatórios
  document.getElementById("generateReport").addEventListener("click", () => {
    initReportDoctors();
    renderAdvancedReport();
  });

  document.getElementById("exportReport").addEventListener("click", () => {
    const period = document.getElementById("reportPeriod").value;
    const doctor = document.getElementById("reportDoctor").value;
    const report = generateAdvancedReport(period, doctor);
    const csv = exportReportToCSV(report);

    // Criar e baixar arquivo
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `relatorio_${period}_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Inicializar médicos no relatório ao carregar
  initReportDoctors();

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
        responsible: editResponsible ? editResponsible.value : undefined,
        doctor: editDoctor ? editDoctor.value : undefined,
        phone: editPhone ? editPhone.value : undefined,
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

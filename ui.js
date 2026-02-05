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
  "Paciente não quer operar": "Não vai operar",
};

function displayStatusLabel(status) {
  return statusDisplayMap[status] || status;
}

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
        <h3>${displayStatusLabel(status)}</h3>
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
      : `<p>Dias desde cadastro: ${baseDays}</p>`;

  const phoneDisplay = patient.phone ? formatPhone(patient.phone) : "";
  const statusClass = patient.status.replace(/\s+/g, "-").toLowerCase();

  return `
    <div class="patient-card" data-status="${patient.status}">
      <h4>${patient.name}</h4>
      ${phoneDisplay ? `<p>Telefone: ${phoneDisplay}</p>` : ""}
      <p>Médico: ${patient.doctor}</p>
      ${patient.responsible ? `<p>Responsável: ${patient.responsible}</p>` : ""}
      <p>Cirurgia: ${patient.surgeryType}</p>
      ${infoLine}
      <span class="badge status-${statusClass}">${patient.status}</span>
      <div class="actions">
        <button onclick="openWhatsApp('${patient.phone}', '${patient.name}', '${patient.doctor}', '${patient.surgeryType}', ${baseDays}, '${patient.id}')">📱 WhatsApp</button>
        <button onclick="sendThankYou('${patient.phone}', '${patient.name}', '${patient.doctor}')">🙏 Agradecimento</button>
        <button onclick="toggleContact('${patient.id}')" class="${patient.lastContactAt ? "contact-done" : "contact-pending"}">
          ${patient.lastContactAt ? "✅ Contato realizado" : "📞 Fazer contato"}
        </button>
        ${patient.notes ? `<button onclick="viewNotes('${patient.name}', '${(patient.notes || "").replace(/'/g, "\\'")}')">👁️ Ver Obs</button>` : ""}
        <button onclick="editPatient('${patient.id}')">✏️ Editar</button>
        <button onclick="deletePatient('${patient.id}')">🗑️ Excluir</button>
      </div>
    </div>
  `;
}

// Renderizar lista de pacientes
export function renderPatients() {
  const search = searchInput.value;
  const status = statusFilter.value;
  const days = daysFilter.value ? parseInt(daysFilter.value) : null;
  const doctor = doctorFilter ? doctorFilter.value : "";
  const responsible = responsibleFilter ? responsibleFilter.value : "";
  const filtered = filterPatients(search, status, days, doctor, responsible);

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

  const message = `Olá, ${name}. Desde a solicitação do risco cirúrgico pelo ${doctor} para a cirurgia de ${surgery}, seguimos à disposição para apoiar a continuidade do processo.`;

  // Usar WhatsApp Web (QR) — se não estiver logado, pedirá QR
  const url = `https://web.whatsapp.com/send?phone=${fullNumber}&text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
};

// Enviar mensagem de agradecimento pós-cirurgia
window.sendThankYou = function (phone, name, doctor) {
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

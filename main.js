// main.js - Ponto de entrada da aplicação
import { logout, onAuthStateChange } from "./auth.js";
import { loadPatients, cleanup, fixPatientsCreatedAt } from "./patients.js";
import {
  renderDashboard,
  renderPatients,
  setupEventListeners,
  populateSelectOptions,
  showSectionFromHash,
} from "./ui.js";
import {
  initSurgerySchedule,
  refreshSurgeryScheduleSafely,
} from "./surgery-schedule.js";
import {
  initSurgeryDateField,
  addSurgeryDateToEditModal,
} from "./surgery-form.js";
import { showToast } from "./utils.js";

// Inicializar autenticação
const logoutBtn = document.getElementById("logoutBtn");

// Helper para compatibilizar produção (cleanUrls) e ambiente local (.html)
function supportsCleanUrls() {
  return !/\.html$/.test(window.location.pathname);
}

function pathForLogin() {
  return supportsCleanUrls() ? "/login" : "login.html";
}

logoutBtn.addEventListener("click", async () => {
  await logout();
  window.location.replace(pathForLogin());
});

onAuthStateChange((user) => {
  if (!user) {
    // Usuário não autenticado: enviar para login sem criar histórico
    window.location.replace(pathForLogin());
  }
});

// Só re-renderiza em tempo real depois que a tela inicial estiver montada
let appReady = false;

/**
 * Chamado a cada mudança no Firebase (inclusive feita por outro usuário):
 * mantém dashboard, lista e agenda sincronizados sem recarregar a página.
 */
function handlePatientsChanged() {
  if (!appReady) return;
  renderDashboard();
  renderPatients();
  refreshSurgeryScheduleSafely();
}

// Inicializar aplicação
async function initApp() {
  const loadingOverlay = document.getElementById("loadingOverlay");

  try {
    // Opções dos selects vêm de patients.js (fonte única)
    populateSelectOptions();
    addSurgeryDateToEditModal(); // Campos de cirurgia no modal (antes dos listeners)

    await loadPatients(handlePatientsChanged);
    await fixPatientsCreatedAt(); // Corrigir pacientes sem createdAt
    renderDashboard();
    renderPatients();
    setupEventListeners();
    initSurgerySchedule(); // Inicializar módulo de agenda cirúrgica
    initSurgeryDateField(); // Inicializar lógica do campo de data da cirurgia

    // Abre a seção indicada na URL (#patients etc.) — F5 mantém a tela
    showSectionFromHash();
    appReady = true;
  } catch (error) {
    console.error("Erro ao inicializar aplicação:", error);
    showToast(
      "Erro ao carregar a aplicação. Recarregue a página.",
      "error",
      { label: "Recarregar", onClick: () => window.location.reload() },
      15000,
    );
  } finally {
    // Esconder indicador de carregamento
    if (loadingOverlay) {
      loadingOverlay.classList.add("hidden");
      setTimeout(() => loadingOverlay.remove(), 300);
    }
  }
}

// Exposto para ui.js atualizar a agenda mantendo o filtro de data ativo
// (ui.js não importa surgery-schedule.js direto para evitar import circular)
window.refreshSurgerySchedule = refreshSurgeryScheduleSafely;

// Limpar recursos quando a página for fechada
window.addEventListener("beforeunload", () => {
  cleanup();
});

// Executar quando DOM estiver pronto
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

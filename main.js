// main.js - Ponto de entrada da aplicação
import { logout, onAuthStateChange } from "./auth.js";
import { loadPatients, cleanup, fixPatientsCreatedAt } from "./patients.js";
import { renderDashboard, renderPatients, setupEventListeners } from "./ui.js";
import {
  initSurgerySchedule,
  renderSurgerySchedule,
} from "./surgery-schedule.js";
import {
  initSurgeryDateField,
  addSurgeryDateToEditModal,
} from "./surgery-form.js";

// Inicializar autenticação
const logoutBtn = document.getElementById("logoutBtn");

// Helper para compatibilizar produção (cleanUrls) e ambiente local (.html)
function supportsCleanUrls() {
  return !/\.html$/.test(window.location.pathname);
}

function pathForLogin() {
  return supportsCleanUrls() ? "/login" : "login.html";
}

function pathForIndex() {
  return supportsCleanUrls() ? "/" : "index.html";
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

// Inicializar aplicação
async function initApp() {
  const loadingOverlay = document.getElementById("loadingOverlay");

  try {
    await loadPatients();
    await fixPatientsCreatedAt(); // Corrigir pacientes sem createdAt
    renderDashboard();
    renderPatients();
    setupEventListeners();
    initSurgerySchedule(); // Inicializar módulo de agenda cirúrgica
    initSurgeryDateField(); // Inicializar lógica do campo de data da cirurgia
    addSurgeryDateToEditModal(); // Adicionar campo de data no modal de edição

    // Mostrar seção inicial (dashboard)
    const dashboardLink = document.querySelector('[data-section="dashboard"]');
    if (dashboardLink) {
      dashboardLink.click();
    }
  } catch (error) {
    console.error("Erro ao inicializar aplicação:", error);
    alert("Erro ao carregar aplicação. Por favor, recarregue a página.");
  } finally {
    // Esconder indicador de carregamento
    if (loadingOverlay) {
      loadingOverlay.classList.add("hidden");
      setTimeout(() => {
        loadingOverlay.style.display = "none";
      }, 300);
    }
  }
}

// Exportar renderSurgerySchedule para uso em outros módulos
window.renderSurgerySchedule = renderSurgerySchedule;

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

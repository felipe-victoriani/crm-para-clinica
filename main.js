// main.js - Ponto de entrada da aplicação
import { logout, onAuthStateChange } from "./auth.js";
import { loadPatients, cleanup, fixPatientsCreatedAt } from "./patients.js";
import { renderDashboard, renderPatients, setupEventListeners } from "./ui.js";

// Inicializar autenticação
const logoutBtn = document.getElementById("logoutBtn");

logoutBtn.addEventListener("click", async () => {
  await logout();
  window.location.href = "login.html";
});

onAuthStateChange((user) => {
  if (!user) {
    window.location.href = "login.html";
  }
});

// Inicializar aplicação
async function initApp() {
  await loadPatients();
  await fixPatientsCreatedAt(); // Corrigir pacientes sem createdAt
  renderDashboard();
  renderPatients();
  setupEventListeners();

  // Mostrar seção inicial (dashboard)
  const dashboardLink = document.querySelector('[data-section="dashboard"]');
  if (dashboardLink) {
    dashboardLink.click();
  }
}

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

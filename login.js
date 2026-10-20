// login.js - Tela de login (Firebase Auth e-mail/senha)
import { login, onAuthStateChange } from "./auth.js";

const loginForm = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");
const submitBtn = loginForm.querySelector('button[type="submit"]');
const submitLabel = submitBtn.innerHTML;

// Mensagens amigáveis por código de erro do Firebase Auth.
// Credencial inválida usa mensagem genérica (não revela se o e-mail existe).
const AUTH_ERROR_MESSAGES = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/user-disabled": "Este usuário está desativado. Fale com o administrador.",
  "auth/too-many-requests":
    "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.",
  "auth/network-request-failed": "Sem conexão com a internet. Verifique a rede.",
};

// Helper para compatibilizar produção (cleanUrls) e ambiente local (.html)
function pathForIndex() {
  return /\.html$/.test(window.location.pathname) ? "index.html" : "/";
}

// Liga/desliga o estado de carregamento do botão
function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.setAttribute("aria-busy", String(loading));
  submitBtn.innerHTML = loading
    ? '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Entrando...'
    : submitLabel;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMessage.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  setLoading(true);
  try {
    await login(email, password);
    // Redirecionar sem adicionar ao histórico
    window.location.replace(pathForIndex());
  } catch (error) {
    // Detalhe técnico só no console; usuário vê mensagem em português
    console.error("Falha no login:", error.code);
    errorMessage.textContent =
      AUTH_ERROR_MESSAGES[error.code] ||
      "Não foi possível entrar. Tente novamente.";
    setLoading(false);
    document.getElementById("password").select();
  }
});

// Já autenticado: vai direto para o painel
onAuthStateChange((user) => {
  if (user) {
    window.location.replace(pathForIndex());
  }
});

// theme-init.js - Aplica o tema salvo ANTES da primeira pintura da página.
// Carregado como script clássico (síncrono) no <head> para evitar o "piscar"
// do tema claro quando o usuário usa o tema escuro.
(function applySavedTheme() {
  try {
    // Tema escolhido manualmente tem prioridade; sem escolha, segue o sistema
    const saved = localStorage.getItem("theme");
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefersDark)) {
      document.documentElement.classList.add("dark-theme");
    }
  } catch {
    // localStorage bloqueado (modo privado etc.): mantém o tema claro padrão
  }
})();

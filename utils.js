// utils.js - Helpers compartilhados entre os módulos (escape, datas, toast e diálogos)

// ============================================================
// Segurança: escape de HTML
// ============================================================

// Mapa de caracteres que precisam ser escapados antes de ir para innerHTML
const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapa um valor qualquer para uso seguro dentro de innerHTML ou de
 * atributos HTML. Evita XSS e quebra de layout com nomes como "D'Ávila".
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

// ============================================================
// Datas no fuso local (evita o bug de "um dia antes" do UTC)
// ============================================================

/**
 * Converte um Date (ou timestamp) para "YYYY-MM-DD" no fuso LOCAL.
 * Substitui toISOString().split("T")[0], que usa UTC e erra o dia à noite.
 */
export function toLocalISODate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converte o valor de um <input type="date"> ("YYYY-MM-DD") em timestamp
 * da meia-noite LOCAL. Retorna null se o valor estiver vazio ou inválido.
 */
export function dateInputToTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(`${value}T00:00:00`).getTime();
  return isNaN(timestamp) ? null : timestamp;
}

// ============================================================
// Toast de feedback (anunciado para leitores de tela via aria-live)
// ============================================================

// Timer do toast atual, para poder cancelar quando outro toast aparecer
let toastTimer = null;

/**
 * Exibe um toast de feedback.
 * @param {string} message - texto exibido (inserido como texto, nunca como HTML)
 * @param {"success"|"error"|"info"} type - variação visual
 * @param {{label: string, onClick: Function}} [action] - botão opcional (ex: "Desfazer")
 * @param {number} [duration] - tempo em ms até sumir
 */
export function showToast(message, type = "success", action = null, duration) {
  // Remove toast anterior para não empilhar
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  clearTimeout(toastTimer);

  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-xmark",
    info: "fa-circle-info",
  };

  // Monta o toast com role adequado: erro interrompe o leitor de tela, o resto não
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");

  const icon = document.createElement("i");
  icon.className = `fas ${icons[type] || icons.info}`;
  icon.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.textContent = message;

  toast.append(icon, text);

  // Botão de ação opcional (ex: desfazer exclusão)
  if (action) {
    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "toast-action";
    actionBtn.textContent = action.label;
    actionBtn.addEventListener("click", () => {
      action.onClick();
      hideToast(toast);
    });
    toast.appendChild(actionBtn);
  }

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  // Toast com ação fica mais tempo na tela para dar tempo de clicar
  const timeout = duration || (action ? 6000 : 3000);
  toastTimer = setTimeout(() => hideToast(toast), timeout);
}

// Esconde o toast com transição e remove do DOM
function hideToast(toast) {
  toast.classList.remove("toast-visible");
  setTimeout(() => toast.remove(), 300);
}

// ============================================================
// Diálogos (substituem confirm() e prompt() nativos)
// ============================================================

/**
 * Abre o <dialog id="appDialog"> genérico e resolve com o resultado.
 * - modo "confirm": resolve true/false
 * - modo "prompt": resolve o texto digitado ou null se cancelado
 */
function openAppDialog({
  title,
  message = "",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  input = null,
}) {
  const dialog = document.getElementById("appDialog");

  // Fallback se a página não tiver o dialog (não deveria acontecer)
  if (!dialog) {
    if (input) return Promise.resolve(window.prompt(title, input.value || ""));
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  const titleEl = dialog.querySelector("#appDialogTitle");
  const messageEl = dialog.querySelector("#appDialogMessage");
  const inputWrapper = dialog.querySelector("#appDialogInputWrapper");
  const inputLabel = dialog.querySelector("#appDialogInputLabel");
  const inputEl = dialog.querySelector("#appDialogInput");
  const confirmBtn = dialog.querySelector("#appDialogConfirm");
  const cancelBtn = dialog.querySelector("#appDialogCancel");
  const form = dialog.querySelector("form");

  // Preenche textos sempre via textContent (sem risco de XSS)
  titleEl.textContent = title;
  messageEl.textContent = message;
  messageEl.hidden = !message;
  confirmBtn.textContent = confirmLabel;
  cancelBtn.textContent = cancelLabel;
  confirmBtn.classList.toggle("btn-danger", danger);

  // Campo de texto só aparece no modo prompt
  inputWrapper.hidden = !input;
  if (input) {
    inputLabel.textContent = input.label || "";
    inputEl.value = input.value || "";
  }

  return new Promise((resolve) => {
    // Resolve conforme o botão usado para fechar (returnValue do dialog)
    const handleClose = () => {
      dialog.removeEventListener("close", handleClose);
      cancelBtn.removeEventListener("click", handleCancel);
      const confirmed = dialog.returnValue === "confirm";
      if (input) resolve(confirmed ? inputEl.value.trim() : null);
      else resolve(confirmed);
    };

    // Cancelar fecha sem confirmar
    const handleCancel = () => dialog.close("cancel");

    dialog.addEventListener("close", handleClose);
    cancelBtn.addEventListener("click", handleCancel);

    // Garante que Enter no input/submit grave "confirm" como resultado
    form.onsubmit = (e) => {
      e.preventDefault();
      dialog.close("confirm");
    };

    dialog.returnValue = "";
    dialog.showModal();

    // Foco inicial: no campo (prompt) ou no botão seguro (cancelar) em ação destrutiva
    if (input) inputEl.focus();
    else if (danger) cancelBtn.focus();
    else confirmBtn.focus();
  });
}

/** Pergunta de confirmação (sim/não). Resolve true se confirmado. */
export function confirmDialog(options) {
  return openAppDialog(options);
}

/** Pede um texto ao usuário. Resolve o texto ou null se cancelado. */
export function promptDialog({ title, label, value = "", confirmLabel = "OK" }) {
  return openAppDialog({ title, confirmLabel, input: { label, value } });
}

/**
 * Liga o comportamento padrão de um <dialog>: botão [data-close] fecha e
 * clique no backdrop (fora da caixa) também fecha. Esc já é nativo.
 */
export function setupDialog(dialog) {
  if (!dialog) return;

  // Botões com data-close fecham o dialog
  dialog.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => dialog.close());
  });

  // Clique fora da caixa (no backdrop) fecha o dialog
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });
}

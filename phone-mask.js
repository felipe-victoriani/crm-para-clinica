// phone-mask.js - Formatação automática de telefone

/**
 * Remove todos os caracteres não numéricos de um telefone
 */
export function cleanPhone(phone) {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/**
 * Formata um telefone no padrão brasileiro
 * Aceita qualquer entrada e remove caracteres especiais
 * Exemplos:
 * - 67999915653 → (67) 99999-5653
 * - 6799991565 → (67) 9999-1565
 * - 1140041234 → (11) 4004-1234
 */
export function formatPhone(value) {
  if (!value) return "";

  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, "");

  // Limita a 11 dígitos (DDD + 9 dígitos)
  const limited = numbers.slice(0, 11);

  // Formata conforme o tamanho
  if (limited.length <= 2) {
    return limited;
  } else if (limited.length <= 6) {
    // (XX) XXXX
    return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  } else if (limited.length <= 10) {
    // (XX) XXXX-XXXX (telefone fixo)
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  } else {
    // (XX) XXXXX-XXXX (celular com 9)
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7, 11)}`;
  }
}

/**
 * Aplica máscara de telefone em um campo input
 */
export function applyPhoneMask(input) {
  if (!input) return;

  // Evento de input para formatar enquanto digita
  input.addEventListener("input", (e) => {
    const cursorPos = e.target.selectionStart;
    const oldValue = e.target.value;
    const oldLength = oldValue.length;

    // Formatar o valor
    const formatted = formatPhone(oldValue);
    e.target.value = formatted;

    // Ajustar posição do cursor
    const newLength = formatted.length;
    const diff = newLength - oldLength;

    // Se adicionou caracteres (parênteses, espaço, hífen), ajustar cursor
    if (diff > 0 && cursorPos > 0) {
      e.target.setSelectionRange(cursorPos + diff, cursorPos + diff);
    } else {
      e.target.setSelectionRange(cursorPos, cursorPos);
    }
  });

  // Evento de blur para garantir formatação ao sair do campo
  input.addEventListener("blur", (e) => {
    e.target.value = formatPhone(e.target.value);
  });

  // Evento de paste para formatar ao colar
  input.addEventListener("paste", (e) => {
    setTimeout(() => {
      e.target.value = formatPhone(e.target.value);
    }, 10);
  });

  // Formatar valor inicial se já houver
  if (input.value) {
    input.value = formatPhone(input.value);
  }
}

/**
 * Inicializa máscaras de telefone em todos os campos
 */
export function initPhoneMasks() {
  // Campo de adicionar paciente
  const pPhone = document.getElementById("pPhone");
  if (pPhone) {
    applyPhoneMask(pPhone);
  }

  // Campo de editar paciente
  const editPhone = document.getElementById("editPhone");
  if (editPhone) {
    applyPhoneMask(editPhone);
  }
}

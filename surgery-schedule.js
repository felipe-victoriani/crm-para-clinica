// surgery-schedule.js - Módulo de Agenda Cirúrgica
import { getPatients, updatePatient } from "./patients.js";
import {
  gerarCartaoConfirmacao,
  downloadCartaoImage,
  copyCartaoToClipboard,
} from "./cartaoConfirmacao.js";

/**
 * Converte uma string de data YYYY-MM-DD para Date no timezone local
 * Evita problemas de conversão UTC que podem mudar o dia
 */
function parseDateLocal(dateString) {
  if (!dateString) return null;

  // Se já é um objeto Date, retornar ele mesmo
  if (dateString instanceof Date) {
    return dateString;
  }

  // Se é string, fazer o parse local
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Obtém pacientes que agendaram cirurgia
 * Se o paciente tem duas datas (surgeryDate e surgeryDate2), cria dois registros separados
 */
export function getSurgeryScheduledPatients() {
  const allPatients = getPatients();
  const surgeryPatients = [];

  allPatients.forEach((p) => {
    if (p.status === "Paciente agendou cirurgia" && p.surgeryDate) {
      // Adicionar card para a primeira data
      surgeryPatients.push({
        ...p,
        _displayDate: p.surgeryDate,
        _isSecondSurgery: false,
      });

      // Se houver segunda data, adicionar card separado
      if (p.surgeryDate2) {
        surgeryPatients.push({
          ...p,
          _displayDate: p.surgeryDate2,
          _isSecondSurgery: true,
        });
      }
    }
  });

  return surgeryPatients;
}

/**
 * Calcula os dias da semana para lembretes
 * Cirurgias são às quartas-feiras
 * Lembretes: sexta anterior (5 dias, mensagem de texto) e terça anterior (1 dia, cartão de confirmação)
 */
export function calculateReminderDates(surgeryDate) {
  const surgery = parseDateLocal(surgeryDate);
  if (!surgery) return null;

  // Verificar se é uma quarta-feira (3 = quarta)
  const dayOfWeek = surgery.getDay();
  const isWednesday = dayOfWeek === 3;

  // Calcular sexta anterior (5 dias antes)
  const friday = new Date(surgery);
  friday.setDate(surgery.getDate() - 5);

  // Calcular terça anterior (1 dia antes)
  const tuesday = new Date(surgery);
  tuesday.setDate(surgery.getDate() - 1);

  // Calcular dias restantes
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const surgeryDay = new Date(surgery);
  surgeryDay.setHours(0, 0, 0, 0);
  const daysUntilSurgery = Math.ceil(
    (surgeryDay - today) / (1000 * 60 * 60 * 24),
  );

  return {
    surgery: surgery,
    friday: friday,
    tuesday: tuesday,
    isWednesday: isWednesday,
    daysUntilSurgery: daysUntilSurgery,
    isPast: daysUntilSurgery < 0,
    shouldSendFridayReminder: daysUntilSurgery === 5,
    shouldSendTuesdayReminder: daysUntilSurgery === 1,
  };
}

/**
 * Formata data no padrão brasileiro com dia da semana
 */
export function formatDateWithWeekday(date) {
  const days = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
  ];
  const d = parseDateLocal(date);
  if (!d) return { full: "", short: "", dayName: "" };

  const dayName = days[d.getDay()];
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return {
    full: `${dayName}, ${day}/${month}/${year}`,
    short: `${day}/${month}/${year}`,
    dayName: dayName,
  };
}

/**
 * Gera mensagem de lembrete personalizada para WhatsApp
 */
export function generateReminderMessage(patient, daysUntil) {
  // Usar a data de exibição específica do card (_displayDate) ou a primeira data como fallback
  const dateToUse = patient._displayDate || patient.surgeryDate;
  const surgeryDateInfo = formatDateWithWeekday(dateToUse);
  const surgeryTime = patient.surgeryTime || "07h15"; // Horário padrão se não especificado

  let message = `Olá, *${patient.name}*, tudo bem?\n\n`;
  message += `Gostaria primeiramente de agradecer a confiança em nossa equipe nesse momento importante!\n\n`;

  if (daysUntil === 5) {
    message += `Faltam *5 dias* para sua cirurgia oftalmológica, `;
  } else if (daysUntil === 2) {
    message += `Faltam *2 dias* para sua cirurgia oftalmológica, `;
  } else {
    message += `Sua cirurgia oftalmológica está `;
  }

  message += `pré-agendada para *${surgeryDateInfo.short}* (${surgeryDateInfo.dayName}), às *${surgeryTime}*, na Clínica Oftalmo 15.\n\n`;

  message += `Estou entrando em contato para saber: você tem alguma dúvida sobre a cirurgia, orientações pré e pós-operatórias?\n\n`;
  message += `Não hesite em nos perguntar! Sua tranquilidade é nossa prioridade. Estamos à disposição para ajudar!\n\n`;
  message += `Estamos à disposição para o que precisar e desejamos que se sinta tranquilo(a) e seguro(a) para o seu procedimento.\n\n`;
  message += `Atenciosamente,\n\nEquipe Oftalmo 15.`;

  return message;
}

/**
 * Gera link do WhatsApp, opcionalmente com mensagem pré-preenchida.
 * Sem mensagem, apenas abre a conversa (usado no fluxo de colar imagem).
 */
export function generateWhatsAppLink(phone, message) {
  // Remover caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, "");

  // Verificar se já tem código do país
  let fullPhone = cleanPhone;
  if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
    fullPhone = "55" + cleanPhone;
  }

  if (!message) {
    return `https://wa.me/${fullPhone}`;
  }

  // Codificar mensagem para URL
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${fullPhone}?text=${encodedMessage}`;
}

/**
 * Sufixo usado nos campos de controle (envio/confirmação) quando o card
 * se refere à segunda cirurgia do paciente (outro olho).
 */
function fieldSuffix(patient) {
  return patient._isSecondSurgery ? "2" : "";
}

function fridaySentField(patient) {
  return "reminderFridaySentAt" + fieldSuffix(patient);
}

function tuesdaySentField(patient) {
  return "reminderTuesdaySentAt" + fieldSuffix(patient);
}

function confirmedField(patient) {
  return "surgeryConfirmed" + fieldSuffix(patient);
}

function confirmedAtField(patient) {
  return "surgeryConfirmedAt" + fieldSuffix(patient);
}

function getReminderSentAt(patient, type) {
  const field = type === "friday" ? fridaySentField(patient) : tuesdaySentField(patient);
  return patient[field] || null;
}

function isSurgeryConfirmed(patient) {
  return !!patient[confirmedField(patient)];
}

/**
 * Formata um timestamp de envio/confirmação como "DD/MM às HHhMM"
 */
function formatSentAt(timestamp) {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} às ${hours}h${minutes}`;
}

/**
 * Encontra, dentre os pacientes com cirurgia agendada, o card correspondente
 * a um cardId (patientId-data), já que um paciente pode ter 2 cirurgias.
 */
function findPatientByCardId(cardId) {
  const patients = getSurgeryScheduledPatients();
  return patients.find((p) => `${p.id}-${p._displayDate}` === cardId);
}

/**
 * Envia o lembrete de texto de sexta-feira via WhatsApp e registra o envio.
 */
async function sendFridayReminder(patient) {
  const dateToUse = patient._displayDate || patient.surgeryDate;
  const reminderInfo = calculateReminderDates(dateToUse);
  const daysUntil = reminderInfo ? reminderInfo.daysUntilSurgery : 5;

  const message = generateReminderMessage(patient, daysUntil);
  const whatsappLink = generateWhatsAppLink(patient.phone, message);
  window.open(whatsappLink, "_blank");

  await updatePatient(patient.id, {
    [fridaySentField(patient)]: Date.now(),
  });
}

/**
 * Gera o cartão de confirmação de terça-feira, tenta copiar pra área de
 * transferência e abrir o WhatsApp do paciente; se o navegador não suportar,
 * cai no fallback de baixar/anexar manualmente. Registra o envio quando o
 * usuário efetivamente completa uma das duas ações.
 */
async function sendTuesdayCard(patient) {
  const dateToUse = patient._displayDate || patient.surgeryDate;
  const surgeryDateInfo = formatDateWithWeekday(dateToUse);
  const dataCirurgia = surgeryDateInfo.short
    ? surgeryDateInfo.short.slice(0, 5) // DD/MM/AAAA -> DD/MM
    : "";

  const { dataUrl, blob, fileName } = await gerarCartaoConfirmacao({
    nome: patient.name,
    dataCirurgia,
    horario: patient.surgeryTime || "07h15",
  });

  try {
    await copyCartaoToClipboard(blob);
    const chatLink = generateWhatsAppLink(patient.phone, null);
    window.open(chatLink, "_blank");

    await updatePatient(patient.id, {
      [tuesdaySentField(patient)]: Date.now(),
    });

    if (typeof window.showToast === "function") {
      window.showToast(
        "Imagem copiada! Cole (Ctrl+V) na conversa que acabou de abrir e envie.",
        "success",
      );
    } else {
      alert(
        "Imagem copiada! Cole (Ctrl+V) na conversa que acabou de abrir e envie.",
      );
    }
  } catch (clipboardError) {
    console.warn(
      "Não foi possível copiar automaticamente, caindo para download manual:",
      clipboardError,
    );
    if (typeof window.showToast === "function") {
      window.showToast(
        "Não foi possível copiar automaticamente neste navegador. Baixe e anexe manualmente.",
        "error",
      );
    }
    openCardPreviewModal(dataUrl, fileName, patient);
  }
}

/**
 * Alterna a confirmação manual de presença do paciente para a cirurgia exibida.
 */
async function toggleSurgeryConfirmed(patient) {
  const newValue = !isSurgeryConfirmed(patient);
  await updatePatient(patient.id, {
    [confirmedField(patient)]: newValue,
    [confirmedAtField(patient)]: newValue ? Date.now() : null,
  });
  return newValue;
}

/**
 * Re-renderiza a agenda mantendo o filtro de data atualmente aplicado.
 */
function rerenderKeepingFilter() {
  const dateFilter = document.getElementById("surgeryDateFilter");
  renderSurgerySchedule(
    dateFilter && dateFilter.value ? dateFilter.value : null,
  );
}

/**
 * Lista os lembretes (sexta ou terça) que deveriam ser enviados hoje e ainda
 * não foram registrados como enviados, para a fila de "Lembretes de Hoje".
 */
function getPendingRemindersToday() {
  const patients = getSurgeryScheduledPatients();
  const pending = [];

  patients.forEach((patient) => {
    const dateToUse = patient._displayDate || patient.surgeryDate;
    const reminderInfo = calculateReminderDates(dateToUse);
    if (!reminderInfo || reminderInfo.isPast) return;

    if (
      reminderInfo.shouldSendFridayReminder &&
      !getReminderSentAt(patient, "friday")
    ) {
      pending.push({ patient, type: "friday" });
    }
    if (
      reminderInfo.shouldSendTuesdayReminder &&
      !getReminderSentAt(patient, "tuesday")
    ) {
      pending.push({ patient, type: "tuesday" });
    }
  });

  return pending;
}

/**
 * Organiza pacientes por semana de cirurgia
 */
export function groupPatientsByWeek(patients) {
  const groups = {};

  patients.forEach((patient) => {
    if (!patient.surgeryDate) return;

    const surgery = new Date(patient.surgeryDate);
    surgery.setHours(12, 0, 0, 0);

    // Encontrar a quarta-feira da semana
    const dayOfWeek = surgery.getDay();
    const daysToWednesday = (3 - dayOfWeek + 7) % 7;
    const wednesday = new Date(surgery);
    wednesday.setDate(surgery.getDate() + daysToWednesday);

    const weekKey = wednesday.toISOString().split("T")[0];

    if (!groups[weekKey]) {
      groups[weekKey] = {
        date: wednesday,
        patients: [],
      };
    }

    groups[weekKey].patients.push(patient);
  });

  // Ordenar por data
  return Object.keys(groups)
    .sort()
    .map((key) => groups[key]);
}

/**
 * Renderiza a agenda cirúrgica
 */
export function renderSurgerySchedule(filterDate = null) {
  const container = document.getElementById("surgeryScheduleContent");
  const counter = document.getElementById("surgeryCounter");

  if (!container) return;

  try {
    let patients = getSurgeryScheduledPatients();

    // Aplicar filtro de data se fornecido
    if (filterDate) {
      patients = patients.filter((p) => p._displayDate === filterDate);
    }

    if (counter) {
      counter.textContent = `(${patients.length})`;
    }

    // Criar controles de filtro
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    let html = `
    <div class="surgery-filters">
      <div class="filter-group">
        <label><i class="fas fa-calendar"></i> Filtrar por data:</label>
        <input 
          type="date" 
          id="surgeryDateFilter" 
          class="date-filter-input"
          value="${filterDate || ""}"
          placeholder="Todas as datas"
        />
        <button id="clearDateFilter" class="btn-clear-filter" title="Limpar filtro">
          <i class="fas fa-times"></i> Limpar
        </button>
      </div>
      <div class="filter-quick-links">
        <button class="btn-quick-filter" data-filter="today">Hoje</button>
        <button class="btn-quick-filter" data-filter="week">Esta Semana</button>
        <button class="btn-quick-filter" data-filter="month">Este Mês</button>
        <button class="btn-quick-filter" data-filter="all">Todas</button>
      </div>
    </div>
  `;

    // Fila de lembretes pendentes de hoje (independe do filtro de data ativo)
    const pendingToday = getPendingRemindersToday();
    if (pendingToday.length > 0) {
      html += `
      <div class="surgery-section surgery-pending-today">
        <h3><i class="fas fa-bell"></i> Lembretes Pendentes de Hoje (${pendingToday.length})</h3>
        <div class="pending-reminders-list">
          ${pendingToday
            .map(({ patient, type }) => {
              const cardId = `${patient.id}-${patient._displayDate}`;
              const isFriday = type === "friday";
              const label = isFriday
                ? "Lembrete Sexta (texto)"
                : "Cartão de Confirmação (terça)";
              const iconSet = isFriday ? "fab" : "fas";
              const icon = isFriday ? "fa-whatsapp" : "fa-id-card";
              return `
              <div class="pending-reminder-row">
                <div class="pending-reminder-info">
                  <strong>${patient.name}</strong>
                  <span class="pending-reminder-type">${label}</span>
                </div>
                <button class="btn-send-pending" data-card-id="${cardId}" data-type="${type}">
                  <i class="${iconSet} ${icon}"></i> Enviar
                </button>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
    `;
    }

    if (patients.length === 0) {
      html += `
      <div class="empty-state">
        <i class="fas fa-calendar-xmark"></i>
        <h3>Nenhuma cirurgia ${filterDate ? "nesta data" : "agendada"}</h3>
        <p>${filterDate ? "Tente outra data ou limpe o filtro." : "Quando pacientes agendarem cirurgias, eles aparecerão aqui."}</p>
      </div>
    `;
      container.innerHTML = html;
      attachFilterListeners();
      attachPendingReminderListeners();
      return;
    }

    // Separar por status: futuras, hoje, passadas
    today.setHours(0, 0, 0, 0);

    const futurePatients = patients
      .filter((p) => {
        const surgery = parseDateLocal(p._displayDate || p.surgeryDate);
        if (!surgery) return false;
        surgery.setHours(0, 0, 0, 0);
        return surgery > today;
      })
      .sort((a, b) => {
        const dateA = parseDateLocal(a._displayDate || a.surgeryDate);
        const dateB = parseDateLocal(b._displayDate || b.surgeryDate);
        if (!dateA || !dateB) return 0;
        return dateA - dateB;
      });

    const todayPatients = patients.filter((p) => {
      const surgery = parseDateLocal(p._displayDate || p.surgeryDate);
      if (!surgery) return false;
      surgery.setHours(0, 0, 0, 0);
      return surgery.getTime() === today.getTime();
    });

    const pastPatients = patients
      .filter((p) => {
        const surgery = parseDateLocal(p._displayDate || p.surgeryDate);
        if (!surgery) return false;
        surgery.setHours(0, 0, 0, 0);
        return surgery < today;
      })
      .sort((a, b) => {
        const dateA = parseDateLocal(a._displayDate || a.surgeryDate);
        const dateB = parseDateLocal(b._displayDate || b.surgeryDate);
        if (!dateA || !dateB) return 0;
        return dateB - dateA;
      });

    // Cirurgias de hoje
    if (todayPatients.length > 0) {
      html += '<div class="surgery-section surgery-today">';
      html += '<h3><i class="fas fa-star"></i> Cirurgias de Hoje</h3>';
      html += '<div class="surgery-cards">';
      todayPatients.forEach((patient) => {
        html += renderSurgeryCard(patient, "today");
      });
      html += "</div></div>";
    }

    // Próximas cirurgias
    if (futurePatients.length > 0) {
      html += '<div class="surgery-section surgery-upcoming">';
      html +=
        '<h3><i class="fas fa-calendar-days"></i> Próximas Cirurgias</h3>';
      html += '<div class="surgery-cards">';
      futurePatients.forEach((patient) => {
        html += renderSurgeryCard(patient, "upcoming");
      });
      html += "</div></div>";
    }

    // Cirurgias passadas (últimas 10)
    if (pastPatients.length > 0) {
      html += '<div class="surgery-section surgery-past">';
      html += '<h3><i class="fas fa-history"></i> Cirurgias Realizadas</h3>';
      html += '<div class="surgery-cards">';
      pastPatients.slice(0, 10).forEach((patient) => {
        html += renderSurgeryCard(patient, "past");
      });
      html += "</div></div>";
    }

    container.innerHTML = html;

    // Adicionar event listeners
    attachWhatsAppListeners();
    attachCardConfirmacaoListeners();
    attachConfirmPresenceListeners();
    attachPendingReminderListeners();
    attachFilterListeners();
  } catch (error) {
    console.error("Erro ao renderizar agenda cirúrgica:", error);
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Erro ao carregar agenda</h3>
        <p>Ocorreu um erro ao carregar a agenda cirúrgica. Tente recarregar a página.</p>
        <p style="color: #ef4444; font-size: 0.85rem; margin-top: 0.5rem;">Detalhes: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Renderiza card individual de cirurgia
 */
function renderSurgeryCard(patient, type) {
  // Usar a data de exibição específica (_displayDate) ou a primeira data como fallback
  const dateToDisplay = patient._displayDate || patient.surgeryDate;
  const reminderInfo = calculateReminderDates(dateToDisplay);
  const surgeryDateInfo = formatDateWithWeekday(dateToDisplay);
  const surgeryTime = patient.surgeryTime || "07h15";

  // Verificação de segurança - verificar se os dados são válidos
  if (!reminderInfo || !surgeryDateInfo || !surgeryDateInfo.short) {
    console.warn(
      "Dados de cirurgia inválidos para paciente:",
      patient.id,
      dateToDisplay,
    );
    return "";
  }

  let statusClass = "";
  let statusText = "";
  let statusIcon = "";

  if (type === "today") {
    statusClass = "status-today";
    statusText = "HOJE";
    statusIcon = "fa-star";
  } else if (type === "upcoming") {
    statusClass = "status-upcoming";
    if (reminderInfo.daysUntilSurgery === 1) {
      statusText = "AMANHÃ";
    } else if (reminderInfo.daysUntilSurgery <= 7) {
      statusText = `EM ${reminderInfo.daysUntilSurgery} DIAS`;
    } else {
      statusText = `${reminderInfo.daysUntilSurgery} dias`;
    }
    statusIcon = "fa-calendar-check";
  } else {
    statusClass = "status-past";
    const daysPast = Math.abs(reminderInfo.daysUntilSurgery);
    statusText = `Há ${daysPast} dia${daysPast !== 1 ? "s" : ""}`;
    statusIcon = "fa-check-circle";
  }

  const fridayInfo = formatDateWithWeekday(reminderInfo.friday) || {
    full: "",
    short: "",
    dayName: "",
  };
  const tuesdayInfo = formatDateWithWeekday(reminderInfo.tuesday) || {
    full: "",
    short: "",
    dayName: "",
  };

  const fridaySentAt = getReminderSentAt(patient, "friday");
  const tuesdaySentAt = getReminderSentAt(patient, "tuesday");
  const confirmed = isSurgeryConfirmed(patient);

  let reminderStatus = "";
  if (type !== "past") {
    // Bloco do lembrete de sexta (texto)
    if (reminderInfo.shouldSendFridayReminder && !fridaySentAt) {
      reminderStatus +=
        '<div class="reminder-alert reminder-friday"><i class="fas fa-bell"></i> Enviar lembrete de sexta-feira HOJE</div>';
    } else if (
      !fridaySentAt &&
      reminderInfo.daysUntilSurgery < 5 &&
      reminderInfo.daysUntilSurgery > 1
    ) {
      reminderStatus +=
        '<div class="reminder-alert reminder-overdue"><i class="fas fa-triangle-exclamation"></i> Lembrete de sexta atrasado — ainda não enviado</div>';
    } else if (!fridaySentAt && reminderInfo.daysUntilSurgery > 5) {
      reminderStatus += `<div class="reminder-info">Próximo lembrete: ${fridayInfo.short} (sexta)</div>`;
    }

    // Bloco do cartão de terça
    if (reminderInfo.shouldSendTuesdayReminder && !tuesdaySentAt) {
      reminderStatus +=
        '<div class="reminder-alert reminder-tuesday"><i class="fas fa-bell"></i> Enviar cartão de confirmação de terça-feira HOJE</div>';
    } else if (!tuesdaySentAt && reminderInfo.daysUntilSurgery <= 0) {
      reminderStatus +=
        '<div class="reminder-alert reminder-overdue"><i class="fas fa-triangle-exclamation"></i> Cartão de terça atrasado — ainda não enviado</div>';
    } else if (
      !tuesdaySentAt &&
      reminderInfo.daysUntilSurgery > 1 &&
      reminderInfo.daysUntilSurgery <= 5
    ) {
      reminderStatus += `<div class="reminder-info">Próximo lembrete: ${tuesdayInfo.short} (terça)</div>`;
    }

    // Badges de confirmação de envio
    if (fridaySentAt) {
      reminderStatus += `<div class="reminder-sent-badge"><i class="fas fa-check-circle"></i> Sexta enviada em ${formatSentAt(fridaySentAt)}</div>`;
    }
    if (tuesdaySentAt) {
      reminderStatus += `<div class="reminder-sent-badge"><i class="fas fa-check-circle"></i> Cartão enviado em ${formatSentAt(tuesdaySentAt)}</div>`;
    }
  }

  const wednesdayWarning =
    !reminderInfo.isWednesday && type !== "past"
      ? '<div class="warning-badge"><i class="fas fa-exclamation-triangle"></i> Cirurgia não é numa quarta-feira</div>'
      : "";

  // Indicador se é a segunda cirurgia
  const secondSurgeryBadge = patient._isSecondSurgery
    ? '<div class="second-surgery-badge"><i class="fas fa-eye"></i> Segunda cirurgia (outro olho)</div>'
    : "";

  // ID único para o card (inclui a data para diferenciar quando há duas cirurgias)
  const cardId = `${patient.id}-${dateToDisplay}`;

  return `
    <div class="surgery-card ${statusClass}" data-patient-id="${patient.id}" data-card-id="${cardId}" data-display-date="${dateToDisplay}">
      <div class="surgery-card-header">
        <div class="surgery-status">
          <i class="fas ${statusIcon}"></i>
          <span>${statusText}</span>
        </div>
        <div class="surgery-date">
          <strong>${surgeryDateInfo.short}</strong>
          <small>${surgeryDateInfo.dayName}</small>
        </div>
      </div>
      
      <div class="surgery-card-body">
        <h4><i class="fas fa-user"></i> ${patient.name}</h4>
        ${secondSurgeryBadge}
        <div class="surgery-details">
          <p><i class="fas fa-scissors"></i> <strong>Cirurgia:</strong> ${patient.surgeryType || "Não especificado"}</p>
          <p class="editable-time-row">
            <i class="fas fa-clock"></i> 
            <strong>Horário:</strong> 
            <input 
              type="time" 
              class="surgery-time-input" 
              data-patient-id="${patient.id}" 
              value="${surgeryTime.replace("h", ":")}" 
              title="Clique para editar o horário"
            />
          </p>
          <p><i class="fas fa-phone"></i> <strong>Telefone:</strong> ${patient.phone}</p>
          ${patient.doctor ? `<p><i class="fas fa-user-md"></i> <strong>Médico:</strong> ${patient.doctor}</p>` : ""}
        </div>
        ${wednesdayWarning}
        ${reminderStatus}
      </div>
      
      <div class="surgery-card-footer">
        ${
          type !== "past"
            ? `
          <button class="btn-whatsapp btn-reminder-5 ${fridaySentAt ? "btn-sent" : ""}" data-card-id="${cardId}" title="${fridaySentAt ? "Reenviar lembrete de sexta" : "Lembrete 5 dias antes"}">
            <i class="fab fa-whatsapp"></i> ${fridaySentAt ? "Reenviar Sexta" : "Lembrete Sexta (5 dias)"}
          </button>
          <button class="btn-card-confirmacao ${tuesdaySentAt ? "btn-sent" : ""}" data-card-id="${cardId}" title="${tuesdaySentAt ? "Reenviar cartão de confirmação" : "Copia o cartão e abre o WhatsApp do paciente (cole com Ctrl+V)"}">
            <i class="fas fa-id-card"></i> ${tuesdaySentAt ? "Reenviar Cartão" : "Enviar Cartão (terça)"}
          </button>
          <button class="btn-confirm-presence ${confirmed ? "btn-confirmed" : ""}" data-card-id="${cardId}" title="Marcar/desmarcar confirmação de presença do paciente">
            <i class="fas ${confirmed ? "fa-check-circle" : "fa-circle-question"}"></i> ${confirmed ? "Presença Confirmada" : "Marcar Presença"}
          </button>
        `
            : ""
        }
        <button class="btn-view-patient" data-patient-id="${patient.id}" title="Ver detalhes do paciente">
          <i class="fas fa-eye"></i> Ver Paciente
        </button>
      </div>
    </div>
  `;
}

/**
 * Adiciona listeners para botões de WhatsApp
 */
function attachWhatsAppListeners() {
  const whatsappButtons = document.querySelectorAll(".btn-whatsapp");
  const viewButtons = document.querySelectorAll(".btn-view-patient");
  const timeInputs = document.querySelectorAll(".surgery-time-input");

  // Listeners para botões WhatsApp (lembrete de sexta)
  whatsappButtons.forEach((button) => {
    button.addEventListener("click", async (e) => {
      const cardId = e.currentTarget.dataset.cardId;
      const patient = findPatientByCardId(cardId);
      if (!patient) return;

      try {
        await sendFridayReminder(patient);
        rerenderKeepingFilter();
      } catch (error) {
        console.error("Erro ao enviar lembrete de sexta:", error);
        if (typeof window.showToast === "function") {
          window.showToast("Erro ao registrar envio do lembrete", "error");
        }
      }
    });
  });

  // Listeners para visualizar paciente
  viewButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      const patientId = e.currentTarget.dataset.patientId;
      // Trocar para a seção de pacientes e abrir o modal de edição
      document.querySelector('[data-section="patients"]').click();
      setTimeout(() => {
        const editButton = document.querySelector(`[data-id="${patientId}"]`);
        if (editButton) {
          editButton.click();
        }
      }, 100);
    });
  });

  // Listeners para editar horário
  timeInputs.forEach((input) => {
    input.addEventListener("change", async (e) => {
      const patientId = e.target.dataset.patientId;
      const newTime = e.target.value; // formato HH:MM

      if (newTime) {
        // Converter para formato brasileiro HHhMM
        const formattedTime = newTime.replace(":", "h");

        try {
          await updatePatient(patientId, { surgeryTime: formattedTime });

          // Mostrar feedback visual
          e.target.style.borderColor = "#10b981";
          setTimeout(() => {
            e.target.style.borderColor = "";
          }, 1000);

          // Atualizar se a função de toast existir
          if (typeof window.showToast === "function") {
            window.showToast("Horário atualizado!", "success");
          }
        } catch (error) {
          console.error("Erro ao atualizar horário:", error);
          e.target.style.borderColor = "#ef4444";
          if (typeof window.showToast === "function") {
            window.showToast("Erro ao atualizar horário", "error");
          }
        }
      }
    });
  });
}

/**
 * Adiciona listeners para o botão de enviar cartão de confirmação
 */
function attachCardConfirmacaoListeners() {
  const cardButtons = document.querySelectorAll(".btn-card-confirmacao");

  cardButtons.forEach((button) => {
    button.addEventListener("click", async (e) => {
      const cardId = e.currentTarget.dataset.cardId;
      const patient = findPatientByCardId(cardId);
      if (!patient) return;

      const originalLabel = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

      try {
        await sendTuesdayCard(patient);
        rerenderKeepingFilter();
      } catch (error) {
        console.error("Erro ao gerar cartão de confirmação:", error);
        if (typeof window.showToast === "function") {
          window.showToast(
            error.message || "Erro ao gerar cartão de confirmação",
            "error",
          );
        } else {
          alert(error.message || "Erro ao gerar cartão de confirmação");
        }
        button.disabled = false;
        button.innerHTML = originalLabel;
      }
    });
  });
}

/**
 * Adiciona listeners para o botão de confirmar presença do paciente
 */
function attachConfirmPresenceListeners() {
  const confirmButtons = document.querySelectorAll(".btn-confirm-presence");

  confirmButtons.forEach((button) => {
    button.addEventListener("click", async (e) => {
      const cardId = e.currentTarget.dataset.cardId;
      const patient = findPatientByCardId(cardId);
      if (!patient) return;

      button.disabled = true;
      try {
        await toggleSurgeryConfirmed(patient);
        rerenderKeepingFilter();
      } catch (error) {
        console.error("Erro ao atualizar confirmação de presença:", error);
        if (typeof window.showToast === "function") {
          window.showToast("Erro ao atualizar confirmação de presença", "error");
        }
        button.disabled = false;
      }
    });
  });
}

/**
 * Adiciona listeners para os botões da fila de "Lembretes Pendentes de Hoje"
 */
function attachPendingReminderListeners() {
  const pendingButtons = document.querySelectorAll(".btn-send-pending");

  pendingButtons.forEach((button) => {
    button.addEventListener("click", async (e) => {
      const cardId = e.currentTarget.dataset.cardId;
      const type = e.currentTarget.dataset.type;
      const patient = findPatientByCardId(cardId);
      if (!patient) return;

      const originalLabel = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

      try {
        if (type === "friday") {
          await sendFridayReminder(patient);
        } else {
          await sendTuesdayCard(patient);
        }
        rerenderKeepingFilter();
      } catch (error) {
        console.error("Erro ao enviar lembrete pendente:", error);
        if (typeof window.showToast === "function") {
          window.showToast(
            error.message || "Erro ao enviar lembrete",
            "error",
          );
        }
        button.disabled = false;
        button.innerHTML = originalLabel;
      }
    });
  });
}

/**
 * Abre o modal de preview do cartão gerado, com botão de download.
 * Usado como fallback quando o navegador não suporta copiar a imagem
 * automaticamente para a área de transferência.
 */
function openCardPreviewModal(dataUrl, fileName, patient) {
  const modal = document.getElementById("cardPreviewModal");
  const img = document.getElementById("cardPreviewImg");
  const downloadBtn = document.getElementById("cardPreviewDownloadBtn");

  if (!modal || !img || !downloadBtn) {
    // Modal não disponível: cair no download direto
    downloadCartaoImage(dataUrl, fileName);
    return;
  }

  img.src = dataUrl;
  downloadBtn.onclick = async () => {
    downloadCartaoImage(dataUrl, fileName);
    modal.style.display = "none";
    if (patient) {
      try {
        await updatePatient(patient.id, {
          [tuesdaySentField(patient)]: Date.now(),
        });
        rerenderKeepingFilter();
      } catch (error) {
        console.error("Erro ao registrar envio do cartão:", error);
      }
    }
  };
  modal.style.display = "flex";
}

/**
 * Adiciona listeners para os filtros de data
 */
function attachFilterListeners() {
  const dateFilter = document.getElementById("surgeryDateFilter");
  const clearFilter = document.getElementById("clearDateFilter");
  const quickFilters = document.querySelectorAll(".btn-quick-filter");

  if (dateFilter) {
    dateFilter.addEventListener("change", (e) => {
      const selectedDate = e.target.value;
      renderSurgerySchedule(selectedDate || null);
    });
  }

  if (clearFilter) {
    clearFilter.addEventListener("click", () => {
      if (dateFilter) dateFilter.value = "";
      renderSurgerySchedule(null);
    });
  }

  quickFilters.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const filter = e.currentTarget.dataset.filter;
      const today = new Date();

      if (filter === "today") {
        const todayString = today.toISOString().split("T")[0];
        if (dateFilter) dateFilter.value = todayString;
        renderSurgerySchedule(todayString);
      } else if (filter === "all") {
        if (dateFilter) dateFilter.value = "";
        renderSurgerySchedule(null);
      } else {
        // Para 'week' e 'month', apenas limpar filtro específico por enquanto
        // Pode ser expandido futuramente para filtros de intervalo
        if (dateFilter) dateFilter.value = "";
        renderSurgerySchedule(null);
      }
    });
  });
}

/**
 * Inicializa o módulo de agenda cirúrgica
 */
export function initSurgerySchedule() {
  // Renderizar ao carregar
  renderSurgerySchedule();

  // Atualizar quando mudar de seção
  document.addEventListener("sectionChanged", (e) => {
    if (e.detail === "surgery-schedule") {
      renderSurgerySchedule();
    }
  });
}

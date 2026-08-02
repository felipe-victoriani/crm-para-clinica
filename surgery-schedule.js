// surgery-schedule.js - Módulo de Agenda Cirúrgica
import { getPatients, updatePatient } from "./patients.js";

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
 * Lembretes: sexta anterior (5 dias) e segunda anterior (2 dias)
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

  // Calcular segunda anterior (2 dias antes)
  const monday = new Date(surgery);
  monday.setDate(surgery.getDate() - 2);

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
    monday: monday,
    isWednesday: isWednesday,
    daysUntilSurgery: daysUntilSurgery,
    isPast: daysUntilSurgery < 0,
    shouldSendFridayReminder: daysUntilSurgery === 5,
    shouldSendMondayReminder: daysUntilSurgery === 2,
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
 * Gera link do WhatsApp com mensagem pré-preenchida
 */
export function generateWhatsAppLink(phone, message) {
  // Remover caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, "");

  // Verificar se já tem código do país
  let fullPhone = cleanPhone;
  if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
    fullPhone = "55" + cleanPhone;
  }

  // Codificar mensagem para URL
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${fullPhone}?text=${encodedMessage}`;
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
  const mondayInfo = formatDateWithWeekday(reminderInfo.monday) || {
    full: "",
    short: "",
    dayName: "",
  };

  let reminderStatus = "";
  if (type === "upcoming") {
    if (reminderInfo.shouldSendFridayReminder) {
      reminderStatus =
        '<div class="reminder-alert reminder-friday"><i class="fas fa-bell"></i> Enviar lembrete de sexta-feira HOJE</div>';
    } else if (reminderInfo.shouldSendMondayReminder) {
      reminderStatus =
        '<div class="reminder-alert reminder-monday"><i class="fas fa-bell"></i> Enviar lembrete de segunda-feira HOJE</div>';
    } else if (reminderInfo.daysUntilSurgery > 5) {
      reminderStatus = `<div class="reminder-info">Próximo lembrete: ${fridayInfo.short} (sexta)</div>`;
    } else if (reminderInfo.daysUntilSurgery > 2) {
      reminderStatus = `<div class="reminder-info">Próximo lembrete: ${mondayInfo.short} (segunda)</div>`;
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
          <button class="btn-whatsapp btn-reminder-5" data-card-id="${cardId}" data-days="5" title="Lembrete 5 dias antes">
            <i class="fab fa-whatsapp"></i> Lembrete Sexta (5 dias)
          </button>
          <button class="btn-whatsapp btn-reminder-2" data-card-id="${cardId}" data-days="2" title="Lembrete 2 dias antes">
            <i class="fab fa-whatsapp"></i> Lembrete Segunda (2 dias)
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

  // Listeners para botões WhatsApp
  whatsappButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      const cardId = e.currentTarget.dataset.cardId;
      const daysUntil = parseInt(e.currentTarget.dataset.days);
      const patients = getSurgeryScheduledPatients();

      // Encontrar o paciente usando o cardId que inclui a data
      const patient = patients.find((p) => {
        const pCardId = `${p.id}-${p._displayDate}`;
        return pCardId === cardId;
      });

      if (patient) {
        const message = generateReminderMessage(patient, daysUntil);
        const whatsappLink = generateWhatsAppLink(patient.phone, message);
        window.open(whatsappLink, "_blank");
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

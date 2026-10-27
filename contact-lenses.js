// contact-lenses.js - Tela de controle de pedidos de lentes de contato
// (lista em tempo real, alertas de atraso, aviso por WhatsApp e recompra)
import { database } from "./firebase.js";
import {
  ref,
  push,
  set,
  update,
  remove,
  onValue,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import {
  LENS_STATUS,
  LENS_TYPES,
  PAYMENT_STATUS,
  QUANTITY_UNITS,
  LENS_FILTERS,
  RX_FIELDS,
  DEFAULT_LEAD_DAYS,
  addDaysISO,
  formatDateBR,
  getExpectedDate,
  getRepurchaseDate,
  getOrderAlert,
  needsAttention,
  matchesFilter,
  matchesSearch,
  sortOrders,
  parseRxValue,
  formatRxValue,
  hasRx,
  formatQuantity,
  buildArrivalMessage,
  buildRepurchaseMessage,
} from "./contact-lenses-logic.js";
import { buildFullPhone } from "./ui.js";
import {
  escapeHtml,
  toLocalISODate,
  showToast,
  confirmDialog,
  setupDialog,
} from "./utils.js";

// Nó do Realtime Database com os pedidos
const ORDERS_PATH = "contactLensOrders";

// Estado da tela
let orders = [];
let activeFilter = "open";
let searchTerm = "";
let unsubscribe = null;

// Elementos fixos (existem no index.html)
const listEl = document.getElementById("lensOrdersList");
const tabsEl = document.getElementById("lensTabs");
const searchEl = document.getElementById("lensSearch");
const counterEl = document.getElementById("lensCounter");
const navBadgeEl = document.getElementById("lensNavBadge");
const modal = document.getElementById("lensModal");
const form = document.getElementById("lensForm");

// ============================================================
// Inicialização
// ============================================================

/** Liga a tela: monta campos, listeners e a escuta em tempo real. */
export function initContactLenses() {
  if (!listEl || !form) return;

  populateFormOptions();
  renderRxGrid();
  renderTabs();
  setupDialog(modal);

  // Botão "Novo pedido"
  document.getElementById("newLensOrderBtn").addEventListener("click", () => openOrderModal());

  // Abas de filtro (delegação)
  tabsEl.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-filter]");
    if (!tab) return;
    activeFilter = tab.dataset.filter;
    renderTabs();
    renderOrders();
  });

  // Busca com pequeno atraso para não re-renderizar a cada tecla
  let searchTimer = null;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTerm = searchEl.value.trim();
      renderOrders();
    }, 150);
  });

  // Ações dos cards (delegação: funciona após qualquer re-render)
  listEl.addEventListener("click", handleCardAction);

  // Salvar o formulário
  form.addEventListener("submit", handleSubmit);

  // Ao mudar a data do pedido, sugere a previsão se ela ainda estiver vazia
  form.elements.orderDate.addEventListener("change", () => {
    if (!form.elements.expectedDate.value) {
      form.elements.expectedDate.value = addDaysISO(form.elements.orderDate.value, DEFAULT_LEAD_DAYS);
    }
  });

  subscribeOrders();
}

/** Escuta o nó de pedidos: qualquer mudança (de qualquer usuário) re-renderiza. */
function subscribeOrders() {
  listEl.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i><p>Carregando pedidos...</p></div>`;

  unsubscribe = onValue(
    ref(database, ORDERS_PATH),
    (snapshot) => {
      const next = [];
      snapshot.forEach((child) => {
        next.push({ ...child.val(), id: child.key });
      });
      orders = next;
      renderTabs();
      renderOrders();
    },
    (error) => {
      // Normalmente: regra do Firebase ainda não publicada para este nó
      console.error("Erro ao carregar pedidos de lentes:", error);
      listEl.innerHTML = `
        <div class="empty-state empty-state-error">
          <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
          <p>Não foi possível carregar os pedidos</p>
          <span>Verifique a conexão ou as permissões do banco de dados.</span>
        </div>`;
    },
  );
}

/** Para a escuta em tempo real (chamado ao fechar a página). */
export function cleanupContactLenses() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
}

// ============================================================
// Renderização
// ============================================================

/** Abas com a contagem de cada filtro. */
function renderTabs() {
  const today = new Date();
  tabsEl.innerHTML = LENS_FILTERS.map(({ key, label }) => {
    const count = orders.filter((o) => matchesFilter(o, key, today)).length;
    const active = key === activeFilter;
    return `
      <button type="button" class="lens-tab${active ? " active" : ""}" data-filter="${key}" aria-pressed="${active}">
        ${escapeHtml(label)} <span class="lens-tab-count">${count}</span>
      </button>`;
  }).join("");

  // Contador do menu lateral: pedidos que exigem ação agora
  const pending = orders.filter((o) => needsAttention(o, today)).length;
  navBadgeEl.textContent = pending;
  navBadgeEl.hidden = pending === 0;
  navBadgeEl.setAttribute("aria-label", `${pending} pedido${pending === 1 ? "" : "s"} precisando de atenção`);
}

/** Lista de cards da aba e busca atuais. */
function renderOrders() {
  const today = new Date();
  const visible = sortOrders(
    orders.filter((o) => matchesFilter(o, activeFilter, today) && matchesSearch(o, searchTerm)),
    today,
  );

  counterEl.textContent = `(${visible.length})`;

  if (!visible.length) {
    const message = searchTerm
      ? "Nenhum pedido encontrado para essa busca"
      : activeFilter === "repurchase"
        ? "Nenhuma recompra para oferecer agora"
        : "Nenhum pedido nesta lista";
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-eye" aria-hidden="true"></i>
        <p>${escapeHtml(message)}</p>
        <span>Use "Novo pedido" para registrar uma encomenda.</span>
      </div>`;
    return;
  }

  listEl.innerHTML = visible.map((o) => renderCard(o, today)).join("");
}

/** HTML de um card de pedido (todo valor dinâmico passa por escapeHtml). */
function renderCard(order, today) {
  const status = LENS_STATUS[order.status] || LENS_STATUS.ordered;
  const alert = getOrderAlert(order, today);
  const id = escapeHtml(order.id);
  const name = escapeHtml(order.patientName);

  // Linha de detalhes: marca · tipo · quantidade · fornecedor
  const details = [
    order.brand,
    LENS_TYPES[order.lensType],
    formatQuantity(order),
    order.supplier ? `via ${order.supplier}` : "",
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");

  // Datas relevantes ao status
  const dates = [`Pedido ${formatDateBR(order.orderDate)}`];
  if (order.status === "ordered") dates.push(`Previsão ${formatDateBR(getExpectedDate(order))}`);
  if (order.deliveredAt) dates.push(`Entregue ${new Date(order.deliveredAt).toLocaleDateString("pt-BR")}`);
  const repurchase = getRepurchaseDate(order);
  if (repurchase) dates.push(`Acaba ~${repurchase.toLocaleDateString("pt-BR")}`);

  // Pagamento só aparece quando informado
  const price = order.price ? Number(order.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
  const payment = order.paymentStatus ? PAYMENT_STATUS[order.paymentStatus] : "";
  const paymentText = [price, payment].filter(Boolean).map(escapeHtml).join(" · ");

  return `
    <article class="lens-card lens-card--${status.tone}${alert ? ` lens-card--alert-${alert.level}` : ""}" aria-label="Pedido de ${name}">
      <div class="lens-card-header">
        <h3 class="lens-card-name">${name}</h3>
        <span class="lens-status lens-status--${status.tone}">
          <i class="fas ${status.icon}" aria-hidden="true"></i> ${escapeHtml(status.label)}
        </span>
      </div>
      ${
        alert
          ? `<p class="lens-alert lens-alert--${alert.level}">
               <i class="fas ${alert.level === "danger" ? "fa-circle-exclamation" : alert.level === "warning" ? "fa-triangle-exclamation" : "fa-circle-info"}" aria-hidden="true"></i>
               ${escapeHtml(alert.text)}
             </p>`
          : ""
      }
      ${details ? `<p class="lens-card-details">${details}</p>` : ""}
      ${renderRxTable(order)}
      <p class="lens-card-dates">${dates.map(escapeHtml).join(" · ")}</p>
      ${paymentText ? `<p class="lens-card-payment"><i class="fas fa-wallet" aria-hidden="true"></i> ${paymentText}</p>` : ""}
      ${order.notes ? `<p class="lens-card-notes">${escapeHtml(order.notes)}</p>` : ""}
      <div class="lens-card-actions">
        ${renderPrimaryAction(order, today)}
        <button type="button" class="icon-btn" data-action="repeat" data-id="${id}" aria-label="Repetir pedido de ${name}" title="Repetir pedido">
          <i class="fas fa-rotate-right" aria-hidden="true"></i>
        </button>
        <button type="button" class="icon-btn" data-action="edit" data-id="${id}" aria-label="Editar pedido de ${name}" title="Editar">
          <i class="fas fa-pen" aria-hidden="true"></i>
        </button>
        <button type="button" class="icon-btn icon-btn--danger" data-action="delete" data-id="${id}" aria-label="Excluir pedido de ${name}" title="Excluir">
          <i class="fas fa-trash" aria-hidden="true"></i>
        </button>
      </div>
    </article>`;
}

/** Tabela compacta OD/OE com só as colunas preenchidas em algum olho. */
function renderRxTable(order) {
  if (!hasRx(order.od) && !hasRx(order.oe)) return "";
  const cols = RX_FIELDS.filter((f) => [order.od, order.oe].some((eye) => eye && eye[f.key] != null));

  const row = (label, eye) => `
    <tr>
      <th scope="row">${label}</th>
      ${cols.map((f) => `<td>${escapeHtml(formatRxValue(eye?.[f.key], f.kind)) || "—"}</td>`).join("")}
    </tr>`;

  return `
    <table class="lens-rx">
      <thead><tr><td></td>${cols.map((f) => `<th scope="col">${f.label}</th>`).join("")}</tr></thead>
      <tbody>${row("OD", order.od)}${row("OE", order.oe)}</tbody>
    </table>`;
}

/** Botão principal: a próxima etapa do fluxo do pedido. */
function renderPrimaryAction(order, today) {
  const id = escapeHtml(order.id);
  const button = (action, icon, label, extra = "") =>
    `<button type="button" class="btn-small lens-primary${extra}" data-action="${action}" data-id="${id}">
       <i class="${icon}" aria-hidden="true"></i> ${label}
     </button>`;

  switch (order.status) {
    case "ordered":
      return button("arrived", "fas fa-box-open", "Confirmar chegada");
    case "arrived":
      return button("notify", "fab fa-whatsapp", "Avisar paciente", " lens-primary--whatsapp");
    case "notified":
      return `${button("delivered", "fas fa-hand-holding", "Marcar entregue")}
        <button type="button" class="icon-btn" data-action="notify" data-id="${id}" aria-label="Avisar novamente por WhatsApp" title="Avisar novamente">
          <i class="fab fa-whatsapp" aria-hidden="true"></i>
        </button>`;
    case "delivered":
      return matchesFilter(order, "repurchase", today)
        ? button("repurchase", "fab fa-whatsapp", "Oferecer recompra", " lens-primary--whatsapp")
        : "";
    default:
      return "";
  }
}

// ============================================================
// Ações dos cards
// ============================================================

/** Trata clique em qualquer botão de ação de um card. */
async function handleCardAction(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const order = orders.find((o) => o.id === btn.dataset.id);
  if (!order) return;

  try {
    switch (btn.dataset.action) {
      case "arrived":
        await changeStatus(order, { status: "arrived", arrivedAt: Date.now() }, "Chegada confirmada");
        break;
      case "notify":
        // WhatsApp abre antes do await para o navegador não bloquear o pop-up
        if (!openWhatsApp(order, buildArrivalMessage(order))) return;
        if (order.status === "arrived") {
          await changeStatus(order, { status: "notified", notifiedAt: Date.now() }, "Paciente marcado como avisado");
        }
        break;
      case "delivered":
        await changeStatus(order, { status: "delivered", deliveredAt: Date.now() }, "Pedido entregue");
        break;
      case "repurchase":
        if (!openWhatsApp(order, buildRepurchaseMessage(order))) return;
        await changeStatus(order, { repurchaseOfferedAt: Date.now() }, "Recompra oferecida");
        break;
      case "repeat":
        openOrderModal(order, { repeat: true });
        break;
      case "edit":
        openOrderModal(order);
        break;
      case "delete":
        await deleteOrder(order);
        break;
    }
  } catch (error) {
    console.error("Erro na ação do pedido de lente:", error);
    showToast("Não foi possível salvar. Verifique a conexão e tente novamente.", "error");
  }
}

/** Abre o WhatsApp com a mensagem. Retorna false se não houver telefone. */
function openWhatsApp(order, message) {
  const fullNumber = buildFullPhone(order.phone);
  if (!fullNumber) {
    showToast("Pedido sem telefone. Edite o pedido e informe o número.", "error");
    return false;
  }
  // api.whatsapp.com/send em vez de wa.me: o redirect do wa.me corrompe emoji
  const url = `https://api.whatsapp.com/send?phone=${fullNumber}&text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener");
  return true;
}

/** Grava a mudança e oferece "Desfazer" restaurando os campos anteriores. */
async function changeStatus(order, patch, message) {
  const previous = Object.fromEntries(Object.keys(patch).map((key) => [key, order[key] ?? null]));
  await update(ref(database, `${ORDERS_PATH}/${order.id}`), { ...patch, updatedAt: Date.now() });

  showToast(message, "success", {
    label: "Desfazer",
    onClick: () =>
      update(ref(database, `${ORDERS_PATH}/${order.id}`), { ...previous, updatedAt: Date.now() }).catch((error) => {
        console.error("Erro ao desfazer mudança do pedido:", error);
        showToast("Não foi possível desfazer.", "error");
      }),
  });
}

/** Exclui com confirmação e permite desfazer recriando o mesmo registro. */
async function deleteOrder(order) {
  const confirmed = await confirmDialog({
    title: "Excluir pedido?",
    message: `O pedido de lentes de ${order.patientName} será removido.`,
    confirmLabel: "Excluir",
    danger: true,
  });
  if (!confirmed) return;

  const { id, ...data } = order;
  await remove(ref(database, `${ORDERS_PATH}/${id}`));

  showToast("Pedido excluído", "success", {
    label: "Desfazer",
    onClick: () =>
      set(ref(database, `${ORDERS_PATH}/${id}`), data).catch((error) => {
        console.error("Erro ao restaurar pedido:", error);
        showToast("Não foi possível restaurar o pedido.", "error");
      }),
  });
}

// ============================================================
// Formulário (novo, editar e repetir pedido)
// ============================================================

/** Preenche os selects de tipo, pagamento e status a partir da lógica. */
function populateFormOptions() {
  const fill = (select, entries) => {
    entries.forEach(([value, label]) => select.add(new Option(label, value)));
  };
  fill(form.elements.lensType, Object.entries(LENS_TYPES));
  fill(form.elements.paymentStatus, Object.entries(PAYMENT_STATUS));
  fill(form.elements.quantityUnit, Object.entries(QUANTITY_UNITS).map(([k, v]) => [k, v.many]));
  fill(form.elements.status, Object.entries(LENS_STATUS).map(([k, v]) => [k, v.label]));
}

/** Monta a grade de grau OD/OE a partir de RX_FIELDS (fonte única). */
function renderRxGrid() {
  const grid = document.getElementById("lensRxGrid");
  const header = RX_FIELDS.map((f) => `<span class="lens-rx-head" aria-hidden="true">${f.label}</span>`).join("");

  const eyeRow = (eye) =>
    RX_FIELDS.map((f) => {
      const inputId = `lensRx_${eye}_${f.key}`;
      // Esf/Cil/Adição precisam do sinal "-": teclado de texto; eixo e mm são numéricos
      const inputmode = f.kind === "diopter" ? "text" : "decimal";
      const placeholder = f.kind === "diopter" ? "-0,00" : f.kind === "axis" ? "0–180" : "mm";
      return `
        <label class="sr-only" for="${inputId}">${eye.toUpperCase()} ${f.label}</label>
        <input id="${inputId}" name="${eye}_${f.key}" data-kind="${f.kind}" type="text"
          inputmode="${inputmode}" autocomplete="off" placeholder="${placeholder}" />`;
    }).join("");

  grid.innerHTML = `
    <span></span>${header}
    <span class="lens-rx-eye">OD</span>${eyeRow("od")}
    <span class="lens-rx-eye">OE</span>${eyeRow("oe")}`;
}

/**
 * Abre o modal.
 * - sem pedido: novo pedido
 * - com pedido: edição
 * - com { repeat: true }: novo pedido copiando paciente, grau e lente
 */
function openOrderModal(order = null, { repeat = false } = {}) {
  const editing = Boolean(order) && !repeat;
  form.reset();
  clearRxErrors();
  form.dataset.id = editing ? order.id : "";

  document.getElementById("lensModalTitle").textContent = editing
    ? "Editar pedido"
    : repeat
      ? "Repetir pedido"
      : "Novo pedido de lentes";

  // Status só é editável em pedido existente (ex: cancelar ou corrigir)
  document.getElementById("lensStatusField").hidden = !editing;

  const today = toLocalISODate();
  const f = form.elements;

  if (order) {
    f.patientName.value = order.patientName || "";
    f.phone.value = order.phone || "";
    f.brand.value = order.brand || "";
    f.lensType.value = order.lensType || "";
    // Pedidos antigos guardavam só "boxes" (sempre caixas)
    f.quantity.value = order.quantity ?? order.boxes ?? "";
    f.quantityUnit.value = order.quantityUnit || "caixa";
    f.supplier.value = order.supplier || "";
    f.durationMonths.value = order.durationMonths || "";
    f.price.value = order.price || "";
    fillRx("od", order.od);
    fillRx("oe", order.oe);
  }

  if (editing) {
    f.orderDate.value = order.orderDate || today;
    f.expectedDate.value = order.expectedDate || "";
    f.paymentStatus.value = order.paymentStatus || "";
    f.status.value = order.status || "ordered";
    f.notes.value = order.notes || "";
  } else {
    // Pedido novo (ou repetido) começa hoje com o prazo padrão
    f.orderDate.value = today;
    f.expectedDate.value = addDaysISO(today, DEFAULT_LEAD_DAYS);
  }

  modal.showModal();
  f.patientName.focus();
}

/** Coloca os valores de grau de um olho nos inputs (formato com vírgula). */
function fillRx(eye, values) {
  RX_FIELDS.forEach((f) => {
    const value = values?.[f.key];
    form.elements[`${eye}_${f.key}`].value =
      value == null ? "" : f.kind === "axis" ? String(value) : formatRxValue(value, f.kind);
  });
}

/** Lê os inputs de grau de um olho. Marca inválidos e retorna null se houver erro. */
function readRx(eye) {
  const result = {};
  let valid = true;
  RX_FIELDS.forEach((f) => {
    const input = form.elements[`${eye}_${f.key}`];
    const value = parseRxValue(input.value, f.kind);
    const invalid = Number.isNaN(value);
    input.setAttribute("aria-invalid", invalid ? "true" : "false");
    if (invalid) valid = false;
    else if (value !== null) result[f.key] = value;
  });
  if (!valid) return null;
  return Object.keys(result).length ? result : undefined;
}

/** Limpa as marcações de erro da grade de grau. */
function clearRxErrors() {
  form.querySelectorAll("#lensRxGrid input").forEach((i) => i.removeAttribute("aria-invalid"));
  document.getElementById("lensRxError").hidden = true;
}

/** Salva o pedido (cria ou atualiza). */
async function handleSubmit(e) {
  e.preventDefault();
  const f = form.elements;
  const submitBtn = form.querySelector('button[type="submit"]');

  // Grau: valida os dois olhos antes de gravar
  const od = readRx("od");
  const oe = readRx("oe");
  const rxError = document.getElementById("lensRxError");
  if (od === null || oe === null) {
    rxError.hidden = false;
    form.querySelector('#lensRxGrid [aria-invalid="true"]')?.focus();
    return;
  }
  rxError.hidden = true;

  const id = form.dataset.id;
  const existing = id ? orders.find((o) => o.id === id) : null;
  const now = Date.now();

  // Campos vazios viram null: no update apagam o valor antigo, no push são ignorados
  const text = (input) => input.value.trim() || null;
  const number = (input) => (input.value ? Number(input.value) : null);

  const data = {
    patientName: f.patientName.value.trim(),
    phone: f.phone.value.replace(/\D/g, "") || null,
    orderDate: f.orderDate.value,
    expectedDate: f.expectedDate.value || null,
    brand: text(f.brand),
    lensType: f.lensType.value || null,
    quantity: number(f.quantity),
    quantityUnit: f.quantity.value ? f.quantityUnit.value : null,
    boxes: null, // campo antigo: migra para quantity ao salvar
    supplier: text(f.supplier),
    durationMonths: number(f.durationMonths),
    price: number(f.price),
    paymentStatus: f.paymentStatus.value || null,
    notes: text(f.notes),
    od: od || null,
    oe: oe || null,
    updatedAt: now,
  };

  submitBtn.disabled = true;
  try {
    if (existing) {
      // Edição: se o status mudou à mão, registra a data da nova etapa
      const status = f.status.value;
      const stampKey = { arrived: "arrivedAt", notified: "notifiedAt", delivered: "deliveredAt" }[status];
      const patch = { ...data, status };
      if (stampKey && !existing[stampKey]) patch[stampKey] = now;
      await update(ref(database, `${ORDERS_PATH}/${id}`), patch);
      showToast("Pedido atualizado");
    } else {
      // Novo: remove os null (push não aceita apagar o que não existe)
      const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null));
      await push(ref(database, ORDERS_PATH), { ...clean, status: "ordered", createdAt: now });
      showToast("Pedido registrado");
      // Mostra o pedido recém-criado na aba certa
      activeFilter = "open";
      renderTabs();
      renderOrders();
    }
    modal.close();
  } catch (error) {
    console.error("Erro ao salvar pedido de lente:", error);
    showToast("Erro ao salvar. Verifique a conexão e tente novamente.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

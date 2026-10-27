// contact-lenses-logic.js - Regras puras do controle de lentes de contato
// (sem DOM e sem Firebase: fácil de testar e de reaproveitar)

// ============================================================
// Status do pedido (fluxo: pedido → chegou → avisado → entregue)
// ============================================================

export const LENS_STATUS = {
  ordered: { label: "Pedido feito", icon: "fa-truck-fast", tone: "blue" },
  arrived: { label: "Chegou", icon: "fa-box-open", tone: "amber" },
  notified: { label: "Paciente avisado", icon: "fa-bell", tone: "cyan" },
  delivered: { label: "Entregue", icon: "fa-circle-check", tone: "green" },
  cancelled: { label: "Cancelado", icon: "fa-ban", tone: "gray" },
};

// Tipos de lente (o valor gravado é a própria chave)
export const LENS_TYPES = {
  diaria: "Diária",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
  torica: "Tórica",
  multifocal: "Multifocal",
  colorida: "Colorida",
};

// Unidade da quantidade pedida (singular / plural)
export const QUANTITY_UNITS = {
  caixa: { one: "caixa", many: "Caixas" },
  par_teste: { one: "par teste", many: "Par teste" },
};

/** "2 caixas" / "1 par teste" / "2 pares teste" (vazio se não informado). */
export function formatQuantity(order) {
  // Pedidos antigos guardavam só "boxes" (sempre caixas)
  const qty = Number(order.quantity ?? order.boxes);
  if (!qty) return "";
  if (order.quantityUnit === "par_teste") return `${qty} ${qty > 1 ? "pares teste" : "par teste"}`;
  return `${qty} ${qty > 1 ? "caixas" : "caixa"}`;
}

// Situação do pagamento
export const PAYMENT_STATUS = {
  pendente: "Pendente",
  sinal: "Sinal pago",
  pago: "Pago",
};

// Prazo padrão de entrega quando o pedido não informa previsão
export const DEFAULT_LEAD_DAYS = 7;

// Paciente avisado há mais que isso sem retirar vira alerta
export const PICKUP_ALERT_DAYS = 7;

// Recompra entra na aba "Recompra" a partir de X dias antes de acabar
export const REPURCHASE_WINDOW_DAYS = 15;

// Campos de grau por olho, na ordem exibida
export const RX_FIELDS = [
  { key: "sph", label: "Esf", kind: "diopter" },
  { key: "cyl", label: "Cil", kind: "diopter" },
  { key: "axis", label: "Eixo", kind: "axis" },
  { key: "add", label: "Adição", kind: "diopter" },
  { key: "bc", label: "CB", kind: "mm" },
  { key: "dia", label: "Diâm", kind: "mm" },
];

// ============================================================
// Datas ("YYYY-MM-DD" no fuso local)
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000;

/** Converte "YYYY-MM-DD" em Date na meia-noite local (null se inválido). */
export function parseISODate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return isNaN(date.getTime()) ? null : date;
}

/** Zera hora/minuto para comparar só o dia. */
function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Dias inteiros de "from" até "to" (positivo se "to" for depois). */
export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/** Soma dias a uma data "YYYY-MM-DD" e devolve no mesmo formato. */
export function addDaysISO(value, days) {
  const date = parseISODate(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2026-10-26" → "26/10/2026" (vazio se inválido). */
export function formatDateBR(value) {
  const date = parseISODate(value);
  return date ? date.toLocaleDateString("pt-BR") : "";
}

/** Previsão efetiva: a informada ou pedido + prazo padrão. */
export function getExpectedDate(order) {
  return order.expectedDate || addDaysISO(order.orderDate, DEFAULT_LEAD_DAYS);
}

/**
 * Data em que as lentes devem acabar (entrega + duração em meses).
 * Retorna null se não foi entregue ou não tem duração informada.
 */
export function getRepurchaseDate(order) {
  const months = Number(order.durationMonths);
  if (order.status !== "delivered" || !order.deliveredAt || !months) return null;
  const date = startOfDay(order.deliveredAt);
  date.setMonth(date.getMonth() + months);
  return date;
}

// ============================================================
// Alertas (o coração do módulo: nada cai no esquecimento)
// ============================================================

/**
 * Calcula o alerta de um pedido na data "today".
 * Retorna { level: "danger"|"warning"|"info", text } ou null.
 */
export function getOrderAlert(order, today = new Date()) {
  // Pedido feito: atraso em relação à previsão de chegada
  if (order.status === "ordered") {
    const expected = parseISODate(getExpectedDate(order));
    if (!expected) return null;
    const late = daysBetween(expected, today);
    if (late > 0) {
      return { level: "danger", text: `Atrasado ${late} dia${late > 1 ? "s" : ""}, cobrar fornecedor` };
    }
    if (late === 0) return { level: "info", text: "Previsto para chegar hoje" };
    return null;
  }

  // Chegou mas o paciente ainda não sabe
  if (order.status === "arrived") {
    const days = order.arrivedAt ? daysBetween(order.arrivedAt, today) : 0;
    const when = days > 0 ? ` há ${days} dia${days > 1 ? "s" : ""}` : " hoje";
    return { level: "warning", text: `Chegou${when}, avisar o paciente` };
  }

  // Avisado e não retirou depois de alguns dias
  if (order.status === "notified" && order.notifiedAt) {
    const days = daysBetween(order.notifiedAt, today);
    if (days >= PICKUP_ALERT_DAYS) {
      return { level: "warning", text: `Avisado há ${days} dias e ainda não retirou` };
    }
    return null;
  }

  // Entregue: lembrete de recompra perto de acabar
  if (order.status === "delivered" && isRepurchaseDue(order, today)) {
    const left = daysBetween(today, getRepurchaseDate(order));
    const text =
      left > 0
        ? `Lentes acabam em ${left} dia${left > 1 ? "s" : ""}, oferecer recompra`
        : "Lentes já devem ter acabado, oferecer recompra";
    return { level: "info", text };
  }

  return null;
}

/** Recompra devida: perto de acabar e ainda não oferecida. */
export function isRepurchaseDue(order, today = new Date()) {
  const date = getRepurchaseDate(order);
  if (!date || order.repurchaseOfferedAt) return false;
  return daysBetween(today, date) <= REPURCHASE_WINDOW_DAYS;
}

/** Pedido que exige ação da equipe agora (entra no contador do menu). */
export function needsAttention(order, today = new Date()) {
  const alert = getOrderAlert(order, today);
  return Boolean(alert && alert.level !== "info") || order.status === "arrived";
}

// ============================================================
// Filtros e ordenação da lista
// ============================================================

// Abas da tela, na ordem exibida
export const LENS_FILTERS = [
  { key: "open", label: "Em aberto" },
  { key: "arrived", label: "Chegaram" },
  { key: "delivered", label: "Entregues" },
  { key: "repurchase", label: "Recompra" },
  { key: "all", label: "Todos" },
];

/** Diz se o pedido aparece na aba escolhida. */
export function matchesFilter(order, filter, today = new Date()) {
  switch (filter) {
    case "open":
      return ["ordered", "arrived", "notified"].includes(order.status);
    case "arrived":
      return ["arrived", "notified"].includes(order.status);
    case "delivered":
      return order.status === "delivered";
    case "repurchase":
      return isRepurchaseDue(order, today);
    default:
      return true;
  }
}

/** Busca por nome, marca ou fornecedor (sem acento e sem caixa). */
export function matchesSearch(order, term) {
  if (!term) return true;
  const normalize = (v) =>
    String(v || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const haystack = normalize(`${order.patientName} ${order.brand} ${order.supplier}`);
  return haystack.includes(normalize(term));
}

// Peso do alerta para ordenar: perigo primeiro
const ALERT_WEIGHT = { danger: 0, warning: 1, info: 2 };

/** Ordena: alertas mais graves primeiro, depois pedido mais antigo primeiro. */
export function sortOrders(orders, today = new Date()) {
  return [...orders].sort((a, b) => {
    const wa = ALERT_WEIGHT[getOrderAlert(a, today)?.level] ?? 3;
    const wb = ALERT_WEIGHT[getOrderAlert(b, today)?.level] ?? 3;
    if (wa !== wb) return wa - wb;
    // Entregues/cancelados: mais recentes no topo; em aberto: mais antigos no topo
    const closed = ["delivered", "cancelled"];
    const dir = closed.includes(a.status) && closed.includes(b.status) ? -1 : 1;
    return dir * String(a.orderDate).localeCompare(String(b.orderDate));
  });
}

// ============================================================
// Grau (dioptrias, eixo, curva base e diâmetro)
// ============================================================

/**
 * Lê o valor digitado de um campo de grau.
 * Aceita vírgula ou ponto e sinal opcional ("-2,25", "+1.5", "180").
 * Retorna: null se vazio, NaN se inválido, ou o número.
 */
export function parseRxValue(raw, kind) {
  const text = String(raw ?? "").trim().replace(",", ".").replace("−", "-");
  if (!text) return null;
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) return NaN;
  const value = Number(text);

  // Faixas plausíveis para pegar erro de digitação
  if (kind === "axis") return Number.isInteger(value) && value >= 0 && value <= 180 ? value : NaN;
  if (kind === "mm") return value > 0 && value <= 25 ? value : NaN;
  return Math.abs(value) <= 30 ? value : NaN;
}

/** Formata um valor de grau para exibição ("-2,25", "+1,00", "90°"). */
export function formatRxValue(value, kind) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (kind === "axis") return `${n}°`;
  if (kind === "mm") return n.toFixed(1).replace(".", ",");
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2).replace(".", ",")}`;
}

/** Diz se um olho tem algum campo de grau preenchido. */
export function hasRx(eye) {
  return Boolean(eye) && RX_FIELDS.some((f) => eye[f.key] !== undefined && eye[f.key] !== null);
}

// ============================================================
// Mensagens de WhatsApp
// ============================================================

/** Primeiro nome com inicial maiúscula (mensagem mais pessoal). */
function firstName(name) {
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Mensagem avisando que a lente chegou. */
export function buildArrivalMessage(order) {
  const brand = order.brand ? ` (${order.brand})` : "";
  return `Olá, ${firstName(order.patientName)}! Aqui é da Oftalmo 15. Suas lentes de contato${brand} chegaram e já estão disponíveis para retirada na clínica. Qualquer dúvida, estamos à disposição!`;
}

/** Mensagem oferecendo um novo pedido perto de acabar. */
export function buildRepurchaseMessage(order) {
  const brand = order.brand ? ` ${order.brand}` : "";
  return `Olá, ${firstName(order.patientName)}! Aqui é da Oftalmo 15. Pelas nossas contas suas lentes de contato${brand} estão perto de acabar. Quer que a gente já faça um novo pedido para você não ficar sem?`;
}

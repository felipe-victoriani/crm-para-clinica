// cartaoConfirmacao.js - Geração do cartão visual de confirmação cirúrgica (PNG)
import { CARTAO_TEMPLATE } from "./cartaoConfirmacao.template.js";

const HTML2CANVAS_URL =
  "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

let html2canvasLoadPromise = null;

/**
 * Carrega html2canvas via CDN sob demanda (só quando o cartão for gerado pela 1ª vez).
 */
function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);

  if (!html2canvasLoadPromise) {
    html2canvasLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = HTML2CANVAS_URL;
      script.onload = () => resolve(window.html2canvas);
      script.onerror = () => {
        html2canvasLoadPromise = null;
        reject(
          new Error(
            "Não foi possível carregar a biblioteca de geração de imagem (html2canvas). Verifique sua conexão com a internet.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  }

  return html2canvasLoadPromise;
}

/**
 * Preenche os placeholders do template com os dados do paciente.
 */
function fillTemplate(dados) {
  return CARTAO_TEMPLATE.replace(/{{NOME_PACIENTE}}/g, dados.nome)
    .replace(/{{DATA_CIRURGIA}}/g, dados.dataCirurgia)
    .replace(/{{HORARIO_CIRURGIA}}/g, dados.horario)
    .replace(
      /{{NOME_CLINICA}}/g,
      dados.nomeClinica || "Clínica Oftalmológica 15 de Novembro",
    );
}

/**
 * Gera o cartão de confirmação cirúrgica como imagem PNG.
 *
 * @param {{nome: string, dataCirurgia: string, horario: string, nomeClinica?: string}} dadosPaciente
 * @returns {Promise<{dataUrl: string, blob: Blob, fileName: string}>}
 */
export async function gerarCartaoConfirmacao(dadosPaciente) {
  if (
    !dadosPaciente ||
    !dadosPaciente.nome ||
    !dadosPaciente.dataCirurgia ||
    !dadosPaciente.horario
  ) {
    throw new Error(
      "Dados incompletos: nome, data e horário da cirurgia são obrigatórios para gerar o cartão.",
    );
  }

  const html2canvas = await loadHtml2Canvas();

  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.innerHTML = fillTemplate(dadosPaciente);
  document.body.appendChild(container);

  try {
    const cardEl = container.querySelector(".cc-card");
    const canvas = await html2canvas(cardEl, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });

    const dataUrl = canvas.toDataURL("image/png");
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );

    const safeName = dadosPaciente.nome
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const safeDate = dadosPaciente.dataCirurgia.replace(/\//g, "-");
    const fileName = `cartao-${safeName}-${safeDate}.png`;

    return { dataUrl, blob, fileName };
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Dispara o download de uma imagem gerada via URL de dados (data URL).
 */
export function downloadCartaoImage(dataUrl, fileName) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Copia a imagem do cartão para a área de transferência, para colar (Ctrl+V)
 * diretamente na conversa do WhatsApp. Requer navegador com suporte à
 * Clipboard API (Chrome/Edge) em contexto seguro (HTTPS ou localhost).
 *
 * @param {Blob} blob
 * @throws {Error} se o navegador não suportar ou a permissão for negada
 */
export async function copyCartaoToClipboard(blob) {
  if (!navigator.clipboard || !window.ClipboardItem) {
    throw new Error(
      "Este navegador não suporta copiar imagens para a área de transferência.",
    );
  }

  await navigator.clipboard.write([
    new ClipboardItem({ [blob.type]: blob }),
  ]);
}

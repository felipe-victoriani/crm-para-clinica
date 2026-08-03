// cartaoConfirmacao.template.js - Template do cartão visual de confirmação cirúrgica
//
// Placeholders: {{NOME_PACIENTE}} {{DATA_CIRURGIA}} {{HORARIO_CIRURGIA}} {{NOME_CLINICA}}
//
// O logo abaixo é um SVG inline recriando o ícone/tipografia do logo Oftalmo 15
// (não temos o arquivo original da logo). Se você tiver o arquivo real (PNG/SVG),
// converta para base64 (ex: https://base64.guru/converter/encode/image) e troque
// o conteúdo da constante LOGO_SVG por:
//   <img src="data:image/png;base64,SEU_BASE64_AQUI" style="height:28px" />

const LOGO_SVG = `
  <svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 13C1 13 6 5 13 5C20 5 25 13 25 13C25 13 20 21 13 21C6 21 1 13 1 13Z"
      fill="none" stroke="#1B6E68" stroke-width="1.6" />
    <circle cx="13" cy="13" r="4.2" fill="#1B6E68" />
    <circle cx="14.5" cy="11.5" r="1.1" fill="#ffffff" />
  </svg>
`;

export const CARTAO_TEMPLATE = `
<div class="cc-card">
  <style>
    .cc-card {
      width: 380px;
      box-sizing: border-box;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 12px 32px rgba(27, 110, 104, 0.16);
      padding: 28px 26px 24px;
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      color: #2b2b2b;
    }
    .cc-card * { box-sizing: border-box; }
    .cc-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .cc-header-text { line-height: 1.1; }
    .cc-header-title {
      font-size: 15px;
      font-weight: 700;
      color: #1B6E68;
    }
    .cc-header-subtitle {
      font-size: 8px;
      letter-spacing: 1px;
      color: #7c9a97;
      font-weight: 600;
    }
    .cc-title {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 22px;
      font-weight: 700;
      color: #1B6E68;
      margin: 14px 0 12px;
    }
    .cc-divider {
      border: none;
      border-top: 1px solid #e2e8e7;
      margin: 0 0 16px;
    }
    .cc-greeting {
      font-size: 13.5px;
      line-height: 1.55;
      color: #374151;
      margin-bottom: 18px;
    }
    .cc-greeting b { color: #1B6E68; }
    .cc-box {
      border: 1px solid #e2e8e7;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 12px;
    }
    .cc-box-row {
      display: flex;
    }
    .cc-box-col {
      flex: 1;
    }
    .cc-box-col + .cc-box-col {
      border-left: 1px dashed #d7e2e0;
      padding-left: 16px;
      margin-left: 16px;
    }
    .cc-label {
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #8b9997;
      margin-bottom: 4px;
    }
    .cc-value {
      font-family: 'Courier New', ui-monospace, monospace;
      font-size: 19px;
      font-weight: 700;
      color: #1B6E68;
    }
    .cc-value-text {
      font-size: 13.5px;
      font-weight: 700;
      color: #1f2937;
    }
    .cc-section-title {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #1B6E68;
      text-transform: uppercase;
      margin: 20px 0 12px;
    }
    .cc-guideline {
      font-size: 13px;
      line-height: 1.55;
      color: #374151;
      margin-bottom: 10px;
    }
    .cc-guideline b { color: #1B6E68; }
    .cc-alert {
      border-left: 3px solid #b5541f;
      background: #fbeee4;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 12.5px;
      line-height: 1.5;
      color: #8a4318;
      margin: 16px 0 14px;
    }
    .cc-alert b { color: #b5541f; }
    .cc-confirm {
      text-align: center;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 13px;
      color: #9ca3af;
      margin-bottom: 14px;
    }
    .cc-footer-text {
      font-size: 11.5px;
      line-height: 1.5;
      color: #6b7280;
      margin-bottom: 6px;
    }
    .cc-footer-signature {
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 700;
      font-size: 13.5px;
      color: #1B6E68;
    }
  </style>

  <div class="cc-header">
    ${LOGO_SVG}
    <div class="cc-header-text">
      <div class="cc-header-title">Oftalmo 15</div>
      <div class="cc-header-subtitle">CENTRO OFTALMOLÓGICO</div>
    </div>
  </div>

  <div class="cc-title">Confirmação de Cirurgia</div>
  <hr class="cc-divider" />

  <div class="cc-greeting">
    Olá, <b>{{NOME_PACIENTE}}</b>, tudo bem?<br />
    Entramos em contato para confirmar sua cirurgia. Abaixo estão os
    detalhes do seu agendamento e as orientações de preparo.
  </div>

  <div class="cc-box">
    <div class="cc-box-row">
      <div class="cc-box-col">
        <div class="cc-label">DATA</div>
        <div class="cc-value">{{DATA_CIRURGIA}}</div>
      </div>
      <div class="cc-box-col">
        <div class="cc-label">HORÁRIO</div>
        <div class="cc-value">{{HORARIO_CIRURGIA}}</div>
      </div>
    </div>
  </div>

  <div class="cc-box">
    <div class="cc-label">LOCAL</div>
    <div class="cc-value-text">{{NOME_CLINICA}}</div>
  </div>

  <div class="cc-section-title">Orientações para o dia</div>

  <div class="cc-guideline"><b>Jejum de 8 horas</b> antes do procedimento.</div>
  <div class="cc-guideline">Chegue no horário combinado <b>({{HORARIO_CIRURGIA}})</b> — é o início da sua preparação e dilatação.</div>
  <div class="cc-guideline">Sintomas como tosse, febre ou mal-estar? Nos avise antes da cirurgia.</div>
  <div class="cc-guideline">Possui <b>alergia</b> a medicamentos, alimentos, látex ou outras substâncias? Informe antecipadamente.</div>
  <div class="cc-guideline">Suspenda medicações apenas conforme orientação médica.</div>
  <div class="cc-guideline">Traga um <b>acompanhante responsável</b> no dia.</div>

  <div class="cc-alert">
    <b>Atenção — uso de Mounjaro® (tirzepatida):</b> suspenda a medicação
    com antecedência mínima de <b>15 dias</b> da cirurgia, conforme
    protocolo de segurança anestésica.
  </div>

  <div class="cc-confirm">Por favor, confirme sua presença ✓</div>
  <hr class="cc-divider" />

  <div class="cc-footer-text">
    Estamos à disposição para o que precisar. Desejamos que se sinta
    tranquilo(a) e seguro(a) para o seu procedimento.
  </div>
  <div class="cc-footer-signature">Equipe Oftalmo 15</div>
</div>
`;

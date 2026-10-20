// surgery-form.js - Lógica para campo de data da cirurgia no formulário

// Status que exige as datas de cirurgia
const SCHEDULED_STATUS = "Paciente agendou cirurgia";

/**
 * Inicializa a lógica do campo de data da cirurgia
 */
export function initSurgeryDateField() {
  const patientForm = document.getElementById("patientForm");
  const statusSelect = document.getElementById("pStatus");
  const surgeryDateField = document.getElementById("surgeryDateField");
  const surgeryDate2Field = document.getElementById("surgeryDate2Field");
  const surgeryDateInput = document.getElementById("pSurgeryDate");
  const surgeryDate2Input = document.getElementById("pSurgeryDate2");

  if (!statusSelect || !surgeryDateField) return;

  // Mostrar/esconder campos baseado no status (atributo hidden, sem estilo inline)
  function toggleSurgeryDateField() {
    const isScheduled = statusSelect.value === SCHEDULED_STATUS;

    surgeryDateField.hidden = !isScheduled;
    surgeryDate2Field.hidden = !isScheduled;

    // Primeira data é obrigatória só quando o campo está visível
    surgeryDateInput.required = isScheduled;

    // Limpar valores ao esconder para não gravar datas "fantasma"
    if (!isScheduled) {
      surgeryDateInput.value = "";
      surgeryDate2Input.value = "";
    }
  }

  // Atualiza ao trocar o status
  statusSelect.addEventListener("change", toggleSurgeryDateField);

  // Executar ao carregar para verificar estado inicial
  toggleSurgeryDateField();

  // Após qualquer reset do form (botão Limpar ou cadastro concluído).
  // setTimeout: o evento "reset" dispara ANTES dos valores voltarem ao padrão
  if (patientForm) {
    patientForm.addEventListener("reset", () => {
      setTimeout(toggleSurgeryDateField, 0);
    });
  }
}

/**
 * Monta o bloco de data + olho/qt/lio de uma cirurgia no modal de edição.
 * @param {"" | "2"} suffix - "" para a primeira cirurgia, "2" para a segunda
 */
function buildEditSurgeryGroup(suffix) {
  const isFirst = suffix === "";
  const group = document.createElement("div");
  group.className = "form-field form-field--full";
  group.id = `editSurgeryDate${suffix}Field`;
  group.hidden = true;

  // Conteúdo estático (sem dados do usuário), seguro para innerHTML
  group.innerHTML = `
    <label for="editSurgeryDate${suffix}">${isFirst ? "Data da primeira cirurgia" : "Data da segunda cirurgia (opcional)"}</label>
    <input id="editSurgeryDate${suffix}" type="date" name="surgeryDate${suffix}" aria-describedby="editSurgeryDate${suffix}Hint" />
    <small id="editSurgeryDate${suffix}Hint" class="field-hint">
      <i class="fas fa-circle-info" aria-hidden="true"></i>
      ${isFirst ? "Normalmente a cirurgia de um olho (esta data calcula os lembretes)" : "Normalmente a cirurgia do outro olho"}
    </small>
    <div class="surgery-map-fields">
      <div class="form-field">
        <label for="editEye${suffix}">Olho</label>
        <select id="editEye${suffix}" name="eye${suffix}">
          <option value="">Selecione</option>
          <option value="OD">OD</option>
          <option value="OE">OE</option>
          <option value="AO">AO</option>
        </select>
      </div>
      <div class="form-field">
        <label for="editQty${suffix}">Qt</label>
        <input id="editQty${suffix}" type="number" name="qty${suffix}" min="1" value="1" />
      </div>
      <div class="form-field">
        <label for="editLio${suffix}">LIO</label>
        <input id="editLio${suffix}" type="text" name="lio${suffix}" placeholder="${isFirst ? "Ex: EYHANCE +21.5" : "Ex: ISERT +17.5"}" />
      </div>
    </div>
  `;
  return group;
}

/**
 * Adiciona campo de data da cirurgia no modal de edição
 */
export function addSurgeryDateToEditModal() {
  // Verificar se o campo já existe
  if (document.getElementById("editSurgeryDate")) return;

  const editStatus = document.getElementById("editStatus");
  if (!editStatus) return;

  // Insere os dois blocos logo abaixo do select de situação, DENTRO do form
  const group1 = buildEditSurgeryGroup("");
  const group2 = buildEditSurgeryGroup("2");
  editStatus.insertAdjacentElement("afterend", group1);
  group1.insertAdjacentElement("afterend", group2);

  // Mostrar/esconder conforme a situação escolhida no modal
  editStatus.addEventListener("change", () => {
    const isScheduled = editStatus.value === SCHEDULED_STATUS;
    group1.hidden = !isScheduled;
    group2.hidden = !isScheduled;
    if (!isScheduled) {
      document.getElementById("editSurgeryDate").value = "";
      document.getElementById("editSurgeryDate2").value = "";
    }
  });
}

/**
 * Popula o campo de data da cirurgia no modal de edição
 */
export function populateSurgeryDateInEditModal(patient) {
  const surgeryDateInput = document.getElementById("editSurgeryDate");
  const surgeryDateField = document.getElementById("editSurgeryDateField");
  const surgeryDate2Input = document.getElementById("editSurgeryDate2");
  const surgeryDate2Field = document.getElementById("editSurgeryDate2Field");

  if (!surgeryDateInput || !surgeryDateField) return;

  // Preencher olho/qt/lio da primeira e segunda cirurgia
  document.getElementById("editEye").value = patient.eye || "";
  document.getElementById("editQty").value = patient.qty || "1";
  document.getElementById("editLio").value = patient.lio || "";
  document.getElementById("editEye2").value = patient.eye2 || "";
  document.getElementById("editQty2").value = patient.qty2 || "1";
  document.getElementById("editLio2").value = patient.lio2 || "";

  // Datas: preenche o que existir
  surgeryDateInput.value = patient.surgeryDate || "";
  surgeryDate2Input.value = patient.surgeryDate2 || "";

  // Blocos visíveis se o paciente está agendado ou já tem data gravada
  const isScheduled = patient.status === SCHEDULED_STATUS;
  surgeryDateField.hidden = !(isScheduled || patient.surgeryDate);
  surgeryDate2Field.hidden = !(isScheduled || patient.surgeryDate2);
}

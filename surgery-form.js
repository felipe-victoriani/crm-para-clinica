// surgery-form.js - Lógica para campo de data da cirurgia no formulário

/**
 * Inicializa a lógica do campo de data da cirurgia
 */
export function initSurgeryDateField() {
  const statusSelect = document.getElementById("pStatus");
  const surgeryDateField = document.getElementById("surgeryDateField");
  const surgeryDateInput = document.getElementById("pSurgeryDate");

  if (!statusSelect || !surgeryDateField) return;

  // Mostrar/esconder campo baseado no status
  function toggleSurgeryDateField() {
    const selectedStatus = statusSelect.value;

    if (selectedStatus === "Paciente agendou cirurgia") {
      surgeryDateField.style.display = "block";
      // Opcional: tornar campo obrigatório quando visível
      if (surgeryDateInput) {
        surgeryDateInput.setAttribute("required", "required");
      }
    } else {
      surgeryDateField.style.display = "none";
      if (surgeryDateInput) {
        surgeryDateInput.removeAttribute("required");
        surgeryDateInput.value = ""; // Limpar valor ao esconder
      }
    }
  }

  // Adicionar listener ao select de status
  statusSelect.addEventListener("change", toggleSurgeryDateField);

  // Executar ao carregar para verificar estado inicial
  toggleSurgeryDateField();

  // Também adicionar no reset do formulário
  const resetBtn = document.getElementById("resetForm");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      setTimeout(toggleSurgeryDateField, 0);
    });
  }
}

/**
 * Adiciona campo de data da cirurgia no modal de edição
 */
export function addSurgeryDateToEditModal() {
  // Verificar se o campo já existe
  if (document.getElementById("editSurgeryDate")) return;

  // Encontrar o modal de edição
  const editForm = document.getElementById("editForm");
  if (!editForm) return;

  // Encontrar o campo de status para inserir o campo de data após ele
  const editStatus = document.getElementById("editStatus");
  if (!editStatus) return;

  // Criar o campo de data da cirurgia
  const surgeryDateGroup = document.createElement("div");
  surgeryDateGroup.className = "form-field form-field--full";
  surgeryDateGroup.id = "editSurgeryDateField";
  surgeryDateGroup.style.display = "none";
  surgeryDateGroup.innerHTML = `
    <label for="editSurgeryDate">Data da Cirurgia</label>
    <input
      id="editSurgeryDate"
      type="date"
      name="surgeryDate"
      placeholder="Data agendada para a cirurgia"
    />
    <small style="color: #888; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
      💡 Esta data será usada para calcular os lembretes automáticos
    </small>
  `;

  // Inserir após o campo de status
  editStatus.parentElement.parentElement.insertBefore(
    surgeryDateGroup,
    editStatus.parentElement.nextSibling,
  );

  // Adicionar lógica para mostrar/esconder no modal de edição
  editStatus.addEventListener("change", function () {
    const surgeryDateField = document.getElementById("editSurgeryDateField");
    const surgeryDateInput = document.getElementById("editSurgeryDate");

    if (this.value === "Paciente agendou cirurgia") {
      surgeryDateField.style.display = "block";
    } else {
      surgeryDateField.style.display = "none";
      if (surgeryDateInput) {
        surgeryDateInput.value = "";
      }
    }
  });
}

/**
 * Popula o campo de data da cirurgia no modal de edição
 */
export function populateSurgeryDateInEditModal(patient) {
  const surgeryDateInput = document.getElementById("editSurgeryDate");
  const surgeryDateField = document.getElementById("editSurgeryDateField");

  if (!surgeryDateInput || !surgeryDateField) return;

  // Se o paciente tem data de cirurgia, preencher o campo
  if (patient.surgeryDate) {
    surgeryDateInput.value = patient.surgeryDate;
    surgeryDateField.style.display = "block";
  } else {
    surgeryDateInput.value = "";
    // Mostrar apenas se status for "Paciente agendou cirurgia"
    if (patient.status === "Paciente agendou cirurgia") {
      surgeryDateField.style.display = "block";
    } else {
      surgeryDateField.style.display = "none";
    }
  }
}

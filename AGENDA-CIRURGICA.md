# 📅 Módulo de Agenda Cirúrgica - Documentação

## ✨ Funcionalidades Implementadas

### 1. Campo de Data da Cirurgia

- **Localização**: Formulário de cadastro de pacientes
- **Comportamento**: Aparece automaticamente quando o status "Paciente agendou cirurgia" é selecionado
- **Funcionalidade**: Permite registrar a data agendada para a cirurgia do paciente

### 2. Navegação

- **Novo item no menu**: "Agenda Cirúrgica" com ícone de calendário
- **Localização**: Entre "Relatórios" e "Configurações"
- **Atalho**: Clique no menu lateral ou use #surgery-schedule na URL

### 3. Visualização da Agenda Cirúrgica

A agenda é organizada em 3 seções:

#### 🌟 Cirurgias de Hoje

- Destaque especial com cor laranja
- Cards maiores e mais visíveis

#### 📆 Próximas Cirurgias

- Ordenadas por data (mais próximas primeiro)
- Mostra contagem regressiva de dias
- Indica quando é "AMANHÃ" ou "EM X DIAS"
- **Alerta visual** quando a cirurgia não for numa quarta-feira

#### ✅ Cirurgias Realizadas

- Últimas 10 cirurgias passadas
- Mostra "Há X dias"
- Opacidade reduzida para indicar que já foram realizadas

### 4. Sistema de Lembretes Inteligente

#### 📅 Cronograma de Lembretes

- **Sexta-feira** (5 dias antes): Primeiro lembrete
- **Segunda-feira** (2 dias antes): Segundo lembrete
- **Quarta-feira**: Dia da cirurgia

#### 🔔 Alertas Automáticos

O sistema mostra alertas visuais:

- **Alerta azul**: "Enviar lembrete de sexta-feira HOJE"
- **Alerta amarelo**: "Enviar lembrete de segunda-feira HOJE"
- **Informação**: "Próximo lembrete: DD/MM (dia da semana)"

#### ⚠️ Validações

- Aviso visual se a cirurgia não estiver agendada para quarta-feira

### 5. Mensagens para WhatsApp

#### 📱 Botões de Envio

Cada card de cirurgia futura possui 2 botões:

- **"Lembrete Sexta (5 dias)"**: Cor azul
- **"Lembrete Segunda (2 dias)"**: Cor laranja

#### 💬 Template da Mensagem

```
Olá, *[NOME DO PACIENTE]*, tudo bem?

Gostaria primeiramente de agradecer a confiança em nossa equipe nesse momento importante!

Faltam *X dias* para sua cirurgia oftalmológica, pré-agendada para *DD/MM/AAAA* (dia-da-semana), às *HH:MM*, na Clínica Oftalmo 15.

Tipo de cirurgia: *[TIPO]*

Estou entrando em contato para saber: você tem alguma dúvida sobre a cirurgia, orientações pré e pós-operatórias?

Não hesite em nos perguntar! Sua tranquilidade é nossa prioridade. Estamos à disposição para ajudar!

Estamos à disposição para o que precisar e desejamos que se sinta tranquilo(a) e seguro(a) para o seu procedimento.

Atenciosamente,

Equipe Oftalmo 15.
```

#### ✨ Personalização Automática

- Nome do paciente
- Número de dias até a cirurgia (5 ou 2)
- Data completa com dia da semana
- Horário (padrão: 07h15, mas pode ser personalizado)
- Tipo de cirurgia
- Telefone do paciente (com código do país automático)

### 6. Informações em Cada Card

Cada card de cirurgia mostra:

- 📅 **Data da cirurgia** com dia da semana
- 👤 **Nome do paciente**
- ✂️ **Tipo de cirurgia**
- 🕐 **Horário** (padrão: 07h15)
- 📞 **Telefone do paciente**
- 👨‍⚕️ **Médico responsável**
- 📊 **Status** (HOJE, AMANHÃ, EM X DIAS, Há X dias)
- 🔔 **Alerta de lembrete** (quando aplicável)

### 7. Funcionalidades Adicionais

#### 🔄 Atualização Automática

- A agenda atualiza automaticamente quando:
  - Um paciente é cadastrado
  - Um paciente é editado
  - Você troca para a seção "Agenda Cirúrgica"

#### 👁️ Botão "Ver Paciente"

- Permite visualizar/editar os dados completos do paciente
- Redireciona para a seção de pacientes e abre o modal de edição

#### 📊 Contador

- Mostra o número total de cirurgias agendadas no cabeçalho da seção

## 🎨 Melhorias na Mensagem Original

As melhorias implementadas em relação à sua mensagem original:

1. ✅ **Dias dinâmicos**: "Faltam _5 dias_" ou "Faltam _2 dias_" (automático)
2. ✅ **Data completa**: Inclui o dia da semana junto com a data
3. ✅ **Horário personalizável**: Pode ser ajustado por paciente (futuro)
4. ✅ **Tipo de cirurgia**: Automaticamente incluído
5. ✅ **Formatação WhatsApp**: Usa _negrito_ para destaque
6. ✅ **Telefone automático**: Adiciona código do país (55) automaticamente

## 🚀 Como Usar

### Cadastrar uma Cirurgia

1. Vá para "Pacientes"
2. No formulário, selecione "Agendou cirurgia" no campo "Situação"
3. O campo "Data da Cirurgia" aparecerá automaticamente
4. Preencha a data da cirurgia
5. Complete os outros campos (telefone é obrigatório!)
6. Clique em "Cadastrar"

### Visualizar a Agenda

1. Clique em "Agenda Cirúrgica" no menu lateral
2. Veja todas as cirurgias organizadas por data
3. Verifique os alertas de lembretes

### Enviar Lembretes

1. Na seção "Agenda Cirúrgica"
2. Encontre a cirurgia desejada
3. Clique em:
   - "Lembrete Sexta (5 dias)" - 5 dias antes
   - "Lembrete Segunda (2 dias)" - 2 dias antes
4. O WhatsApp abrirá com a mensagem pronta
5. Revise e envie!

### Editar Data da Cirurgia

1. Na lista de pacientes, clique em "Editar"
2. O campo "Data da Cirurgia" aparecerá se o status for "Agendou cirurgia"
3. Altere a data
4. Salve as alterações
5. A agenda atualizará automaticamente

## 💡 Dicas

### Sobre o Dia da Cirurgia

- O sistema assume que **todas as cirurgias são às quartas-feiras**
- Se agendar para outro dia, aparecerá um aviso visual ⚠️
- Os lembretes ainda funcionarão normalmente

### Sobre os Horários

- Horário padrão: **07h15**
- Para mudar: será necessário adicionar um campo "horário" no futuro

### Sobre os Telefones

- Certifique-se de cadastrar o telefone corretamente
- Formato aceito: apenas números (ex: 67999887766)
- O sistema adiciona o código do país (55) automaticamente

## 📱 Responsividade

O módulo é totalmente responsivo:

- **Desktop**: Cards em grade (múltiplas colunas)
- **Tablet**: 2 colunas
- **Mobile**: 1 coluna, botões empilhados verticalmente

## 🎨 Visual

### Cores e Identidade

- **Azul** (#0369a1): Cor principal, próximas cirurgias
- **Laranja** (#f59e0b): Cirurgias de hoje, urgência
- **Verde** (#25d366): Botões do WhatsApp
- **Cinza** (#6b7280): Cirurgias passadas

### Animações

- ✨ Cards com hover (elevação)
- 🔔 Ícone de sino animado nos alertas
- 📊 Pulso nos alertas importantes
- 🎭 Fade in ao mostrar campo de data

## 🔮 Possíveis Melhorias Futuras

1. **Campo de horário personalizado** por cirurgia
2. **Notificações automáticas** (push ou e-mail)
3. **Histórico de lembretes enviados**
4. **Múltiplos templates de mensagem**
5. **Exportar agenda** para PDF ou Excel
6. **Integração com Google Calendar**
7. **Confirmação de recebimento** do paciente

## 📝 Arquivos Criados/Modificados

### Novos Arquivos

- `surgery-schedule.js` - Lógica do módulo de agenda
- `surgery-form.js` - Lógica do campo de data da cirurgia

### Arquivos Modificados

- `index.html` - Adicionado campo e seção de agenda
- `style.css` - Estilos do módulo (≈400 linhas)
- `main.js` - Integração do módulo
- `ui.js` - Formulários e navegação
- `patients.js` - Suporte ao campo surgeryDate (já existia)
- `database.js` - Suporte ao campo surgeryDate (já existia)

---

Desenvolvido com ❤️ para Oftalmo 15

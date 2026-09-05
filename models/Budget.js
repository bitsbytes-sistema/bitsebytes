const mongoose = require("mongoose");

const BudgetSchema = new mongoose.Schema({

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  numero: Number,

  codigo: {
    type: String,
    unique: true,
    sparse: true
  },

  validade: {
    type: Number,
    default: 10
  },

  historico: [{
    acao: String,
    usuario: String,
    data: {
      type: Date,
      default: Date.now
    }
  }],

  clienteId: String,
  cliente: String,
  telefone: String,
  observacoes: String,

  /* ===================== AGENDAMENTO ===================== */

  dataAgendamento: {
    type: String,
    default: null
},

  horaAgendamento: {
    type: String,
    default: null
  },

  /* ======================================================= */

  itens: [
    {
      descricao: String,
      quantidade: Number,
      valor: Number,
      total: Number,
      serviceId: String
    }
  ],

  total: Number,

  status: {
    type: String,
    enum: [
      "pendente",
      "aprovado",
      "reprovado",
      "convertido"
    ],
    default: "pendente"
  },

  /* ===================== PAGAMENTO ===================== */

  pagamento: {
    type: String,
    enum: [
      "pendente",
      "pago",
      "cortesia",
      "permuta"
    ],
    default: "pendente"
  },

  dataPagamento: {
    type: Date,
    default: null
  },

  usuarioPagamento: {
    type: String,
    default: null
  },

  /* ================================================ */

  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ticket",
    default: null
  },

  numeroOS: {
    type: Number,
    default: null
  }

}, {
  timestamps: true
});

module.exports = mongoose.model("Budget", BudgetSchema);
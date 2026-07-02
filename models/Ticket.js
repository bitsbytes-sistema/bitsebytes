const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({

clienteId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Cliente",
  default: null
},

  cliente: {
    type: String,
    required: true,
    trim: true
  },

  telefone: {
    type: String,
    default: ""
  },

  cpfcnpj: {
    type: String,
    default: ""
  },

  endereco: {
    type: String,
    default: ""
  },

bairro: {
  type: String,
  default: ""
},

  cidade: {
    type: String,
    default: ""
  },

  estado: {
    type: String,
    default: ""
  },

  cep: {
    type: String,
    default: ""
  },

  equipamento: {
    type: String,
    default: ""
  },

  problema: {
    type: String,
    required: true,
    trim: true
  },

  status: {
    type: String,
    enum: ["aberto", "andamento", "reparo", "finalizado"],
    default: "aberto",
    lowercase: true,
    trim: true
  },

  /* ===================== LAUDO ===================== */

  diagnostico: {
    type: String,
    default: ""
  },

  servico: {
    type: String,
    default: ""
  },

  pecas: {
    type: String,
    default: ""
  },

  conclusao: {
    type: String,
    default: ""
  },

  garantia: {
    type: String,
    default: ""
  },

  observacoes: {
    type: String,
    default: ""
  },

  tecnico: {
    type: String,
    default: "",
    trim: true
  },

  laudoGerado: {
    type: Boolean,
    default: false
  },

  numeroOS: {
  type: Number,
  default: 1
},

  /* ===================== EMPRESA ===================== */

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Company",
    index: true
  }

}, {
  timestamps: true
});

ticketSchema.index({
  companyId: 1,
  status: 1
});

module.exports = mongoose.model("Ticket", ticketSchema);
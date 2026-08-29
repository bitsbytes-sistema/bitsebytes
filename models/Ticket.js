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

  /* ===================== DIAGNÓSTICO PRÉ-SERVIÇO ===================== */

  diagnosticoPreServico: {
    type: String,
    default: "",
    trim: true
  },

  servicoRecomendado: {
    type: String,
    default: "",
    trim: true
  },

  pecasRecomendadas: {
    type: String,
    default: "",
    trim: true
  },

  valorDiagnostico: {
    type: Number,
    default: 0,
    min: 0
  },

  prazoEstimado: {
    type: String,
    default: "",
    trim: true
  },

  observacoesDiagnostico: {
    type: String,
    default: "",
    trim: true
  },

  tecnicoDiagnostico: {
    type: String,
    default: "",
    trim: true
  },

  situacaoDiagnostico: {
    type: String,
    enum: [
      "rascunho",
      "aguardando_aprovacao",
      "aprovado",
      "recusado"
    ],
    default: "rascunho"
  },

  dataDiagnostico: {
    type: Date,
    default: null
  },

  dataRespostaDiagnostico: {
    type: Date,
    default: null
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

origem: {
  type: String,
  enum: ["direto", "orcamento"],
  default: "direto"
},

budgetId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Budget",
  default: null
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
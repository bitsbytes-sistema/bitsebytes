const mongoose = require("mongoose");

const mensagemProgramadaSchema = new mongoose.Schema({

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true
  },

  lembreteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lembrete",
    required: true,
    index: true
  },

  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cliente",
    required: true
  },

  cliente: {
    type: String,
    default: "",
    trim: true
  },

  telefone: {
    type: String,
    default: "",
    trim: true
  },

  tipo: {
    type: String,
    enum: [
      "confirmacao",
      "lembrete",
      "retorno",
      "manutencao"
    ],
    required: true
  },

  mensagem: {
    type: String,
    required: true,
    trim: true
  },

  dataHoraProgramada: {
    type: Date,
    required: true,
    index: true
  },

  status: {
    type: String,
    enum: [
      "programada",
      "enviada",
      "cancelada"
    ],
    default: "programada"
  },

  enviadaEm: {
    type: Date,
    default: null
  },

  criadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }

}, {
  timestamps: true
});


mensagemProgramadaSchema.index({
  companyId: 1,
  dataHoraProgramada: 1,
  status: 1
});


module.exports = mongoose.model(
  "MensagemProgramada",
  mensagemProgramadaSchema
);

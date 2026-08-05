const mongoose = require("mongoose");

const lembreteSchema = new mongoose.Schema({

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Company",
    index: true
  },

  titulo: {
    type: String,
    required: true,
    trim: true
  },

  descricao: {
    type: String,
    default: ""
  },

  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cliente",
    default: null
  },

  cliente: {
    type: String,
    default: ""
  },

  telefone: {
    type: String,
    default: ""
  },

  data: {
    type: Date,
    required: true
  },

  hora: {
    type: String,
    default: ""
  },

  tipo: {
    type: String,
    enum: [
      "retorno",
      "cobranca",
      "entrega",
      "garantia",
      "revisao",
      "outros"
    ],
    default: "outros"
  },

  status: {
    type: String,
    enum: [
      "pendente",
      "concluido",
      "cancelado"
    ],
    default: "pendente"
  },

  criadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }

}, {
  timestamps: true
});


lembreteSchema.index({
  companyId: 1,
  data: 1
});


module.exports = mongoose.model("Lembrete", lembreteSchema);
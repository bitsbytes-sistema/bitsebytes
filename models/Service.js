const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({

  codigo: {
    type: Number,
    required: true
  },

  nome: {
    type: String,
    required: true,
    trim: true
  },

  tipo: {
    type: String,
    enum: [
      "servico",
      "peca"
    ],
    default: "servico"
  },

  categoria: {
    type: String,
    default: "",
    trim: true
  },

  descricao: {
    type: String,
    default: ""
  },

  valor: {
    type: Number,
    default: 0
  },

  tempo: {
    type: String,
    default: ""
  },

  garantia: {
    type: String,
    default: ""
  },

  ativo: {
    type: Boolean,
    default: true
  },

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true
  }

}, {
  timestamps: true
});

serviceSchema.index({
  companyId: 1,
  nome: 1
});

module.exports = mongoose.model("Service", serviceSchema);

const mongoose = require("mongoose");

const clienteSchema = new mongoose.Schema({

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Company",
    index: true
  },

  codigo: {
    type: Number,
    required: true
  },

  nome: {
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
  }

}, {
  timestamps: true
});

clienteSchema.index({
  companyId: 1,
  codigo: 1
}, {
  unique: true
});

module.exports = mongoose.model("Cliente", clienteSchema);
const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({

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

  equipamento: {
    type: String,
    default: ""
  },

  problema: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: [
      "aberto",
      "andamento",
      "finalizado"
    ],
    default: "aberto"
  },

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Company",
    index: true
  }

}, {

  timestamps: true

});

module.exports =
  mongoose.model(
    "Ticket",
    ticketSchema
  );
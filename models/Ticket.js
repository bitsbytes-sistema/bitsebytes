const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({

  /* ===================== */
  /* DADOS DO CLIENTE */
  /* ===================== */

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

  /* ===================== */
  /* EQUIPAMENTO */
  /* ===================== */

  equipamento: {
    type: String,
    default: ""
  },

  problema: {
    type: String,
    required: true,
    default: ""
  },

  /* ===================== */
  /* STATUS */
  /* ===================== */

  status: {
    type: String,
    enum: ["aberto", "andamento", "finalizado"],
    default: "aberto"
  },

  /* ===================== */
  /* LAUDO TÉCNICO */
  /* ===================== */

  diagnostico: {
    type: String,
    default: ""
  },

  servico: {
    type: String,
    default: ""
  },

  conclusao: {
    type: String,
    default: ""
  },

  /* ===================== */
  /* MULTIEMPRESA */
  /* ===================== */

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Company",
    index: true
  }

}, {

  timestamps: true

});

/* ===================== */
/* ÍNDICE DE SEGURANÇA */
/* ===================== */
ticketSchema.index({ companyId: 1, _id: 1 });

module.exports = mongoose.model("Ticket", ticketSchema);
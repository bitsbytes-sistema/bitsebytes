const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({

  name: {
    type: String,
    required: true
  },

  plan: {
    type: String,
    default: "free"
  },

  ticketLimit: {
    type: Number,
    default: 10
  },

  userLimit: {
    type: Number,
    default: 1
  },

  paymentStatus: {
    type: String,
    default: "pending"
  },

  mpPaymentId: String,

  active: {
    type: Boolean,
    default: true
  },

  /* ========================= */
  /* EMPRESA PROTEGIDA */
  /* ========================= */

  protected: {
    type: Boolean,
    default: false
  },

  /* ========================= */
  /* PERSONALIZAÇÃO EMPRESA */
  /* ========================= */

  logo: {
    type: String,
    default: ""
  },

  backgroundImage: {
    type: String,
    default: ""
  },

  primaryColor: {
    type: String,
    default: "#2563eb"
  },

  secondaryColor: {
    type: String,
    default: "#1e293b"
  },

  /* ========================= */
  /* DADOS DA EMPRESA */
  /* ========================= */

  phone: {
    type: String,
    default: ""
  },

  email: {
    type: String,
    default: ""
  },

  address: {
    type: String,
    default: ""
  },

  website: {
    type: String,
    default: ""
  },

  cnpj: {
    type: String,
    default: ""
  },

  /* ========================= */
  /* RELATÓRIOS / LAUDOS */
  /* ========================= */

  reportFooter: {
    type: String,
    default: ""
  },

  technicianSignature: {
    type: String,
    default: ""
  },

  /* ========================= */
  /* CONTROLE */
  /* ========================= */

  lastAccess: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports =
  mongoose.model(
    "Company",
    companySchema
  );
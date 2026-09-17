const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true
    },

    acao: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    entidade: {
      type: String,
      required: true,
      trim: true
    },

    entidadeId: {
      type: String,
      default: ""
    },

    descricao: {
      type: String,
      default: ""
    },

    executadoPor: {
      type: String,
      required: true
    },

    executadoPorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    autorizadoPor: {
      type: String,
      required: true
    },

    autorizadoPorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    dados: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    data: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "AuditLog",
  AuditLogSchema
);
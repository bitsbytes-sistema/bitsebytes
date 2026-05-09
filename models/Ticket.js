const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  cliente: {
    type: String,
    required: true,
    trim: true,
  },

  problema: {
    type: String,
    required: true,
  },

  status: {
    type: String,
    enum: ["aberto", "andamento", "fechado"],
    default: "aberto",
  },

  // 🔥 ISOLAMENTO SAAS
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Company",
    index: true,
  },
}, {
  timestamps: true, // 🔥 createdAt / updatedAt automático
});

module.exports = mongoose.model("Ticket", ticketSchema);
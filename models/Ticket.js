const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  cliente: String,
  problema: String,
  status: String,

  // 🔥 ISOLAMENTO SAAS
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
});

module.exports = mongoose.model("Ticket", ticketSchema);
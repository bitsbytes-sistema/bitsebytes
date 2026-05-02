const mongoose = require("mongoose");

module.exports = mongoose.model("Ticket", {
  companyId: String,
  cliente: String,
  equipamento: String,
  status: String,
  createdAt: { type: Date, default: Date.now }
});
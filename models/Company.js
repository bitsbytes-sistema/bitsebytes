const mongoose = require("mongoose");

module.exports = mongoose.model("Company", {
  name: String,
  plan: { type: String, default: "free" }, // free | pro
  paymentStatus: { type: String, default: "pending" }, // pending | paid
  mpPaymentId: String,
  createdAt: { type: Date, default: Date.now }
});
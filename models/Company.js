const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({

  name: String,

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
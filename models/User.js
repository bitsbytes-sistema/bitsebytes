const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  password: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    default: "user",
  },

  // 🔥 ISOLAMENTO SAAS
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Company",
  },


  // 🔔 ALERTAS IGNORADOS PELO USUÁRIO
  alertasIgnorados: [
    {
      tipo: String,
      data: Date
    }
  ],


}, {
  timestamps: true,
});

module.exports = mongoose.model("User", userSchema);
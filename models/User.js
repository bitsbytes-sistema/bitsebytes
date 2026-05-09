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
}, {
  timestamps: true, // ajuda no controle do sistema
});

module.exports = mongoose.model("User", userSchema);
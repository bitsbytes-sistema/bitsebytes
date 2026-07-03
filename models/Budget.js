const mongoose = require("mongoose");

const BudgetSchema = new mongoose.Schema({

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  numero: Number,

  clienteId: String,
  cliente: String,

  itens: [
    {
      descricao: String,
      quantidade: Number,
      valor: Number,
      total: Number,
      serviceId: String
    }
  ],

  total: Number,

  status: {
    type: String,
    default: "pendente"
  }

}, {
  timestamps: true
});

module.exports = mongoose.model("Budget", BudgetSchema);
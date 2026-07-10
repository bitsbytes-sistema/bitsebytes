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
telefone: String,
observacoes: String,

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

status:{
    type:String,
    enum:[
        "pendente",
        "aprovado",
        "reprovado",
        "convertido"
    ],
    default:"pendente"
},

ticketId:{
    type: mongoose.Schema.Types.ObjectId,
    ref:"Ticket",
    default:null
},

numeroOS:{
    type:Number,
    default:null
}

}, {
  timestamps: true
});

module.exports = mongoose.model("Budget", BudgetSchema);
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  nome: {
    type: String,
    trim: true,
    default: "",
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
  ativo: {
    type: Boolean,
    default: true,
  },

  permissoes: {
    dashboard: {
      type: Boolean,
      default: true
    },
    clientes: {
      type: Boolean,
      default: true
    },
    chamados: {
      type: Boolean,
      default: true
    },
    orcamentos: {
      type: Boolean,
      default: true
    },
    servicos: {
      type: Boolean,
      default: true
    },
    laudos: {
      type: Boolean,
      default: true
    },
    estoque: {
      type: Boolean,
      default: true
    },
    vendas: {
      type: Boolean,
      default: true
    },
    financeiro: {
      type: Boolean,
      default: true
    },
    lembretes: {
      type: Boolean,
      default: true
    },
    relatorios: {
      type: Boolean,
      default: true
    },
    configuracoes: {
      type: Boolean,
      default: true
    }
  },

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
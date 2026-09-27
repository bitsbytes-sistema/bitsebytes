const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({

clienteId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Cliente",
  default: null
},

  cliente: {
    type: String,
    required: true,
    trim: true
  },

  telefone: {
    type: String,
    default: ""
  },

  cpfcnpj: {
    type: String,
    default: ""
  },

  endereco: {
    type: String,
    default: ""
  },

bairro: {
  type: String,
  default: ""
},

  cidade: {
    type: String,
    default: ""
  },

  estado: {
    type: String,
    default: ""
  },

  cep: {
    type: String,
    default: ""
  },

  equipamento: {
    type: String,
    default: ""
  },

  /* ===================== CHECKLIST DE ENTRADA ===================== */

  checklistEntrada: {
    liga: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    tela: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    teclado: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    touchpadMouse: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    usbConectores: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    carregadorFonte: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    bateria: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    wifi: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    bluetooth: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    camera: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    audio: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    microfone: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    estadoFisico: {
      type: String,
      enum: ["", "ok", "defeito", "nao_testado", "nao_aplica"],
      default: ""
    },

    acessorios: {
      type: String,
      default: "",
      trim: true
    },

    observacoes: {
      type: String,
      default: "",
      trim: true
    },

    dataVerificacao: {
      type: Date,
      default: null
    }
  },
  /* ===================== DESENHO / AVARIAS DO EQUIPAMENTO ===================== */

  desenhoEquipamento: {
    tipo: {
      type: String,
      enum: [
        "",
        "notebook",
        "desktop",
        "impressora",
        "celular",
        "playstation",
        "xbox",
        "monitor",
        "tablet",
        "tv",
        "roteador"
      ],
      default: ""
    },

    observacoes: {
      type: String,
      default: "",
      trim: true
    },

    marcacoes: [
      {
        vista: {
          type: String,
          default: "",
          trim: true
        },

        tipo: {
          type: String,
          enum: [
            "trinca",
            "arranhao",
            "amassado",
            "quebrado",
            "outro"
          ],
          required: true
        },

        x: {
          type: Number,
          min: 0,
          max: 100,
          required: true
        },

        y: {
          type: Number,
          min: 0,
          max: 100,
          required: true
        }
      }
    ]
  },
  /* ===================== FOTOS DO EQUIPAMENTO ===================== */

  fotos: [
    {
      chave: {
        type: String,
        required: true
      },

      nomeOriginal: {
        type: String,
        default: ""
      },

      tipo: {
        type: String,
        default: ""
      },

      tamanho: {
        type: Number,
        default: 0
      },

      observacao: {
        type: String,
        default: "",
        trim: true
      },

      dataEnvio: {
        type: Date,
        default: Date.now
      }
    }
  ],

  problema: {
    type: String,
    required: true,
    trim: true
  },

  status: {
    type: String,
    enum: ["aberto", "andamento", "reparo", "finalizado"],
    default: "aberto",
    lowercase: true,
    trim: true
  },

  /* ===================== DIAGNÃ“STICO PRÃ‰-SERVIÃ‡O ===================== */

  diagnosticoPreServico: {
    type: String,
    default: "",
    trim: true
  },

  servicoRecomendado: {
    type: String,
    default: "",
    trim: true
  },

  pecasRecomendadas: {
    type: String,
    default: "",
    trim: true
  },

  valorDiagnostico: {
    type: Number,
    default: 0,
    min: 0
  },

  prazoEstimado: {
    type: String,
    default: "",
    trim: true
  },

  observacoesDiagnostico: {
    type: String,
    default: "",
    trim: true
  },

  tecnicoDiagnostico: {
    type: String,
    default: "",
    trim: true
  },

  situacaoDiagnostico: {
    type: String,
    enum: [
      "rascunho",
      "aguardando_aprovacao",
      "aprovado",
      "recusado"
    ],
    default: "rascunho"
  },

  dataDiagnostico: {
    type: Date,
    default: null
  },

  dataRespostaDiagnostico: {
    type: Date,
    default: null
  },


  /* ===================== LAUDO ===================== */

  diagnostico: {
    type: String,
    default: ""
  },

  servico: {
    type: String,
    default: ""
  },

  pecas: {
    type: String,
    default: ""
  },

  conclusao: {
    type: String,
    default: ""
  },

  /* ===================== ASSINATURA DO CLIENTE ===================== */

  assinaturaCliente: {
    type: String,
    default: ""
  },

  nomeAssinante: {
    type: String,
    default: "",
    trim: true
  },

  documentoAssinante: {
    type: String,
    default: "",
    trim: true
  },

  dataAssinaturaCliente: {
    type: Date,
    default: null
  },

  assinaturaConfirmada: {
    type: Boolean,
    default: false
  },
  garantia: {
    type: String,
    default: ""
  },

  observacoes: {
    type: String,
    default: ""
  },

  tecnico: {
    type: String,
    default: "",
    trim: true
  },

  laudoGerado: {
    type: Boolean,
    default: false
  },

  numeroOS: {
  type: Number,
  default: 1
},

origem: {
  type: String,
  enum: ["direto", "orcamento"],
  default: "direto"
},

budgetId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Budget",
  default: null
},

  /* ===================== AUDITORIA DE ALTERAÃ‡Ã•ES SENSÃVEIS ===================== */

  auditoria: [
    {

      acao: {
        type: String,
        default: ""
      },

      executadoPor: {
        type: String,
        default: ""
      },

      executadoPorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },

      autorizadoPor: {
        type: String,
        default: ""
      },

      autorizadoPorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },

      clienteAnterior: {
        type: String,
        default: ""
      },

      clienteAnteriorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cliente",
        default: null
      },

      clienteNovo: {
        type: String,
        default: ""
      },

      clienteNovoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cliente",
        default: null
      },

      data: {
        type: Date,
        default: Date.now
      }

    }
  ],
  /* ===================== EMPRESA ===================== */

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Company",
    index: true
  }

}, {
  timestamps: true
});

ticketSchema.index({
  companyId: 1,
  status: 1
});

module.exports = mongoose.model("Ticket", ticketSchema);

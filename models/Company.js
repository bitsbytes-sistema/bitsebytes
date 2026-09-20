const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({

  name: {
    type: String,
    required: true
  },

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

  /* ========================= */
  /* EMPRESA PROTEGIDA */
  /* ========================= */

  protected: {
    type: Boolean,
    default: false
  },

  /* ========================= */
  /* PERSONALIZAÇÃO EMPRESA */
  /* ========================= */

  logo: {
    type: String,
    default: ""
  },

  backgroundImage: {
    type: String,
    default: ""
  },

  primaryColor: {
    type: String,
    default: "#2563eb"
  },

  secondaryColor: {
    type: String,
    default: "#1e293b"
  },

  /* ========================= */
  /* DADOS DA EMPRESA */
  /* ========================= */

  phone: {
    type: String,
    default: ""
  },

  email: {
    type: String,
    default: ""
  },

  address: {
    type: String,
    default: ""
  },

  website: {
    type: String,
    default: ""
  },

  cnpj: {
    type: String,
    default: ""
  },

  /* ========================= */
  /* RELATÓRIOS / LAUDOS */
  /* ========================= */

  /* ========================= */
  /* ORDEM DE SERVIÇO */
  /* ========================= */

  ordemServicoConfig: {

    titulo: {
      type: String,
      default: "ORDEM DE SERVIÇO - ENTRADA"
    },

    subtitulo: {
      type: String,
      default: ""
    },

    mostrarLogo: {
      type: Boolean,
      default: true
    },

    posicaoLogo: {
      type: String,
      enum: ["esquerda", "centro", "direita"],
      default: "esquerda"
    },

    mostrarDadosEmpresa: {
      type: Boolean,
      default: true
    },

    layoutCabecalho: {
      type: String,
      enum: ["padrao", "compacto", "centralizado"],
      default: "padrao"
    },

    mostrarNomeCliente: {
      type: Boolean,
      default: true
    },

    mostrarDocumentoCliente: {
      type: Boolean,
      default: true
    },

    mostrarTelefoneCliente: {
      type: Boolean,
      default: true
    },

    mostrarEmailCliente: {
      type: Boolean,
      default: true
    },

    mostrarEnderecoCliente: {
      type: Boolean,
      default: true
    },

    mostrarLocalizacaoCliente: {
      type: Boolean,
      default: true
    },

    mostrarObservacoesCliente: {
      type: Boolean,
      default: true
    },

    mostrarEquipamento: {
      type: Boolean,
      default: true
    },

    mostrarMarcaModelo: {
      type: Boolean,
      default: true
    },

    mostrarNumeroSerie: {
      type: Boolean,
      default: true
    },

    mostrarEstadoEquipamento: {
      type: Boolean,
      default: true
    },

    mostrarAcessorios: {
      type: Boolean,
      default: true
    },

    mostrarSenhaEquipamento: {
      type: Boolean,
      default: false
    },

    mostrarDefeitoRelatado: {
      type: Boolean,
      default: true
    },

    observacaoPadrao: {
      type: String,
      default: ""
    },

    observacaoInterna: {
      type: String,
      default: ""
    },

    termosCondicoes: {
      type: String,
      default: ""
    },

    garantiaPadrao: {
      type: Number,
      default: 90,
      min: 0,
      max: 3650
    },

    mostrarDiagnostico: {
      type: Boolean,
      default: true
    },

    mostrarServicos: {
      type: Boolean,
      default: true
    },

    mostrarPecas: {
      type: Boolean,
      default: true
    },

    mostrarValores: {
      type: Boolean,
      default: true
    },

    mostrarDesconto: {
      type: Boolean,
      default: true
    },

    mostrarFormaPagamento: {
      type: Boolean,
      default: true
    },

    mostrarDataConclusao: {
      type: Boolean,
      default: true
    },

    mostrarObservacoesFinais: {
      type: Boolean,
      default: true
    },

    mostrarRetirada: {
      type: Boolean,
      default: true
    },

    responsavelRetirada: {
      type: String,
      enum: ["cliente", "responsavel", "ambos"],
      default: "cliente"
    },

    documentoRetirada: {
      type: Boolean,
      default: false
    },

    mostrarRodape: {
      type: Boolean,
      default: true
    },

    textoRodape: {
      type: String,
      default: ""
    },

    mostrarQrCode: {
      type: Boolean,
      default: false
    },

    textoQrCode: {
      type: String,
      default: ""
    },

    tamanhoDocumento: {
      type: String,
      enum: ["a4", "a5"],
      default: "a4"
    },

    fonteTitulo: {
      type: String,
      enum: ["arial", "verdana", "tahoma"],
      default: "arial"
    },

    orientacao: {
      type: String,
      enum: ["retrato", "paisagem"],
      default: "retrato"
    },

    tamanhoFonte: {
      type: String,
      enum: ["pequena", "media", "grande"],
      default: "media"
    },

    esquemaCores: {
      type: String,
      enum: ["empresa", "preto-branco"],
      default: "empresa"
    },

    espacamento: {
      type: String,
      enum: ["compacto", "normal", "amplo"],
      default: "normal"
    },

    estiloTabela: {
      type: String,
      enum: ["simples", "linhas", "sem-bordas"],
      default: "simples"
    },

    quantidadeVias: {
      type: Number,
      enum: [1, 2, 3],
      default: 1
    },

    viaPadrao: {
      type: String,
      enum: ["cliente", "empresa"],
      default: "cliente"
    },

    imprimirObservacaoInterna: {
      type: Boolean,
      default: false
    },

    formatoNumero: {
      type: String,
      enum: ["sequencial", "ano-sequencial"],
      default: "sequencial"
    },

    prefixo: {
      type: String,
      default: "OS"
    },

    digitosNumero: {
      type: Number,
      enum: [4, 5, 6],
      default: 6
    },

    reiniciarNumeroAno: {
      type: Boolean,
      default: false
    },

    assinaturaCliente: {
      type: Boolean,
      default: true
    },

    assinaturaTecnico: {
      type: Boolean,
      default: true
    },

    assinaturaData: {
      type: Boolean,
      default: true
    }

  },

  reportFooter: {
    type: String,
    default: ""
  },

  technicianSignature: {
    type: String,
    default: ""
  },

  /* ========================= */
  /* CONTROLE */
  /* ========================= */

  lastAccess: {
    type: Date,
    default: null
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

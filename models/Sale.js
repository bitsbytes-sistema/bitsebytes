const mongoose = require("mongoose");

const SaleItemSchema = new mongoose.Schema({

    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    nomeProduto: {
        type: String,
        required: true
    },

    quantidade: {
        type: Number,
        required: true,
        min: 1
    },

    precoUnitario: {
        type: Number,
        required: true,
        min: 0
    },

    subtotal: {
        type: Number,
        required: true,
        min: 0
    }

}, {
    _id: true
});


const SaleSchema = new mongoose.Schema({

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    numeroVenda: {
        type: Number,
        required: true
    },

    clienteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cliente",
        required: true
    },

    clienteNome: {
        type: String,
        required: true
    },

    clienteTelefone: {
        type: String,
        default: ""
    },

    itens: {
        type: [SaleItemSchema],
        required: true
    },

    subtotal: {
        type: Number,
        default: 0
    },

    desconto: {
        type: Number,
        default: 0
    },

    total: {
        type: Number,
        default: 0
    },


    /* =====================================================
       PAGAMENTO
    ===================================================== */

    formaPagamento: {
        type: String,
        default: "Dinheiro"
    },

    parcelas: {
        type: Number,
        default: null,
        min: 1,
        max: 12
    },


    /* =====================================================
       MAQUININHA / TAXA DO CARTÃO
    ===================================================== */

    maquininha: {
        type: String,
        default: null
    },

    tipoJuros: {
        type: String,
        enum: [
            "sem_juros",
            "com_juros"
        ],
        default: "sem_juros"
    },

taxaPercentual: {
    type: Number,
    default: 0,
    min: 0
},

valorTaxa: {
    type: Number,
    default: 0,
    min: 0
},

valorLiquido: {
    type: Number,
    default: 0,
    min: 0
},

valorFinalCartao: {
    type: Number,
    default: 0,
    min: 0
},

valorParcela: {
    type: Number,
    default: 0,
    min: 0
},


    /* =====================================================
       STATUS
    ===================================================== */

    status: {
        type: String,
        enum: [
            "finalizada",
            "cancelada"
        ],
        default: "finalizada"
    },

    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }

}, {
    timestamps: true
});


module.exports =
    mongoose.model(
        "Sale",
        SaleSchema
    );
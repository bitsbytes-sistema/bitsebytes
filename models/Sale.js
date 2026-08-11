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

    formaPagamento: {
        type: String,
        default: "Dinheiro"
    },

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


module.exports = mongoose.model("Sale", SaleSchema);
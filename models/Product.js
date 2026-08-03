const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    codigo: {
        type: String,
        default: ""
    },

    nome: {
        type: String,
        required: true
    },

    descricao: {
        type: String,
        default: ""
    },

    categoria: {
        type: String,
        default: ""
    },

    fornecedor: {
        type: String,
        default: ""
    },

    marca: {
        type: String,
        default: ""
    },

    observacoes: {
        type: String,
        default: ""
    },

    quantidade: {
        type: Number,
        default: 0
    },

    estoqueMinimo: {
        type: Number,
        default: 0
    },

    custo: {
        type: Number,
        default: 0
    },

    venda: {
        type: Number,
        default: 0
    },

    localizacao: {
        type: String,
        default: ""
    },

    ativo: {
        type: Boolean,
        default: true
    }

},{
    timestamps:true
});

module.exports = mongoose.model("Product", ProductSchema);
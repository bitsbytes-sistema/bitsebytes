const mongoose = require("mongoose");

const MovimentoFinanceiroSchema = new mongoose.Schema({

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true,
        index: true
    },

    tipo: {
        type: String,
        enum: [
            "entrada",
            "saida"
        ],
        required: true
    },

    descricao: {
        type: String,
        required: true,
        trim: true
    },

    categoria: {
        type: String,
        default: "",
        trim: true
    },

    valor: {
        type: Number,
        required: true,
        min: 0
    },

    status: {
        type: String,
        enum: [
            "pendente",
            "pago",
            "cancelado"
        ],
        default: "pago"
    },

    formaPagamento: {
        type: String,
        default: "",
        trim: true
    },

    dataCompetencia: {
        type: Date,
        default: Date.now
    },

    dataVencimento: {
        type: Date,
        default: null
    },

    dataPagamento: {
        type: Date,
        default: null
    },

    observacoes: {
        type: String,
        default: "",
        trim: true
    },

    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    usuarioNome: {
        type: String,
        default: "",
        trim: true
    }

}, {
    timestamps: true
});

MovimentoFinanceiroSchema.index({
    companyId: 1,
    dataCompetencia: -1
});

MovimentoFinanceiroSchema.index({
    companyId: 1,
    tipo: 1,
    status: 1
});

module.exports =
    mongoose.model(
        "MovimentoFinanceiro",
        MovimentoFinanceiroSchema
    );
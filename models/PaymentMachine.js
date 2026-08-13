const mongoose = require("mongoose");

const PaymentMachineSchema = new mongoose.Schema({

    /* =====================================================
       EMPRESA
    ===================================================== */

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },


    /* =====================================================
       NOME DA MAQUININHA / MODALIDADE
    ===================================================== */

    nome: {
        type: String,
        required: true,
        trim: true
    },


    /* =====================================================
       TAXAS POR PARCELAMENTO
    ===================================================== */

    taxas: {

        "1": {
            type: Number,
            default: 0,
            min: 0
        },

        "2": {
            type: Number,
            default: 0,
            min: 0
        },

        "3": {
            type: Number,
            default: 0,
            min: 0
        },

        "4": {
            type: Number,
            default: 0,
            min: 0
        },

        "5": {
            type: Number,
            default: 0,
            min: 0
        },

        "6": {
            type: Number,
            default: 0,
            min: 0
        },

        "7": {
            type: Number,
            default: 0,
            min: 0
        },

        "8": {
            type: Number,
            default: 0,
            min: 0
        },

        "9": {
            type: Number,
            default: 0,
            min: 0
        },

        "10": {
            type: Number,
            default: 0,
            min: 0
        },

        "11": {
            type: Number,
            default: 0,
            min: 0
        },

        "12": {
            type: Number,
            default: 0,
            min: 0
        }

    },


    /* =====================================================
       STATUS
    ===================================================== */

    ativo: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});


module.exports =
    mongoose.model(
        "PaymentMachine",
        PaymentMachineSchema
    );
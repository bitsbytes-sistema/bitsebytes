const mongoose = require("mongoose");

const StockMovementSchema = new mongoose.Schema({

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
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

    quantidade: {
        type: Number,
        required: true,
        min: 1
    },

    motivo: {
        type: String,
        default: ""
    },

    // Será utilizado futuramente quando
    // a saída vier de uma venda.
    vendaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Sale",
        default: null
    },

    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    }

}, {
    timestamps: true
});

module.exports = mongoose.model(
    "StockMovement",
    StockMovementSchema
);

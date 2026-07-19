const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true
    },

    tipo: {
        type: String,
        enum: [
            "novo_chamado",
            "orcamento_aprovado",
            "orcamento_pago",
            "sistema"
        ],
        required: true
    },

    titulo: {
        type: String,
        required: true
    },

    mensagem: {
        type: String,
        required: true
    },

    ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ticket",
        default: null
    },

    budgetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Budget",
        default: null
    },

    lida: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Notification", NotificationSchema);
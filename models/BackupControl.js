const mongoose = require("mongoose");

const BackupControlSchema = new mongoose.Schema(
    {
        chave: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        ultimoBackupAutomatico: {
            type: Date,
            default: null
        },

        ultimaTentativa: {
            type: Date,
            default: null
        },

        ultimoStatus: {
            type: String,
            enum: [
                "sucesso",
                "erro"
            ],
            default: "sucesso"
        },

        ultimoErro: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.model(
        "BackupControl",
        BackupControlSchema
    );

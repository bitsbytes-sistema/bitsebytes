const mongoose = require("mongoose");


/* =====================================================
   ESTRUTURA DE TAXA
===================================================== */

const TaxaJurosSchema = {

    sem_juros: {
        type: Number,
        default: 0,
        min: 0
    },

    com_juros: {
        type: Number,
        default: 0,
        min: 0
    }

};


/* =====================================================
   ESTRUTURA DA MAQUININHA
===================================================== */

const PaymentMachineSchema = new mongoose.Schema({

    /* =================================================
       EMPRESA
    ================================================= */

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },


    /* =================================================
       NOME DA MAQUININHA
    ================================================= */

    nome: {
        type: String,
        required: true,
        trim: true
    },


    /* =================================================
       TAXAS DE DÉBITO
       
       Débito possui:
       
       - Sem juros
       - Com juros
    ================================================= */

    debito: {

        sem_juros: {
            type: Number,
            default: 0,
            min: 0
        },

        com_juros: {
            type: Number,
            default: 0,
            min: 0
        }

    },


    /* =================================================
       TAXAS DE CRÉDITO
       
       Cada quantidade de parcelas possui:
       
       - Sem juros
       - Com juros
       
       1x até 12x
    ================================================= */

    credito: {

        "1": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        "2": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        "3": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        "4": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        "5": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        "6": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        "7": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        "8": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        "9": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        "10": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        "11": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        "12": {
            sem_juros: {
                type: Number,
                default: 0,
                min: 0
            },

            com_juros: {
                type: Number,
                default: 0,
                min: 0
            }
        }

    },


    /* =================================================
       STATUS
    ================================================= */

    ativo: {
        type: Boolean,
        default: true
    }

}, {

    timestamps: true

});


/* =====================================================
   EXPORTAR MODEL
===================================================== */

module.exports =
    mongoose.model(
        "PaymentMachine",
        PaymentMachineSchema
    );
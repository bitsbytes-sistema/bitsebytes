const express = require("express");
const router = express.Router();

const PaymentMachine = require("../models/PaymentMachine");

const auth = require("../middleware/auth");


/* =========================================================
   LISTAR MAQUININHAS
========================================================= */

router.get("/", auth, async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;


        const maquininhas =
            await PaymentMachine.find({

                companyId

            })
            .sort({
                nome: 1
            });


        res.json(maquininhas);


    } catch (err) {

        console.error(err);


        res.status(500).json({

            error:
                "Erro ao listar maquininhas."

        });

    }

});


/* =========================================================
   BUSCAR MAQUININHA
========================================================= */

router.get("/:id", auth, async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;


        const maquininha =
            await PaymentMachine.findOne({

                _id:
                    req.params.id,

                companyId

            });


        if (!maquininha) {

            return res.status(404).json({

                error:
                    "Maquininha não encontrada."

            });

        }


        res.json(maquininha);


    } catch (err) {

        console.error(err);


        res.status(500).json({

            error:
                "Erro ao buscar maquininha."

        });

    }

});


/* =========================================================
   CADASTRAR MAQUININHA
========================================================= */

router.post("/", auth, async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;


        const {
            nome,
            taxas
        } = req.body;


        /* =================================================
           VALIDAÇÃO
        ================================================= */

        if (!nome || !nome.trim()) {

            return res.status(400).json({

                error:
                    "Informe o nome da maquininha."

            });

        }


        /* =================================================
           VERIFICAR DUPLICIDADE
        ================================================= */

        const existente =
            await PaymentMachine.findOne({

                companyId,

                nome:
                    nome.trim()

            });


        if (existente) {

            return res.status(400).json({

                error:
                    "Já existe uma maquininha com esse nome."

            });

        }


        /* =================================================
           TAXAS
        ================================================= */

        const taxasRecebidas =
            taxas || {};


        const taxasFormatadas = {};


        for (let i = 1; i <= 12; i++) {

            const valor =
                Number(
                    taxasRecebidas[i] || 0
                );


            if (
                !Number.isFinite(valor) ||
                valor < 0
            ) {

                return res.status(400).json({

                    error:
                        `Taxa inválida para ${i}x.`

                });

            }


            taxasFormatadas[i] =
                valor;

        }


        /* =================================================
           CRIAR
        ================================================= */

        const maquininha =
            await PaymentMachine.create({

                companyId,

                nome:
                    nome.trim(),

                taxas:
                    taxasFormatadas,

                ativo:
                    true

            });


        res.json({

            ok: true,

            maquininha

        });


    } catch (err) {

        console.error(err);


        res.status(500).json({

            error:
                "Erro ao cadastrar maquininha."

        });

    }

});


/* =========================================================
   EDITAR MAQUININHA
========================================================= */

router.put("/:id", auth, async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;


        const {
            nome,
            taxas,
            ativo
        } = req.body;


        const maquininha =
            await PaymentMachine.findOne({

                _id:
                    req.params.id,

                companyId

            });


        if (!maquininha) {

            return res.status(404).json({

                error:
                    "Maquininha não encontrada."

            });

        }


        /* =================================================
           NOME
        ================================================= */

        if (
            nome !== undefined
        ) {

            if (
                !String(nome).trim()
            ) {

                return res.status(400).json({

                    error:
                        "Informe o nome da maquininha."

                });

            }


            const duplicada =
                await PaymentMachine.findOne({

                    companyId,

                    nome:
                        String(nome).trim(),

                    _id: {
                        $ne:
                            maquininha._id
                    }

                });


            if (duplicada) {

                return res.status(400).json({

                    error:
                        "Já existe outra maquininha com esse nome."

                });

            }


            maquininha.nome =
                String(nome).trim();

        }


        /* =================================================
           TAXAS
        ================================================= */

        if (
            taxas !== undefined
        ) {

            for (let i = 1; i <= 12; i++) {

                const valor =
                    Number(
                        taxas[i] || 0
                    );


                if (
                    !Number.isFinite(valor) ||
                    valor < 0
                ) {

                    return res.status(400).json({

                        error:
                            `Taxa inválida para ${i}x.`

                    });

                }


                maquininha.taxas[String(i)] =
                    valor;

            }

        }


        /* =================================================
           ATIVO
        ================================================= */

        if (
            ativo !== undefined
        ) {

            maquininha.ativo =
                Boolean(ativo);

        }


        await maquininha.save();


        res.json({

            ok: true,

            maquininha

        });


    } catch (err) {

        console.error(err);


        res.status(500).json({

            error:
                "Erro ao editar maquininha."

        });

    }

});


/* =========================================================
   ATIVAR / DESATIVAR
========================================================= */

router.patch("/:id/status", auth, async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;


        const maquininha =
            await PaymentMachine.findOne({

                _id:
                    req.params.id,

                companyId

            });


        if (!maquininha) {

            return res.status(404).json({

                error:
                    "Maquininha não encontrada."

            });

        }


        maquininha.ativo =
            !maquininha.ativo;


        await maquininha.save();


        res.json({

            ok: true,

            maquininha

        });


    } catch (err) {

        console.error(err);


        res.status(500).json({

            error:
                "Erro ao alterar status da maquininha."

        });

    }

});


/* =========================================================
   EXCLUIR MAQUININHA
========================================================= */

router.delete("/:id", auth, async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;


        const maquininha =
            await PaymentMachine.findOne({

                _id:
                    req.params.id,

                companyId

            });


        if (!maquininha) {

            return res.status(404).json({

                error:
                    "Maquininha não encontrada."

            });

        }


        await PaymentMachine.deleteOne({

            _id:
                maquininha._id

        });


        res.json({

            ok: true

        });


    } catch (err) {

        console.error(err);


        res.status(500).json({

            error:
                "Erro ao excluir maquininha."

        });

    }

});


module.exports = router;
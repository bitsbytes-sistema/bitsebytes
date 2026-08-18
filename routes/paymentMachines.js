const express = require("express");
const router = express.Router();

const PaymentMachine = require("../models/PaymentMachine");


/* =====================================================
   LISTAR MÁQUINAS
===================================================== */

router.get("/", async (req, res) => {

    try {

        const machines =
            await PaymentMachine.find({

                companyId:
                    req.session.user.companyId

            })
            .sort({
                nome: 1
            });


        res.json(machines);


    } catch (err) {

        console.error(
            "Erro ao listar máquinas de pagamento:",
            err
        );


        res.status(500).json({

            error: true,

            message:
                "Erro ao listar máquinas de pagamento."

        });

    }

});


/* =====================================================
   BUSCAR MÁQUINA POR ID
===================================================== */

router.get("/:id", async (req, res) => {

    try {

        const machine =
            await PaymentMachine.findOne({

                _id:
                    req.params.id,

                companyId:
                    req.session.user.companyId

            });


        if (!machine) {

            return res.status(404).json({

                error:
                    "Máquina não encontrada."

            });

        }


        res.json(machine);


    } catch (err) {

        console.error(
            "Erro ao buscar máquina de pagamento:",
            err
        );


        res.status(500).json({

            error: true,

            message:
                "Erro ao buscar máquina de pagamento."

        });

    }

});


/* =====================================================
   CRIAR MÁQUINA
===================================================== */

router.post("/", async (req, res) => {

    try {

        const machine =
            await PaymentMachine.create({

                /* =====================================
                   EMPRESA
                ===================================== */

                companyId:
                    req.session.user.companyId,


                /* =====================================
                   NOME
                ===================================== */

                nome:
                    String(
                        req.body.nome || ""
                    ).trim(),


                /* =====================================
                   DÉBITO
                ===================================== */

                debito: {

                    sem_juros:
                        Number(
                            req.body.debito?.sem_juros || 0
                        ),

                    com_juros:
                        Number(
                            req.body.debito?.com_juros || 0
                        )

                },


                /* =====================================
                   CRÉDITO
                ===================================== */

                credito: {

                    "1": {

                        sem_juros:
                            Number(
                                req.body.credito?.["1"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["1"]?.com_juros || 0
                            )

                    },


                    "2": {

                        sem_juros:
                            Number(
                                req.body.credito?.["2"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["2"]?.com_juros || 0
                            )

                    },


                    "3": {

                        sem_juros:
                            Number(
                                req.body.credito?.["3"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["3"]?.com_juros || 0
                            )

                    },


                    "4": {

                        sem_juros:
                            Number(
                                req.body.credito?.["4"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["4"]?.com_juros || 0
                            )

                    },


                    "5": {

                        sem_juros:
                            Number(
                                req.body.credito?.["5"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["5"]?.com_juros || 0
                            )

                    },


                    "6": {

                        sem_juros:
                            Number(
                                req.body.credito?.["6"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["6"]?.com_juros || 0
                            )

                    },


                    "7": {

                        sem_juros:
                            Number(
                                req.body.credito?.["7"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["7"]?.com_juros || 0
                            )

                    },


                    "8": {

                        sem_juros:
                            Number(
                                req.body.credito?.["8"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["8"]?.com_juros || 0
                            )

                    },


                    "9": {

                        sem_juros:
                            Number(
                                req.body.credito?.["9"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["9"]?.com_juros || 0
                            )

                    },


                    "10": {

                        sem_juros:
                            Number(
                                req.body.credito?.["10"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["10"]?.com_juros || 0
                            )

                    },


                    "11": {

                        sem_juros:
                            Number(
                                req.body.credito?.["11"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["11"]?.com_juros || 0
                            )

                    },


                    "12": {

                        sem_juros:
                            Number(
                                req.body.credito?.["12"]?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.credito?.["12"]?.com_juros || 0
                            )

                    }

                },


                /* =====================================
                   STATUS
                ===================================== */

                ativo: true

            });


        res.status(201).json(machine);


    } catch (err) {

        console.error(
            "Erro ao criar máquina de pagamento:",
            err
        );


        res.status(500).json({

            error: true,

            message:
                "Erro ao criar máquina de pagamento."

        });

    }

});


/* =====================================================
   EDITAR MÁQUINA
===================================================== */

router.put("/:id", async (req, res) => {

    try {

        const machine =
            await PaymentMachine.findOneAndUpdate(

                {

                    _id:
                        req.params.id,

                    companyId:
                        req.session.user.companyId

                },


                {

                    /* =================================
                       NOME
                    ================================= */

                    nome:
                        String(
                            req.body.nome || ""
                        ).trim(),


                    /* =================================
                       DÉBITO
                    ================================= */

                    debito: {

                        sem_juros:
                            Number(
                                req.body.debito?.sem_juros || 0
                            ),

                        com_juros:
                            Number(
                                req.body.debito?.com_juros || 0
                            )

                    },


                    /* =================================
                       CRÉDITO
                    ================================= */

                    credito: {

                        "1": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["1"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["1"]?.com_juros || 0
                                )

                        },


                        "2": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["2"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["2"]?.com_juros || 0
                                )

                        },


                        "3": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["3"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["3"]?.com_juros || 0
                                )

                        },


                        "4": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["4"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["4"]?.com_juros || 0
                                )

                        },


                        "5": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["5"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["5"]?.com_juros || 0
                                )

                        },


                        "6": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["6"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["6"]?.com_juros || 0
                                )

                        },


                        "7": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["7"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["7"]?.com_juros || 0
                                )

                        },


                        "8": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["8"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["8"]?.com_juros || 0
                                )

                        },


                        "9": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["9"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["9"]?.com_juros || 0
                                )

                        },


                        "10": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["10"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["10"]?.com_juros || 0
                                )

                        },


                        "11": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["11"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["11"]?.com_juros || 0
                                )

                        },


                        "12": {

                            sem_juros:
                                Number(
                                    req.body.credito?.["12"]?.sem_juros || 0
                                ),

                            com_juros:
                                Number(
                                    req.body.credito?.["12"]?.com_juros || 0
                                )

                        }

                    }

                },


                {

                    new: true,

                    runValidators: true

                }

            );


        if (!machine) {

            return res.status(404).json({

                error:
                    "Máquina não encontrada."

            });

        }


        res.json(machine);


    } catch (err) {

        console.error(
            "Erro ao editar máquina de pagamento:",
            err
        );


        res.status(500).json({

            error: true,

            message:
                "Erro ao editar máquina de pagamento."

        });

    }

});


/* =====================================================
   ALTERAR STATUS
===================================================== */

router.patch("/:id/status", async (req, res) => {

    try {

        const machine =
            await PaymentMachine.findOne({

                _id:
                    req.params.id,

                companyId:
                    req.session.user.companyId

            });


        if (!machine) {

            return res.status(404).json({

                error:
                    "Máquina não encontrada."

            });

        }


        machine.ativo =
            !machine.ativo;


        await machine.save();


        res.json({

            ok: true,

            maquininha:
                machine

        });


    } catch (err) {

        console.error(
            "Erro ao alterar status da máquina:",
            err
        );


        res.status(500).json({

            error: true,

            message:
                "Erro ao alterar status da máquina."

        });

    }

});


/* =====================================================
   EXCLUIR MÁQUINA
===================================================== */

router.delete("/:id", async (req, res) => {

    try {

        const machine =
            await PaymentMachine.findOneAndDelete({

                _id:
                    req.params.id,

                companyId:
                    req.session.user.companyId

            });


        if (!machine) {

            return res.status(404).json({

                error:
                    "Máquina não encontrada."

            });

        }


        res.json({

            ok: true

        });


    } catch (err) {

        console.error(
            "Erro ao excluir máquina de pagamento:",
            err
        );


        res.status(500).json({

            error: true,

            message:
                "Erro ao excluir máquina de pagamento."

        });

    }

});


module.exports = router;
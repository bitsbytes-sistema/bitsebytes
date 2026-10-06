const express = require("express");
const router = express.Router();

const PaymentMachine = require("../models/PaymentMachine");
const User = require("../models/User");
const bcrypt = require("bcrypt");


/* =====================================================
   LISTAR MÁQUINAS
===================================================== */

async function carregarUsuarioPermissoes(req) {

    const User = require("../models/User");

    return await User.findById(
        req.session.user._id
    );

}


async function requirePermissaoMaquininhas(req, res, next) {

    try {

        const user =
            await carregarUsuarioPermissoes(req);

        if (!user) {
            return res.status(401).json({
                error: "user_not_found"
            });
        }

        if (user.role === "master") {
            return next();
        }

        const permissoes =
            user.permissoes || {};

        const podeVendas =
            permissoes.vendas !== false;

        const podeConfiguracoes =
            permissoes.configuracoes !== false;

        if (
            !podeVendas &&
            !podeConfiguracoes
        ) {
            return res.status(403).json({
                error: "permission_denied",
                modulo: "payment-machines"
            });
        }

        next();

    } catch (err) {

        console.error(
            "ERRO AO VERIFICAR PERMISSAO DE MAQUININHAS:",
            err
        );

        return res.status(500).json({
            error: "permission_check_error"
        });

    }

}


async function requireConfiguracoesMaquininhas(req, res, next) {

    try {

        const user =
            await carregarUsuarioPermissoes(req);

        if (!user) {
            return res.status(401).json({
                error: "user_not_found"
            });
        }

        if (user.role === "master") {
            return next();
        }

        if (
            user.permissoes &&
            user.permissoes.configuracoes === false
        ) {
            return res.status(403).json({
                error: "permission_denied",
                modulo: "configuracoes"
            });
        }

        next();

    } catch (err) {

        console.error(
            "ERRO AO VERIFICAR PERMISSAO DE CONFIGURACOES:",
            err
        );

        return res.status(500).json({
            error: "permission_check_error"
        });

    }

}


router.get("/", requirePermissaoMaquininhas, async (req, res) => {

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

router.get("/:id", requireConfiguracoesMaquininhas, async (req, res) => {

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

router.post("/", requireConfiguracoesMaquininhas, async (req, res) => {

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

router.put("/:id", requireConfiguracoesMaquininhas, async (req, res) => {

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

router.patch("/:id/status", requireConfiguracoesMaquininhas, async (req, res) => {

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

router.delete("/:id", requireConfiguracoesMaquininhas, async (req, res) => {

    try {

        const companyId =
            String(req.session.user.companyId);

        const adminUsername =
            String(req.body.adminUsername || "").trim();

        const adminPassword =
            String(req.body.adminPassword || "");

        if(!adminUsername || !adminPassword){
            return res.status(400).json({
                error:"Informe o usuario e a senha do administrador."
            });
        }

        const administrador = await User.findOne({
            username:adminUsername
        });

        if(
            !administrador ||
            String(administrador.companyId) !== companyId
        ){
            return res.status(401).json({
                error:"Administrador ou senha invalidos."
            });
        }

        const perfil =
            String(administrador.role || "").toLowerCase();

        if(perfil !== "admin" && perfil !== "master"){
            return res.status(403).json({
                error:"O usuario informado nao possui permissao administrativa."
            });
        }

        const senhaCorreta = await bcrypt.compare(
            adminPassword,
            administrador.password
        );

        if(!senhaCorreta){
            return res.status(401).json({
                error:"Administrador ou senha invalidos."
            });
        }

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
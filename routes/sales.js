const express = require("express");
const router = express.Router();

const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Cliente = require("../models/Cliente");
const StockMovement = require("../models/StockMovement");

const auth = require("../middleware/auth");


/* =========================================================
   LISTAR VENDAS
========================================================= */

router.get("/", auth, async (req, res) => {

    try {

        const vendas = await Sale.find({
            companyId: req.session.user.companyId
        })
        .populate("clienteId", "nome telefone")
        .populate("itens.productId", "nome codigo")
        .sort({
            createdAt: -1
        });

        res.json(vendas);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Erro ao listar vendas."
        });

    }

});


/* =========================================================
   BUSCAR VENDA
========================================================= */

router.get("/:id", auth, async (req, res) => {

    try {

        const venda = await Sale.findOne({

            _id: req.params.id,

            companyId:
                req.session.user.companyId

        })
        .populate("clienteId", "nome telefone")
        .populate("itens.productId", "nome codigo");

        if (!venda) {

            return res.status(404).json({
                error: "Venda não encontrada."
            });

        }

        res.json(venda);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Erro ao buscar venda."
        });

    }

});


/* =========================================================
   CRIAR VENDA
========================================================= */

router.post("/", auth, async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;

        const usuarioId =
            req.session.user._id;


        let {

            clienteId,

            clienteNome,

            clienteTelefone,

            itens,

            desconto,

            formaPagamento

        } = req.body;


        /* =====================================================
           VALIDAÇÃO DOS ITENS
        ===================================================== */

        if (
            !Array.isArray(itens) ||
            itens.length === 0
        ) {

            return res.status(400).json({

                error:
                    "Adicione pelo menos um produto à venda."

            });

        }


        /* =====================================================
           CLIENTE
        ===================================================== */

        let cliente;


        /* -----------------------------------------------------
           CLIENTE EXISTENTE
        ----------------------------------------------------- */

        if (clienteId) {

            cliente =
                await Cliente.findOne({

                    _id: clienteId,

                    companyId

                });


            if (!cliente) {

                return res.status(404).json({

                    error:
                        "Cliente não encontrado."

                });

            }

        }


        /* -----------------------------------------------------
           CLIENTE NOVO
        ----------------------------------------------------- */

        else {

            if (!clienteNome) {

                return res.status(400).json({

                    error:
                        "Informe o nome do cliente."

                });

            }


const ultimoCliente = await Cliente.findOne({
    companyId
}).sort({
    codigo: -1
});

const proximoCodigo =
    ultimoCliente
        ? ultimoCliente.codigo + 1
        : 1;


cliente = await Cliente.create({

    companyId,

    codigo:
        proximoCodigo,

    nome:
        clienteNome.trim(),

    telefone:
        clienteTelefone || ""

});

        }


        /* =====================================================
           PREPARAR ITENS
        ===================================================== */

        const itensVenda = [];

        let subtotal = 0;


        for (const item of itens) {

            const quantidade =
                Number(item.quantidade);


            if (
                !Number.isInteger(quantidade) ||
                quantidade <= 0
            ) {

                return res.status(400).json({

                    error:
                        "Quantidade inválida para um dos produtos."

                });

            }


            const produto =
                await Product.findOne({

                    _id: item.productId,

                    companyId

                });


            if (!produto) {

                return res.status(404).json({

                    error:
                        "Produto não encontrado."

                });

            }


            const estoqueAtual =
                Number(produto.quantidade || 0);


            if (quantidade > estoqueAtual) {

                return res.status(400).json({

                    error:
                        `Estoque insuficiente para "${produto.nome}". Estoque atual: ${estoqueAtual}.`

                });

            }


            const precoUnitario =
                Number(produto.venda || 0);


            const subtotalItem =
                precoUnitario * quantidade;


            subtotal += subtotalItem;


            itensVenda.push({

                productId:
                    produto._id,

                nomeProduto:
                    produto.nome,

                quantidade,

                precoUnitario,

                subtotal:
                    subtotalItem

            });

        }


        /* =====================================================
           DESCONTO
        ===================================================== */

        const valorDesconto =
            Number(desconto || 0);


        if (valorDesconto < 0) {

            return res.status(400).json({

                error:
                    "Desconto inválido."

            });

        }


        if (valorDesconto > subtotal) {

            return res.status(400).json({

                error:
                    "O desconto não pode ser maior que o subtotal."

            });

        }


        const total =
            subtotal - valorDesconto;


        /* =====================================================
           NÚMERO DA VENDA
        ===================================================== */

        const ultimaVenda =
            await Sale.findOne({

                companyId

            })
            .sort({
                numeroVenda: -1
            });


        const numeroVenda =
            ultimaVenda
                ? ultimaVenda.numeroVenda + 1
                : 1;


        /* =====================================================
           CRIAR VENDA
        ===================================================== */

        const venda =
            await Sale.create({

                companyId,

                numeroVenda,

                clienteId:
                    cliente._id,

                clienteNome:
                    cliente.nome,

                clienteTelefone:
                    cliente.telefone || "",

                itens:
                    itensVenda,

                subtotal,

                desconto:
                    valorDesconto,

                total,

                formaPagamento:
                    formaPagamento ||
                    "Dinheiro",

                status:
                    "finalizada",

                usuarioId

            });


        /* =====================================================
           BAIXAR ESTOQUE
        ===================================================== */

        for (const item of itensVenda) {

            const produto =
                await Product.findOne({

                    _id:
                        item.productId,

                    companyId

                });


            if (!produto) {
                continue;
            }


            produto.quantidade =
                Number(produto.quantidade || 0)
                - item.quantidade;


            await produto.save();


            /* -----------------------------------------------
               REGISTRAR MOVIMENTAÇÃO
            ------------------------------------------------ */

            await StockMovement.create({

                companyId,

                productId:
                    produto._id,

                tipo:
                    "saida",

                quantidade:
                    item.quantidade,

                motivo:
                    `Venda #${numeroVenda}`,

                usuarioId

            });

        }


        /* =====================================================
           RESPOSTA
        ===================================================== */

        res.json({

            ok: true,

            venda

        });


    } catch (err) {

        console.error(err);

        res.status(500).json({

            error:
                "Erro ao registrar venda."

        });

    }

});


/* =========================================================
   CANCELAR VENDA
========================================================= */

router.post("/:id/cancelar", auth, async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;


        const venda =
            await Sale.findOne({

                _id:
                    req.params.id,

                companyId

            });


        if (!venda) {

            return res.status(404).json({

                error:
                    "Venda não encontrada."

            });

        }


        if (venda.status === "cancelada") {

            return res.status(400).json({

                error:
                    "Esta venda já está cancelada."

            });

        }


        /* =====================================================
           DEVOLVER ESTOQUE
        ===================================================== */

        for (const item of venda.itens) {

            const produto =
                await Product.findOne({

                    _id:
                        item.productId,

                    companyId

                });


            if (!produto) {
                continue;
            }


            produto.quantidade =
                Number(produto.quantidade || 0)
                + item.quantidade;


            await produto.save();


            await StockMovement.create({

                companyId,

                productId:
                    produto._id,

                tipo:
                    "entrada",

                quantidade:
                    item.quantidade,

                motivo:
                    `Cancelamento da venda #${venda.numeroVenda}`,

                usuarioId:
                    req.session.user._id

            });

        }


        venda.status =
            "cancelada";


        await venda.save();


        res.json({

            ok: true,

            venda

        });


    } catch (err) {

        console.error(err);

        res.status(500).json({

            error:
                "Erro ao cancelar venda."

        });

    }

});


module.exports = router;
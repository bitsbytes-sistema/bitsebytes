const express = require("express");
const router = express.Router();

const StockMovement = require("../models/StockMovement");
const Product = require("../models/Product");
const auth = require("../middleware/auth");

/* ===================== LISTAR MOVIMENTAÇÕES ===================== */

router.get("/", auth, async (req, res) => {

    try {

        const movimentacoes = await StockMovement.find({
            companyId: req.session.user.companyId
        })
        .populate("productId", "nome codigo")
        .sort({
            createdAt: -1
        });

        res.json(movimentacoes);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Erro ao listar movimentações."
        });

    }

});


/* ===================== ENTRADA ===================== */

router.post("/entrada", auth, async (req, res) => {

    try {

        const productId = req.body.productId;
        const quantidade = req.body.quantidade;
        const motivo = req.body.motivo;

        const qtd = Number(quantidade);

        if (!productId) {

            return res.status(400).json({
                error: "Produto não informado."
            });

        }

        if (!Number.isInteger(qtd) || qtd <= 0) {

            return res.status(400).json({
                error: "Quantidade inválida."
            });

        }

        const produto = await Product.findOne({
            _id: productId,
            companyId: req.session.user.companyId
        });

        if (!produto) {

            return res.status(404).json({
                error: "Produto não encontrado."
            });

        }

        produto.quantidade =
            Number(produto.quantidade || 0) + qtd;

        await produto.save();

        const movimentacao =
            await StockMovement.create({

                companyId:
                    req.session.user.companyId,

                productId:
                    produto._id,

                tipo:
                    "entrada",

                quantidade:
                    qtd,

                motivo:
                    motivo || "Entrada de estoque",

                usuarioId:
                    req.session.user._id

            });

        res.json({

            ok: true,

            produto,

            movimentacao

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Erro ao registrar entrada."
        });

    }

});


/* ===================== SAÍDA ===================== */

router.post("/saida", auth, async (req, res) => {

    try {

        const productId = req.body.productId;
        const quantidade = req.body.quantidade;
        const motivo = req.body.motivo;

        const qtd = Number(quantidade);

        if (!productId) {

            return res.status(400).json({
                error: "Produto não informado."
            });

        }

        if (!Number.isInteger(qtd) || qtd <= 0) {

            return res.status(400).json({
                error: "Quantidade inválida."
            });

        }

        const produto = await Product.findOne({

            _id: productId,

            companyId: req.session.user.companyId

        });

        if (!produto) {

            return res.status(404).json({
                error: "Produto não encontrado."
            });

        }

        const estoqueAtual =
            Number(produto.quantidade || 0);

        if (qtd > estoqueAtual) {

            return res.status(400).json({

                error:
                    "Estoque insuficiente. Estoque atual: " +
                    estoqueAtual +
                    "."

            });

        }

        produto.quantidade =
            estoqueAtual - qtd;

        await produto.save();

        const movimentacao =
            await StockMovement.create({

                companyId:
                    req.session.user.companyId,

                productId:
                    produto._id,

                tipo:
                    "saida",

                quantidade:
                    qtd,

                motivo:
                    motivo || "Saída de estoque",

                usuarioId:
                    req.session.user._id

            });

        res.json({

            ok: true,

            produto,

            movimentacao

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Erro ao registrar saída."
        });

    }

});


module.exports = router;
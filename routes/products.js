const express = require("express");
const router = express.Router();

async function requirePermissaoEstoque(req, res, next) {
    try {
        const userId = req.session?.user?._id;

        if (!userId) {
            return res.status(401).json({ error: "not_logged" });
        }

        const User = require("../models/User");
        const user = await User.findById(userId);

        if (!user) {
            return res.status(401).json({ error: "user_not_found" });
        }

        if (user.role === "master") {
            return next();
        }

        if (user.permissoes && user.permissoes.estoque === false) {
            return res.status(403).json({
                error: "permission_denied",
                modulo: "estoque"
            });
        }

        next();
    } catch (err) {
        console.error("ERRO AO VERIFICAR PERMISSAO DE ESTOQUE:", err);

        return res.status(500).json({
            error: "permission_check_error"
        });
    }
}

const Product = require("../models/Product");
const auth = require("../middleware/auth");

/* ===================== LISTAR ===================== */

router.get("/", auth, async (req, res) => {

    try {

        const produtos = await Product.find({
    companyId: req.session.user.companyId
}).sort({
    codigo: 1
});

        res.json(produtos);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Erro ao listar produtos."
        });

    }

});

/* ===================== BUSCAR ===================== */

router.get("/:id", auth, requirePermissaoEstoque, async (req, res) => {

    try {

        const produto = await Product.findOne({
            _id: req.params.id,
            companyId: req.session.user.companyId
        });

        if (!produto) {

            return res.status(404).json({
                error: "Produto não encontrado."
            });

        }

        res.json(produto);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Erro ao buscar produto."
        });

    }

});

/* ===================== CRIAR ===================== */

router.post("/", auth, requirePermissaoEstoque, async (req, res) => {

    try {

        const produto = await Product.create({

            companyId: req.session.user.companyId,

            codigo: req.body.codigo || "",

            nome: req.body.nome,

            descricao: req.body.descricao || "",

            categoria: req.body.categoria || "",

            fornecedor: req.body.fornecedor || "",

	    marca: req.body.marca || "",

	    observacoes: req.body.observacoes || "",

	    quantidade: Number(req.body.quantidade || 0),

            estoqueMinimo: Number(req.body.estoqueMinimo || 0),

            custo: Number(req.body.custo || 0),

            venda: Number(req.body.venda || 0),

            localizacao: req.body.localizacao || ""

        });

        res.json({
            ok: true,
            produto
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Erro ao cadastrar produto."
        });

    }

});

/* ===================== EDITAR ===================== */

router.put("/:id", auth, requirePermissaoEstoque, async (req, res) => {

    try {

        const produto = await Product.findOneAndUpdate(

            {
                _id: req.params.id,
                companyId: req.session.user.companyId
            },

            {
                codigo: req.body.codigo,
                nome: req.body.nome,
                descricao: req.body.descricao,
                categoria: req.body.categoria,
                fornecedor: req.body.fornecedor,
                marca: req.body.marca,
                observacoes: req.body.observacoes,
                quantidade: Number(req.body.quantidade),
                estoqueMinimo: Number(req.body.estoqueMinimo),
                custo: Number(req.body.custo),
                venda: Number(req.body.venda),
                localizacao: req.body.localizacao
            },

            {
                new: true
            }

        );

        res.json({
            ok: true,
            produto
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Erro ao atualizar produto."
        });

    }

});

/* ===================== EXCLUIR ===================== */

router.delete("/:id", auth, requirePermissaoEstoque, async (req, res) => {

    try {

        await Product.deleteOne({

            _id: req.params.id,
            companyId: req.session.user.companyId

        });

        res.json({
            ok: true
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Erro ao excluir produto."
        });

    }

});

module.exports = router;
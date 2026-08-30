const express = require("express");
const router = express.Router();

const MovimentoFinanceiro = require("../models/MovimentoFinanceiro");
const Sale = require("../models/Sale");
const Budget = require("../models/Budget");

const auth = require("../middleware/auth");


/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function numero(valor) {

    const n = Number(valor || 0);

    return Number.isFinite(n)
        ? n
        : 0;

}


function dataValida(valor) {

    if (!valor) {
        return null;
    }

    const data = new Date(valor);

    return Number.isNaN(data.getTime())
        ? null
        : data;

}


/* =========================================================
   RESUMO FINANCEIRO
========================================================= */

router.get("/resumo", auth, async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;

        const {
            inicio,
            fim
        } = req.query;


        const filtroManual = {
            companyId
        };


        const filtroVenda = {
            companyId,
            status: "finalizada"
        };


        const filtroBudget = {
            companyId,
            pagamento: "pago"
        };


        const dataInicio =
            dataValida(inicio);

        const dataFim =
            dataValida(fim);


        if (dataInicio || dataFim) {

            filtroManual.dataCompetencia = {};
            filtroVenda.createdAt = {};
            filtroBudget.dataPagamento = {};

            if (dataInicio) {

                dataInicio.setHours(
                    0,
                    0,
                    0,
                    0
                );

                filtroManual.dataCompetencia.$gte =
                    dataInicio;

                filtroVenda.createdAt.$gte =
                    dataInicio;

                filtroBudget.dataPagamento.$gte =
                    dataInicio;

            }


            if (dataFim) {

                dataFim.setHours(
                    23,
                    59,
                    59,
                    999
                );

                filtroManual.dataCompetencia.$lte =
                    dataFim;

                filtroVenda.createdAt.$lte =
                    dataFim;

                filtroBudget.dataPagamento.$lte =
                    dataFim;

            }

        }


        const [
            movimentos,
            vendas,
            budgets
        ] = await Promise.all([

            MovimentoFinanceiro
                .find(filtroManual)
                .sort({
                    dataCompetencia: -1,
                    createdAt: -1
                })
                .lean(),

            Sale
                .find(filtroVenda)
                .sort({
                    createdAt: -1
                })
                .lean(),

            Budget
                .find(filtroBudget)
                .sort({
                    dataPagamento: -1
                })
                .lean()

        ]);


        const movimentacoes = [];


        /* =====================================================
           LANÇAMENTOS MANUAIS
        ===================================================== */

        for (const movimento of movimentos) {

            movimentacoes.push({

                id:
                    movimento._id,

                origem:
                    "manual",

                tipo:
                    movimento.tipo,

                descricao:
                    movimento.descricao,

                categoria:
                    movimento.categoria || "",

                valor:
                    numero(movimento.valor),

                status:
                    movimento.status,

                formaPagamento:
                    movimento.formaPagamento || "",

                data:
                    movimento.dataCompetencia ||
                    movimento.createdAt,

                dataVencimento:
                    movimento.dataVencimento,

                dataPagamento:
                    movimento.dataPagamento,

                observacoes:
                    movimento.observacoes || "",

                usuarioNome:
                    movimento.usuarioNome || ""

            });

        }


        /* =====================================================
           VENDAS FINALIZADAS
        ===================================================== */

        for (const venda of vendas) {

            movimentacoes.push({

                id:
                    venda._id,

                origem:
                    "venda",

                tipo:
                    "entrada",

                descricao:
                    `Venda #${venda.numeroVenda}`,

                categoria:
                    "Vendas",

                valor:
                    numero(venda.total),

                status:
                    "pago",

                formaPagamento:
                    venda.formaPagamento || "",

                data:
                    venda.createdAt,

                dataVencimento:
                    null,

                dataPagamento:
                    venda.createdAt,

                observacoes:
                    venda.clienteNome
                        ? `Cliente: ${venda.clienteNome}`
                        : "",

                usuarioNome:
                    ""

            });

        }


        /* =====================================================
           ORÇAMENTOS PAGOS
        ===================================================== */

        for (const budget of budgets) {

            movimentacoes.push({

                id:
                    budget._id,

                origem:
                    "orcamento",

                tipo:
                    "entrada",

                descricao:
                    budget.codigo
                        ? `Orçamento ${budget.codigo}`
                        : `Orçamento #${budget.numero}`,

                categoria:
                    "Orçamentos",

                valor:
                    numero(budget.total),

                status:
                    "pago",

                formaPagamento:
                    "",

                data:
                    budget.dataPagamento ||
                    budget.updatedAt ||
                    budget.createdAt,

                dataVencimento:
                    null,

                dataPagamento:
                    budget.dataPagamento,

                observacoes:
                    budget.cliente
                        ? `Cliente: ${budget.cliente}`
                        : "",

                usuarioNome:
                    budget.usuarioPagamento || ""

            });

        }


        /* =====================================================
           ORDENAR MOVIMENTAÇÕES
        ===================================================== */

        movimentacoes.sort((a, b) => {

            return (
                new Date(b.data || 0) -
                new Date(a.data || 0)
            );

        });


        /* =====================================================
           TOTAIS
        ===================================================== */

        let entradas = 0;
        let saidas = 0;
        let pendenteReceber = 0;
        let pendentePagar = 0;


        for (const movimento of movimentacoes) {

            const valor =
                numero(movimento.valor);


            if (movimento.status === "cancelado") {
                continue;
            }


            if (movimento.status === "pendente") {

                if (movimento.tipo === "entrada") {
                    pendenteReceber += valor;
                }

                if (movimento.tipo === "saida") {
                    pendentePagar += valor;
                }

                continue;

            }


            if (movimento.tipo === "entrada") {
                entradas += valor;
            }


            if (movimento.tipo === "saida") {
                saidas += valor;
            }

        }


        res.json({

            resumo: {

                entradas:
                    Number(entradas.toFixed(2)),

                saidas:
                    Number(saidas.toFixed(2)),

                saldo:
                    Number(
                        (entradas - saidas)
                            .toFixed(2)
                    ),

                pendenteReceber:
                    Number(
                        pendenteReceber
                            .toFixed(2)
                    ),

                pendentePagar:
                    Number(
                        pendentePagar
                            .toFixed(2)
                    )

            },

            movimentacoes

        });


    } catch (err) {

        console.error(
            "Erro no resumo financeiro:",
            err
        );

        res.status(500).json({
            error:
                "Erro ao carregar financeiro."
        });

    }

});


/* =========================================================
   CRIAR LANÇAMENTO MANUAL
========================================================= */

router.post("/", auth, async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;

        const usuarioId =
            req.session.user._id;


        const {
            tipo,
            descricao,
            categoria,
            valor,
            status,
            formaPagamento,
            dataCompetencia,
            dataVencimento,
            dataPagamento,
            observacoes
        } = req.body;


        if (
            tipo !== "entrada" &&
            tipo !== "saida"
        ) {

            return res.status(400).json({
                error:
                    "Tipo de lançamento inválido."
            });

        }


        if (
            !descricao ||
            !String(descricao).trim()
        ) {

            return res.status(400).json({
                error:
                    "Informe a descrição."
            });

        }


        const valorNumero =
            Number(valor);


        if (
            !Number.isFinite(valorNumero) ||
            valorNumero <= 0
        ) {

            return res.status(400).json({
                error:
                    "Informe um valor válido."
            });

        }


        const statusPermitidos = [
            "pendente",
            "pago",
            "cancelado"
        ];


        const statusFinal =
            statusPermitidos.includes(status)
                ? status
                : "pago";


        let pagamentoFinal =
            dataValida(dataPagamento);


        if (
            statusFinal === "pago" &&
            !pagamentoFinal
        ) {

            pagamentoFinal =
                new Date();

        }


        if (statusFinal !== "pago") {

            pagamentoFinal =
                null;

        }


        const movimento =
            await MovimentoFinanceiro.create({

                companyId,

                tipo,

                descricao:
                    String(descricao).trim(),

                categoria:
                    categoria
                        ? String(categoria).trim()
                        : "",

                valor:
                    valorNumero,

                status:
                    statusFinal,

                formaPagamento:
                    formaPagamento
                        ? String(formaPagamento).trim()
                        : "",

                dataCompetencia:
                    dataValida(dataCompetencia) ||
                    new Date(),

                dataVencimento:
                    dataValida(dataVencimento),

                dataPagamento:
                    pagamentoFinal,

                observacoes:
                    observacoes
                        ? String(observacoes).trim()
                        : "",

                usuarioId,

                usuarioNome:
                    req.session.user.username || ""

            });


        res.json({

            ok: true,

            movimento

        });


    } catch (err) {

        console.error(
            "Erro ao criar lançamento financeiro:",
            err
        );

        res.status(500).json({
            error:
                "Erro ao criar lançamento financeiro."
        });

    }

});


/* =========================================================
   ALTERAR LANÇAMENTO MANUAL
========================================================= */

router.put("/:id", auth, async (req, res) => {

    try {

        const companyId =
            req.session.user.companyId;


        const movimento =
            await MovimentoFinanceiro.findOne({

                _id:
                    req.params.id,

                companyId

            });


        if (!movimento) {

            return res.status(404).json({
                error:
                    "Lançamento não encontrado."
            });

        }


        const {
            tipo,
            descricao,
            categoria,
            valor,
            status,
            formaPagamento,
            dataCompetencia,
            dataVencimento,
            dataPagamento,
            observacoes
        } = req.body;


        if (tipo !== undefined) {

            if (
                tipo !== "entrada" &&
                tipo !== "saida"
            ) {

                return res.status(400).json({
                    error:
                        "Tipo de lançamento inválido."
                });

            }

            movimento.tipo =
                tipo;

        }


        if (descricao !== undefined) {

            if (!String(descricao).trim()) {

                return res.status(400).json({
                    error:
                        "Informe a descrição."
                });

            }

            movimento.descricao =
                String(descricao).trim();

        }


        if (categoria !== undefined) {

            movimento.categoria =
                String(categoria || "").trim();

        }


        if (valor !== undefined) {

            const valorNumero =
                Number(valor);


            if (
                !Number.isFinite(valorNumero) ||
                valorNumero <= 0
            ) {

                return res.status(400).json({
                    error:
                        "Informe um valor válido."
                });

            }

            movimento.valor =
                valorNumero;

        }


        if (formaPagamento !== undefined) {

            movimento.formaPagamento =
                String(
                    formaPagamento || ""
                ).trim();

        }


        if (dataCompetencia !== undefined) {

            const data =
                dataValida(dataCompetencia);


            if (!data) {

                return res.status(400).json({
                    error:
                        "Data de competência inválida."
                });

            }

            movimento.dataCompetencia =
                data;

        }


        if (dataVencimento !== undefined) {

            movimento.dataVencimento =
                dataVencimento
                    ? dataValida(dataVencimento)
                    : null;

        }


        if (observacoes !== undefined) {

            movimento.observacoes =
                String(
                    observacoes || ""
                ).trim();

        }


        if (status !== undefined) {

            const statusPermitidos = [
                "pendente",
                "pago",
                "cancelado"
            ];


            if (
                !statusPermitidos.includes(status)
            ) {

                return res.status(400).json({
                    error:
                        "Status inválido."
                });

            }


            movimento.status =
                status;


            if (status === "pago") {

                movimento.dataPagamento =
                    dataValida(dataPagamento) ||
                    movimento.dataPagamento ||
                    new Date();

            } else {

                movimento.dataPagamento =
                    null;

            }

        } else if (
            dataPagamento !== undefined &&
            movimento.status === "pago"
        ) {

            movimento.dataPagamento =
                dataValida(dataPagamento) ||
                movimento.dataPagamento;

        }


        await movimento.save();


        res.json({

            ok: true,

            movimento

        });


    } catch (err) {

        console.error(
            "Erro ao alterar lançamento financeiro:",
            err
        );

        res.status(500).json({
            error:
                "Erro ao alterar lançamento financeiro."
        });

    }

});


/* =========================================================
   EXCLUIR LANÇAMENTO MANUAL
========================================================= */

router.delete("/:id", auth, async (req, res) => {

    try {

        const movimento =
            await MovimentoFinanceiro.findOneAndDelete({

                _id:
                    req.params.id,

                companyId:
                    req.session.user.companyId

            });


        if (!movimento) {

            return res.status(404).json({
                error:
                    "Lançamento não encontrado."
            });

        }


        res.json({
            ok: true
        });


    } catch (err) {

        console.error(
            "Erro ao excluir lançamento financeiro:",
            err
        );

        res.status(500).json({
            error:
                "Erro ao excluir lançamento financeiro."
        });

    }

});


module.exports = router;
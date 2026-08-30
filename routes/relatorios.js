const express = require("express");
const router = express.Router();

const Sale = require("../models/Sale");
const Budget = require("../models/Budget");
const Ticket = require("../models/Ticket");
const MovimentoFinanceiro = require("../models/MovimentoFinanceiro");

const auth = require("../middleware/auth");


function numero(valor) {

    const n = Number(valor);

    return Number.isFinite(n)
        ? n
        : 0;
}


function inicioDoDia(valor) {

    if (!valor) {
        return null;
    }

    const data = new Date(`${valor}T00:00:00`);

    return Number.isNaN(data.getTime())
        ? null
        : data;
}


function fimDoDia(valor) {

    if (!valor) {
        return null;
    }

    const data = new Date(`${valor}T23:59:59.999`);

    return Number.isNaN(data.getTime())
        ? null
        : data;
}


function filtroPeriodo(campo, inicio, fim) {

    const filtro = {};

    if (inicio || fim) {

        filtro[campo] = {};

        if (inicio) {
            filtro[campo].$gte = inicio;
        }

        if (fim) {
            filtro[campo].$lte = fim;
        }
    }

    return filtro;
}


router.get(
    "/resumo",
    auth,
    async (req, res) => {

        try {

            const companyId =
                req.session.user.companyId;

            const inicio =
                inicioDoDia(req.query.inicio);

            const fim =
                fimDoDia(req.query.fim);


            const filtroVendas = {
                companyId,
                status: "finalizada",
                ...filtroPeriodo(
                    "createdAt",
                    inicio,
                    fim
                )
            };


            const filtroOrcamentos = {
                companyId,
                ...filtroPeriodo(
                    "createdAt",
                    inicio,
                    fim
                )
            };


            const filtroOrcamentosPagos = {
                companyId,
                pagamento: "pago",
                ...filtroPeriodo(
                    "dataPagamento",
                    inicio,
                    fim
                )
            };


            const filtroChamados = {
                companyId,
                ...filtroPeriodo(
                    "createdAt",
                    inicio,
                    fim
                )
            };


            const filtroFinanceiro = {
                companyId,
                ...filtroPeriodo(
                    "dataCompetencia",
                    inicio,
                    fim
                )
            };


            const [
                vendas,
                orcamentos,
                orcamentosPagos,
                chamados,
                movimentos
            ] = await Promise.all([

                Sale.find(filtroVendas).lean(),

                Budget.find(filtroOrcamentos).lean(),

                Budget.find(filtroOrcamentosPagos).lean(),

                Ticket.find(filtroChamados).lean(),

                MovimentoFinanceiro
                    .find(filtroFinanceiro)
                    .lean()

            ]);


            const totalVendas =
                vendas.reduce(
                    (soma, venda) =>
                        soma + numero(venda.total),
                    0
                );


            const totalOrcamentosPagos =
                orcamentosPagos.reduce(
                    (soma, orcamento) =>
                        soma + numero(orcamento.total),
                    0
                );


            let entradasManuais = 0;
            let saidasManuais = 0;
            let pendenteReceber = 0;
            let pendentePagar = 0;


            movimentos.forEach(
                movimento => {

                    const valor =
                        numero(movimento.valor);

                    if (
                        movimento.status ===
                        "cancelado"
                    ) {
                        return;
                    }

                    if (
                        movimento.status ===
                        "pendente"
                    ) {

                        if (
                            movimento.tipo ===
                            "entrada"
                        ) {
                            pendenteReceber += valor;
                        }

                        if (
                            movimento.tipo ===
                            "saida"
                        ) {
                            pendentePagar += valor;
                        }

                        return;
                    }

                    if (
                        movimento.status ===
                        "pago"
                    ) {

                        if (
                            movimento.tipo ===
                            "entrada"
                        ) {
                            entradasManuais += valor;
                        }

                        if (
                            movimento.tipo ===
                            "saida"
                        ) {
                            saidasManuais += valor;
                        }
                    }

                }
            );


            const faturamento =
                totalVendas +
                totalOrcamentosPagos +
                entradasManuais;


            const despesas =
                saidasManuais;


            const resultado =
                faturamento - despesas;


            const resumoVendas = {

                quantidade:
                    vendas.length,

                total:
                    totalVendas,

                ticketMedio:
                    vendas.length
                        ? totalVendas /
                            vendas.length
                        : 0

            };


            const resumoOrcamentos = {

                quantidade:
                    orcamentos.length,

                pendentes:
                    0,

                aprovados:
                    0,

                reprovados:
                    0,

                convertidos:
                    0,

                pagos:
                    orcamentosPagos.length,

                totalPago:
                    totalOrcamentosPagos

            };


            orcamentos.forEach(
                orcamento => {

                    if (
                        orcamento.status ===
                        "pendente"
                    ) {
                        resumoOrcamentos.pendentes++;
                    }

                    if (
                        orcamento.status ===
                        "aprovado"
                    ) {
                        resumoOrcamentos.aprovados++;
                    }

                    if (
                        orcamento.status ===
                        "reprovado"
                    ) {
                        resumoOrcamentos.reprovados++;
                    }

                    if (
                        orcamento.status ===
                        "convertido"
                    ) {
                        resumoOrcamentos.convertidos++;
                    }

                }
            );


            const resumoChamados = {

                quantidade:
                    chamados.length,

                aberto:
                    0,

                andamento:
                    0,

                reparo:
                    0,

                finalizado:
                    0

            };


            chamados.forEach(
                chamado => {

                    if (
                        Object.prototype.hasOwnProperty.call(
                            resumoChamados,
                            chamado.status
                        )
                    ) {
                        resumoChamados[
                            chamado.status
                        ]++;
                    }

                }
            );


            const formasPagamento = {};


            vendas.forEach(
                venda => {

                    const forma =
                        venda.formaPagamento ||
                        "Não informado";

                    if (!formasPagamento[forma]) {

                        formasPagamento[forma] = {
                            quantidade: 0,
                            total: 0
                        };

                    }

                    formasPagamento[
                        forma
                    ].quantidade++;

                    formasPagamento[
                        forma
                    ].total +=
                        numero(venda.total);

                }
            );


            movimentos.forEach(
                movimento => {

                    if (
                        movimento.status !==
                        "pago"
                    ) {
                        return;
                    }

                    if (
                        movimento.tipo !==
                        "entrada"
                    ) {
                        return;
                    }

                    const forma =
                        movimento.formaPagamento ||
                        "Não informado";

                    if (!formasPagamento[forma]) {

                        formasPagamento[forma] = {
                            quantidade: 0,
                            total: 0
                        };

                    }

                    formasPagamento[
                        forma
                    ].quantidade++;

                    formasPagamento[
                        forma
                    ].total +=
                        numero(movimento.valor);

                }
            );


            const formasPagamentoLista =
                Object.entries(
                    formasPagamento
                )
                .map(
                    ([forma, dados]) => ({
                        forma,
                        quantidade:
                            dados.quantidade,
                        total:
                            dados.total
                    })
                )
                .sort(
                    (a, b) =>
                        b.total - a.total
                );


            res.json({

                periodo: {
                    inicio:
                        req.query.inicio || null,
                    fim:
                        req.query.fim || null
                },

                financeiro: {

                    faturamento,
                    despesas,
                    resultado,

                    aReceber:
                        pendenteReceber,

                    aPagar:
                        pendentePagar,

                    vendas:
                        totalVendas,

                    orcamentosPagos:
                        totalOrcamentosPagos,

                    entradasManuais

                },

                vendas:
                    resumoVendas,

                orcamentos:
                    resumoOrcamentos,

                chamados:
                    resumoChamados,

                formasPagamento:
                    formasPagamentoLista

            });

        } catch (erro) {

            console.error(
                "Erro ao gerar relatório:",
                erro
            );

            res.status(500).json({
                erro:
                    "Erro ao gerar relatório."
            });

        }

    }
);


module.exports = router;
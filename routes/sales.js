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

            formaPagamento,

            parcelas,

            maquininha,

            tipoJuros,

            taxaPercentual

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


            const ultimoCliente =
                await Cliente.findOne({
                    companyId
                })
                .sort({
                    codigo: -1
                });


            const proximoCodigo =
                ultimoCliente
                    ? ultimoCliente.codigo + 1
                    : 1;


            cliente =
                await Cliente.create({

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


        if (
            !Number.isFinite(valorDesconto) ||
            valorDesconto < 0
        ) {

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
           PAGAMENTO / PARCELAMENTO / JUROS
        ===================================================== */

        let numeroParcelas = null;

        let nomeMaquininha = null;

        let jurosTipo = "sem_juros";

        let percentualTaxa = 0;

        let valorTaxa = 0;

        let valorFinalCartao = 0;

        let valorParcela = 0;


        /* =====================================================
           CARTÃO DE CRÉDITO
        ===================================================== */

        if (formaPagamento === "Cartão de Crédito") {

            /* =================================================
               PARCELAS
            ================================================= */

            numeroParcelas =
                Number(parcelas);


            if (
                !Number.isInteger(numeroParcelas) ||
                numeroParcelas < 1 ||
                numeroParcelas > 12
            ) {

                return res.status(400).json({

                    error:
                        "Para Cartão de Crédito, informe de 1 a 12 parcelas."

                });

            }


            /* =================================================
               MAQUININHA
            ================================================= */

            if (maquininha) {

                nomeMaquininha =
                    String(maquininha).trim();

            }


            /* =================================================
               TIPO DE JUROS
            ================================================= */

            jurosTipo =
                tipoJuros === "com_juros"
                    ? "com_juros"
                    : "sem_juros";


            /* =================================================
               TAXA
            ================================================= */

            percentualTaxa =
                Number(taxaPercentual || 0);


            if (
                !Number.isFinite(percentualTaxa) ||
                percentualTaxa < 0
            ) {

                return res.status(400).json({

                    error:
                        "Taxa de juros inválida."

                });

            }


            /* =================================================
               SEM JUROS
            ================================================= */

            if (jurosTipo === "sem_juros") {

                percentualTaxa = 0;

                valorTaxa = 0;

                valorFinalCartao = total;

                valorParcela =
                    total / numeroParcelas;

            }


            /* =================================================
               COM JUROS
            ================================================= */

            else {

                const percentualDecimal =
                    percentualTaxa / 100;


                if (percentualDecimal >= 1) {

                    return res.status(400).json({

                        error:
                            "A taxa de juros deve ser menor que 100%."

                    });

                }


                valorFinalCartao =
                    total /
                    (1 - percentualDecimal);


                valorTaxa =
                    valorFinalCartao -
                    total;


                valorParcela =
                    valorFinalCartao /
                    numeroParcelas;

            }


            /* =================================================
               ARREDONDAMENTO MONETÁRIO
            ================================================= */

            valorTaxa =
                Number(valorTaxa.toFixed(2));


            valorFinalCartao =
                Number(valorFinalCartao.toFixed(2));


            valorParcela =
                Number(valorParcela.toFixed(2));

        }


        /* =====================================================
           CARTÃO DE DÉBITO
        ===================================================== */

        else if (
            formaPagamento === "Cartão de Débito"
        ) {

            /*
             * Débito não possui parcelamento,
             * portanto trabalhamos sempre com 1x.
             */

            numeroParcelas = 1;


            /* =================================================
               MAQUININHA
            ================================================= */

            if (maquininha) {

                nomeMaquininha =
                    String(maquininha).trim();

            }


            /* =================================================
               DÉBITO UTILIZA A TAXA DA MAQUININHA
            ================================================= */

            jurosTipo =
                "com_juros";


            percentualTaxa =
                Number(taxaPercentual || 0);


            if (
                !Number.isFinite(percentualTaxa) ||
                percentualTaxa < 0
            ) {

                return res.status(400).json({

                    error:
                        "Taxa da maquininha inválida."

                });

            }


            /* =================================================
               CALCULAR TAXA DO DÉBITO
            ================================================= */

            const percentualDecimal =
                percentualTaxa / 100;


            if (percentualDecimal >= 1) {

                return res.status(400).json({

                    error:
                        "A taxa da maquininha deve ser menor que 100%."

                });

            }


            /*
             * A taxa é calculada "por dentro".
             *
             * Exemplo:
             *
             * Venda: R$ 104,00
             * Taxa: 0,89%
             *
             * Valor cobrado:
             *
             * 104 / (1 - 0,0089)
             *
             * Resultado aproximado:
             * R$ 104,93
             *
             * Taxa:
             * R$ 0,93
             *
             * Líquido recebido:
             * R$ 104,00
             */

            valorFinalCartao =
                total /
                (1 - percentualDecimal);


            valorTaxa =
                valorFinalCartao -
                total;


            /*
             * No débito é sempre uma única parcela.
             */

            valorParcela =
                valorFinalCartao;


            /* =================================================
               ARREDONDAMENTO MONETÁRIO
            ================================================= */

            valorTaxa =
                Number(valorTaxa.toFixed(2));


            valorFinalCartao =
                Number(valorFinalCartao.toFixed(2));


            valorParcela =
                Number(valorParcela.toFixed(2));

        }


        /* =====================================================
           OUTRAS FORMAS DE PAGAMENTO
        ===================================================== */

        else {

            numeroParcelas = null;

            nomeMaquininha = null;

            jurosTipo = "sem_juros";

            percentualTaxa = 0;

            valorTaxa = 0;

            valorFinalCartao = 0;

            valorParcela = 0;

        }


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

                parcelas:
                    numeroParcelas,

                maquininha:
                    nomeMaquininha,

                tipoJuros:
                    jurosTipo,

                taxaPercentual:
                    percentualTaxa,

                valorTaxa,

                valorFinalCartao,

                valorParcela,

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
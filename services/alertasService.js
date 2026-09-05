const Cliente = require("../models/Cliente");
const Ticket = require("../models/Ticket");
const Budget = require("../models/Budget");
const MovimentoFinanceiro = require("../models/MovimentoFinanceiro");
const Product = require("../models/Product");

module.exports = {

    async aniversariantes(companyId){

    const hoje = new Date();

    const dia = hoje.getDate();
    const mes = hoje.getMonth() + 1;


    const clientes = await Cliente.find({

        companyId,

        aniversario:{
            $ne:null
        }

    });


    const aniversariantes = clientes.filter(cliente=>{

        if(!cliente.aniversario){
            return false;
        }


        const data = new Date(cliente.aniversario);


        return (
            data.getUTCDate() === dia &&
            data.getUTCMonth() + 1 === mes
        );

    });


    return {

        tipo:"aniversariantes",

        titulo:"🎂 Alerta de Aniversariantes",

        cor:"blue",

        quantidade: aniversariantes.length,

        mensagem:

        aniversariantes.length

        ?

        `Hoje existem ${aniversariantes.length} aniversariante(s).`

        :

        "Hoje não existem aniversariantes.",


        dados: aniversariantes.map(c=>({

            nome:c.nome,

            telefone:c.telefone,

            aniversario:c.aniversario

        }))

    };

},

    async contasReceber(companyId){

        const contas = await MovimentoFinanceiro.find({

            companyId,

            tipo:"entrada",

            status:"pendente"

        }).sort({

            dataVencimento:1,

            createdAt:-1

        });


        return {

            tipo:"receber",

            titulo:"🟢 Contas a Receber",

            cor:"green",

            quantidade:contas.length,

            mensagem:

                contas.length

                ?

                `Existem ${contas.length} conta(s) pendente(s) a receber.`

                :

                "Não existem contas pendentes a receber.",


            dados: contas.map(c=>({

                descricao:c.descricao,

                categoria:c.categoria,

                valor:c.valor,

                dataVencimento:c.dataVencimento,

                observacoes:c.observacoes

            }))

        };

    },
    async contasPagar(companyId){

        const contas = await MovimentoFinanceiro.find({

            companyId,

            tipo:"saida",

            status:"pendente"

        }).sort({

            dataVencimento:1,

            createdAt:-1

        });


        return {

            tipo:"pagar",

            titulo:"🔴 Contas a Pagar",

            cor:"red",

            quantidade:contas.length,

            mensagem:

                contas.length

                ?

                `Existem ${contas.length} conta(s) pendente(s) a pagar.`

                :

                "Não existem contas pendentes a pagar.",


            dados: contas.map(c=>({

                descricao:c.descricao,

                categoria:c.categoria,

                valor:c.valor,

                dataVencimento:c.dataVencimento,

                observacoes:c.observacoes

            }))

        };

    },
    async chamados(companyId){

    const chamados = await Ticket.find({

        companyId,

        status:{
            $in:[
                "aberto",
                "andamento",
                "reparo"
            ]
        }

    }).sort({

        createdAt:-1

    });


    return {

        tipo:"chamados",

        titulo:"📋 Chamados",

        cor:"orange",

        quantidade:chamados.length,

        mensagem:

            chamados.length

            ?

            `Existem ${chamados.length} chamado(s) em andamento.`

            :

            "Não existem chamados em andamento.",


        dados: chamados.map(c=>({

            numeroOS:c.numeroOS,

            cliente:c.cliente,

            equipamento:c.equipamento,

            status:c.status,

            data:c.createdAt

        }))

    };

},

    async orcamentos(companyId){

        const orcamentos = await Budget.find({

            companyId,

            status:"pendente"

        }).sort({

            createdAt:1

        });


        return {

            tipo:"orcamentos",

            titulo:"💰 Orçamentos",

            cor:"yellow",

            quantidade:orcamentos.length,

            mensagem:

                orcamentos.length

                ?

                `Existem ${orcamentos.length} orçamento(s) pendente(s) aguardando retorno.`

                :

                "Não existem orçamentos pendentes.",


            dados: orcamentos.map(o=>{

                const validadeDias =
                    Number(o.validade || 10);

                const criadoEm =
                    o.createdAt
                        ? new Date(o.createdAt)
                        : null;

                let venceEm = null;

                if(criadoEm){

                    venceEm =
                        new Date(criadoEm);

                    venceEm.setDate(
                        venceEm.getDate() +
                        validadeDias
                    );

                }


                return {

                    numero:o.numero,

                    codigo:o.codigo,

                    cliente:o.cliente,

                    telefone:o.telefone,

                    total:o.total,

                    status:o.status,

                    validade:validadeDias,

                    criadoEm:o.createdAt,

                    venceEm,

                    observacoes:o.observacoes

                };

            })

        };

    },
    async estoque(companyId){

        const produtos = await Product.find({

            companyId,

            ativo:true

        }).sort({

            quantidade:1,

            nome:1

        });


        const produtosCriticos =
            produtos.filter(p=>{

                const quantidade =
                    Number(p.quantidade || 0);

                const minimo =
                    Number(p.estoqueMinimo || 0);

                return (
                    quantidade <= 0 ||
                    quantidade <= minimo
                );

            });


        return {

            tipo:"estoque",

            titulo:"📦 Estoque",

            cor:"purple",

            quantidade:
                produtosCriticos.length,

            mensagem:

                produtosCriticos.length

                ?

                `Existem ${produtosCriticos.length} produto(s) com estoque baixo ou zerado.`

                :

                "Não existem produtos com estoque baixo.",


            dados:
                produtosCriticos.map(p=>({

                    codigo:p.codigo,

                    nome:p.nome,

                    categoria:p.categoria,

                    quantidade:p.quantidade,

                    estoqueMinimo:p.estoqueMinimo,

                    localizacao:p.localizacao,

                    fornecedor:p.fornecedor,

                    marca:p.marca

                }))

        };

    }

};
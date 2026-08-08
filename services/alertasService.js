const Cliente = require("../models/Cliente");
const Ticket = require("../models/Ticket");
const Budget = require("../models/Budget");

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

        return {

            tipo:"receber",

            titulo:"🟢 Contas a Receber",

            cor:"green",

            quantidade:0,

            mensagem:"Ainda não implementado.",

            dados:[]

        };

    },

    async contasPagar(companyId){

        return {

            tipo:"pagar",

            titulo:"🔴 Contas a Pagar",

            cor:"red",

            quantidade:0,

            mensagem:"Ainda não implementado.",

            dados:[]

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

        return {

            tipo:"orcamentos",

            titulo:"💰 Orçamentos",

            cor:"yellow",

            quantidade:0,

            mensagem:"Ainda não implementado.",

            dados:[]

        };

    },

    async estoque(companyId){

        return {

            tipo:"estoque",

            titulo:"📦 Estoque",

            cor:"purple",

            quantidade:0,

            mensagem:"Ainda não implementado.",

            dados:[]

        };

    }

};
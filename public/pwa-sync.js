/* ===================== PWA SYNC ===================== */

(() => {

const CHANNEL_NAME = "bitsbytes-sync";

const TAB_ID = Date.now().toString(36) + Math.random().toString(36).slice(2);

const channel = new BroadcastChannel(CHANNEL_NAME);

window.BitsBytesSync = {

    isMain: false,

    ready: false,

    callbacks: {},

    currentPage: window.location.pathname,

    becomeMain(){

        this.isMain = true;

        localStorage.setItem("bb-main-tab", TAB_ID);

        console.log("PWA -> Janela Principal");

    },

    isMainWindow(){

        return localStorage.getItem("bb-main-tab") === TAB_ID;

    },

    send(type,data={}){

        channel.postMessage({

            type,

            data,

            sender:TAB_ID

        });

    },

    on(type,callback){

        this.callbacks[type]=callback;

    }

};


window.addEventListener("beforeunload",()=>{

    if(localStorage.getItem("bb-main-tab")===TAB_ID){

        localStorage.removeItem("bb-main-tab");

    }

});


setTimeout(()=>{

    if(!localStorage.getItem("bb-main-tab")){

        window.BitsBytesSync.becomeMain();

    }

},500);


channel.onmessage=(event)=>{

    const msg=event.data;

    if(!msg) return;

    if(msg.sender===TAB_ID) return;

    const fn=window.BitsBytesSync.callbacks[msg.type];

    if(fn){

        fn(msg.data);

    }

};

/* ===================== NAVEGAÇÃO GLOBAL ===================== */

window.BitsBytesSync.on("ABRIR_CHAMADO",(data)=>{

    console.log("Abrindo chamado:",data.ticketId);

    sessionStorage.setItem(
        "abrirChamadoId",
        data.ticketId
    );

    if(window.location.pathname!=="/chamados.html"){

        window.location.href="/chamados.html?id="+data.ticketId;

        return;

    }

    window.dispatchEvent(new CustomEvent("abrirChamado",{

        detail:data

    }));

});


})();
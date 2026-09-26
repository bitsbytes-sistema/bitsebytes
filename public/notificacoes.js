(function(){

  "use strict";

  const INTERVALO = 10000;
  const CHAVE_AVISADAS = "bitsbytes_notificacoes_avisadas";

  let audioLiberado = false;


  function obterAvisadas(){

    try{

      const dados =
        JSON.parse(
          sessionStorage.getItem(CHAVE_AVISADAS) || "[]"
        );

      return Array.isArray(dados) ? dados : [];

    }catch(err){

      return [];

    }

  }


  function registrarAvisada(id){

    const avisadas = obterAvisadas();

    if(!avisadas.includes(id)){
      avisadas.push(id);
    }

    sessionStorage.setItem(
      CHAVE_AVISADAS,
      JSON.stringify(avisadas.slice(-100))
    );

  }


  function jaFoiAvisada(id){

    return obterAvisadas().includes(id);

  }


  let audioContext = null;


  async function liberarAudio(){

    try{

      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if(!AudioContext){
        audioLiberado = true;
        return;
      }

      if(!audioContext){
        audioContext = new AudioContext();
      }

      if(audioContext.state === "suspended"){
        await audioContext.resume();
      }

      audioLiberado =
        audioContext.state === "running";

    }catch(err){

      console.warn(
        "Nao foi possivel liberar o audio:",
        err
      );

    }

  }


  async function tocarSom(){

    try{

      await liberarAudio();

      if(!audioContext || audioContext.state !== "running"){
        return;
      }

      const agora = audioContext.currentTime;

      const osc = audioContext.createOscillator();
      const ganho = audioContext.createGain();

      osc.connect(ganho);
      ganho.connect(audioContext.destination);

      osc.type = "sine";

      osc.frequency.setValueAtTime(
        880,
        agora
      );

      osc.frequency.setValueAtTime(
        1174,
        agora + 0.16
      );

      ganho.gain.setValueAtTime(
        0.18,
        agora
      );

      ganho.gain.exponentialRampToValueAtTime(
        0.001,
        agora + 0.5
      );

      osc.start(agora);
      osc.stop(agora + 0.5);

    }catch(err){

      console.warn(
        "Nao foi possivel tocar o som:",
        err
      );

    }

  }


  function mostrarAviso(notificacao){

    const anterior =
      document.getElementById(
        "bitsbytes-aviso-agendamento"
      );

    if(anterior){
      anterior.remove();
    }


    const aviso =
      document.createElement("div");

    aviso.id =
      "bitsbytes-aviso-agendamento";

    aviso.style.cssText = [
      "position:fixed",
      "top:20px",
      "right:20px",
      "width:min(380px,calc(100vw - 40px))",
      "background:#ffffff",
      "color:#111827",
      "border:1px solid #d1d5db",
      "border-left:5px solid #2563eb",
      "border-radius:10px",
      "box-shadow:0 12px 30px rgba(0,0,0,.22)",
      "padding:16px",
      "z-index:999999",
      "font-family:Arial,sans-serif"
    ].join(";");


    const titulo =
      document.createElement("div");

    titulo.style.cssText =
      "font-weight:700;font-size:16px;margin-bottom:8px;";

    titulo.textContent =
      notificacao.titulo;


    const mensagem =
      document.createElement("div");

    mensagem.style.cssText =
      "font-size:14px;line-height:1.45;margin-bottom:14px;";

    mensagem.textContent =
      notificacao.mensagem;


    const fechar =
      document.createElement("button");

    fechar.type = "button";

    fechar.textContent = "Fechar";

    fechar.style.cssText = [
      "border:0",
      "background:#2563eb",
      "color:white",
      "padding:8px 14px",
      "border-radius:6px",
      "cursor:pointer"
    ].join(";");

    fechar.addEventListener(
      "click",
      function(){
        aviso.remove();
      }
    );


    aviso.appendChild(titulo);
    aviso.appendChild(mensagem);
    aviso.appendChild(fechar);

    document.body.appendChild(aviso);

  }


  async function verificarNotificacoes(){

    try{

      const resposta =
        await fetch(
          "/api/notifications",
          {
            credentials:"include",
            cache:"no-store"
          }
        );


      if(!resposta.ok){
        return;
      }


      const lista =
        await resposta.json();


      const agendamentosNovos =
        lista.filter(n =>
          n.tipo === "agendamento" &&
          !n.lida &&
          !jaFoiAvisada(n._id)
        );


      if(!agendamentosNovos.length){
        return;
      }


      for(const notificacao of agendamentosNovos){

        registrarAvisada(notificacao._id);

        mostrarAviso(notificacao);

        if(audioLiberado){
          tocarSom();
        }

      }


    }catch(err){

      console.error(
        "Erro ao verificar notificacoes:",
        err
      );

    }

  }


  document.addEventListener(
    "click",
    liberarAudio,
    {
      once:true
    }
  );

  document.addEventListener(
    "keydown",
    liberarAudio,
    {
      once:true
    }
  );


  if(document.readyState === "loading"){

    document.addEventListener(
      "DOMContentLoaded",
      function(){

        verificarNotificacoes();

        setInterval(
          verificarNotificacoes,
          INTERVALO
        );

      }
    );

  }else{

    verificarNotificacoes();

    setInterval(
      verificarNotificacoes,
      INTERVALO
    );

  }

})();

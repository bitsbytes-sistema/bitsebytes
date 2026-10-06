(function () {

  const MODULOS_POR_PAGINA = {
    "dashboard.html": "dashboard",
    "clientes.html": "clientes",
    "chamados.html": "chamados",
    "diagnostico.html": "chamados",

    "orcamentos.html": "orcamentos",
    "orcamento.html": "orcamentos",
    "novo-orcamento.html": "orcamentos",

    "services.html": "servicos",

    "laudos.html": "laudos",
    "laudo.html": "laudos",

    "estoque.html": "estoque",
    "produto.html": "estoque",
    "novo-produto.html": "estoque",

    "vendas.html": "vendas",
    "venda.html": "vendas",

    "financeiro.html": "financeiro",
    "lembretes.html": "lembretes",
    "relatorios.html": "relatorios",
    "auditoria.html": "auditoria",
    "configuracoes.html": "configuracoes"
  };


  function obterModuloDoLink(link) {

    try {

      const href = link.getAttribute("href");

      if (!href || href === "#") {
        return null;
      }

      const url =
        new URL(
          href,
          window.location.origin
        );

      const arquivo =
        url.pathname
          .split("/")
          .pop()
          .toLowerCase();

      return MODULOS_POR_PAGINA[arquivo] || null;

    } catch (err) {

      return null;

    }

  }


  function aplicarPermissoes(permissoes, role) {

    const perfil =
      String(role || "").toLowerCase();

    const links =
      document.querySelectorAll("a[href]");

    links.forEach(link => {

      const modulo =
        obterModuloDoLink(link);

      if (!modulo) {
        return;
      }

      if (
        modulo === "auditoria" &&
        perfil !== "admin" &&
        perfil !== "master"
      ) {

        link.style.display = "none";
        return;

      }

      if (permissoes[modulo] === false) {

        link.style.display = "none";

      }

    });

  }


  async function carregarPermissoes() {

    try {

      const resposta =
        await fetch(
          "/me",
          {
            credentials: "include",
            cache: "no-store"
          }
        );

      if (!resposta.ok) {
        return;
      }

      const dados =
        await resposta.json();

      const permissoes =
        dados &&
        dados.user &&
        dados.user.permissoes;

      if (!permissoes) {
        return;
      }

      aplicarPermissoes(permissoes, dados.user.role);

    } catch (err) {

      console.error(
        "Erro ao carregar permissoes:",
        err
      );

    }

  }


  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      carregarPermissoes
    );

  } else {

    carregarPermissoes();

  }

})();


/* ===================== NOTIFICACOES GLOBAIS ===================== */

(function carregarNotificacoesGlobais(){

  if(document.querySelector('script[data-bitsbytes-notificacoes]')){
    return;
  }

  const script = document.createElement("script");

  script.src = "/notificacoes.js";
  script.defer = true;
  script.dataset.bitsbytesNotificacoes = "true";

  document.head.appendChild(script);

})();


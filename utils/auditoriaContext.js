const { AsyncLocalStorage } = require("async_hooks");

const auditoriaContext = new AsyncLocalStorage();

function iniciarContextoAuditoria(callback) {
  auditoriaContext.run(
    {
      auditoriaEspecificaRegistrada: false
    },
    callback
  );
}

function marcarAuditoriaEspecifica() {
  const contexto = auditoriaContext.getStore();

  if (contexto) {
    contexto.auditoriaEspecificaRegistrada = true;
  }
}

function possuiAuditoriaEspecifica() {
  const contexto = auditoriaContext.getStore();

  return Boolean(
    contexto &&
    contexto.auditoriaEspecificaRegistrada
  );
}

module.exports = {
  iniciarContextoAuditoria,
  marcarAuditoriaEspecifica,
  possuiAuditoriaEspecifica
};

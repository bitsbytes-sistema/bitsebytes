require("dotenv").config();

const {
    executarBackup
} = require("./services/backupService");

async function iniciar() {

    console.log("");
    console.log("========================================");
    console.log("BITS & BYTES - BACKUP CRON");
    console.log("========================================");
    console.log("");

    try {

        await executarBackup();

        console.log("");
        console.log("BACKUP CRON FINALIZADO COM SUCESSO.");
        console.log("");

        process.exit(0);

    } catch (erro) {

        console.error("");
        console.error("BACKUP CRON FALHOU.");
        console.error(erro);
        console.error("");

        process.exit(1);

    }

}

iniciar();
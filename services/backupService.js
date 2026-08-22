require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const {
    enviarArquivo
} = require("./googleDriveBackup");

const ROOT_DIR =
    path.join(__dirname, "..");

const BACKUP_DIR =
    path.join(ROOT_DIR, "backups");


/* =====================================================
   GARANTIR PASTA LOCAL
===================================================== */

function garantirPastaBackup() {

    if (!fs.existsSync(BACKUP_DIR)) {

        fs.mkdirSync(
            BACKUP_DIR,
            {
                recursive: true
            }
        );

    }

}


/* =====================================================
   GERAR NOME DO BACKUP
===================================================== */

function gerarNomeBackup() {

    const agora =
        new Date();

    const ano =
        agora.getFullYear();

    const mes =
        String(
            agora.getMonth() + 1
        ).padStart(2, "0");

    const dia =
        String(
            agora.getDate()
        ).padStart(2, "0");

    const hora =
        String(
            agora.getHours()
        ).padStart(2, "0");

    const minuto =
        String(
            agora.getMinutes()
        ).padStart(2, "0");

    const segundo =
        String(
            agora.getSeconds()
        ).padStart(2, "0");


    return (
        `bitsebytes-backup-` +
        `${ano}-${mes}-${dia}-` +
        `${hora}-${minuto}-${segundo}.gz`
    );

}


/* =====================================================
   EXECUTAR MONGODUMP
===================================================== */

function executarMongoDump(
    caminhoArquivo
) {

    return new Promise(
        (resolve, reject) => {

            if (!process.env.MONGO_URL) {

                return reject(
                    new Error(
                        "MONGO_URL não encontrada."
                    )
                );

            }


            console.log(
                "Iniciando mongodump..."
            );


            const processo =
                spawn(
                    process.env.MONGODUMP_PATH || "mongodump",
                    [
                        `--uri=${process.env.MONGO_URL}`,
                        `--archive=${caminhoArquivo}`,
                        "--gzip"
                    ],
                    {
                        stdio: "inherit"
                    }
                );


            processo.on(
                "error",
                erro => {

                    reject(erro);

                }
            );


            processo.on(
                "close",
                codigo => {

                    if (codigo === 0) {

                        resolve();

                    } else {

                        reject(
                            new Error(
                                `mongodump encerrou com código ${codigo}`
                            )
                        );

                    }

                }
            );

        }
    );

}


/* =====================================================
   BACKUP COMPLETO
===================================================== */

async function executarBackup() {

    let caminhoArquivo = null;


    try {

        garantirPastaBackup();


        const nomeArquivo =
            gerarNomeBackup();


        caminhoArquivo =
            path.join(
                BACKUP_DIR,
                nomeArquivo
            );


        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "BACKUP AUTOMÁTICO"
        );
        console.log(
            "========================================"
        );
        console.log(
            "Arquivo:",
            nomeArquivo
        );


        /* ---------------------------------------------
           1. MONGODUMP
        --------------------------------------------- */

        await executarMongoDump(
            caminhoArquivo
        );


        /* ---------------------------------------------
           2. CONFERIR ARQUIVO
        --------------------------------------------- */

        if (
            !fs.existsSync(
                caminhoArquivo
            )
        ) {

            throw new Error(
                "Arquivo de backup não foi criado."
            );

        }


        const estatisticas =
            fs.statSync(
                caminhoArquivo
            );


        if (
            estatisticas.size <= 0
        ) {

            throw new Error(
                "Arquivo de backup está vazio."
            );

        }


        console.log(
            "Backup local criado:",
            estatisticas.size,
            "bytes"
        );


        /* ---------------------------------------------
           3. GOOGLE DRIVE
        --------------------------------------------- */

        const resultado =
            await enviarArquivo(
                caminhoArquivo,
                nomeArquivo
            );


        console.log(
            "Backup enviado para o Google Drive."
        );

        console.log(
            "ID:",
            resultado.id
        );


        /* ---------------------------------------------
           4. APAGAR ARQUIVO LOCAL
        --------------------------------------------- */

        try {

            fs.unlinkSync(
                caminhoArquivo
            );

            console.log(
                "Backup local removido."
            );

        } catch (erro) {

            console.error(
                "Não foi possível remover o backup local:",
                erro
            );

        }


        console.log(
            "========================================"
        );

        console.log(
            "BACKUP CONCLUÍDO COM SUCESSO!"
        );

        console.log(
            "========================================"
        );


        return resultado;


    } catch (erro) {

        console.error("");

        console.error(
            "========================================"
        );

        console.error(
            "ERRO NO BACKUP AUTOMÁTICO"
        );

        console.error(
            "========================================"
        );

        console.error(
            erro
        );


        /* ---------------------------------------------
           REMOVER ARQUIVO INCOMPLETO
        --------------------------------------------- */

        if (
            caminhoArquivo &&
            fs.existsSync(caminhoArquivo)
        ) {

            try {

                fs.unlinkSync(
                    caminhoArquivo
                );

            } catch (erroRemocao) {

                console.error(
                    "Erro ao remover arquivo incompleto:",
                    erroRemocao
                );

            }

        }


        throw erro;

    }

}


/* =====================================================
   EXPORTAR
===================================================== */

module.exports = {

    executarBackup

};
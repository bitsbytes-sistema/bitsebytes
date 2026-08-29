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
   GERAR TIMESTAMP
===================================================== */

function gerarTimestamp() {

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
        `${ano}-${mes}-${dia}-` +
        `${hora}-${minuto}-${segundo}`
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


            const executavel =
                process.env.MONGODUMP_PATH ||
                (
                    process.platform === "win32"
                        ? "mongodump"
                        : path.join(
                            ROOT_DIR,
                            "mongodump"
                        )
                );


            const processo =
                spawn(
                    executavel,
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
                reject
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
   BACKUP DOS ARQUIVOS DO SISTEMA
===================================================== */

function executarBackupSistema(
    caminhoArquivo
) {

    return new Promise(
        (resolve, reject) => {

            console.log(
                "Compactando arquivos do sistema..."
            );


            const argumentos = [

                "-czf",
                caminhoArquivo,

                "--exclude=node_modules",
                "--exclude=.git",
                "--exclude=backups",

                "--exclude=.env",
                "--exclude=.env.*",

                "--exclude=google-token.json",
                "--exclude=google-token.json.*",

                "--exclude=client_secret_*.json",

                "--exclude=*.bak*",
                "--exclude=*.bak-*",

                "."

            ];


            const processo =
                spawn(
                    "tar",
                    argumentos,
                    {
                        cwd: ROOT_DIR,
                        stdio: "inherit"
                    }
                );


            processo.on(
                "error",
                reject
            );


            processo.on(
                "close",
                codigo => {

                    if (codigo === 0) {

                        resolve();

                    } else {

                        reject(
                            new Error(
                                `tar encerrou com código ${codigo}`
                            )
                        );

                    }

                }
            );

        }
    );

}


/* =====================================================
   CONFERIR ARQUIVO
===================================================== */

function conferirArquivo(
    caminhoArquivo,
    descricao
) {

    if (
        !fs.existsSync(
            caminhoArquivo
        )
    ) {

        throw new Error(
            `${descricao} não foi criado.`
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
            `${descricao} está vazio.`
        );

    }


    console.log(
        `${descricao} criado:`,
        estatisticas.size,
        "bytes"
    );


    return estatisticas;

}


/* =====================================================
   REMOVER ARQUIVO APÓS UPLOAD
===================================================== */

function removerArquivoLocal(
    caminhoArquivo,
    descricao
) {

    try {

        if (
            fs.existsSync(
                caminhoArquivo
            )
        ) {

            fs.unlinkSync(
                caminhoArquivo
            );

            console.log(
                `${descricao} local removido.`
            );

        }

    } catch (erro) {

        console.error(
            `Não foi possível remover ${descricao}:`,
            erro
        );

    }

}


/* =====================================================
   BACKUP COMPLETO
===================================================== */

async function executarBackup() {

    garantirPastaBackup();


    const timestamp =
        gerarTimestamp();


    const nomeBanco =
        `bitsebytes-banco-${timestamp}.gz`;


    const nomeSistema =
        `bitsebytes-sistema-${timestamp}.tar.gz`;


    const caminhoBanco =
        path.join(
            BACKUP_DIR,
            nomeBanco
        );


    const caminhoSistema =
        path.join(
            BACKUP_DIR,
            nomeSistema
        );


    try {

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "BACKUP COMPLETO - BITS & BYTES"
        );

        console.log(
            "========================================"
        );

        console.log(
            "Banco:",
            nomeBanco
        );

        console.log(
            "Sistema:",
            nomeSistema
        );


        /* =============================================
           1. BACKUP DO BANCO
        ============================================= */

        console.log("");
        console.log(
            "----- BACKUP DO BANCO DE DADOS -----"
        );


        await executarMongoDump(
            caminhoBanco
        );


        conferirArquivo(
            caminhoBanco,
            "Backup do banco"
        );


        /* =============================================
           2. BACKUP DO SISTEMA
        ============================================= */

        console.log("");
        console.log(
            "----- BACKUP DOS ARQUIVOS DO SISTEMA -----"
        );


        await executarBackupSistema(
            caminhoSistema
        );


        conferirArquivo(
            caminhoSistema,
            "Backup do sistema"
        );


        /* =============================================
           3. ENVIAR BANCO AO GOOGLE DRIVE
        ============================================= */

        console.log("");
        console.log(
            "----- ENVIO DO BANCO AO GOOGLE DRIVE -----"
        );


        const resultadoBanco =
            await enviarArquivo(
                caminhoBanco,
                nomeBanco
            );


        console.log(
            "Backup do banco enviado."
        );

        console.log(
            "ID:",
            resultadoBanco.id
        );


        removerArquivoLocal(
            caminhoBanco,
            "Backup do banco"
        );


        /* =============================================
           4. ENVIAR SISTEMA AO GOOGLE DRIVE
        ============================================= */

        console.log("");
        console.log(
            "----- ENVIO DO SISTEMA AO GOOGLE DRIVE -----"
        );


        const resultadoSistema =
            await enviarArquivo(
                caminhoSistema,
                nomeSistema
            );


        console.log(
            "Backup do sistema enviado."
        );

        console.log(
            "ID:",
            resultadoSistema.id
        );


        removerArquivoLocal(
            caminhoSistema,
            "Backup do sistema"
        );


        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "BACKUP COMPLETO CONCLUÍDO COM SUCESSO!"
        );

        console.log(
            "Banco de dados: OK"
        );

        console.log(
            "Arquivos do sistema: OK"
        );

        console.log(
            "========================================"
        );


        return {

            banco: resultadoBanco,

            sistema: resultadoSistema

        };


    } catch (erro) {

        console.error("");
        console.error(
            "========================================"
        );

        console.error(
            "ERRO NO BACKUP COMPLETO"
        );

        console.error(
            "========================================"
        );

        console.error(
            erro
        );


        /*
         * IMPORTANTE:
         *
         * Se o backup já tiver sido criado e ocorrer
         * falha no Google Drive, NÃO apagamos o arquivo.
         *
         * Assim uma cópia válida permanece disponível
         * localmente para recuperação.
         */


        if (
            fs.existsSync(
                caminhoBanco
            )
        ) {

            console.error(
                "Backup do banco preservado localmente:"
            );

            console.error(
                caminhoBanco
            );

        }


        if (
            fs.existsSync(
                caminhoSistema
            )
        ) {

            console.error(
                "Backup do sistema preservado localmente:"
            );

            console.error(
                caminhoSistema
            );

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


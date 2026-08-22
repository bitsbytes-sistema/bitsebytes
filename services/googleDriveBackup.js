require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const ROOT_DIR = path.join(__dirname, "..");

let client_id;
let client_secret;
let refresh_token;


/* =====================================================
   CONFIGURAÇÃO DO GOOGLE
===================================================== */

/*
   NO RENDER:
   Usa variáveis de ambiente.

   LOCALMENTE:
   Continua usando os arquivos existentes.
*/

if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
) {

    console.log(
        "Google Drive: usando credenciais do ambiente."
    );

    client_id =
        process.env.GOOGLE_CLIENT_ID;

    client_secret =
        process.env.GOOGLE_CLIENT_SECRET;

    refresh_token =
        process.env.GOOGLE_REFRESH_TOKEN;

} else {

    console.log(
        "Google Drive: usando credenciais locais."
    );


    const CREDENTIALS_FILE =
        fs.readdirSync(ROOT_DIR)
            .find(
                nome =>
                    nome.startsWith("client_secret_") &&
                    nome.endsWith(".json")
            );


    if (!CREDENTIALS_FILE) {

        throw new Error(
            "Credenciais do Google não encontradas."
        );

    }


    const credentials =
        JSON.parse(
            fs.readFileSync(
                path.join(
                    ROOT_DIR,
                    CREDENTIALS_FILE
                ),
                "utf8"
            )
        );


    if (
        !credentials.web ||
        !credentials.web.client_id ||
        !credentials.web.client_secret
    ) {

        throw new Error(
            "Formato inválido do arquivo de credenciais do Google."
        );

    }


    client_id =
        credentials.web.client_id;

    client_secret =
        credentials.web.client_secret;


    const TOKEN_FILE =
        path.join(
            ROOT_DIR,
            "google-token.json"
        );


    if (!fs.existsSync(TOKEN_FILE)) {

        throw new Error(
            "google-token.json não encontrado."
        );

    }


    const tokens =
        JSON.parse(
            fs.readFileSync(
                TOKEN_FILE,
                "utf8"
            )
        );


    if (!tokens.refresh_token) {

        throw new Error(
            "refresh_token não encontrado no google-token.json."
        );

    }


    refresh_token =
        tokens.refresh_token;

}


/* =====================================================
   CLIENTE OAUTH
===================================================== */

const auth =
    new google.auth.OAuth2(
        client_id,
        client_secret
    );


auth.setCredentials({
    refresh_token
});


/* =====================================================
   GOOGLE DRIVE
===================================================== */

const drive =
    google.drive({
        version: "v3",
        auth
    });


/* =====================================================
   LOCALIZAR OU CRIAR PASTA
===================================================== */

async function obterPastaBackup() {

    const nomePasta =
        "Bits e Bytes Backup";


    const resposta =
        await drive.files.list({

            q:
                `name = '${nomePasta}' ` +
                `and mimeType = 'application/vnd.google-apps.folder' ` +
                `and trashed = false`,

            fields:
                "files(id,name)",

            spaces:
                "drive",

            pageSize:
                10

        });


    if (
        resposta.data.files &&
        resposta.data.files.length > 0
    ) {

        return resposta.data.files[0].id;

    }


    const pasta =
        await drive.files.create({

            requestBody: {

                name:
                    nomePasta,

                mimeType:
                    "application/vnd.google-apps.folder"

            },

            fields:
                "id,name"

        });


    console.log(
        "Pasta de backup criada:",
        pasta.data.name
    );


    return pasta.data.id;

}


/* =====================================================
   ENVIAR ARQUIVO
===================================================== */

async function enviarArquivo(
    caminhoArquivo,
    nomeArquivo
) {

    if (
        !fs.existsSync(
            caminhoArquivo
        )
    ) {

        throw new Error(
            `Arquivo não encontrado: ${caminhoArquivo}`
        );

    }


    const pastaId =
        await obterPastaBackup();


    const arquivo =
        await drive.files.create({

            requestBody: {

                name:
                    nomeArquivo,

                parents:
                    [pastaId]

            },

            media: {

                body:
                    fs.createReadStream(
                        caminhoArquivo
                    )

            },

            fields:
                "id,name,size,webViewLink"

        });


    console.log(
        "Backup enviado para o Google Drive:",
        arquivo.data.name
    );


    return arquivo.data;

}


/* =====================================================
   EXPORTAR
===================================================== */

module.exports = {

    obterPastaBackup,

    enviarArquivo

};
/* ===================== ONESIGNAL INIT ===================== */

window.OneSignalDeferred = window.OneSignalDeferred || [];

OneSignalDeferred.push(async function (OneSignal) {

    try {

        await OneSignal.init({

            appId: "6711c89e-0dc5-48c3-b31a-b70f6c64902d",

            persistNotification: false,

            notificationClickHandlerMatch: "origin",

            notificationClickHandlerAction: "focus"

        });

        console.log("✅ OneSignal iniciado");

        const permissao =
            await OneSignal.Notifications.permission;

        const inscrito =
            await OneSignal.User.PushSubscription.optedIn;

        console.log("Permissão:", permissao);
        console.log("Inscrito:", inscrito);

        if (permissao && !inscrito) {

            console.log("🔄 Reativando inscrição...");

            await OneSignal.User.PushSubscription.optIn();

            console.log("✅ Inscrição reativada");

        }

        const subscriptionId =
    await OneSignal.User.PushSubscription.id;

console.log("Subscription ID:", subscriptionId);


/* ===================== TAGS USUÁRIO ===================== */

try {

    const resposta = await fetch("/me", {
    credentials: "include"
});

console.log("Status /me:", resposta.status);
console.log("URL:", resposta.url);

if (!resposta.ok) {
    console.log("Usuário não autenticado");
    return;
}

const dados = await resposta.json();
console.log("Resposta /me:", dados);

const user = dados.user;

if (user) {

    console.log("USUÁRIO RECEBIDO /me:", user);

    await OneSignal.login(String(user._id));

    console.log("✅ Login OneSignal realizado");


    console.log(
        "External ID:",
        await OneSignal.User.externalId
    );


    const tags = {

        companyId: String(user.companyId),
        userId: String(user._id),
        role: String(user.role),
        username: String(user.username)

    };


    await OneSignal.User.addTags(tags);


    console.log(
        "✅ TAGS ENVIADAS:",
        tags
    );

}

} catch(err){

    console.error(
        "Erro ao registrar Tags OneSignal:",
        err
    );

}

    } catch (erro) {

        console.error("Erro ao iniciar OneSignal:", erro);

    }

});

/* ===================== CLICK NA NOTIFICAÇÃO ===================== */

window.addEventListener("focus", () => {

    const params = new URLSearchParams(window.location.search);

    const ticketId = params.get("id");

    if (!ticketId) return;

    if (window.BitsBytesSync) {

        window.BitsBytesSync.send("ABRIR_CHAMADO", {
            ticketId
        });

    }

});
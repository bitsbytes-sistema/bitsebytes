"use strict";

const express = require("express");

function criarRotaLaudoPdf({
  Ticket,
  auth,
  requirePermissao,
  puppeteer,
  chromium,
  port
}) {
  const router = express.Router();

  router.get(
    "/api/tickets/:id/laudo/pdf",
    auth,
    requirePermissao("laudos"),
    async (req, res) => {
      let browser;

      try {
        const ticket = await Ticket.findOne({
          _id: req.params.id,
          companyId: req.session.user.companyId
        }).select("_id");

        if (!ticket) {
          return res.status(404).send("Laudo não encontrado");
        }

        const porta = Number(port);
        if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
          throw new Error("Porta interna inválida");
        }

        const origem = `http://127.0.0.1:${porta}`;
        const url = `${origem}/laudo-pdf.html?id=${encodeURIComponent(String(ticket._id))}`;

        browser = await puppeteer.launch(
          process.env.RENDER
            ? {
                executablePath: await chromium.executablePath(),
                args: chromium.args,
                headless: true
              }
            : { headless: true }
        );

        const page = await browser.newPage();

        page.on("dialog", async dialog => {
          await dialog.dismiss().catch(() => {});
        });

        const cookieSessao = (req.headers.cookie || "")
          .split(";")
          .map(parte => parte.trim())
          .find(parte => parte.startsWith("connect.sid="));

        if (!cookieSessao) {
          return res.status(401).send("Sessão não encontrada");
        }

        const valorSessao = cookieSessao.slice("connect.sid=".length);

        await page.setCookie({
          name: "connect.sid",
          value: valorSessao,
          url: origem,
          httpOnly: true,
          sameSite: "Lax"
        });

        await page.setRequestInterception(true);

        page.on("request", requisicao => {
          try {
            const destino = new URL(requisicao.url());

            if (
              destino.origin === origem ||
              destino.protocol === "data:"
            ) {
              return requisicao.continue();
            }

            return requisicao.abort();
          } catch {
            return requisicao.abort();
          }
        });

        await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: 30000
        });

        await page.waitForFunction(
          () => {
            const status =
              document.documentElement.dataset.laudoPdfStatus;

            return status === "pronto" || status === "erro";
          },
          { timeout: 30000 }
        );

        const status = await page.evaluate(
          () => document.documentElement.dataset.laudoPdfStatus
        );

        if (status !== "pronto") {
          throw new Error("O laudo não foi carregado corretamente");
        }

        await page.evaluate(async () => {
          await document.fonts.ready;

          await Promise.all(
            Array.from(document.images).map(imagem => {
              if (imagem.complete) return Promise.resolve();

              return new Promise(resolve => {
                imagem.addEventListener("load", resolve, { once: true });
                imagem.addEventListener("error", resolve, { once: true });
              });
            })
          );
        });

        const pdf = await page.pdf({
          format: "A4",
          preferCSSPageSize: true,
          printBackground: true,
          margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
          }
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader(
          "Content-Disposition",
          `inline; filename="Laudo-${ticket._id}.pdf"`
        );

        return res.send(Buffer.from(pdf));

      } catch (erro) {
        console.error("Erro ao gerar PDF do laudo:", erro);

        if (!res.headersSent) {
          return res.status(500).send(
            "Não foi possível gerar o PDF do laudo."
          );
        }
      } finally {
        if (browser) {
          await browser.close().catch(() => {});
        }
      }
    }
  );

  return router;
}

module.exports = criarRotaLaudoPdf;

/* Prepara a pasta "app" que vai dentro da aplicação de secretária: copia a
   página e os ícones, descarrega o three.js para funcionar sem internet, e
   aponta a página para essa cópia local. Em Node, para correr igual no
   Windows, no Mac e no Linux. Corre antes do electron-builder. */
"use strict";
const fs = require("fs"), path = require("path");
const {CDN_THREE, prepararPagina} = require("./pagina-desktop");
const raiz = path.join(__dirname, "..");
const app = path.join(__dirname, "app");

(async () => {
  fs.mkdirSync(path.join(app, "vendor"), {recursive: true});
  fs.mkdirSync(path.join(app, "icons"), {recursive: true});
  for (const f of fs.readdirSync(path.join(raiz, "icons")))
    fs.copyFileSync(path.join(raiz, "icons", f), path.join(app, "icons", f));
  fs.mkdirSync(path.join(__dirname, "build"), {recursive: true});
  fs.copyFileSync(path.join(raiz, "icons", "icon-512.png"), path.join(__dirname, "build", "icon.png"));

  /* O three.js vem de um CDN na versão web; na aplicação fica dentro do pacote. */
  const local = path.join(app, "vendor", "three.min.js");
  if (!fs.existsSync(local)) {
    console.log("A descarregar three.js r128…");
    const r = await fetch(CDN_THREE);
    if (!r.ok) throw new Error("three.js: o CDN respondeu " + r.status);
    fs.writeFileSync(local, Buffer.from(await r.arrayBuffer()));
  }
  const html = fs.readFileSync(path.join(raiz, "network-framework.html"), "utf8");
  fs.writeFileSync(path.join(app, "network-framework.html"), prepararPagina(html), "utf8");
  console.log("Pasta app preparada em " + app);
})().catch(e => { console.error(e.message || e); process.exit(1); });

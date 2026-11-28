/* Os ficheiros das atualizações.
     node gerar-atualizacao.js versao    → ../versao.json, que a versão web
                                           (e o telemóvel) consulta para saber
                                           se há versão nova
     node gerar-atualizacao.js release   → dist/atualizacao.json e
                                           dist/pagina.html, que vão para a
                                           Release e que a aplicação de
                                           secretária descarrega
   A versão vem do package.json; as novidades, da secção dessa versão em
   notas-da-versao.md; o nível da ponte (casca), de main.js. Corre depois de
   preparar-app.js (para "release"). */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const {versaoDaPagina} = require("./pagina-desktop");

const versao = require("./package.json").version;
function novidades(){
  const md = fs.readFileSync(path.join(__dirname, "notas-da-versao.md"), "utf8");
  const i = md.indexOf("### Versão " + versao);
  if (i < 0) throw new Error("notas-da-versao.md não tem a secção «### Versão " + versao + "»");
  const resto = md.slice(i).split("\n").slice(1);
  const fim = resto.findIndex(l => /^###? /.test(l));
  return (fim < 0 ? resto : resto.slice(0, fim))
    .filter(l => /^- /.test(l)).slice(0, 6)
    .map(l => l.replace(/^- /, "").replace(/\*\*/g, "").replace(/`/g, "").trim());
}

const modo = process.argv[2];
if (modo === "versao"){
  const f = path.join(__dirname, "..", "versao.json");
  fs.writeFileSync(f, JSON.stringify({versao, novidades: novidades()}, null, 2) + "\n", "utf8");
  console.log("versao.json: " + versao);
} else if (modo === "release"){
  const html = fs.readFileSync(path.join(__dirname, "app", "network-framework.html"));
  const v = versaoDaPagina(html.toString("utf8"));
  if (v !== versao) throw new Error("a página declara a versão " + v + " e o package.json " + versao);
  const m = /\bconst CASCA=(\d+);/.exec(fs.readFileSync(path.join(__dirname, "main.js"), "utf8"));
  if (!m) throw new Error("não encontrei const CASCA em main.js");
  const dist = path.join(__dirname, "dist");
  fs.mkdirSync(dist, {recursive: true});
  fs.writeFileSync(path.join(dist, "pagina.html"), html);
  const manifesto = {versao, casca: +m[1], sha256: crypto.createHash("sha256").update(html).digest("hex"),
    tamanho: html.length, novidades: novidades()};
  fs.writeFileSync(path.join(dist, "atualizacao.json"), JSON.stringify(manifesto, null, 2) + "\n", "utf8");
  console.log("atualizacao.json: " + versao + " (casca " + manifesto.casca + ", " + html.length + " bytes)");
} else {
  console.error("uso: node gerar-atualizacao.js versao|release");
  process.exit(2);
}

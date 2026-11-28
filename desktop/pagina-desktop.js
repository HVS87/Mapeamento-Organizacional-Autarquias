/* A página da versão web, posta à medida da aplicação de secretária: o
   three.js passa a vir da cópia local (vendor/three.min.js) e o service
   worker, que é da instalação como app no browser, sai. Usado ao preparar o
   pacote (preparar-app.js), ao gerar a atualização que vai na Release
   (gerar-atualizacao.js) e pela QA, para que as três saiam iguais. */
"use strict";
const CDN_THREE = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

function prepararPagina(html){
  const tag = '<script src="' + CDN_THREE + '" crossorigin="anonymous"></script>';
  if (!html.includes(tag)) throw new Error("Não encontrei o <script> do three.js para apontar à cópia local.");
  html = html.replace(tag, '<script src="vendor/three.min.js"></script>');
  html = html.replace(/navigator\.serviceWorker\.register\([^)]*\)/, "Promise.resolve()");
  return html;
}
/** A versão que a própria página declara (const VERSAO_APP="x.y.z"). */
function versaoDaPagina(html){
  const m = /\bconst VERSAO_APP\s*=\s*"(\d+\.\d+\.\d+)"/.exec(html);
  return m ? m[1] : null;
}
module.exports = {CDN_THREE, prepararPagina, versaoDaPagina};

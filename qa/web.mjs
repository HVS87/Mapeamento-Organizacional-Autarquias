// QA da versão web, num navegador sem janela (Edge ou Chromium):
//   1. as suites na página instrumentada (qa.html) e no .exe simulado
//      (qa-desktop.html), servidas pelo qa/servir.mjs
//   2. uma atualização a sério da app instalada: um site de faz-de-conta com
//      o service worker e a cache HTTP de dez minutos do GitHub Pages; muda
//      de versão a meio, e a app tem de chegar à nova pelas Definições sem
//      perder o projeto, as preferências nem a sincronização
//   uso: node qa/preparar.mjs && node qa/web.mjs [--rede]
//   (--rede: a suite da sincronização faz também uma troca real pelo ntfy.sh)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, "..");
const rede = process.argv.includes("--rede");
const PORTA_QA = 8754, PORTA_SITE = 8755, PORTA_CDP = 9227;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const suite = n => fs.readFileSync(path.join(aqui, "suites", n), "utf8");

const candidatos = [process.env.QA_BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/usr/bin/microsoft-edge", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
const browser = candidatos.find(p => fs.existsSync(p));
if (!browser) { console.error("Não encontrei um navegador. Indique o caminho do executável em QA_BROWSER."); process.exit(1); }

/* ---------- servidores ---------- */
const TIPOS = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png"};
function servir(pasta, porta, cache){
  return new Promise(res => {
    const s = http.createServer((req, resp) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const f = path.normalize(path.join(pasta, p));
      if (!f.startsWith(pasta)) { resp.writeHead(403); resp.end(); return; }
      fs.readFile(f, (err, buf) => {
        if (err) { resp.writeHead(404); resp.end(); return; }
        resp.writeHead(200, {"Content-Type": TIPOS[path.extname(f)] || "application/octet-stream", "Cache-Control": cache});
        resp.end(buf);
      });
    });
    s.on("error", () => res(null));   // a porta já está a servir (um servir.mjs aberto noutra consola)
    s.listen(porta, "127.0.0.1", () => res(s));
  });
}
const srvQA = await servir(raiz, PORTA_QA, "no-store");
/* o site de faz-de-conta: a raiz publicada, como o GitHub Pages a serve (max-age=600) */
const site = fs.mkdtempSync(path.join(os.tmpdir(), "fma-site-"));
const qaHtml = fs.readFileSync(path.join(aqui, "build", "qa.html"), "utf8");
function publicar(versao){
  const html = versao ? qaHtml.replace(/const VERSAO_APP="\d+\.\d+\.\d+";/, 'const VERSAO_APP="' + versao + '";') : qaHtml;
  if (versao && html === qaHtml) throw new Error("não consegui mudar a versão da página");
  fs.writeFileSync(path.join(site, "network-framework.html"), html);
  const vj = JSON.parse(fs.readFileSync(path.join(raiz, "versao.json"), "utf8"));
  if (versao) vj.versao = versao;
  fs.writeFileSync(path.join(site, "versao.json"), JSON.stringify(vj));
}
for (const f of ["index.html", "manifest.json", "sw.js"]) fs.copyFileSync(path.join(raiz, f), path.join(site, f));
fs.cpSync(path.join(raiz, "icons"), path.join(site, "icons"), {recursive: true});
publicar(null);
const srvSite = await servir(site, PORTA_SITE, "public, max-age=600");

/* ---------- navegador ---------- */
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "fma-web-"));
const proc = spawn(browser, ["--headless=new", "--remote-debugging-port=" + PORTA_CDP, "--user-data-dir=" + perfil, "--no-first-run",
  "--no-default-browser-check", "--mute-audio", "--disable-extensions", "--disable-sync", "--disable-component-extensions-with-background-pages",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--enable-gpu", "--ignore-gpu-blocklist", "--window-size=1440,900", "about:blank"], {stdio: "ignore"});
async function alvo(re){
  for (let k = 0; k < 80; k++){
    try { const l = await (await fetch("http://127.0.0.1:" + PORTA_CDP + "/json")).json(); const a = l.find(x => x.type === "page" && re.test(x.url)); if (a) return a; } catch(e){}
    await sleep(250);
  }
  throw new Error("separador não encontrado: " + re);
}
async function ligar(a){
  const ws = new WebSocket(a.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  const dialogos = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); }
    /* uma pergunta do browser (p. ex. «sair do site?») fica registada e é aceite, para o teste não parar */
    if (m.method === "Page.javascriptDialogOpening"){ dialogos.push(m.params.type + ": " + m.params.message); cmd("Page.handleJavaScriptDialog", {accept: true}); }
  };
  const cmd = (method, params) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params})); });
  return {
    cmd, dialogos,
    /** um clique de verdade (com gesto do utilizador), no centro do elemento */
    async clicar(seletorJs){
      const rr = await this.avaliar("(()=>{const e=" + seletorJs + ";if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
      if (!rr) return false;
      for (const type of ["mousePressed", "mouseReleased"]) await cmd("Input.dispatchMouseEvent", {type, x: rr.x, y: rr.y, button: "left", clickCount: 1});
      return true;
    },
    async avaliar(expr){
      const r = await cmd("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true});
      if (!r.result) throw new Error("CDP: " + JSON.stringify(r.error).slice(0, 300));
      if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
      return r.result.result.value;
    },
    fechar: () => ws.close(),
  };
}
const BOOT = "new Promise(r=>{const f=()=>window.__F&&window.__F.get('booted')?r(true):setTimeout(f,200);f();})";
async function abrir(c, url){
  await c.cmd("Page.navigate", {url});
  for (let k = 0; ; k++){
    try { await sleep(800); await c.avaliar(BOOT); await sleep(1500); await c.avaliar("window.__F.get('booted')"); return; }
    catch(e){ if (k > 30) throw e; }
  }
}

let falhou = false;
const relatar = (nome, r) => {
  const f = (r.falhas || []).length + (r.errs || []).length;
  if (f) falhou = true;
  console.log((f ? "✗ " : "✓ ") + nome + ": " + r.ok + " certas" + (r.falhas && r.falhas.length ? " · falhas: " + r.falhas.join(" | ") : "") + (r.errs && r.errs.length ? " · erros: " + r.errs.join(" | ") : ""));
};
try {
  const c = await ligar(await alvo(/about:blank/));
  await c.cmd("Page.enable", {});
  await c.cmd("Page.bringToFront", {});

  /* ---------- 1. suites ---------- */
  await abrir(c, "http://127.0.0.1:" + PORTA_QA + "/qa/build/qa.html");
  console.log("  web (qa.html)…");
  relatar("atualizações (web)", await c.avaliar(suite("qa-atualizar.js") + ";window.__QA_ATUALIZAR()"));
  relatar("aplicação (web)", await c.avaliar(suite("qa-app.js") + ";window.__QA_APP()"));
  relatar("sincronização (web" + (rede ? ", com ntfy.sh real" : "") + ")", await c.avaliar(suite("qa-sinc.js") + ";window.__QA_SINC({rede:" + rede + "})"));
  relatar("estrutura (web)", await c.avaliar(suite("qa-estrutura.js") + ";window.__QA_ESTRUTURA()"));
  await abrir(c, "http://127.0.0.1:" + PORTA_QA + "/qa/build/qa-desktop.html");
  console.log("  .exe simulado (qa-desktop.html)…");
  relatar("atualizações (.exe simulado)", await c.avaliar(suite("qa-atualizar.js") + ";window.__QA_ATUALIZAR()"));

  /* ---------- 2. a app instalada atualiza-se ---------- */
  console.log("  atualização real da app instalada (service worker, cache de 10 min)…");
  const SITE = "http://127.0.0.1:" + PORTA_SITE + "/network-framework.html";
  await abrir(c, SITE);
  const v0 = await c.avaliar("window.__F.get('VERSAO_APP')");
  /* o service worker toma conta da página, como numa app instalada */
  await c.avaliar("navigator.serviceWorker.ready.then(()=>true)");
  await abrir(c, SITE);
  const antes = await c.avaliar(`(async()=>{const F=__F,run=n=>F.run(n);
    await new Promise(r=>setTimeout(r,800));
    localStorage.setItem("of.atualizacoes.v1",JSON.stringify({auto:false}));
    run("applyTheme")("lisboa");localStorage.setItem("of.theme.v1","lisboa");
    run("sincLigarCom")(run("codigoNovo")());
    await new Promise(r=>setTimeout(r,500));
    F.set("orgName","Câmara Municipal de Teste");run("markDirty")();run("scheduleAutosave")();
    await new Promise(r=>setTimeout(r,2500));
    if(F.get("SINC"))F.get("SINC")._registar();
    const V=localStorage.getItem("of.sinc.versoes.v1");
    return {controlada:!!navigator.serviceWorker.controller,org:F.get("orgName"),tema:F.get("themeId"),
      V,codigo:JSON.parse(localStorage.getItem("of.sinc.v1")||"{}").codigo,nos:F.get("nodes").length};})()`);
  publicar("9.9.9");
  /* procurar e atualizar pelas Definições, como uma pessoa */
  const procura = await c.avaliar(`(async()=>{const F=__F,run=n=>F.run(n);
    const p=run("procurarAtualizacoes")(true);
    const fim=Date.now()+8000;
    while(Date.now()<fim){const t=document.getElementById("odTitle");if(t&&/9\\.9\\.9/.test(t.textContent)&&document.querySelector("#odBtns button"))break;await new Promise(r=>setTimeout(r,100));}
    const titulo=(document.getElementById("odTitle")||{}).textContent||"";
    const b=[...document.querySelectorAll("#odBtns button")].find(x=>x.textContent==="Atualizar agora");
    return {titulo,ha:!!b,dirty:F.get("dirty"),visita:document.getElementById("coach").classList.contains("open")};})()`);
  /* um clique a sério: com gesto do utilizador, o browser perguntaria «sair do site?» se a página o pedisse;
     e, num perfil novo, com a visita de boas-vindas aberta por baixo da pergunta */
  procura.clicou = procura.ha && await c.clicar('[...document.querySelectorAll("#odBtns button")].find(x=>x.textContent==="Atualizar agora")');
  /* a página recarrega sozinha */
  await sleep(1500);
  for (let k = 0; ; k++){
    try { await sleep(700); const v = await c.avaliar("window.__F&&window.__F.get('booted')&&window.__F.get('VERSAO_APP')"); if (v === "9.9.9") break; }
    catch(e){}
    if (k > 40) break;
  }
  await sleep(2500);
  const depois = await c.avaliar(`(async()=>{const F=__F;
    await new Promise(r=>setTimeout(r,1500));
    if(F.get("SINC"))F.get("SINC")._registar();
    const avisos=[...document.querySelectorAll(".toast .tmsg")].map(x=>x.textContent);
    return {versao:F.get("VERSAO_APP"),org:F.get("orgName"),tema:F.get("themeId"),
      V:localStorage.getItem("of.sinc.versoes.v1"),codigo:JSON.parse(localStorage.getItem("of.sinc.v1")||"{}").codigo,
      auto:JSON.parse(localStorage.getItem("of.atualizacoes.v1")||"{}").auto,nos:F.get("nodes").length,
      marca:localStorage.getItem("of.atualizacoes.feita.v1"),avisos,sessao:avisos.some(a=>/Sessão guardada/.test(a)),
      controlada:!!navigator.serviceWorker.controller,errs:window.__errs||[]};})()`);
  const chk = [
    ["a app estava instalada (service worker a servir)", antes.controlada],
    ["a pergunta mostrou a versão nova", /Versão 9\.9\.9 disponível/.test(procura.titulo) && procura.clicou],
    ["com alterações por guardar, recarregou sem perguntar «sair do site?»", procura.dirty === true && c.dialogos.length === 0],
    ["com a visita de boas-vindas aberta, o clique chegou à pergunta", procura.visita === true && depois.versao === "9.9.9"],
    ["recarregou já na versão nova, apesar da cache de 10 min", depois.versao === "9.9.9"],
    ["o projeto ficou (" + depois.org + ")", depois.org === "Câmara Municipal de Teste" && depois.nos === antes.nos],
    ["o tema ficou", depois.tema === antes.tema && !!antes.tema],
    ["a preferência das atualizações ficou", depois.auto === false],
    ["a ligação de sincronização ficou", !!antes.codigo && depois.codigo === antes.codigo],
    ["a sincronização não registou nada de novo ao arrancar", depois.V === antes.V],
    ["avisou que atualizou, sem oferecer recuperar a sessão", depois.avisos.some(a => /Atualizado para a versão 9\.9\.9/.test(a)) && !depois.sessao],
    ["a marca da atualização foi consumida", depois.marca === null],
    ["sem erros na página", depois.errs.length === 0],
  ];
  const f = chk.filter(x => !x[1]).map(x => x[0]);
  relatar("atualização da app instalada (web, de " + v0 + " para 9.9.9)", {ok: chk.length - f.length, falhas: f, errs: []});
  if (f.length && antes.V && depois.V){const A=JSON.parse(antes.V),B=JSON.parse(depois.V);const d=[...new Set([...Object.keys(A),...Object.keys(B)])].filter(k=>JSON.stringify(A[k])!==JSON.stringify(B[k]));console.log("    peças diferentes: "+d.slice(0,10).map(k=>k+" "+JSON.stringify(A[k])+" → "+JSON.stringify(B[k])).join(" ; "));}
  if (f.length) console.log("    antes: " + JSON.stringify({...antes, V: (antes.V || "").length}) + "\n    depois: " + JSON.stringify({...depois, V: (depois.V || "").length}));
  await c.avaliar(`(()=>{try{__F.run("sincParar")();}catch(e){}localStorage.clear();return 1;})()`);
  c.fechar();
} catch(e){
  falhou = true; console.error("✗ " + (e && e.message || e));
} finally {
  proc.kill();
  if (srvQA) srvQA.close();
  if (srvSite) srvSite.close();
  await sleep(500);
  for (const d of [site, perfil]) { try { fs.rmSync(d, {recursive: true, force: true}); } catch(e){} }
}
process.exit(falhou ? 1 : 0);

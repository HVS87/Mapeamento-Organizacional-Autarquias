// Capturas de ecrã para a auditoria visual: abre a página instrumentada num
// navegador sem janela, no tamanho pedido, percorre uma lista de cenas e
// guarda uma imagem de cada uma. Serve para ver a aplicação tal como ela é
// em computador, tablet e telemóvel, e para comparar antes e depois.
//   uso: node qa/preparar.mjs && node qa/servir.mjs   (noutra consola)
//        node qa/capturas.mjs [--tamanho=1440x900] [--movel] [--tema=id]
//             [--cenas=qa/cenas.mjs] [--so=nome,nome] [--saida=qa/build/capturas]
//             [--prefixo=pc] [--pagina=qa.html] [--porta=9226] [--escala=0.6]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {spawn} from "node:child_process";
import {fileURLToPath, pathToFileURL} from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const args = {};
for (const a of process.argv.slice(2)) { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); if (m) args[m[1]] = m[2] === undefined ? true : m[2]; }
const [W, H] = String(args.tamanho || "1440x900").split("x").map(Number);
const movel = !!args.movel;
const saida = path.resolve(args.saida || path.join(aqui, "build", "capturas"));
const prefixo = args.prefixo || (movel ? "movel" : W + "x" + H);
const porta = +(args.porta || 9226);
const escala = +(args.escala || 1);   // 0.6 dá imagens mais leves, para ver muitas de seguida
const url = "http://127.0.0.1:" + (args.servidor || 8754) + "/qa/build/" + (args.pagina || "qa.html");
const sleep = ms => new Promise(r => setTimeout(r, ms));

const candidatos = [process.env.QA_BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/usr/bin/microsoft-edge", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
const browser = candidatos.find(p => fs.existsSync(p));
if (!browser) { console.error("Não encontrei um navegador. Indique o caminho do executável em QA_BROWSER."); process.exit(1); }

const cenasMod = await import(pathToFileURL(path.resolve(args.cenas || path.join(aqui, "cenas.mjs"))).href);
let cenas = cenasMod.default;
if (args.so) { const so = String(args.so).split(","); cenas = cenas.filter(c => so.includes(c.nome)); }

fs.mkdirSync(saida, {recursive: true});
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "fma-capturas-"));
const proc = spawn(browser, ["--headless=new", "--remote-debugging-port=" + porta, "--user-data-dir=" + perfil, "--no-first-run",
  "--no-default-browser-check", "--hide-scrollbars", "--mute-audio", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--window-size=" + W + "," + H, "about:blank"], {stdio: "ignore"});

async function alvo() {
  for (let k = 0; k < 60; k++) {
    try { const l = await (await fetch("http://127.0.0.1:" + porta + "/json")).json(); const a = l.find(x => x.type === "page"); if (a) return a; } catch (e) {}
    await sleep(250);
  }
  throw new Error("o browser não abriu a porta de depuração " + porta);
}
let falhou = false;
try {
  const a = await alvo();
  const ws = new WebSocket(a.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params: params || {}})); });
  const avaliar = async expr => {
    const r = await cmd("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true});
    if (r.error) throw new Error("CDP: " + JSON.stringify(r.error).slice(0, 300));
    if (r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || JSON.stringify(r.result.exceptionDetails)).slice(0, 400));
    return r.result.result.value;
  };
  await cmd("Page.enable"); await cmd("Runtime.enable");
  await cmd("Emulation.setDeviceMetricsOverride", {width: W, height: H, deviceScaleFactor: movel ? 2 : 1, mobile: movel});
  if (movel) {
    await cmd("Emulation.setTouchEmulationEnabled", {enabled: true, maxTouchPoints: 5});
    await cmd("Emulation.setUserAgentOverride", {userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"});
  }
  const carregar = async () => {
    await cmd("Page.navigate", {url});
    await avaliar("new Promise(r=>{const f=()=>window.__F&&window.__F.get('booted')?r(true):setTimeout(f,150);f();})");
    if (args.tema) await avaliar("window.__F.run('applyTheme')(" + JSON.stringify(args.tema) + ")");
  };
  await carregar();
  for (const c of cenas) {
    try {
      if (c.recarregar) await carregar();
      let devolvido; if (c.js) devolvido = await avaliar("(async()=>{const F=window.__F,g=n=>F.get(n),run=n=>F.run(n),q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)],sleep=ms=>new Promise(r=>setTimeout(r,ms));" + c.js + "})()");
      if (devolvido !== undefined && devolvido !== null) console.log("  " + c.nome + " → " + (typeof devolvido === "string" ? devolvido : JSON.stringify(devolvido)));
      if (c.semImagem) continue;
      await sleep(c.espera === undefined ? 500 : c.espera);
      const r = await cmd("Page.captureScreenshot", Object.assign({format: "jpeg", quality: 82}, escala !== 1 ? {clip: {x: 0, y: 0, width: W, height: H, scale: escala}} : {}));
      const f = path.join(saida, prefixo + "-" + c.nome + ".jpg");
      fs.writeFileSync(f, Buffer.from(r.result.data, "base64"));
      console.log("✓ " + path.relative(process.cwd(), f));
    } catch (e) { falhou = true; console.log("✗ " + c.nome + ": " + (e && e.message || e)); }
  }
  const erros = await avaliar("window.__errs||[]");
  if (erros.length) { falhou = true; console.log("erros na página: " + erros.join(" | ")); }
  ws.close();
} catch (e) { falhou = true; console.error("✗ " + (e && e.message || e)); }
finally { proc.kill(); await sleep(400); try { fs.rmSync(perfil, {recursive: true, force: true}); } catch (e) {} }
process.exit(falhou ? 1 : 0);

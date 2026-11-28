// QA do instalador do Windows, de ponta a ponta (só Windows; instala de
// verdade, numa pasta temporária, e desinstala no fim):
//   1. instala a versão atual (desktop/dist) em silêncio
//   2. deixa ao lado do executável os dados que a versão 1.0 lá guardava
//      (autosaves e definições) e reinstala por cima — o desinstalador da
//      versão anterior apaga a pasta inteira; os dados têm de sobreviver
//   3. arranca a aplicação instalada: os dados passam para a pasta do
//      utilizador, e as atualizações dizem que o programa se atualiza sozinho
//   4. atualiza o programa inteiro para uma versão seguinte (desktop/dist-qa),
//      servida localmente como se viesse da Release: descarregar, instalar em
//      silêncio, reabrir — com os dados intactos
//   5. desinstala
//   uso: (em desktop/) npm run build:win, e depois node qa/instalador.mjs
//   Recusa-se a correr se a aplicação já estiver instalada neste computador.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import {spawn, spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

if (process.platform !== "win32") { console.log("instalador: só no Windows — nada a fazer aqui."); process.exit(0); }
const aqui = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.join(aqui, "..", "desktop");
const pkg = JSON.parse(fs.readFileSync(path.join(desktop, "package.json"), "utf8"));
const versao = pkg.version, seguinte = versao.replace(/\d+$/, n => String(+n + 1));
const NOME = pkg.build.productName;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const instalador = v => path.join(desktop, v === versao ? "dist" : "dist-qa", "Mapeamento-Organizacional-" + v + "-x64.exe");
const PORTA_CDP = 9251, PORTA_SRV = 8758;

function registo(){
  const r = spawnSync("powershell", ["-NoProfile", "-Command",
    "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | " +
    "Where-Object { $_.DisplayName -like '" + NOME + "*' } | Select-Object DisplayVersion,InstallLocation,UninstallString | ConvertTo-Json"], {encoding: "utf8"});
  const t = (r.stdout || "").trim();
  if (!t) return null;
  const j = JSON.parse(t);
  return Array.isArray(j) ? j[0] : j;
}
const correrUmaVez = (exe, args) => new Promise(res => {
  const p = spawn(exe, args, {stdio: "ignore", windowsVerbatimArguments: true});
  p.on("exit", c => res(c)); p.on("error", () => res(-1));
});
/* Em algumas versões do Windows, o System.dll do NSIS rebenta de vez em quando
   ao arrancar um instalador (0xC0000005), com ou sem os nossos ganchos; uma
   segunda tentativa passa. Conta-se, para se ver se piora. */
let repeticoes = 0;
const correr = async (exe, args) => {
  for (let k = 0; ; k++){
    const c = await correrUmaVez(exe, args);
    if (c !== 3221225477 || k >= 4) return c;
    repeticoes++; await sleep(3000);
  }
};
const ler = f => { try { return fs.readFileSync(f, "utf8"); } catch(e){ return null; } };

if (registo()) { console.error("✗ A aplicação já está instalada neste computador: esta QA não lhe toca. Desinstale-a primeiro, ou corra noutra máquina."); process.exit(1); }
if (!fs.existsSync(instalador(versao))) { console.error("✗ Falta " + instalador(versao) + " — corra npm run build:win em desktop/."); process.exit(1); }
if (!fs.existsSync(instalador(seguinte))){
  console.log("  a compilar a versão " + seguinte + " para o teste (só o instalador)…");
  const c = await new Promise(r => spawn("npx electron-builder --win nsis --x64 --publish never -c.extraMetadata.version=" + seguinte + " -c.directories.output=dist-qa",
    {cwd: desktop, stdio: "ignore", shell: true,
    env: Object.assign({}, process.env, {CSC_IDENTITY_AUTO_DISCOVERY: "false"})}).on("exit", r));
  if (c !== 0 || !fs.existsSync(instalador(seguinte))) { console.error("✗ não consegui compilar a versão " + seguinte); process.exit(1); }
}

const inst = fs.mkdtempSync(path.join(os.tmpdir(), "fma-inst-"));
const dados = fs.mkdtempSync(path.join(os.tmpdir(), "fma-inst-dados-"));
const exe = path.join(inst, NOME + ".exe");
const chk = [];
let app = null, srv = null;
try {
  /* 1. instalar */
  await correr(instalador(versao), ["/S", "/D=" + inst]);
  chk.push(["instalada a " + versao, fs.existsSync(exe) && (registo() || {}).DisplayVersion === versao]);
  if (!fs.existsSync(exe)) throw new Error("o instalador não instalou nada");

  /* 2. dados da versão 1.0 ao lado do executável, e reinstalar por cima */
  const MARCA = "dados-da-versao-1.0-" + Date.now();
  fs.mkdirSync(path.join(inst, "autosaves"), {recursive: true});
  fs.writeFileSync(path.join(inst, "autosaves", "autosave.json"), JSON.stringify({at: "2026-01-01T00:00:00.000Z", state: MARCA}));
  fs.writeFileSync(path.join(inst, "autosaves", "autosave-2026-01-01_10-00.json"), JSON.stringify({at: "2026-01-01T10:00:00.000Z", state: MARCA}));
  fs.writeFileSync(path.join(inst, "definicoes.json"), JSON.stringify({ecraInteiro: false, marca: MARCA}));
  await correr(instalador(versao), ["/S", "/D=" + inst]);
  chk.push(["reinstalar por cima: os autosaves ao lado do executável sobrevivem", (ler(path.join(inst, "autosaves", "autosave.json")) || "").includes(MARCA) &&
    fs.existsSync(path.join(inst, "autosaves", "autosave-2026-01-01_10-00.json"))]);
  chk.push(["reinstalar por cima: as definições sobrevivem", (ler(path.join(inst, "definicoes.json")) || "").includes(MARCA)]);
  chk.push(["a pasta temporária do instalador foi limpa", !fs.existsSync(path.join(os.tmpdir(), "mapeamento-organizacional-dados"))]);

  /* 3. arrancar a aplicação instalada */
  const pagina = Buffer.from("<!doctype html><title>x</title>");
  const ficheiros = {};
  for (const f of fs.readdirSync(path.join(desktop, "dist-qa"))) if (/\.(yml|exe|blockmap)$/.test(f)) ficheiros[f] = path.join(desktop, "dist-qa", f);
  srv = http.createServer((q, r) => {
    const n = decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\//, "");
    if (n === "atualizacao.json"){ r.writeHead(200); r.end(JSON.stringify({versao: seguinte, casca: 99, sha256: "a".repeat(64), tamanho: pagina.length, novidades: ["Programa novo (QA)."]})); return; }
    if (!ficheiros[n]){ r.writeHead(404); r.end(); return; }
    const st = fs.statSync(ficheiros[n]);
    r.writeHead(200, {"Content-Length": st.size}); fs.createReadStream(ficheiros[n]).pipe(r);
  });
  await new Promise(r => srv.listen(PORTA_SRV, "127.0.0.1", r));
  if (!fs.existsSync(exe)) throw new Error("o executável desapareceu depois de reinstalar");
  app = spawn(exe, ["--remote-debugging-port=" + PORTA_CDP], {stdio: "ignore",
    env: Object.assign({}, process.env, {MAPA_DADOS: dados, MAPA_ATUALIZACOES: "http://127.0.0.1:" + PORTA_SRV + "/"})});
  app.on("error", () => {});
  let alvo = null;
  for (let k = 0; k < 80 && !alvo; k++){
    try { alvo = (await (await fetch("http://127.0.0.1:" + PORTA_CDP + "/json")).json()).find(x => x.type === "page" && /network-framework\.html/.test(x.url)); } catch(e){}
    if (!alvo) await sleep(500);
  }
  if (!alvo) throw new Error("a aplicação instalada não abriu a página");
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
  const avaliar = expr => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.result && m.result.result.value)); ws.send(JSON.stringify({id: i, method: "Runtime.evaluate", params: {expression: expr, awaitPromise: true, returnByValue: true}})); });
  for (let k = 0; k < 60; k++){ if (await avaliar("!!(window.desktop&&document.getElementById('atualizRow'))")) break; await sleep(500); }
  const info = await avaliar("window.desktop.atualizacoes()");
  const pasta = await avaliar("window.desktop.pastaAutosaves()");
  chk.push(["instalado: o programa atualiza-se sozinho", info && info.modo === "instalado" && info.programaSozinho === true && info.versao === versao]);
  chk.push(["instalado: os autosaves vivem na pasta do utilizador", pasta && path.resolve(pasta.atual) === path.resolve(dados, "autosaves")]);
  chk.push(["os dados da 1.0 passaram para a pasta do utilizador", (ler(path.join(dados, "autosaves", "autosave.json")) || "").includes(MARCA) &&
    (ler(path.join(dados, "definicoes.json")) || "").includes(MARCA) && fs.existsSync(path.join(dados, "autosaves", "autosave-2026-01-01_10-00.json"))]);
  chk.push(["as definições migradas valem (ecrã inteiro desligado)", (await avaliar("window.desktop.definicoes().ecraInteiro")) === false]);

  /* 4. o programa inteiro, para a versão seguinte */
  const r = await avaliar("window.desktop.procurarAtualizacoes()");
  chk.push(["a página nova pede um programa mais novo: atualização do programa", r && r.tipo === "programa" && r.versao === seguinte]);
  const a = await avaliar("window.desktop.aplicarAtualizacao()");
  chk.push(["o programa novo descarregou-se e conferiu", a && a.ok === true && a.tipo === "programa"]);
  if (a && a.ok){
    avaliar("window.desktop.concluirAtualizacao()");
    let v = null;
    for (let k = 0; k < 120; k++){ await sleep(1000); v = (registo() || {}).DisplayVersion; if (v === seguinte) break; }
    chk.push(["instalou-se em silêncio a " + seguinte, v === seguinte]);
    let reaberta = false;
    for (let k = 0; k < 30 && !reaberta; k++){
      const t = spawnSync("powershell", ["-NoProfile", "-Command", "(Get-CimInstance Win32_Process -Filter \"name='" + NOME + ".exe'\" | Where-Object { $_.ExecutablePath -like '" + inst + "*' }).Count"], {encoding: "utf8"});
      reaberta = +String(t.stdout).trim() > 0;
      if (!reaberta) await sleep(1000);
    }
    chk.push(["a aplicação reabriu sozinha", reaberta]);
    chk.push(["depois da atualização: os dados continuam lá", (ler(path.join(dados, "autosaves", "autosave.json")) || "").includes(MARCA) && (ler(path.join(dados, "definicoes.json")) || "").includes(MARCA)]);
  }
  try { ws.close(); } catch(e){}
} catch(e){
  chk.push(["exceção: " + (e && e.message || e), false]);
} finally {
  /* 5. fechar e desinstalar */
  spawnSync("taskkill", ["/F", "/T", "/IM", NOME + ".exe"], {stdio: "ignore"});
  if (app) try { app.kill(); } catch(e){}
  if (srv) srv.close();
  await sleep(2000);
  const reg = registo();
  const desinst = reg && reg.UninstallString ? /"([^"]+)"/.exec(reg.UninstallString) : null;
  if (desinst) await correr(desinst[1], ["/S", "/currentuser"]);
  /* o desinstalador copia-se para fora da pasta e continua em segundo plano */
  for (let k = 0; k < 30 && registo(); k++) await sleep(1000);
  chk.push(["desinstalada", !registo()]);
  await sleep(2000);
  for (const d of [inst, dados]) { try { fs.rmSync(d, {recursive: true, force: true}); } catch(e){} }
}
const f = chk.filter(x => !x[1]).map(x => x[0]);
console.log((f.length ? "✗ " : "✓ ") + "instalador do Windows (" + versao + " → " + seguinte + "): " + (chk.length - f.length) + " certas" + (f.length ? " · falhas: " + f.join(" | ") : "") + (repeticoes ? " (o instalador rebentou ao arrancar " + repeticoes + " vez(es) e foi repetido)" : ""));
process.exit(f.length ? 1 : 0);

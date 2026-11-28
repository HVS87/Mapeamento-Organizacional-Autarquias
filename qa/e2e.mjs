// QA da aplicação de secretária real (Electron), de ponta a ponta:
//   lança o Electron com a página instrumentada, corre as suites dentro da
//   janela principal, abre o segundo ecrã e verifica-o, mede os frames.
//   uso: node qa/preparar.mjs && node qa/e2e.mjs [--sem-rede] [--sem-atualizacao]
import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.join(aqui, "..", "desktop");
const electron = createRequire(path.join(desktop, "package.json"))("electron");
const PORTA = +(process.env.QA_PORTA || 9223), rede = !process.argv.includes("--sem-rede");
const sleep = ms => new Promise(r => setTimeout(r, ms));

const proc = spawn(electron, [".", "--remote-debugging-port=" + PORTA, "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
  {cwd: desktop, env: Object.assign({}, process.env, {MAPA_HTML: path.join(aqui, "build", "qa.html"),
    /* as atualizações apontam para um sítio sem resposta: a procura ao arrancar
       falha em silêncio, e a QA nunca descarrega nada de verdade aqui */
    MAPA_ATUALIZACOES: "http://127.0.0.1:9/"}), stdio: "ignore"});

async function alvo(re, ms, porta){
  const fim = Date.now() + (ms || 20000);
  while (Date.now() < fim){
    try {
      const l = await (await fetch("http://127.0.0.1:" + (porta || PORTA) + "/json")).json();
      const a = l.find(x => x.type === "page" && re.test(x.url));
      if (a) return a;
    } catch(e){}
    await sleep(300);
  }
  throw new Error("janela não encontrada: " + re);
}
async function ligar(a){
  const ws = new WebSocket(a.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params})); });
  await cmd("Page.bringToFront", {});
  return {
    async avaliar(expr){
      const r = await cmd("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true});
      if (r.error) throw new Error("CDP: " + JSON.stringify(r.error).slice(0, 300));
      if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
      return r.result.result.value;
    },
    fechar: () => ws.close(),
  };
}
const suite = n => fs.readFileSync(path.join(aqui, "suites", n), "utf8");

let falhou = false;
const relatar = (nome, r) => {
  const f = (r.falhas || []).length + (r.errs || []).length;
  if (f) falhou = true;
  console.log((f ? "✗ " : "✓ ") + nome + ": " + r.ok + " certas" + (r.falhas && r.falhas.length ? " · falhas: " + r.falhas.join(" | ") : "") + (r.errs && r.errs.length ? " · erros: " + r.errs.join(" | ") : ""));
};
try {
  const p = await ligar(await alvo(/qa\.html$/));
  /* a janela pode recarregar uma vez ao arrancar: espera-se que fique de pé */
  for (let k = 0; ; k++){
    try { await p.avaliar("new Promise(r=>{const f=()=>window.__F&&window.__F.get('booted')?r():setTimeout(f,200);f();})"); await sleep(2500);
      await p.avaliar("window.__F.get('booted')"); break; }
    catch(e){ if (k >= 5) throw e; await sleep(1000); }
  }
  console.log("  a correr: aplicação…");
  relatar("aplicação (Electron)", await p.avaliar(suite("qa-app.js") + ";window.__QA_APP()"));
  console.log("  a correr: sincronização…");
  relatar("sincronização (Electron" + (rede ? ", com ntfy.sh real" : "") + ")", await p.avaliar(suite("qa-sinc.js") + ";window.__QA_SINC({rede:" + rede + "})"));
  relatar("atualizações (Electron)", await p.avaliar(suite("qa-atualizar.js") + ";window.__QA_ATUALIZAR()"));
  relatar("estrutura (Electron)", await p.avaliar(suite("qa-estrutura.js") + ";window.__QA_ESTRUTURA()"));
  relatar("esquadria (Electron)", await p.avaliar(suite("qa-varrer.js") + ";window.__QA_VARRER()"));
  /* segundo ecrã */
  await p.avaliar("window.desktop.abrirPalco()");
  const pal = await ligar(await alvo(/qa\.html#palco/));
  await sleep(18000);   // a génese (a organização a nascer) leva até ~16 s
  await p.avaliar("(()=>{const F=window.__F;F.run('selectNode')(F.get('nodes')[6]);F.run('palcoEnviaFoco')(true);})()");
  await sleep(2500);
  const ep = await pal.avaliar(`(async()=>{const F=window.__F,g=n=>F.get(n);const t0=g("uxTick"),p0=performance.now();await new Promise(r=>setTimeout(r,3000));
    return {palco:g("ehPalco"),sinc:g("SINC"),foco:g("foco"),holo:!!g("holo"),fps:+((g("uxTick")-t0)/((performance.now()-p0)/1000)).toFixed(1),errs:window.__errs||[],privacidade:document.querySelectorAll(".privacidade").length};})()`);
  const okPal = ep.palco === true && ep.sinc === null && ep.foco && ep.foco.tipo === "nodulo" && ep.holo && ep.errs.length === 0;
  relatar("segundo ecrã (Electron)", {ok: okPal ? 5 : 0, falhas: okPal ? [] : ["estado do palco: " + JSON.stringify(ep)], errs: []});
  console.log("  palco a " + ep.fps + " fps, sem sincronização própria (só o principal fala com a caixa)");
  const fps = await p.avaliar(`(async()=>{await window.desktop.fecharPalco();await new Promise(r=>setTimeout(r,1500));const fr=[];let l=performance.now();const t0=l;
    await new Promise(res=>{const s=()=>{const n=performance.now();fr.push(n-l);l=n;if(n-t0<5000)requestAnimationFrame(s);else res();};requestAnimationFrame(s);});
    fr.shift();const o=[...fr].sort((a,b)=>a-b);return {fps:+(1000/(fr.reduce((a,b)=>a+b,0)/fr.length)).toFixed(1),p95:+o[Math.floor(o.length*.95)].toFixed(1),acima33:fr.filter(x=>x>33.5).length,n:fr.length,errs:window.__errs};})()`);
  console.log("  janela principal a " + fps.fps + " fps (p95 " + fps.p95 + " ms, " + fps.acima33 + " frames acima de 33 ms em " + fps.n + ")");
  if (fps.errs.length){ falhou = true; console.log("✗ erros na janela principal: " + fps.errs.join(" | ")); }
  pal.fechar(); p.fechar();
} catch(e){
  falhou = true; console.error("✗ " + (e && e.message || e));
} finally {
  proc.kill();
}
/* ---------- atualizar a aplicação de secretária, a sério ----------
   Um Electron à parte, com dados numa pasta temporária e as atualizações
   servidas daqui: a página nova (a instrumentada, com outra versão) passa
   pelo mesmo caminho que a da Release — descarregar, conferir, instalar na
   pasta do utilizador, recarregar — e os dados, as preferências e a
   sincronização têm de chegar ao outro lado iguais. Depois, reiniciar
   continua na versão nova; e uma página que não confere, ou que pede um
   programa mais novo, é recusada. */
async function faseAtualizacao(){
  const os = await import("node:os"), http = await import("node:http"), crypto = await import("node:crypto");
  const req = createRequire(path.join(desktop, "package.json"));
  const {prepararPagina} = req("./pagina-desktop.js");
  if (!fs.existsSync(path.join(desktop, "app", "vendor", "three.min.js"))){
    console.log("  a preparar desktop/app (three.js local)…");
    await new Promise((r, j) => spawn(process.execPath, ["preparar-app.js"], {cwd: desktop, stdio: "inherit"}).on("exit", c => c ? j(new Error("preparar-app")) : r()));
  }
  const PORTA2 = PORTA + 10, PORTA_SRV = 8757;
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), "fma-e2e-dados-"));
  const qa = fs.readFileSync(path.join(aqui, "build", "qa.html"), "utf8");
  let servido = {};
  const pagina = versao => Buffer.from(prepararPagina(qa.replace(/const VERSAO_APP="\d+\.\d+\.\d+";/, 'const VERSAO_APP="' + versao + '";')), "utf8");
  const publicar = (versao, o) => {
    o = o || {};
    const html = pagina(versao);
    servido = {"pagina.html": html, "atualizacao.json": Buffer.from(JSON.stringify({versao, casca: o.casca || 2,
      sha256: o.shaErrado ? "0".repeat(64) : crypto.createHash("sha256").update(html).digest("hex"), tamanho: html.length,
      novidades: ["Versão de teste: só para a QA."]}))};
  };
  const srv = http.createServer((q, r) => {
    const f = servido[decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\//, "")];
    if (!f){ r.writeHead(404); r.end(); return; }
    r.writeHead(200, {"Content-Type": "application/octet-stream"}); r.end(f);
  });
  await new Promise(r => srv.listen(PORTA_SRV, "127.0.0.1", r));
  const env = Object.assign({}, process.env, {MAPA_HTML: path.join(aqui, "build", "qa.html"), MAPA_DADOS: dados,
    MAPA_ATUALIZACOES: "http://127.0.0.1:" + PORTA_SRV + "/"});
  const lancar = () => spawn(electron, [".", "--remote-debugging-port=" + PORTA2, "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"], {cwd: desktop, env, stdio: "ignore"});
  const pronto = async re => {
    for (let k = 0; ; k++){
      try {
        const p = await ligar(await alvo(re, 20000, PORTA2));
        await p.avaliar("new Promise(r=>{const f=()=>window.__F&&window.__F.get('booted')?r():setTimeout(f,200);f();})");
        await sleep(2500); await p.avaliar("window.__F.get('booted')");
        return p;
      } catch(e){ if (k >= 6) throw e; await sleep(1000); }
    }
  };
  const ESTADO = `(async()=>{const F=__F;await new Promise(r=>setTimeout(r,1200));if(F.get("SINC"))F.get("SINC")._registar();
    const info=window.desktop.atualizacoes();
    return {versao:F.get("VERSAO_APP"),info,org:F.get("orgName"),tema:F.get("themeId"),nos:F.get("nodes").length,
      V:localStorage.getItem("of.sinc.versoes.v1"),codigo:JSON.parse(localStorage.getItem("of.sinc.v1")||"{}").codigo,
      auto:JSON.parse(localStorage.getItem("of.atualizacoes.v1")||"{}").auto,ecraInteiro:window.desktop.definicoes().ecraInteiro,
      url:location.href,avisos:[...document.querySelectorAll(".toast .tmsg")].map(x=>x.textContent),errs:window.__errs||[]};})()`;
  let proc2 = lancar(), p = null;
  /* parar a sério: o processo e a porta de depuração livres antes de o voltar a lançar */
  const parar = async pr => { if (pr.exitCode === null){ const fim = new Promise(r => pr.once("exit", r)); pr.kill(); await Promise.race([fim, sleep(10000)]); } await sleep(1500); };
  const largar = () => { try { if (p) p.fechar(); } catch(e){} p = null; };
  const chk = [];
  try {
    publicar("1.0.0");   // mais antiga do que a instalada: nada a fazer
    p = await pronto(/qa\.html$/);
    const r0 = await p.avaliar("window.desktop.procurarAtualizacoes()");
    chk.push(["versão publicada mais antiga: está atualizada", r0.tipo === "atual"]);
    /* dados, preferências e sincronização deste aparelho */
    const antes = await p.avaliar(`(async()=>{const F=__F,run=n=>F.run(n);
      localStorage.setItem("of.atualizacoes.v1",JSON.stringify({auto:false}));
      run("applyTheme")("lisboa");localStorage.setItem("of.theme.v1","lisboa");
      await window.desktop.definir("ecraInteiro",false);
      run("sincLigarCom")(run("codigoNovo")());
      await new Promise(r=>setTimeout(r,600));
      F.set("orgName","Câmara Municipal de Teste");run("markDirty")();run("scheduleAutosave")();
      await new Promise(r=>setTimeout(r,2600));
      return true;})()`);
    const e0 = await p.avaliar(ESTADO);
    chk.push(["autosave na pasta de dados", antes && fs.existsSync(path.join(dados, "autosaves", "autosave.json"))]);
    /* recusas */
    publicar("9.9.9", {shaErrado: true});
    const r1 = await p.avaliar("window.desktop.procurarAtualizacoes().then(r=>window.desktop.aplicarAtualizacao().then(a=>({r,a})))");
    chk.push(["página que não confere: recusada, nada instalado", r1.r.tipo === "pagina" && r1.a.ok === false && /não confere/.test(r1.a.erro) && !fs.existsSync(path.join(dados, "pagina"))]);
    publicar("9.9.9", {casca: 99});
    const r2 = await p.avaliar("window.desktop.procurarAtualizacoes()");
    chk.push(["página que pede um programa mais novo: oferece o download", r2.tipo === "descarregar"]);
    /* a atualização, pelas Definições, como uma pessoa */
    publicar("9.9.9");
    const pr = await p.avaliar(`(async()=>{const run=n=>__F.run(n);
      run("procurarAtualizacoes")(true);
      const fim=Date.now()+8000;
      while(Date.now()<fim){const t=document.getElementById("odTitle");if(t&&/9\\.9\\.9/.test(t.textContent)&&document.querySelector("#odBtns button"))break;await new Promise(r=>setTimeout(r,100));}
      const b=[...document.querySelectorAll("#odBtns button")].find(x=>x.textContent==="Atualizar agora");
      if(b)b.click();return !!b;})()`);
    chk.push(["a pergunta da versão nova apareceu", pr === true]);
    largar();
    p = await pronto(/pagina\/network-framework\.html$/);
    const e1 = await p.avaliar(ESTADO);
    const iguais = (e, nome) => {
      chk.push([nome + ": versão 9.9.9", e.versao === "9.9.9" && e.info.versao === "9.9.9" && /pagina\/network-framework\.html$/.test(e.url)]);
      chk.push([nome + ": o projeto ficou", e.org === "Câmara Municipal de Teste" && e.nos === e0.nos]);
      chk.push([nome + ": tema e preferências ficaram", e.tema === "lisboa" && e.auto === false && e.ecraInteiro === false]);
      chk.push([nome + ": a ligação de sincronização ficou", !!e0.codigo && e.codigo === e0.codigo]);
      chk.push([nome + ": a sincronização não registou nada de novo", !!e0.V && e.V === e0.V]);
      chk.push([nome + ": sem erros", e.errs.length === 0]);
    };
    iguais(e1, "depois de atualizar");
    chk.push(["depois de atualizar: avisou", e1.avisos.some(a => /Atualizado para a versão 9\.9\.9/.test(a))]);
    chk.push(["a página nova ficou na pasta de dados", fs.existsSync(path.join(dados, "pagina", "network-framework.html")) && fs.existsSync(path.join(dados, "pagina", "vendor", "three.min.js"))]);
    const r3 = await p.avaliar("window.desktop.procurarAtualizacoes()");
    chk.push(["já na 9.9.9: está atualizada", r3.tipo === "atual"]);
    /* reiniciar: continua na versão nova, com tudo */
    largar();
    await parar(proc2);
    proc2 = lancar();
    p = await pronto(/pagina\/network-framework\.html$/);
    iguais(await p.avaliar(ESTADO), "depois de reiniciar");
  } catch(e){
    chk.push(["exceção: " + (e && e.message || e), false]);
  } finally {
    try { if (p) await Promise.race([p.avaliar(`(()=>{try{__F.run("sincParar")();}catch(e){}return 1;})()`), sleep(3000)]); } catch(e){}
    largar();
    await parar(proc2); srv.close();
    try { fs.rmSync(dados, {recursive: true, force: true}); } catch(e){}
  }
  const f = chk.filter(x => !x[1]).map(x => x[0]);
  relatar("atualização da aplicação de secretária (página da Release, reinício, recusas)", {ok: chk.length - f.length, falhas: f, errs: []});
}
if (!process.argv.includes("--sem-atualizacao")){
  try { console.log("  a correr: atualização real…"); await faseAtualizacao(); }
  catch(e){ falhou = true; console.error("✗ atualização: " + (e && e.message || e)); }
}
process.exit(falhou ? 1 : 0);

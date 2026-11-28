/* Processo principal da aplicação de secretária (Electron).
   Responsabilidades: a janela principal (ecrã inteiro por omissão), o palco
   no segundo monitor (já em ecrã inteiro, sem arrastar nem clicar), a pasta
   local de autosaves, as definições persistidas, as atualizações, e o correio
   entre as duas janelas — no .exe cada janela file:// é uma origem opaca, por
   isso o BroadcastChannel da versão web não as liga; o IPC daqui faz esse papel. */
"use strict";
const {app,BrowserWindow,ipcMain,screen,shell,dialog,net}=require("electron");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

/* MAPA_DADOS põe os dados do utilizador (armazenamento da página, definições,
   página atualizada) noutra pasta: a QA corre assim sem tocar nos verdadeiros. */
if(process.env.MAPA_DADOS)app.setPath("userData",path.resolve(process.env.MAPA_DADOS));

/* ---------- como foi instalada ----------
   Decide onde vivem os dados e que atualizações se podem fazer sozinhas. */
function modoInstalacao(){
  if(!app.isPackaged)return "desenvolvimento";
  if(process.platform==="darwin")return "mac";
  if(process.platform==="linux")return process.env.APPIMAGE?"appimage":"linux";
  return process.env.PORTABLE_EXECUTABLE_DIR?"portatil":"instalado";
}
const MODO=modoInstalacao();

/* ---------- onde vivem os dados ----------
   Em desenvolvimento (electron .) é a raiz do projeto. A versão portátil do
   Windows guarda tudo ao lado do .exe (numa pen, os dados vão com ela). Em
   todos os outros casos, na pasta do utilizador: no Mac a aplicação vive
   dentro de um .app assinado (escrever lá dentro parte a assinatura), no
   Linux o AppImage é montado só de leitura, e no Windows instalado a pasta
   do programa é apagada e reescrita a cada atualização. */
function pastaBase(){
  if(!app.isPackaged)return process.env.MAPA_DADOS?app.getPath("userData"):path.join(__dirname,"..");
  /* O portátil descompacta-se numa pasta temporária que desaparece ao
     fechar; a pasta verdadeira, ao lado do .exe, vem nesta variável. */
  if(MODO==="portatil"){
    try{fs.accessSync(process.env.PORTABLE_EXECUTABLE_DIR,fs.constants.W_OK);return process.env.PORTABLE_EXECUTABLE_DIR;}catch(e){}
  }
  return app.getPath("userData");
}
const BASE=pastaBase();
const PASTA_AUTOSAVES_OMISSAO=path.join(BASE,"autosaves");
const FICHEIRO_DEFS=path.join(BASE,"definicoes.json");

/* Até à versão 1.0, o Windows instalado guardava os autosaves e as
   definições ao lado do executável. Passam para a pasta do utilizador, uma
   vez, sem apagar nada: o que já lá estiver não é substituído. (O instalador
   também os resguarda antes de a versão anterior ser desinstalada — ver
   instalador.nsh.) */
function migrarDadosAntigos(){
  if(MODO!=="instalado")return;
  const antiga=path.dirname(app.getPath("exe"));
  if(path.resolve(antiga)===path.resolve(BASE))return;
  try{
    fs.mkdirSync(BASE,{recursive:true});
    const de=path.join(antiga,"definicoes.json");
    if(fs.existsSync(de)&&!fs.existsSync(FICHEIRO_DEFS))fs.copyFileSync(de,FICHEIRO_DEFS);
    const pa=path.join(antiga,"autosaves");
    if(fs.existsSync(pa)){
      fs.mkdirSync(PASTA_AUTOSAVES_OMISSAO,{recursive:true});
      for(const f of fs.readdirSync(pa)){
        const para=path.join(PASTA_AUTOSAVES_OMISSAO,f);
        if(/\.json$/i.test(f)&&!fs.existsSync(para))fs.copyFileSync(path.join(pa,f),para);
      }
    }
  }catch(e){}
}
migrarDadosAntigos();

/* ---------- a página ----------
   A que vem no pacote, ou uma mais recente que as Atualizações tenham
   descarregado para a pasta do utilizador. MAPA_HTML aponta para outra
   página (uma cópia instrumentada para QA, por exemplo); só fora do pacote. */
const HTML_EMBUTIDO=app.isPackaged
  ?path.join(app.getAppPath(),"app","network-framework.html")
  :(process.env.MAPA_HTML||path.join(__dirname,"..","network-framework.html"));
/* vendor/three.min.js e os ícones que a página atualizada leva consigo */
const RECURSOS=app.isPackaged?path.join(app.getAppPath(),"app"):path.join(__dirname,"app");
const PASTA_PAGINA=path.join(app.getPath("userData"),"pagina");
/* Nível da ponte entre a página e o programa (este ficheiro e o preload).
   Sobe sempre que uma página nova precisar de algo que um programa antigo
   não tem; a página de uma Release só se instala num programa com o nível
   que ela pede. Lido daqui por gerar-atualizacao.js. */
const CASCA=2;
const REPO="HVS87/Mapeamento-Organizacional-Autarquias";
const PAGINA_RELEASES="https://github.com/"+REPO+"/releases/latest";
/* MAPA_ATUALIZACOES: outra origem para as atualizações (a QA usa um servidor local) */
const ORIGEM_ATUALIZACOES=(process.env.MAPA_ATUALIZACOES||("https://github.com/"+REPO+"/releases/latest/download/")).replace(/\/?$/,"/");

function compararVersoes(a,b){
  const pa=String(a).split(".").map(n=>parseInt(n,10)||0),pb=String(b).split(".").map(n=>parseInt(n,10)||0);
  for(let i=0;i<3;i++){if((pa[i]||0)!==(pb[i]||0))return (pa[i]||0)>(pb[i]||0)?1:-1;}
  return 0;
}
const versaoValida=v=>typeof v==="string"&&/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v);
/* Em desenvolvimento, a página da pasta do projeto manda — salvo na QA das
   atualizações, que é quando há uma origem própria. */
const usaPaginaDescarregada=app.isPackaged||!!process.env.MAPA_ATUALIZACOES;
function paginaDescarregada(){
  if(!usaPaginaDescarregada)return null;
  try{
    const v=JSON.parse(fs.readFileSync(path.join(PASTA_PAGINA,"versao.json"),"utf8"));
    if(!v||!versaoValida(v.versao))return null;
    if(compararVersoes(v.versao,app.getVersion())<=0)return null;   // o programa já traz esta ou mais recente
    if((v.casca|0)>CASCA)return null;
    if(!fs.existsSync(path.join(PASTA_PAGINA,"network-framework.html")))return null;
    return v;
  }catch(e){return null;}
}
/* Depois de o programa inteiro ser atualizado, a página descarregada antes
   fica para trás: apaga-se, para não ocupar espaço nem confundir. */
function limparPaginaVelha(){
  if(!usaPaginaDescarregada||paginaDescarregada())return;
  try{fs.rmSync(PASTA_PAGINA,{recursive:true,force:true});}catch(e){}
}
const htmlAtual=()=>paginaDescarregada()?path.join(PASTA_PAGINA,"network-framework.html"):HTML_EMBUTIDO;
const versaoAtual=()=>{const p=paginaDescarregada();return p?p.versao:app.getVersion();};

/* a pasta dos autosaves muda-se nas Definições; sem escolha, fica ao lado do exe */
function pastaAutosaves(){
  const d=lerDefs();
  return (typeof d.pastaAutosaves==="string"&&d.pastaAutosaves)?d.pastaAutosaves:PASTA_AUTOSAVES_OMISSAO;
}
function garantePasta(){try{fs.mkdirSync(pastaAutosaves(),{recursive:true});}catch(e){}}

/* ---------- definições ---------- */
const DEFS_OMISSAO={ecraInteiro:true,ecraAuto:null,pastaAutosaves:null,motor:null};
function lerDefs(){
  try{
    const d=JSON.parse(fs.readFileSync(FICHEIRO_DEFS,"utf8"));
    return Object.assign({},DEFS_OMISSAO,(d&&typeof d==="object")?d:{});
  }catch(e){return Object.assign({},DEFS_OMISSAO);}
}
function escreveDefs(d){
  try{garantePasta();fs.writeFileSync(FICHEIRO_DEFS,JSON.stringify(d,null,2),"utf8");}catch(e){}
}

/* ---------- autosaves ----------
   "autosave.json" é sempre o último estado; de 30 em 30 minutos fica também
   uma cópia datada, e guardam-se as últimas 40. */
let ultimaCopiaDatada=0;
function guardaAutosave(json){
  if(typeof json!=="string"||!json)return false;
  garantePasta();
  try{
    fs.writeFileSync(path.join(pastaAutosaves(),"autosave.json"),json,"utf8");
    const agora=Date.now();
    if(agora-ultimaCopiaDatada>30*60*1000){
      const d=new Date(agora);
      const carimbo=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")+
        "_"+String(d.getHours()).padStart(2,"0")+"-"+String(d.getMinutes()).padStart(2,"0");
      fs.writeFileSync(path.join(pastaAutosaves(),"autosave-"+carimbo+".json"),json,"utf8");
      ultimaCopiaDatada=agora;
      const datados=fs.readdirSync(pastaAutosaves()).filter(f=>/^autosave-.*\.json$/.test(f)).sort();
      while(datados.length>40){const velho=datados.shift();try{fs.unlinkSync(path.join(pastaAutosaves(),velho));}catch(e){}}
    }
    return true;
  }catch(e){return false;}
}
function leAutosave(){
  try{return fs.readFileSync(path.join(pastaAutosaves(),"autosave.json"),"utf8");}
  catch(e){return null;}
}

/* ---------- janelas ---------- */
let janelaPrincipal=null,janelaPalco=null;
const prefs={preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false};

function criaPrincipal(){
  const d=lerDefs();
  janelaPrincipal=new BrowserWindow({
    width:1400,height:900,minWidth:900,minHeight:600,
    fullscreen:d.ecraInteiro!==false,
    autoHideMenuBar:true,
    backgroundColor:"#04070E",
    title:"Mapeamento Organizacional para Autarquias",
    webPreferences:prefs
  });
  janelaPrincipal.setMenuBarVisibility(false);
  janelaPrincipal.loadFile(htmlAtual());
  /* fechar pelo X passa pela mesma pergunta do menu: a página decide e chama "sair" */
  janelaPrincipal.on("close",e=>{
    if(aSair||janelaPrincipal.isDestroyed())return;
    e.preventDefault();
    janelaPrincipal.webContents.send("pedir-sair");
  });
  janelaPrincipal.on("closed",()=>{janelaPrincipal=null;if(janelaPalco)janelaPalco.close();});
}
function ecraDoPalco(){
  const todos=screen.getAllDisplays();
  if(todos.length<2||!janelaPrincipal)return null;
  const principal=screen.getDisplayMatching(janelaPrincipal.getBounds());
  return todos.find(e=>e.id!==principal.id)||null;
}
function abrePalco(){
  if(janelaPalco&&!janelaPalco.isDestroyed()){janelaPalco.focus();return {ok:true,doisEcras:screen.getAllDisplays().length>1};}
  const alvo=ecraDoPalco();
  const opts=alvo
    ?{x:alvo.bounds.x,y:alvo.bounds.y,width:alvo.bounds.width,height:alvo.bounds.height,fullscreen:true}
    :{width:1100,height:700,fullscreen:false};
  janelaPalco=new BrowserWindow(Object.assign({
    autoHideMenuBar:true,backgroundColor:"#04070E",
    title:"Palco — Mapeamento Organizacional para Autarquias",
    webPreferences:prefs
  },opts));
  janelaPalco.setMenuBarVisibility(false);
  janelaPalco.loadFile(htmlAtual(),{hash:"palco"});
  janelaPalco.on("closed",()=>{
    janelaPalco=null;
    if(janelaPrincipal&&!janelaPrincipal.isDestroyed())janelaPrincipal.webContents.send("palco-msg",{t:"adeus"});
  });
  return {ok:true,doisEcras:!!alvo};
}
function fechaPalco(){if(janelaPalco&&!janelaPalco.isDestroyed())janelaPalco.close();}

/* ---------- IPC ---------- */
ipcMain.on("versao",e=>{e.returnValue=app.getVersion();});
ipcMain.on("ecras",e=>{
  e.returnValue=screen.getAllDisplays().map(d=>({id:d.id,bounds:d.bounds,primary:d.id===screen.getPrimaryDisplay().id}));
});
ipcMain.on("sou-palco",e=>{e.returnValue=!!(janelaPalco&&!janelaPalco.isDestroyed()&&e.sender===janelaPalco.webContents);});
ipcMain.on("palco-aberto",e=>{e.returnValue=!!(janelaPalco&&!janelaPalco.isDestroyed());});
ipcMain.on("autosave-ler",e=>{e.returnValue=leAutosave();});
ipcMain.on("defs-ler",e=>{e.returnValue=lerDefs();});
ipcMain.handle("autosave-guardar",(e,json)=>guardaAutosave(json));
ipcMain.handle("autosave-pasta",()=>{garantePasta();return shell.openPath(pastaAutosaves());});
ipcMain.on("pasta-autosaves-ler",e=>{e.returnValue={atual:pastaAutosaves(),omissao:PASTA_AUTOSAVES_OMISSAO};});
/* escolher outra pasta: o autosave atual vai junto, para a recuperação não se perder */
ipcMain.handle("pasta-autosaves-escolher",async e=>{
  const w=BrowserWindow.fromWebContents(e.sender);
  const r=await dialog.showOpenDialog(w,{title:"Pasta dos autosaves",defaultPath:pastaAutosaves(),
    buttonLabel:"Usar esta pasta",properties:["openDirectory","createDirectory"]});
  if(r.canceled||!r.filePaths||!r.filePaths[0])return null;
  const nova=r.filePaths[0],antiga=pastaAutosaves();
  try{fs.mkdirSync(nova,{recursive:true});}catch(err){return null;}
  try{
    const de=path.join(antiga,"autosave.json"),para=path.join(nova,"autosave.json");
    if(nova!==antiga&&fs.existsSync(de)&&!fs.existsSync(para))fs.copyFileSync(de,para);
  }catch(err){}
  const d=lerDefs();d.pastaAutosaves=(nova===PASTA_AUTOSAVES_OMISSAO)?null:nova;escreveDefs(d);
  return nova;
});
/* ---------- ficheiro de trabalho: Guardar / Guardar como ---------- */
let ficheiroAtual=null,aSair=false;
ipcMain.on("ficheiro-atual",e=>{e.returnValue=ficheiroAtual;});
ipcMain.on("ficheiro-definir",(e,p)=>{if(typeof p==="string"&&p)ficheiroAtual=p;});
ipcMain.handle("ficheiro-guardar",async(e,json,o)=>{
  if(typeof json!=="string"||!json)return {ok:false,erro:"nada para guardar"};
  o=o||{};
  let alvo=(!o.como&&ficheiroAtual)?ficheiroAtual:null;
  if(!alvo){
    const w=BrowserWindow.fromWebContents(e.sender);
    const sug=String(o.sugestao||"organizacao").replace(/[^\w-]+/g,"_")||"organizacao";
    const r=await dialog.showSaveDialog(w,{title:o.como?"Guardar como":"Guardar",
      defaultPath:ficheiroAtual||path.join(app.getPath("documents"),sug+".json"),
      filters:[{name:"Dataset (JSON)",extensions:["json"]}]});
    if(r.canceled||!r.filePath)return {cancelado:true};
    alvo=r.filePath;
  }
  try{fs.writeFileSync(alvo,json,"utf8");}catch(err){return {ok:false,erro:err.message};}
  ficheiroAtual=alvo;
  return {ok:true,path:alvo,nome:path.basename(alvo)};
});
ipcMain.on("sair",()=>{aSair=true;app.quit();});
ipcMain.handle("defs-escrever",(e,k,v)=>{
  if(typeof k!=="string"||!(k in DEFS_OMISSAO))return false;
  const d=lerDefs();d[k]=v;escreveDefs(d);return true;
});
ipcMain.handle("ecra-inteiro",(e,on)=>{
  const w=BrowserWindow.fromWebContents(e.sender);
  if(!w)return false;
  const alvo=(typeof on==="boolean")?on:!w.isFullScreen();
  w.setFullScreen(alvo);
  return alvo;
});
ipcMain.handle("palco-abrir",()=>abrePalco());
ipcMain.handle("palco-fechar",()=>{fechaPalco();return true;});
/* correio entre janelas: o que uma envia chega a todas as outras */
ipcMain.on("palco-msg",(e,m)=>{
  BrowserWindow.getAllWindows().forEach(w=>{
    if(!w.isDestroyed()&&w.webContents!==e.sender)w.webContents.send("palco-msg",m);
  });
});

/* ---------- atualizações ----------
   Duas camadas. A página — quase toda a ferramenta — atualiza-se em
   qualquer instalação: descarrega-se da Release mais recente, confere-se a
   impressão digital (SHA-256) e fica na pasta do utilizador, ao lado dos
   dados, que não mudam de sítio. Quando a página nova precisa de um programa
   mais novo (nível da ponte acima do deste), o Windows instalado e o
   AppImage atualizam o programa inteiro; o portátil, o Mac e o .deb abrem a
   página de download. A página decide quando (ao arrancar, se a pessoa
   quiser, e no botão das Definições); daqui só sai o que ela pede. */
const PROGRAMA_SOZINHO=MODO==="instalado"||MODO==="appimage";
let pendente=null;          // {tipo:"pagina"|"programa"|"descarregar", versao, ...}
let programaPronto=false;
let atualizador=null;
function obterAtualizador(){
  if(atualizador)return atualizador;
  const {autoUpdater}=require("electron-updater");
  autoUpdater.autoDownload=false;
  autoUpdater.autoInstallOnAppQuit=true;
  autoUpdater.logger=null;
  if(process.env.MAPA_ATUALIZACOES)autoUpdater.setFeedURL({provider:"generic",url:ORIGEM_ATUALIZACOES});
  autoUpdater.on("download-progress",p=>avisarProgresso({fase:"programa",pct:Math.round(p.percent||0)}));
  atualizador=autoUpdater;
  return atualizador;
}
function avisarProgresso(p){
  if(janelaPrincipal&&!janelaPrincipal.isDestroyed())janelaPrincipal.webContents.send("atualizacoes-progresso",p);
}
async function buscar(url,ms){
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),ms||20000);
  try{
    const r=await net.fetch(url,{cache:"no-store",signal:ctl.signal});
    if(!r.ok)throw new Error(r.status===404?"ainda não há atualizações publicadas":"o servidor respondeu "+r.status);
    return Buffer.from(await r.arrayBuffer());
  }finally{clearTimeout(t);}
}
function lerManifesto(buf){
  let m=null;try{m=JSON.parse(buf.toString("utf8"));}catch(e){}
  if(!m||!versaoValida(m.versao)||!/^[0-9a-f]{64}$/.test(String(m.sha256||""))||!(m.tamanho>0&&m.tamanho<20e6))
    throw new Error("a informação da versão nova está incompleta");
  return {versao:m.versao,casca:Math.max(1,m.casca|0),sha256:m.sha256,tamanho:m.tamanho|0,
    novidades:Array.isArray(m.novidades)?m.novidades.filter(x=>typeof x==="string").slice(0,8).map(x=>x.slice(0,240)):[]};
}
async function procurar(){
  pendente=null;
  const m=lerManifesto(await buscar(ORIGEM_ATUALIZACOES+"atualizacao.json"));
  const base={versao:m.versao,atual:versaoAtual(),novidades:m.novidades};
  if(compararVersoes(m.versao,versaoAtual())<=0)return Object.assign(base,{tipo:"atual"});
  if(m.casca<=CASCA)pendente={tipo:"pagina",m};
  else if(PROGRAMA_SOZINHO)pendente={tipo:"programa",m};
  else pendente={tipo:"descarregar",m};
  return Object.assign(base,{tipo:pendente.tipo});
}
/* A página nova monta-se numa pasta ao lado e só no fim toma o lugar da
   anterior: uma falha a meio deixa tudo como estava. */
async function instalarPagina(m){
  avisarProgresso({fase:"pagina",pct:0});
  const html=await buscar(ORIGEM_ATUALIZACOES+"pagina.html",60000);
  if(html.length!==m.tamanho||crypto.createHash("sha256").update(html).digest("hex")!==m.sha256)
    throw new Error("o ficheiro descarregado não confere — nada foi alterado");
  const txt=html.toString("utf8");
  if(!txt.includes('src="vendor/three.min.js"'))throw new Error("a página descarregada não é a da aplicação de secretária");
  const tmp=PASTA_PAGINA+".nova",velha=PASTA_PAGINA+".anterior";
  fs.rmSync(tmp,{recursive:true,force:true});
  fs.mkdirSync(path.join(tmp,"vendor"),{recursive:true});
  fs.copyFileSync(path.join(RECURSOS,"vendor","three.min.js"),path.join(tmp,"vendor","three.min.js"));
  fs.cpSync(path.join(RECURSOS,"icons"),path.join(tmp,"icons"),{recursive:true});
  fs.writeFileSync(path.join(tmp,"network-framework.html"),html);
  fs.writeFileSync(path.join(tmp,"versao.json"),JSON.stringify({versao:m.versao,casca:m.casca,sha256:m.sha256,instalada:new Date().toISOString()},null,2));
  fs.rmSync(velha,{recursive:true,force:true});
  if(fs.existsSync(PASTA_PAGINA))fs.renameSync(PASTA_PAGINA,velha);
  fs.renameSync(tmp,PASTA_PAGINA);
  fs.rmSync(velha,{recursive:true,force:true});
  avisarProgresso({fase:"pagina",pct:100});
}
async function descarregarPrograma(){
  const u=obterAtualizador();
  const r=await u.checkForUpdates();
  if(!r||!r.updateInfo||compararVersoes(r.updateInfo.version,app.getVersion())<=0)
    throw new Error("o programa novo ainda não está publicado — tente daqui a pouco");
  await u.downloadUpdate();
  programaPronto=true;
}
ipcMain.on("atualizacoes-info",e=>{
  e.returnValue={versao:versaoAtual(),programa:app.getVersion(),casca:CASCA,modo:MODO,programaSozinho:PROGRAMA_SOZINHO};
});
ipcMain.handle("atualizacoes-procurar",async()=>{
  try{return await procurar();}
  catch(err){return {tipo:"erro",erro:String(err&&err.message||err),atual:versaoAtual()};}
});
/* Descarrega e prepara; não reinicia nada. A página grava o que tem e
   depois chama "atualizacoes-concluir". */
ipcMain.handle("atualizacoes-aplicar",async()=>{
  if(!pendente)return {ok:false,erro:"procure primeiro"};
  try{
    if(pendente.tipo==="pagina")await instalarPagina(pendente.m);
    else if(pendente.tipo==="programa")await descarregarPrograma();
    else{await shell.openExternal(PAGINA_RELEASES);return {ok:true,tipo:"descarregar"};}
    return {ok:true,tipo:pendente.tipo,versao:pendente.m.versao};
  }catch(err){return {ok:false,erro:String(err&&err.message||err)};}
});
ipcMain.handle("atualizacoes-concluir",()=>{
  if(!pendente)return false;
  const tipo=pendente.tipo;pendente=null;
  if(tipo==="programa"&&programaPronto){
    aSair=true;
    /* instalador silencioso e a aplicação volta a abrir sozinha */
    setImmediate(()=>obterAtualizador().quitAndInstall(true,true));
    return true;
  }
  if(tipo==="pagina"){
    const html=htmlAtual();
    if(janelaPalco&&!janelaPalco.isDestroyed())janelaPalco.loadFile(html,{hash:"palco"});
    if(janelaPrincipal&&!janelaPrincipal.isDestroyed())janelaPrincipal.loadFile(html);
    return true;
  }
  return false;
});

/* O motor gráfico (backend ANGLE) escolhe-se nas Definições e aplica-se ao
   arrancar: em alguns portáteis o Direct3D 11 dá a cada uma de duas janelas
   um vsync sim, outro não — trinta frames por janela, por mais leve que seja
   a cena; o Vulkan e o Direct3D 9 não. Sem escolha, fica o do Chromium. */
{
  const motor=lerDefs().motor;
  if(["vulkan","d3d9","gl","d3d11"].includes(motor))app.commandLine.appendSwitch("use-angle",motor);
}

/* ---------- ciclo de vida ---------- */
if(!app.requestSingleInstanceLock()){app.quit();}
else{
  app.on("second-instance",()=>{if(janelaPrincipal){if(janelaPrincipal.isMinimized())janelaPrincipal.restore();janelaPrincipal.focus();}});
  app.whenReady().then(()=>{
    garantePasta();
    limparPaginaVelha();
    criaPrincipal();
    const avisaEcras=()=>{
      if(janelaPrincipal&&!janelaPrincipal.isDestroyed())
        janelaPrincipal.webContents.send("ecras-mudaram",screen.getAllDisplays().length);
    };
    screen.on("display-added",avisaEcras);
    screen.on("display-removed",()=>{
      /* o monitor do palco foi-se: o palco vai com ele, e o principal fica a saber */
      if(janelaPalco&&!janelaPalco.isDestroyed()&&screen.getAllDisplays().length<2)fechaPalco();
      avisaEcras();
    });
    app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)criaPrincipal();});
  });
  app.on("window-all-closed",()=>{app.quit();});
}

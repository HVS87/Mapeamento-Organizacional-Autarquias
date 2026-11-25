/* QA — a estrutura: barra superior, navegação lateral, Criar, Vista, perfil,
   definições rápidas, camadas, janela do palco, vocabulário e movimento.
   Corre na página instrumentada: await window.__QA_ESTRUTURA()
   Repõe o projeto e as escolhas deste aparelho no fim. */
window.__QA_ESTRUTURA = async function(){
  const F = window.__F, g = n => F.get(n), run = n => F.run(n);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
  const click = el => { if (!el) throw new Error("sem elemento"); el.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true})); };
  const vis = e => { if (!e) return false; const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const ok = [], falhas = [], t0 = performance.now(), errs0 = (window.__errs || []).length;
  const t = async (nome, fn) => { try { const v = await fn(); if (v === false) falhas.push(nome); else ok.push(nome); } catch(e){ falhas.push(nome + ": " + (e && e.message || e)); } };
  const snap0 = run("snapshotState")();
  const CH = ["of.nav.v1", "of.densidade.v1", "of.perfil.v1", "of.a11y.cores.v1"];
  const ls = {}; CH.forEach(k => { ls[k] = localStorage.getItem(k); });
  const tema0 = g("themeId"), fs0 = g("fontScale");
  const fone = document.body.classList.contains("vp-phone");
  const itens = () => qa(".menu-pop button .mt").map(e => e.textContent);
  const escolhe = rot => click(qa(".menu-pop button").find(b => b.querySelector(".mt").textContent === rot));
  try {
    try { q("#coachDone").click(); } catch(e){}
    run("setTab")("home"); await sleep(80);
    /* ---- barra superior ---- */
    await t("barra superior: menu, procura e perfil à vista", () => ["#navBtn", "#buscaBtn", "#perfilBtn"].every(s => vis(q(s))));
    if (!fone) await t("barra superior: nome, anular, refazer, ajuda e definições rápidas", () => ["#orgName", "#undoBtn", "#redoBtn", "#helpBtn", "#rapidasBtn"].every(s => vis(q(s)) && q("header").contains(q(s))));
    await t("barra superior: baixa", () => q("header").getBoundingClientRect().height <= 66);
    click(q("#buscaBtn")); await sleep(120);
    await t("a procura abre a paleta", () => q("#palette").classList.contains("open") || vis(q("#palette")));
    try { run("closePalette")(); } catch(e){ document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true})); }
    await sleep(60);
    /* ---- navegação ---- */
    await t("navegação: onze destinos, com «Início» em português", () => qa("#tabbar .tab").length === 11 && q('#tabbar .tab[data-tab="home"]').textContent.trim() === "Início");
    await t("navegação: sem «Home» nem nomes antigos nos destinos", () => !/Home|Nódulos|Agentes/.test(q("#tabbar").textContent) && /Unidades/.test(q("#tabbar").textContent) && /Pessoas/.test(q("#tabbar").textContent));
    if (!fone){
      const estava = document.body.classList.contains("nav-fina");
      click(q("#navBtn")); await sleep(40);
      await t("navegação: recolhe para uma calha e lembra-se", () => document.body.classList.contains("nav-fina") !== estava && !!localStorage.getItem("of.nav.v1"));
      click(q("#navBtn")); await sleep(40);
      await t("navegação: volta ao que era", () => document.body.classList.contains("nav-fina") === estava);
      run("setTab")("tarefas"); await sleep(320);
      await t("navegação: o indicador acompanha o separador", () => { const on = q("#tabbar .tab.on"), i = q("#navInd"); return on.dataset.tab === "tarefas" && i.style.transform.includes("," + on.offsetTop + "px") && parseFloat(i.style.width) === on.offsetWidth; });
      run("setTab")("home"); await sleep(60);
    } else {
      await t("telemóvel: barra inferior com cinco destinos e botão de criar", () => qa("#barraBaixo button").length === 5 && vis(q("#fabCriar")));
      click(q("#navBtn")); await sleep(60);
      await t("telemóvel: a gaveta abre com o resto (nome, anular, ajuda)", () => document.body.classList.contains("nav-aberta") && q("#navExtra").contains(q("#orgName")) && q("#navExtra").contains(q("#undoBtn")));
      click(q("#navScrim")); await sleep(60);
      await t("telemóvel: tocar fora fecha a gaveta", () => !document.body.classList.contains("nav-aberta"));
      click(qa("#barraBaixo button")[2]); await sleep(120);
      await t("telemóvel: a barra inferior muda de página", () => document.body.dataset.tab === "tarefas" && qa("#barraBaixo button")[2].classList.contains("on"));
      run("setTab")("home"); await sleep(60);
    }
    /* ---- procedimentos à vista ---- */
    const p0 = g("processes")[0], v0 = !!p0._visible;
    if (!fone || true){
      await t("procedimentos à vista: uma caixa por procedimento", () => qa("#navProcs .nav-proc").length === g("processes").length);
      click(qa("#navProcs .nav-proc")[0]); await sleep(60);
      await t("procedimentos à vista: a caixa mostra e esconde no palco", () => !!p0._visible !== v0 && qa("#navProcs .nav-proc")[0].classList.contains("on") === !!p0._visible);
      click(qa("#navProcs .nav-proc")[0]); await sleep(60);
    }
    /* ---- Criar ---- */
    const ancoraCriar = fone ? q("#fabCriar") : q("#criarBtn");
    click(ancoraCriar); await sleep(60);
    await t("Criar: um menu com tudo o que se pode criar", () => { const i = itens(); return ["Unidade", "Pessoa", "Procedimento", "Tarefa", "Objeto", "Repositório", "Pelouro", "Grupo de procedimentos"].every(x => i.includes(x)); });
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true})); await sleep(40);
    await t("Criar: Esc fecha o menu", () => !q(".menu-pop"));
    const nObj = g("objetos").length;
    click(ancoraCriar); await sleep(40); escolhe("Objeto"); await sleep(120);
    await t("Criar › Objeto: cria, abre a página e a ficha", () => g("objetos").length === nObj + 1 && document.body.dataset.tab === "objetos" && g("selected") && g("selected").type === "objeto");
    const nProc = g("processes").length;
    click(ancoraCriar); await sleep(40); escolhe("Procedimento"); await sleep(150);
    await t("Criar › Procedimento: cria e abre o fluxograma", () => g("processes").length === nProc + 1 && g("modal").classList.contains("open"));
    run("closeModalSilent")();
    click(ancoraCriar); await sleep(40); escolhe("Tarefa"); await sleep(150);
    await t("Criar › Tarefa: pergunta em que procedimento", () => q("#optDialog").classList.contains("open") && /Em que procedimento/.test(q("#optDialog").textContent));
    run("fechaOpcoes")("__nao"); await sleep(60);
    click(ancoraCriar); await sleep(40); escolhe("Unidade"); await sleep(260);
    await t("Criar › Unidade: leva à página das unidades", () => document.body.dataset.tab === "nodulos");
    try { run("fechaOpcoes")(null); run("closeModalSilent")(); } catch(e){}
    run("clearSelection")(); run("setTab")("home"); await sleep(80);
    /* ---- Vista e ferramentas ---- */
    click(q("#vistaBtn")); await sleep(60);
    await t("Vista: rede 3D, organograma, fluxogramas e as seis vistas", () => { const i = itens(); return i.includes("Rede 3D") && i.includes("Organograma") && i.includes("Fluxogramas") && i.includes("Estado da rede") && g("VIEWS").every(v => i.includes(v.t)); });
    escolhe("Organograma"); await sleep(200);
    await t("Vista › Organograma abre-o", () => document.body.classList.contains("page-org") || g("modal").classList.contains("open"));
    run("setTab")("home"); await sleep(80);
    await t("ferramentas do palco: as mesmas de sempre, numa coluna", () => ["linkBtn", "contBtn", "healthBtn", "resetViewBtn", "peekBtn", "presentBtn", "fsBtn", "palcoBtn", "snapBtn"].every(id => q("#ferramentas").contains(q("#" + id))) && ["orgChartBtn", "flowIndexBtn", "viewsBtn"].every(id => !!q("#" + id)));
    await t("ferramentas do palco: todas com nome para leitores de ecrã", () => qa("#ferramentas .btn").every(b => (b.getAttribute("aria-label") || b.title || "").length > 3));
    click(q("#camadasBtn")); await sleep(80);
    await t("camadas: abre a legenda e os procedimentos sobre o palco", () => vis(q("#panel")) && vis(q("#secLegenda")) && vis(q("#secProc")) && !vis(q("#secDefinicoes")));
    click(q("#camadasBtn")); await sleep(60);
    await t("camadas: fecha", () => !vis(q("#panel")));
    /* ---- janela do palco ---- */
    await sleep(700);
    await t("janela do palco: a câmara encolhe e centra-se na parte livre", () => { const c = g("camera"); return c.zoom < 1 && c.zoom > 0.45 && c.view && c.view.enabled && (fone ? Math.abs(c.view.offsetX) < 1 : c.view.offsetX < -10); });
    await t("janela do palco: a moldura não apanha cliques", () => getComputedStyle(q("#janela")).pointerEvents === "none");
    /* ---- perfil ---- */
    click(q("#perfilBtn")); await sleep(60);
    const pres = run("presidente")();
    await t("perfil: mostra quem está a usar e deixa trocar", () => q("#perfilBtn").textContent === "SA" && itens().includes("Systems Admin") && itens().includes(pres.name));
    escolhe(pres.name); await sleep(80);
    await t("perfil: trocar muda as iniciais e a credencial em vigor", () => q("#perfilBtn").textContent !== "SA" && g("perfil").id === pres.id && run("credAtual")() === run("credDe")(pres));
    click(q("#perfilBtn")); await sleep(40); escolhe("Systems Admin"); await sleep(60);
    await t("perfil: voltar a Systems Admin", () => q("#perfilBtn").textContent === "SA" && g("perfil").tipo === "admin");
    /* ---- definições rápidas ---- */
    if (!fone){
      click(q("#rapidasBtn")); await sleep(80);
      await t("definições rápidas: tema, visão das cores, densidade, texto", () => q("#rapidas").classList.contains("aberta") && qa("#rapidas .tema-cartao").length === 7 && qa("#rapidas .segmentos").length === 3);
      click(q('#rapidas .tema-cartao[data-tema="calcada"]')); await sleep(60);
      await t("definições rápidas: mudar de tema", () => g("themeId") === "calcada" && q('#rapidas .tema-cartao[data-tema="calcada"]').classList.contains("on"));
      click(qa("#rapidas .segmentos")[1].querySelectorAll("button")[1]); await sleep(40);
      await t("definições rápidas: densidade compacta", () => document.body.classList.contains("densa") && localStorage.getItem("of.densidade.v1") === "compacta");
      click(qa("#rapidas .segmentos")[1].querySelectorAll("button")[0]); await sleep(40);
      click(qa("#rapidas .segmentos")[2].querySelectorAll("button")[2]); await sleep(40);
      await t("definições rápidas: texto maior", () => g("fontScale") === fs0 + 10);
      run("applyFontScale")(fs0);
      document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true})); await sleep(60);
      await t("definições rápidas: Esc fecha", () => !q("#rapidas").classList.contains("aberta"));
      run("applyTheme")(tema0);
    }
    /* ---- páginas ---- */
    run("setTab")("definicoes"); await sleep(120);
    await t("Definições: índice com todas as secções", () => { const i = qa("#defIndice .chip").map(c => c.textContent); return i.includes("Sincronizar dispositivos") && i.includes("Acessibilidade") && i.includes("Privacidade") && i.length >= 10; });
    run("setTab")("objetos"); await sleep(100);
    const semObj = g("objetos").length === 0;
    if (semObj) await t("Objetos vazio: um convite com botão", () => !!q("#pageBody .vazio .btn.primary"));
    run("setTab")("dados"); await sleep(80);
    await t("Dados: «Nova rede» distingue-se como ação que apaga", () => q("#newDatasetBtn").classList.contains("perigo"));
    run("setTab")("tarefas"); await sleep(300);
    await t("Tarefas: a duração não repete a unidade", () => qa("#pageBody .task-row .t-route").every(e => !/dias? dias?/.test(e.textContent)));
    const linha = q("#pageBody .task-row");
    linha.dispatchEvent(new PointerEvent("pointerdown", {bubbles: true})); click(linha); await sleep(120);
    await t("lista → ficha: abre a ficha da tarefa", () => g("selected") && g("selected").type === "task" && vis(q("#detail")));
    run("clearSelection")();
    run("flash")("Aviso de teste"); await sleep(120);
    await t("avisos: nascem em baixo", () => { const b = q("#toasts .toast"); return b && b.getBoundingClientRect().top > innerHeight * 0.55; });
    /* ---- vocabulário e regras ---- */
    const maus = [];
    for (const tab of ["home", "nodulos", "agentes", "tarefas", "procedimentos", "pelouros", "objetos", "repositorios", "dados", "definicoes"]){
      run("setTab")(tab); await sleep(tab === "tarefas" ? 250 : 60);
      const txt = document.body.innerText;
      const m = txt.match(/n[óÓ]dulos?|\bagentes?\b/i);
      if (m) maus.push(tab + ": «" + m[0] + "»");
    }
    run("setTab")("home");
    run("selectNode")(g("nodes")[3]); await sleep(80);
    if (/n[óÓ]dulo|\bagente/i.test(q("#detail").innerText)) maus.push("ficha da unidade");
    run("selectAgent")(g("agents")[0]); await sleep(80);
    if (/n[óÓ]dulo|\bagente/i.test(q("#detail").innerText)) maus.push("ficha da pessoa");
    run("clearSelection")();
    await t("vocabulário: unidades e pessoas em todo o lado", () => { if (maus.length) throw new Error(maus.join(", ")); return true; });
    await t("sem maiúsculas forçadas nos rótulos à vista", () => qa("#tabbar *,header *,#pageBody .mini-title,summary").filter(vis).every(e => getComputedStyle(e).textTransform !== "uppercase"));
    await t("o segundo ecrã não leva a estrutura", () => /body\.palco #janela\{display:none\}/.test(document.documentElement.innerHTML));
  } finally {
    try { run("fechaOpcoes")(null); run("closeModalSilent")(); run("closePage")(); run("clearSelection")(); } catch(e){}
    document.querySelectorAll(".menu-pop").forEach(m => m.remove());
    CH.forEach(k => { if (ls[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, ls[k]); });
    F.set("perfil", {tipo: "admin", id: null});
    run("applyTheme")(tema0, {silent: true}); run("applyFontScale")(fs0);
    document.body.classList.toggle("nav-fina", localStorage.getItem("of.nav.v1") === "fina" || (!localStorage.getItem("of.nav.v1") && innerWidth < 1180));
    document.body.classList.remove("densa", "camadas", "nav-aberta");
    run("restoreState")(snap0); run("clearDirty")(); run("setTab")("home");
  }
  return {suite: "estrutura", ok: ok.length, falhas, errs: (window.__errs || []).slice(errs0), tempo: Math.round(performance.now() - t0) + " ms"};
};

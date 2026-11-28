/* QA — Atualizações.
   Corre dentro da página instrumentada (qa/build/qa.html, qa-desktop.html,
   ou a aplicação de secretária real):
     await window.__QA_ATUALIZAR()
   1. Definições › Atualizações: versão, botão, interruptor ligado por omissão
      e que se lembra, entrada no índice
   2. comparar versões
   3. procurar: está atual, há versão nova (aviso e pergunta), erro
   4. antes de recarregar: autosave já gravado, marca com a versão e o estado
      das alterações por guardar, rascunho aplicado
   5. ao arrancar: com a marca ou com a sincronização ligada, o último estado
      volta sem perguntar; sem nenhuma das duas, nada muda
   6. a sincronização não toma o projeto de exemplo por alterações novas
   7. fechar a página com um autosave pendente grava-o
   8. (versão web) o versao.json servido diz a versão da página
   Devolve {ok, falhas, errs, tempo}. Repõe o projeto, o armazenamento e as
   funções trocadas. */
window.__QA_ATUALIZAR = async function(){
  const F = window.__F, g = n => F.get(n), run = n => F.run(n);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const q = s => document.querySelector(s);
  const ok = [], falhas = [], t0 = performance.now(), errs0 = (window.__errs || []).length;
  const t = async (nome, fn) => { try { const v = await fn(); if (v === false) falhas.push(nome); else ok.push(nome); } catch(e){ falhas.push(nome + ": " + (e && e.message || e)); } };
  const esperar = async (cond, ms) => { const fim = Date.now() + (ms || 4000); while (Date.now() < fim){ try { if (await cond()) return true; } catch(e){} await sleep(50); } return false; };
  const ultimoAviso = () => { const l = [...document.querySelectorAll(".toast .tmsg")]; return l.length ? l[l.length - 1].textContent : ""; };

  /* ---------- o que se repõe no fim ---------- */
  const CHAVES = ["of.atualizacoes.v1", "of.atualizacoes.feita.v1", "of.autosave.v1", "of.sinc.v1", "of.sinc.versoes.v1"];
  const lsAntes = {}; CHAVES.forEach(k => { lsAntes[k] = localStorage.getItem(k); });
  const snap0 = run("snapshotState")();
  const dirty0 = g("dirty"), org0 = g("orgName");
  const orig = {procurarVersaoNova: g("procurarVersaoNova"), recarregarParaAtualizar: g("recarregarParaAtualizar")};
  const sincAntes = g("SINC");
  if (sincAntes) run("sincParar")();
  const desktop = !!g("ehDesktop");
  /* na aplicação de secretária real, a ponte é a verdadeira: aí não se troca nada nela */
  const ponteTrocavel = desktop && !!window.__D;   // qa-desktop.html: a ponte de faz-de-conta
  let recarregou = 0;
  F.set("recarregarParaAtualizar", async () => { recarregou++; });

  try {
  /* ---------- 1. Definições ---------- */
  localStorage.removeItem("of.atualizacoes.v1");
  F.set("atualizUltima", null);
  run("renderAtualizRow")();
  await t("título «Atualizações» nas Definições", () => q("#atualizTitulo") && q("#atualizTitulo").textContent.trim() === "Atualizações");
  await t("versão à vista", () => q("#atualizRow").textContent.indexOf("Versão " + g("VERSAO_APP")) >= 0);
  await t("versão no formato x.y.z", () => /^\d+\.\d+\.\d+$/.test(g("VERSAO_APP")));
  await t("botão «Procurar atualizações»", () => q("#procurarAtualizBtn") && q("#procurarAtualizBtn").textContent === "Procurar atualizações" && !q("#procurarAtualizBtn").disabled);
  const sw = () => q("#atualizAutoSw");
  await t("«Procurar sempre atualizações ao iniciar» ligado por omissão", () => sw() && sw().getAttribute("role") === "switch" && sw().getAttribute("aria-checked") === "true" && sw().classList.contains("on") && run("atualizPrefs")().auto === true);
  await t("o interruptor tem nome acessível", () => sw().getAttribute("aria-label") === "Procurar sempre atualizações ao iniciar");
  sw().click();
  await t("desligar fica guardado", () => sw().getAttribute("aria-checked") === "false" && JSON.parse(localStorage.getItem("of.atualizacoes.v1")).auto === false && run("atualizPrefs")().auto === false);
  sw().click();
  await t("voltar a ligar fica guardado", () => sw().getAttribute("aria-checked") === "true" && JSON.parse(localStorage.getItem("of.atualizacoes.v1")).auto === true);
  await t("sem verificação, o estado di-lo", () => /Ainda não se procurou/.test(q("#atualizEstado").textContent));
  await t("Atualizações no índice das Definições", async () => {
    run("setTab")("definicoes"); await sleep(250);
    const ind = q("#defIndice");
    const r = !!ind && [...ind.querySelectorAll(".chip")].some(b => b.textContent === "Atualizações");
    run("setTab")("home"); await sleep(80);
    return r;
  });

  /* as perguntas ficam por cima da visita de boas-vindas (que abre sozinha
     na primeira utilização, ao mesmo tempo que podem chegar perguntas) */
  {
    const coach = q("#coach"), estava = coach.classList.contains("open");
    const noTopo = b => { const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === b || b.contains(e); };
    coach.classList.add("open");
    const po = run("askOpcoes")("Teste", "por cima da visita?", [{k: "a", label: "Fica por cima"}]);
    await sleep(80);
    const bo = q("#odBtns button");
    await t("a janela de opções fica por cima da visita de boas-vindas", () => noTopo(bo));
    bo.click(); await po;
    const pc = run("askConfirm")("Por cima da visita?", {yes: "Sim"});
    await sleep(80);
    const bc = q("#confirmYes") || [...q("#confirm").querySelectorAll("button")].find(b => b.textContent === "Sim");
    await t("a confirmação fica por cima da visita de boas-vindas", () => noTopo(bc));
    bc.click(); await pc;
    await t("a visita continua lá depois da pergunta", () => coach.classList.contains("open"));
    if (!estava) coach.classList.remove("open");
  }

  /* ---------- 2. comparar versões ---------- */
  const cmp = run("compararVersoesApp");
  await t("comparar versões", () => cmp("1.1.0", "1.0.9") === 1 && cmp("1.0.10", "1.0.9") === 1 && cmp("2.0.0", "10.0.0") === -1 && cmp("1.1.0", "1.1.0") === 0 && cmp("0.9.9", "1.0.0") === -1);

  /* ---------- 3. procurar ---------- */
  const v = g("VERSAO_APP");
  F.set("procurarVersaoNova", async () => ({tipo: "atual", versao: v, atual: v, novidades: []}));
  let r = await run("procurarAtualizacoes")(true);
  await t("atual: diz que está na versão mais recente", () => r.tipo === "atual" && /Está na versão mais recente/.test(ultimoAviso()));
  await t("atual: fica registada a verificação", () => { const p = run("atualizPrefs")(); return p.resultado === "atual" && Date.now() - p.verificada < 5000 && /está na versão mais recente/.test(q("#atualizEstado").textContent); });
  await t("atual: sem botão de atualizar", () => !q("#atualizAgoraBtn"));

  const nova = {tipo: "pagina", versao: "99.0.0", atual: v, novidades: ["Coisa nova: com pormenor.", "Outra coisa"]};
  F.set("procurarVersaoNova", async () => nova);
  r = await run("procurarAtualizacoes")(false);
  await t("ao arrancar, versão nova: aviso com «Atualizar»", () => r.tipo === "pagina" && /Há uma versão nova: 99\.0\.0/.test(ultimoAviso()) &&
    [...document.querySelectorAll(".toast")].some(x => /99\.0\.0/.test(x.textContent) && [...x.querySelectorAll(".tacts button")].some(b => b.textContent === "Atualizar")));
  await t("versão nova: botão «Atualizar para a versão 99.0.0» nas Definições", () => q("#atualizAgoraBtn") && /99\.0\.0/.test(q("#atualizAgoraBtn").textContent));
  await t("versão nova: estado registado", () => run("atualizPrefs")().resultado === "nova:99.0.0");
  run("fecharAviso")("atualiz");
  /* manual: pergunta, e «Mais tarde» não mexe em nada */
  const pr = run("procurarAtualizacoes")(true);
  await t("manual, versão nova: pergunta com as novidades", async () => {
    const aberto = await esperar(() => q("#optDialog.open, .open #odTitle") || (q("#odTitle") && /99\.0\.0/.test(q("#odTitle").textContent) && q("#odBtns button")));
    return aberto && /Versão 99\.0\.0 disponível/.test(q("#odTitle").textContent) && /Coisa nova/.test(q("#odSub").textContent) && !/pormenor/.test(q("#odSub").textContent) &&
      /mantêm-se/.test(q("#odSub").textContent) && [...q("#odBtns").querySelectorAll("button")].map(b => b.textContent).join("|") === "Atualizar agora|Mais tarde";
  });
  [...q("#odBtns").querySelectorAll("button")].find(b => b.textContent === "Mais tarde").click();
  await pr;
  await t("«Mais tarde»: nada recarregado nem marcado", () => recarregou === 0 && !localStorage.getItem("of.atualizacoes.feita.v1"));
  const desc = {tipo: "descarregar", versao: "99.0.0", atual: v, novidades: []};
  F.set("procurarVersaoNova", async () => desc);
  const pd = run("procurarAtualizacoes")(true);
  await t("programa antigo: oferece a página de download", async () => {
    await esperar(() => q("#odBtns button") && /download/.test(q("#odBtns").textContent));
    return /programa mais recente/.test(q("#odSub").textContent) && [...q("#odBtns").querySelectorAll("button")][0].textContent === "Abrir a página de download";
  });
  [...q("#odBtns").querySelectorAll("button")].find(b => b.textContent === "Mais tarde").click();
  await pd;
  F.set("procurarVersaoNova", async () => { throw new Error("rede em baixo"); });
  r = await run("procurarAtualizacoes")(true);
  await t("erro: diz porquê, e fica registado", () => r.tipo === "erro" && /Não foi possível procurar atualizações: rede em baixo/.test(ultimoAviso()) && run("atualizPrefs")().resultado === "erro");
  F.set("procurarVersaoNova", orig.procurarVersaoNova);
  F.set("atualizUltima", null);

  /* ---------- 4. antes de recarregar ---------- */
  F.set("orgName", "Município de Teste das Atualizações");
  run("markDirty")();
  run("scheduleAutosave")();
  await run("guardarTudoAntesDeAtualizar")("99.0.0");
  await t("o autosave grava já, sem esperar", () => { const a = JSON.parse(localStorage.getItem("of.autosave.v1")); return JSON.parse(a.state).orgName === "Município de Teste das Atualizações" && g("autosaveTimer") === null; });
  await t("fica a marca da atualização", () => { const m = JSON.parse(localStorage.getItem("of.atualizacoes.feita.v1")); return m.para === "99.0.0" && m.de === v && m.dirty === true; });
  if (desktop && !ponteTrocavel){
    /* a ponte real, sem procura antes: recusa, e nada recarrega */
    localStorage.removeItem("of.atualizacoes.feita.v1");
    const a = await run("aplicarAtualizacao")({tipo: "pagina", versao: "99.0.0"});
    await t("aplicação real sem procura: recusa sem mexer em nada", () => a === false && recarregou === 0 && !localStorage.getItem("of.atualizacoes.feita.v1") && /não foi feita/.test(ultimoAviso()));
  } else {
    localStorage.removeItem("of.atualizacoes.feita.v1");
    if (desktop){ window.__D.aplicar = {ok: true, tipo: "pagina", versao: "99.0.0"}; }
    const a = await run("aplicarAtualizacao")({tipo: "pagina", versao: "99.0.0"});
    await t("atualizar: grava, marca e recarrega", () => a === true && recarregou === 1 && JSON.parse(localStorage.getItem("of.atualizacoes.feita.v1")).para === "99.0.0" && !g("atualizEmCurso"));
    if (desktop){
      window.__D.aplicar = {ok: false, erro: "o ficheiro descarregado não confere — nada foi alterado"};
      localStorage.removeItem("of.atualizacoes.feita.v1");
      const b = await run("aplicarAtualizacao")({tipo: "pagina", versao: "99.0.0"});
      await t("descarga que não confere: diz porquê e não recarrega", () => b === false && recarregou === 1 && /não confere/.test(ultimoAviso()) && !localStorage.getItem("of.atualizacoes.feita.v1"));
      window.__D.aplicar = {ok: true, tipo: "descarregar"};
      const c = await run("aplicarAtualizacao")({tipo: "descarregar", versao: "99.0.0"});
      await t("programa antigo: abre a página de download e não recarrega", () => c === true && recarregou === 1 && /download/.test(ultimoAviso()));
      delete window.__D.aplicar;
    }
  }

  /* ---------- 5. ao arrancar ---------- */
  const estadoA = run("snapshotState")();
  run("gravarAutosaveJa")();
  const exemplo = JSON.parse(estadoA); exemplo.orgName = "Junta de Freguesia de Exemplo";
  const porExemplo = () => { run("restoreState")(JSON.stringify(exemplo)); F.set("orgName", exemplo.orgName); F.set("repostoNoArranque", false); };
  porExemplo();
  localStorage.removeItem("of.atualizacoes.feita.v1"); localStorage.removeItem("of.sinc.v1");
  await t("sem marca nem sincronização: o arranque não mexe", () => run("reporAoArrancar")() === false && g("orgName") === "Junta de Freguesia de Exemplo");
  localStorage.setItem("of.atualizacoes.feita.v1", JSON.stringify({de: "1.0.0", para: v, dirty: true, em: Date.now()}));
  F.set("dirty", false);
  await t("depois de atualizar: o último estado volta sem perguntar", () => run("reporAoArrancar")() === true && g("orgName") === "Município de Teste das Atualizações" && g("repostoNoArranque") === true);
  await t("depois de atualizar: a marca sai, as alterações por guardar ficam", () => !localStorage.getItem("of.atualizacoes.feita.v1") && g("dirty") === true);
  await t("depois de atualizar: anular não volta ao exemplo", () => g("undoStack").length === 0 && g("lastSnap") === run("snapshotState")());
  await t("depois de atualizar: avisa que atualizou", async () => esperar(() => /Atualizado para a versão/.test(ultimoAviso()), 3000));
  await t("depois de atualizar: não oferece recuperar a sessão", () => { run("offerSessionRestore")(); return !/Sessão guardada/.test(ultimoAviso()); });
  porExemplo();
  localStorage.setItem("of.sinc.v1", JSON.stringify({codigo: "ABCDE-FGHJK-MNPQR-STVWX-YZ012"}));
  await t("com a sincronização ligada: o último estado volta ao arrancar", () => run("reporAoArrancar")() === true && g("orgName") === "Município de Teste das Atualizações");
  localStorage.removeItem("of.sinc.v1");
  porExemplo();
  localStorage.setItem("of.atualizacoes.feita.v1", JSON.stringify({de: "1.0.0", para: "99.0.0", em: Date.now()}));
  run("reporAoArrancar")();
  await t("a versão nova ainda não chegou: diz para tentar daqui a pouco", async () => esperar(() => /ainda está a chegar/.test(ultimoAviso()), 3000));

  /* ---------- 6. a sincronização e o arranque ---------- */
  const {chave} = await run("sincChaves")(run("codigoNovo")());
  let V = {}; const meta = {};
  const motor = run("criarSinc")({chave, eu: {id: "qa-atualizar", nome: "QA"},
    transporte: {publicarEstado: async () => {}, publicarTexto: async () => {}, escutar: () => () => {}, buscar: async () => []},
    ler: run("sincEstadoLocal"), aplicar: () => {}, vazio: () => false,
    meta: {ler: () => meta, gravar: o => Object.assign(meta, o)},
    versoes: {ler: () => V, gravar: x => { V = x; }}});
  run("restoreState")(estadoA); F.set("orgName", JSON.parse(estadoA).orgName);
  run("gravarAutosaveJa")();
  motor._registar();
  const V1 = JSON.stringify(V);
  /* o arranque: o exemplo em cena, e depois a reposição antes de a sincronização olhar */
  porExemplo();
  localStorage.setItem("of.sinc.v1", JSON.stringify({codigo: "ABCDE-FGHJK-MNPQR-STVWX-YZ012"}));
  run("reporAoArrancar")();
  motor._registar();
  await t("arrancar com a sincronização ligada não regista alterações novas", () => JSON.stringify(V) === V1);
  /* e a prova de que o teste mede alguma coisa: sem a reposição, o exemplo contaria como alteração */
  porExemplo();
  motor._registar();
  await t("(controlo) o exemplo sem reposição contaria como alteração", () => JSON.stringify(V) !== V1 && V.orgName[2] !== JSON.parse(V1).orgName[2]);
  localStorage.removeItem("of.sinc.v1");
  run("restoreState")(snap0);
  await t("guardar e repor dá o mesmo projeto, peça a peça", () => {
    const J = run("jsonEstavel"), L1 = J(run("sincEstadoLocal")());
    run("restoreState")(run("snapshotState")());
    return J(run("sincEstadoLocal")()) === L1;
  });

  /* ---------- 7. fechar a página com um autosave pendente ---------- */
  run("restoreState")(estadoA);
  F.set("orgName", "Gravado ao fechar");
  run("scheduleAutosave")();
  dispatchEvent(new Event("pagehide"));
  await t("fechar a página grava o autosave pendente", () => JSON.parse(JSON.parse(localStorage.getItem("of.autosave.v1")).state).orgName === "Gravado ao fechar" && g("autosaveTimer") === null);

  /* ---------- 8. versão web: o versao.json servido ---------- */
  if (!desktop && location.protocol.indexOf("http") === 0){
    await t("o versao.json publicado diz a versão desta página", async () => {
      const u = new URL("../../versao.json", location.href);
      const j = await (await fetch(u, {cache: "no-store"})).json();
      return j.versao === v && Array.isArray(j.novidades) && j.novidades.length > 0;
    });
  }
  } catch(e){
    falhas.push("exceção: " + (e && e.message || e));
  } finally {
    F.set("procurarVersaoNova", orig.procurarVersaoNova);
    F.set("recarregarParaAtualizar", orig.recarregarParaAtualizar);
    F.set("atualizUltima", null); F.set("repostoNoArranque", false); F.set("atualizEmCurso", false);
    CHAVES.forEach(k => { if (lsAntes[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, lsAntes[k]); });
    run("restoreState")(snap0); F.set("orgName", org0);
    F.set("lastSnap", run("snapshotState")());
    F.set("dirty", dirty0); run("updateDirtyUI")();
    run("renderAtualizRow")();
    run("fecharAviso")("atualiz");
    if (sincAntes) run("sincArrancar")();
  }
  return {ok: ok.length, falhas, errs: (window.__errs || []).slice(errs0), tempo: Math.round(performance.now() - t0)};
};

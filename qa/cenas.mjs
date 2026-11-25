// As cenas que qa/capturas.mjs percorre: cada uma prepara o ecrã (js) e
// espera (ms) antes da captura. Dentro do js há F (o gancho), g, run, q, qa
// e sleep. A ordem conta: cada cena parte do estado que a anterior deixou.
const fecha = "try{run('fechaOpcoes')(null);}catch(e){} try{run('closeModalSilent')();}catch(e){} try{run('closePage')();}catch(e){} try{run('clearSelection')();}catch(e){}";
const pagina = id => ({nome: "pagina-" + id, js: fecha + ";run('setTab')('" + id + "');", espera: 1700});
const vista = id => ({nome: "vista-" + id, js: fecha + ";run('showView')('" + id + "');", espera: 1800});

export default [
  {nome: "boas-vindas", espera: 2200},
  {nome: "inicio", js: "const b=q('#coachDone');if(b)b.click();", espera: 2500},
  {nome: "painel", js: "const p=q('#panel');if(!p.classList.contains('open')){const b=q('#menuBtn');if(b)b.click();}", espera: 700},
  {nome: "nodulo", js: fecha + ";run('selectNode')(g('nodes')[6]);", espera: 1600},
  {nome: "pessoa", js: "run('selectAgent')(g('agents').find(a=>a.primary));", espera: 1200},
  {nome: "tarefa", js: "run('selectTask')(g('processes')[0].tasks[0]);", espera: 1400},
  pagina("nodulos"), pagina("agentes"), pagina("procedimentos"), pagina("tarefas"), pagina("objetos"),
  pagina("pelouros"), pagina("repositorios"), pagina("dados"), pagina("definicoes"),
  {nome: "definicoes-meio", js: "const p=q('#page');p.scrollTop=p.scrollHeight*0.4;g('pageBody').scrollTop=g('pageBody').scrollHeight*0.4;", espera: 400},
  {nome: "definicoes-fim", js: "const p=q('#page');p.scrollTop=p.scrollHeight;g('pageBody').scrollTop=g('pageBody').scrollHeight;", espera: 400},
  {nome: "organograma", js: fecha + ";run('showOrgChart')();", espera: 900},
  {nome: "fluxograma", js: fecha + ";run('showFlowchart')(g('processes')[0]);", espera: 900},
  {nome: "interacoes", js: fecha + ";run('showFeynman')(g('processes')[0]);", espera: 900},
  {nome: "vistas", js: fecha + ";run('showViewGallery')();", espera: 800},
  vista("matrix"), vista("sankey"), vista("mural"), vista("metro"),
  {nome: "estado", js: fecha + ";run('showHealth')();", espera: 800},
  {nome: "paleta", js: fecha + ";run('openPalette')();", espera: 600},
  {nome: "ajuda", js: "try{run('closePalette')();}catch(e){} " + fecha + ";run('openHelp')();", espera: 600},
];

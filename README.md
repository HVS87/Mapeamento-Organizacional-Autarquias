# Mapeamento Organizacional para Autarquias

Uma ferramenta interativa para mapear a estrutura e os procedimentos de uma autarquia portuguesa: a hierarquia (unidades e pessoas) e os fluxos de trabalho (procedimentos e tarefas) no mesmo espaço 3D, com organograma, fluxogramas e listas para trabalhar no dia a dia.

Versão web: https://hvs87.github.io/Mapeamento-Organizacional-Autarquias/

## 🎯 Características

### Uma estrutura simples
- **Barra superior**: menu, nome da organização, procura (unidades, pessoas, tarefas e ações), estado da sincronização, anular e refazer, ajuda, definições rápidas e perfil ativo.
- **Navegação lateral**: «Criar» (unidade, pessoa, procedimento, tarefa, objeto, repositório, pelouro, grupo), os onze destinos e os procedimentos à vista, que se mostram e escondem com uma caixa. Recolhe para uma calha; no telemóvel é uma gaveta, com uma barra inferior de destinos.
- **Conteúdo num cartão**: o palco 3D, com o menu Vista e as ferramentas numa coluna, ou a página do separador escolhido. A ficha do que se escolhe abre numa folha lateral a toda a altura.

### Visualização 3D
- **Rede organizacional em tempo real**: quatro níveis de coordenação em anéis, com cores por ramo
- **Pessoas em órbita**: cada unidade mostra a sua equipa; a dourada é o responsável
- **Tarefas direcionais**: correntes que percorrem cada procedimento da origem ao destino
- **Visita guiada** em oito cenas

### Temas
- **Claro** e **Escuro**: neutros, seguem o sistema
- **Noturno**, **Meia-noite em Lisboa**, **Calçada**, **Verde Institucional** e **Alto Contraste**

Cada tema tinge a mesma estrutura, o céu, o chão e as cores das divisões.

### Gestão de Dados
- **Organograma interativo**: Criar/renomear/reorganizar unidades, mudar níveis, reparentar equipas
- **Equipas e pessoas**: Adicionar pessoas às unidades, designar responsáveis, reatribuir entre estruturas
- **Procedimentos**: Criar tarefas direcionais com descrições, durações, pessoas responsáveis
- **Fluxogramas 2D**: Cada procedimento desdobra-se num fluxograma editável com visualização de cadeias
- **Grupos de procedimentos**: Agrupar tarefas relacionadas em "Grupos de Procedimentos" para melhor navegação

### Governação
- **Pelouros**: o Presidente (ou o Systems Admin) cria, edita e elimina Pelouros; cada um junta unidades raiz e tudo o que está hierarquicamente abaixo, com um responsável do Executivo. Uma unidade pode ser destacado para outro Pelouro. Os procedimentos pertencem ao Pelouro onde têm origem. O organograma mostra o Pelouro de cada braço.
- **Credenciais de segurança** (Consulta · Operacional · Chefia · Direção · Executivo): o Systems Admin define-as; o Presidente altera todas; os membros do Executivo alteram as dos seus Pelouros; uma chefia altera as dos subordinados diretos ou das unidades abaixo se tiver essa permissão, e nunca acima da sua.
- **Objetos**: número, nome, categoria e atributos com texto preditivo, alertas (recorrentes, por procedimento ou por alteração noutro objeto), localização (geográfica, morada ou dentro de outro objeto), associações a objetos e procedimentos, valores com histórico (cobranças, despesas, valor patrimonial), observações, "conta para o inventário", arquivar e eliminar. O que se vê e edita depende da credencial.
- **Validação e prazos de tarefas**: uma tarefa só fica concluída quando o responsável a valida, e só então o procedimento prossegue. Cada tarefa tem um prazo em dias (editável pela chefia com credencial): aviso amarelo "Prazo a vencer" ao aproximar-se, alerta vermelho "Em atraso" ao responsável e à chefia direta quando passa, e de semana em semana o alerta sobe um nível na hierarquia até ao responsável do Pelouro e ao Presidente. Os prazos dos alertas afinam-se em Definições.
- **Objetos em lista ou em mapa 3D**: a lista é uma árvore colapsável e editável (novo objeto, novo objeto dentro do atual, arrastar um objeto para outro para o pôr lá dentro, zona para o tirar de dentro); o mapa 3D mostra a hierarquia em cubos (a organização é de esferas), com as raízes num anel e o que está dentro em volta de quem o contém. Ao arrastar um objeto para outro, o de destino abre-se como uma caixa em flor (quatro pétalas a virar para fora, brilho) e o transportado deposita-se lá dentro; um objeto novo constrói-se no segundo ecrã em cubinhos, camada a camada, à medida que o nome se escreve, e a tampa fecha quando o nome fica; as faces dos cubos vestem-se com o tema (azulejo em Lisboa, cartão na Calçada, madeira no Verde, traço grosso no Contraste, grelha de néon no Noturno).
- **Repositórios**: documentos, multimédia, atas e minutas, com formato, ligação (endereço web ou caminho de rede), data e observações, associados a procedimentos, tarefas, unidades e pessoas, e com credencial mínima de acesso (abaixo dela vê-se que existe, mas não se abre).
- **Perfil ativo** (Definições): escolhe-se quem está a usar a aplicação — o Systems Admin ou uma das pessoas — e tudo o resto respeita a credencial dessa pessoa.

### Sincronizar dispositivos e privacidade
- O mesmo projeto no telemóvel, no tablet e no computador, sem conta: liga-se com um código QR em Definições › Sincronizar dispositivos. O projeto viaja cifrado (AES-GCM 256) por uma caixa de passagem que não o consegue ler; alterações feitas nos dois aparelhos juntam-se peça a peça.
- **Atualizações sem reinstalar** (Definições › Atualizações): «Procurar atualizações» e «Procurar sempre atualizações ao iniciar» (ligado por omissão). A versão nova chega à aplicação de secretária (Windows, Mac, Linux) e à app instalada no telemóvel ou no tablet sem a reinstalar; os dados, as preferências e a ligação de sincronização mantêm-se.
- Esta é uma ferramenta gratuita e sem fins lucrativos. Todos os dados ficam no aparelho; não há contas, publicidade, cookies de terceiros, analytics nem estatísticas de utilização.

### Acessibilidade
- Definições › Acessibilidade: modos para daltonismo (vermelho-verde, azul-amarelo, monocromático) por cima de qualquer tema, tema Alto Contraste, movimento reduzido, foco do teclado reforçado, tamanho do texto.

### Experiência do Utilizador
- **Tour guiado**: Reprodução automática (com ritmo adaptativo) ou navegação manual (←/→ ou clique)
- **Pesquisa em tempo real**: Filtro rápido em todos os separadores (Procedimentos, Unidades, Pessoas, Grupos)
- **Suporte móvel**: Interface responsiva com gaveta lateral e painéis inferiores; controlos otimizados para toque
- **Lembretes de mudanças**: Aviso `beforeunload` se houver alterações não gravadas
- **Exportação/Importação**: Guardar datasets em JSON, partilhar configurações; PDF e apresentações PPTX

### Segurança e Acessibilidade
- `prefers-reduced-motion`: Animações pausam automaticamente para utilizadores com preferências
- `prefers-color-scheme`: Deteta modo claro/escuro do sistema
- Rótulos ARIA e navegação por teclado: ←/→ mudam cenas, Espaço reproduz/pausa a tour
- Tipografia clara (Avenir Next/Segoe UI) com alto contraste em todos os temas

## 🚀 Como Começar

### Uso Online
Abra [a versão web](https://hvs87.github.io/Mapeamento-Organizacional-Autarquias/) e comece imediatamente — não é necessário instalar nada.

### Instalação Local
```bash
git clone https://github.com/HVS87/Mapeamento-Organizacional-Autarquias.git
cd Mapeamento-Organizacional-Autarquias
# Abra network-framework.html num browser moderno (Chrome, Firefox, Safari, Edge)
```

### Instalação como App (PWA)
1. Visite a página no Chrome/Edge (ou similar com suporte PWA)
2. Clique no ícone "Instalar" na barra de endereços
3. A app abre em modo standalone — funciona offline após o primeiro carregamento

### Aplicação de secretária (Windows, Mac, Linux)
A pasta `desktop/` gera a aplicação para Windows (portátil e instalador), Mac (Apple e Intel) e Linux (AppImage e .deb), independente do browser: arranca em ecrã inteiro, estende sozinho o palco 3D para um segundo monitor (mediante confirmação, reversível nas Definições) e guarda os autosaves numa pasta `autosaves/` (na versão portátil do Windows ao lado do executável; no Windows instalado, no Mac e no Linux na pasta do utilizador). Atualiza-se a partir das Definições, sem reinstalar. No telemóvel e no tablet, a versão web instala-se como app (Adicionar ao ecrã principal). Instruções em [DEPLOY.md](DEPLOY.md#aplicação-de-secretária-exe). Os atalhos de teclado remapeiam-se em Definições › Atalhos de teclado.

## 📖 Guia de Utilização

### Exploração 3D
- **Clique + arraste**: Roda a câmara
- **Scroll/Pinch**: Zoom in/out (raio da órbita)
- **Clique numa esfera**: Seleciona a unidade ou a tarefa — abre o painel de edição à direita
- **Espaço**: Reproduz/pausa o tour (quando não está num campo de texto)

### Edição de Dados
1. **Unidades**: Clique em qualquer esfera para renomear, mudar de nível, adicionar/remover pessoas
2. **Tarefas**: Clique num arco para editar as pontas (origem/destino), descrição, responsável, duração
3. **Pessoas**: Atribua a uma unidade ou mude de responsável de uma tarefa
4. **Grupos**: Agrupe procedimentos relacionados e controle a visibilidade em conjunto

### Tour Guiado
- Clique **Play tour** para reprodução automática (ritmo adaptativo por cena)
- Use **←/→** para navegar manualmente entre cenas
- Clique nos pontos (dots) para ir a uma cena específica
- Cada cena realça diferentes aspetos da estrutura

### Exportar & Partilhar
- **Export Dataset**: Guarda toda a configuração como JSON (inclui tema)
- **Export PDF**: Relatório impresso com organograma + fluxogramas
- **Export Presentation**: Slide deck PPTX com overview, estrutura por divisão, e procedimentos

## 🏗️ Arquitetura Técnica

- **Frontend**: JavaScript vanilla + Three.js r128 (3D rendering)
- **Sem dependências externas**: Todos os componentes são auto-contidos (PDF/PPTX via CDN)
- **Single-file artifact**: `network-framework.html` contém toda a lógica, estilos e dados
- **Persistência**: JSON em memória durante a sessão; exportação manual para ficheiros
- **Acesso sem servidor**: Funciona totalmente offline após carregamento inicial

## 📱 Suporte de Navegadores

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Opera 76+
- Requires WebGL support

Mobile:
- iOS Safari 15+ (com limitações de vibração e fullscreen)
- Chrome Android 90+
- Firefox Android 88+

## 🎨 Desenvolvimento & Personalização

O código está organizado em secções:
- **Paletas de cores** (linhas ~110–180): Edite `THEMES` para adicionar novos temas
- **Estrutura de dados** (linhas ~200–300): Seed inicial; edite `nodes`, `agents`, `processes`
- **Renderização 3D** (linhas ~400–1200): Three.js cena, materiais, câmara, iluminação
- **UI panels** (linhas ~1300–3200): Renderização dos separadores e modais
- **Lógica de negócio** (linhas ~3200–3600): Mutações, validação, re-layout

## 📄 Licença

Este projeto é fornecido como-é para uso em administração autárquica portuguesa. Personalize livremente para as suas necessidades.

## 🛠️ Contribuições & Feedback

Têm ideias? Encontraram um bug? Abra uma issue ou enviem um pull request — queremos ouvir!

---

**Desenvolvido para modernizar a administração municipal através de visualização clara e interativa de estruturas e fluxos.**


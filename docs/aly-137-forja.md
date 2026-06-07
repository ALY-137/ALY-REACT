# ALY-137 Forja

ALY-137 e o modulo de portfolio vivo do sistema ALY. Ele transforma cards em provas de trajetoria: habilidades, ferramentas, cursos, servicos e projetos deixam de ser apenas itens visuais e passam a carregar relacoes, XP, poder, rank e origem.

## Ideia central

Cards nao surgem do nada. Eles podem ser encontrados, provados ou forjados.

- `Encontrado`: liberado por QR Code, link, pista ou deck fisico.
- `Provado`: nasce de uma missao, curso, servico, entrega ou evidencia real.
- `Forjado`: nasce da fusao de cards menores e fragmentos.

## Conceitos

- `Add-on`: fragmento anexavel a cards. Pode representar habilidade, ferramenta, linguagem, disciplina, atributo, curso ou conhecimento.
- `Card`: entidade de portfolio. Pode representar projeto, curso, servico, conquista, habilidade composta, sistema ou evidencia.
- `Missao`: atividade que gera prova e XP. Pode vir de estudo, servico, entrega, desafio, conversa ou evento de outro modulo.
- `Poder`: pontuacao de 0 a 100 calculada a partir dos add-ons, XP, evidencias e cards fundidos.
- `Rank`: leitura simples do poder do card.
- `Nivel`: complexidade estrutural do card. Nivel nao e promocao automatica; nivel e composicao.
- `Forja`: processo de combinar cards e fragmentos para criar um card de nivel superior.

## Ativacao no gerenciador de projetos

Add-ons nao pertencem ao ALY-137. Eles sao uma base transversal do sistema.

Chaves de configuracao:

```js
{
  addOnsHabilitados: true,
  blocoAddOnsHabilitado: true,
  aly137Habilitado: true
}
```

- `addOnsHabilitados`: libera a base de add-ons para cards e outros modulos.
- `blocoAddOnsHabilitado`: libera a criacao de blocos do tipo `addons`.
- `aly137Habilitado`: libera as regras especificas da Forja: XP, poder, nivel, fusao, deck, QR e impressao.

O ALY-137 consome cards, add-ons e subobjetos, mas nao deve bloquear o uso desses recursos fora dele.

Os add-ons do projeto ficam no contexto do usuario/projeto, nao no gerenciador global:

```txt
users/{uid}/add_ons/{addOnId}
```

O gerenciador global apenas ativa/desativa a base de add-ons no projeto. A gaveta `ADD-ONS`
aparece no menu do usuario do projeto quando `addOnsHabilitados` esta ativo.

## Regras de XP, nivel e atributos

O ALY-137 usa XP como historico de evidencias. XP nao representa uma verdade absoluta
sobre habilidade; representa progresso registrado e auditavel.

### Atributos fixos

Os atributos iniciais do modulo sao:

- `tecnica`: execucao, implementacao, precisao, correcao e arquitetura.
- `criatividade`: solucao inesperada, estetica, identidade, invencao e combinacao de ideias.
- `impacto`: efeito real causado, alcance, valor entregue, uso, resultado publico.
- `autonomia`: capacidade de avancar, investigar, decidir e concluir sem depender de guia externo.

Analogias narrativas:

- `impacto`: dano fisico, efeito concreto no mundo.
- `criatividade`: dano magico, invencao e percepcao.
- `autonomia`: resistencia/energia de continuar.
- `tecnica`: precisao da ferramenta/arma.

### XP total e atributos

Uma evidencia sempre pode gerar `xpTotal`, mas nao precisa gerar XP por atributo.

```txt
XP total mede progresso geral.
Atributos medem a natureza da evidencia.
```

Exemplo sem atributo:

```js
{
  tipo: "update",
  titulo: "Atualizei a extensao publicada",
  xpTotal: 5,
  atributos: {}
}
```

Exemplo com atributo:

```js
{
  tipo: "resultado_publico",
  titulo: "10K instalacoes na extensao Cyberpink",
  xpTotal: 35,
  atributos: {
    impacto: 35
  }
}
```

Exemplo com mais de um atributo:

```js
{
  tipo: "entrega_tecnica",
  titulo: "Publiquei a extensao e documentei o fluxo",
  xpTotal: 55,
  atributosSelecionados: ["impacto", "tecnica", "autonomia"],
  atributosPesos: {
    impacto: "grande",
    tecnica: "medio",
    autonomia: "pequeno"
  },
  atributos: {
    impacto: 35,
    tecnica: 15,
    autonomia: 5
  }
}
```

Nesse caso o `xpTotal` da evidencia e a soma dos pesos dos atributos selecionados.
Uma mesma prova pode ter impacto grande, tecnica media e autonomia pequena, por
exemplo. Se a evidencia nao tiver atributo, ela usa apenas o peso geral como XP
neutro.

### Peso padrao de evidencia

Cada evidencia tem XP base de `5`.

Multiplicadores:

```txt
peso pequeno = 1x = 5 XP
peso medio   = 3x = 15 XP
peso grande  = 7x = 35 XP
```

O peso geral define o XP de uma evidencia sem atributo. Quando a evidencia possui
atributos, cada atributo tem seu proprio peso e o XP total da evidencia e a soma
do XP desses atributos.

### Evidencia de conclusao de nivel

Uma evidencia pode ser do tipo `conclusao_nivel`.

Ela nao representa uma prova comum de crescimento; representa o fechamento de um
ciclo. Ao ser criada, o sistema calcula automaticamente quanto XP falta para
fechar o marco atual do card e grava esse valor como `xpManual`.

Exemplo:

```txt
Card em formacao: 75 XP
Proximo marco: 100 XP
Evidencia de conclusao: +25 XP
Resultado: 100 XP / Nivel 1
```

Regras:

- nao distribui XP para add-ons por padrao.
- nao distribui XP para atributos por padrao.
- registra `xpCalculadoAutomaticamente: true`.
- registra `conclusaoEtapa`, `nivelAlvo`, `xpAlvo` e `xpAntesConclusao`.
- se o card estiver em formacao, fecha a formacao ate 100 XP.
- se o card estiver no nivel 1, fecha o nivel 1 ate 300 XP, mantendo representacao de nivel 1.
- o card so evolui para o proximo nivel quando novas evidencias ultrapassarem o limite do nivel atual.
- nao deve ser repetida para a mesma etapa e mesmo nivel alvo.

### Regras para add-ons

Add-ons representam ferramentas, linguagens, habilidades, disciplinas ou amplificadores.

Uma evidencia so aumenta XP dos add-ons selecionados nela.

O fato de um card possuir varios add-ons nao significa que todos ganham XP em toda
evidencia. A evidencia precisa indicar explicitamente quais add-ons participaram.

Add-ons usam nivel unico:

```txt
Add-on nivel unico: 0 a 300 XP
100% de consolidacao = 300 XP
```

Ao atingir 300 XP, o add-on pode ser considerado consolidado naquele projeto/usuario.
Isso evita que um unico card forte feche o add-on em 100% cedo demais.

Leitura recomendada:

```txt
0 a 99 XP    = contato / inicio de pratica
100 a 199 XP = uso recorrente
200 a 299 XP = consolidacao avancada
300 XP       = consolidado
```

Essa escala nao altera automaticamente cards antigos. O card continua usando a
curva propria de niveis; o add-on usa porcentagem de consolidacao.

### ChatGPT/Codex como add-on

`ChatGPT/Codex` pode ser cadastrado como:

```txt
tipo: ferramenta
classe: amplificador
atributo principal: autonomia
```

Ele funciona como amplificador de autonomia. Impacto nao deve receber bonus automatico:
impacto depende de entrega real.

### Curva de nivel de cards

Cards usam curva propria:

```txt
Card nivel 1: 100 XP
Card nivel 2: 300 XP
Card nivel 3: 700 XP
```

Leitura recomendada:

```txt
0 a 99 XP    = em formacao / pre-nivel 1
100 a 300 XP = nivel 1
301 a 700 XP = nivel 2
701+ XP      = nivel 3
```

A porcentagem exibida no card representa progresso ate o proximo nivel, nao dominio
absoluto.

### Edicao de evidencias

Uma evidencia pode ser editada.

Ao editar uma evidencia, o XP deve ser recalculado. A edicao nao cria uma nova evidencia
por padrao, mas deve ser auditavel.

Regras:

- editar titulo, peso, atributos ou add-ons selecionados recalcula XP.
- o card relacionado recalcula `xpTotal`, atributos e progresso.
- os add-ons selecionados recalculam XP conforme as evidencias em que aparecem.
- o historico/auditoria deve registrar a alteracao.

## Regra de forja

Forja cria um novo card derivado. Ela nao modifica o card original.

A forja nao funciona pela quantidade de cards:

```txt
card nivel 1 + card nivel 1 != card nivel 2 automaticamente
```

A forja funciona por XP acumulado:

```txt
xpTotalCardForjado =
  soma(xpTotal dos cards usados)
  + xpBonusDaForja opcional
  + xpDeEvidenciasExtras opcional
```

Depois:

```txt
nivelCardForjado = calcularNivel(xpTotalCardForjado)
```

Exemplo:

```txt
Card A: 40 XP
Card B: 35 XP

Novo card forjado: 75 XP
Resultado: ainda em formacao / pre-nivel 1
```

Outro exemplo:

```txt
Card A: 120 XP
Card B: 90 XP

Novo card forjado: 210 XP
Resultado: nivel 1
```

### Materiais disponiveis para forja

Ao abrir a forja, o usuario deve ver:

- cards criados por aquele usuario em espacos relacionados a mesma skin.
- add-ons criados por aquele usuario.
- evidencias disponiveis ou opcao de criar evidencia.

### Inventario visual da forja

A forja possui um inventario visual com miniaturas reais dos materiais:

- cards aparecem como mini-cards, preservando imagem, nome, nivel, XP e subtema.
- add-ons aparecem como chips, preservando icone, nome e subtema.
- o usuario pode clicar ou arrastar cards e chips para a estrutura de forja.
- a estrutura de forja mostra um preview do novo card antes da criacao.
- cards usados como fragmentos permitem selecionar quais add-ons internos entram
  como relacao direta no novo card.
- criar pela forja gera um novo card; os materiais originais nao sao alterados.

Essa interface existe para separar a criacao comum de card da criacao por
composicao. O usuario nao precisa abrir o editor de um card existente para
experimentar combinacoes: ele pode montar primeiro, conferir XP/atributos e so
entao gerar o card final.

No codigo, a interface da forja deve ficar isolada como modulo opcional em:

```txt
src/components/Layout/Modulos/ALY137/Forja/
```

A separacao atual fica assim:

```txt
src/components/Layout/Modulos/ALY137/Forja/Aly137Forja.jsx
src/components/Layout/Modulos/ALY137/Forja/useAly137Forja.js
src/components/Layout/Modulos/ALY137/Forja/aly137ForjaApi.js
```

`Aly137Forja.jsx` controla a tela. `useAly137Forja.js` controla estado,
inventario, selecao de materiais, drag/drop e preview de XP/atributos.
`aly137ForjaApi.js` concentra a criacao persistida do card forjado, incluindo
payload, snapshot ALY-137, atualizacao de XP dos add-ons e auditoria.

A pagina do espaco ainda fornece contexto, referencias e callbacks de bloco,
porque a criacao real do card depende do owner, espaco e estrutura atual do
Firestore. A tela, a logica de interacao e a regra de persistencia da forja nao
devem morar diretamente na estrutura base do espaco. Isso preserva a ideia de
que ALY-137 e um modulo ativavel, nao uma obrigacao de todo projeto que usa
cards.

Partes visuais relacionadas ao card tambem foram separadas de `EspacoPage.jsx`
para reduzir sobrecarga do componente principal:

```txt
src/components/Layout/Espacos/components/AddOnFichaModal.jsx
src/components/Layout/Espacos/components/EditorCardModal.jsx
src/components/Layout/Espacos/components/ForjaPreviewModal.jsx
src/components/Layout/Espacos/components/CardPrintPreviewModal.jsx
```

`CardPrintPreviewModal.jsx` concentra o historico de cards rastreaveis e a
visualizacao frente/verso para impressao, enquanto `EspacoPage.jsx` continua
responsavel por estados, permissoes e chamadas de persistencia.
`EditorCardModal.jsx` concentra o editor visual do card: abas de conteudo,
imagem, add-ons, XP/Forja, rastreabilidade, impressao e preview fixo.

O editor de card foi quebrado por abas para evitar que uma unica janela volte a
virar um componente gigante:

```txt
src/components/Layout/Espacos/components/EditorCardConteudoTab.jsx
src/components/Layout/Espacos/components/EditorCardVisualTab.jsx
src/components/Layout/Espacos/components/EditorCardAddOnsTab.jsx
src/components/Layout/Espacos/components/EditorCardAly137Tab.jsx
src/components/Layout/Espacos/components/EditorCardRastreabilidadeTab.jsx
src/components/Layout/Espacos/components/EditorCardImpressaoTab.jsx
src/components/Layout/Espacos/components/EditorCardPreview.jsx
src/components/Layout/Espacos/components/EditorBlocoCardsModal.jsx
src/components/Layout/Espacos/components/EditorBlocoHeader.jsx
src/components/Layout/Espacos/components/EditorBlocoConfigPanel.jsx
src/components/Layout/Espacos/components/EditorBlocoCardsList.jsx
src/components/Layout/Espacos/components/EditorBlocoAddOnsPanel.jsx
```

`EditorCardModal.jsx` agora funciona como casca/orquestrador: cabecalho, tabs,
layout e rodape. Cada aba cuida apenas do seu painel.
`EditorBlocoCardsModal.jsx` concentra o editor visual de blocos do tipo cards e
add-ons, incluindo reordenacao de cards, cabecalho do bloco e subblocos de
add-ons. As chamadas de persistencia continuam no `EspacoPage.jsx`.
Esse modal tambem foi quebrado em paineis menores: header/acoes rapidas,
configuracao de bloco, lista de cards e subblocos de add-ons.

No editor do card, cards tambem podem aparecer na aba de add-ons como
`Cards como fragmentos`. Essa selecao nao transforma o card em um add-on comum
no banco; ela cria uma relacao de forja/snapshot. Visualmente, o usuario pode
tratar o card como fragmento, mas tecnicamente ele continua sendo card de origem.
Esses cards nao ficam limitados ao espaco atual: a forja pode usar cards de
outros espacos da mesma skin, permitindo que um projeto herde fragmentos de
experiencias publicadas em areas diferentes.

Ao apertar o botao de forja:

- o sistema calcula preview.
- o usuario confirma.
- um novo card e criado a partir dos materiais.
- o novo card recebe XP, nivel e atributos recalculados.
- o novo card herda os add-ons dos cards de origem.
- o novo card soma o XP dos add-ons herdados no resumo da forja.
- o card original continua existindo.

Na pratica, para criar um card de perfil geral, nao e necessario selecionar
manualmente todos os add-ons outra vez. Se os cards de origem ja possuem
`VSCode`, `JSON`, `Criatividade`, `ChatGPT` ou outros add-ons, o card forjado
herda esses fragmentos automaticamente.

Na representacao visual do card, add-ons herdados por cards de origem nao devem
aparecer como icones soltos. Eles continuam contando no calculo de XP, mas sao
representados por um icone padrao de card-fragmento. Ao clicar nesse icone, o
sistema mostra XP, nivel, atributos e add-ons internos daquele card de origem.

Ao relacionar um card-fragmento, o usuario deve escolher quais add-ons daquele
card entram na relacao. O card-fragmento continua contribuindo com XP e
atributos totais, mas somente os add-ons marcados entram como add-ons herdados.
Ao clicar no icone do card-fragmento no card publicado, a ficha mostra somente
os add-ons relacionados naquela forja.

Analogia:

```txt
Forja = commit de evolucao.
Publicar card forjado = push.
Snapshot = registro daquela versao.
```

## Snapshot do card

Todo card criado pela forja deve salvar snapshot completo.

O snapshot protege o historico: se add-ons ou cards antigos evoluirem depois, o card
forjado nao muda sozinho.

Estrutura sugerida:

```js
{
  cardId: "card_cyberpink_137",
  versao: 1,
  criadoPor: "uid_usuario",
  criadoEm: "...",

  origem: {
    tipo: "forja",
    cardsOrigem: [
      {
        cardId: "card_design_grafico",
        nome: "Design grafico",
        xpTotal: 100,
        nivel: 1,
        atributos: {
          tecnica: 20,
          criatividade: 50,
          impacto: 10,
          autonomia: 20
        }
      }
    ],
    addOnsOrigem: [
      {
        addOnId: "vscode",
        nome: "VSCode",
        tipo: "ferramenta",
        xpTotal: 0,
        nivel: "unico",
        atributos: {}
      }
    ],
    evidenciasOrigem: [
      {
        evidenciaId: "ev_10k_instalacoes",
        titulo: "10K de instalacoes",
        peso: "grande",
        xpTotal: 35,
        atributos: {
          impacto: 35
        },
        addOnIds: ["vscode"]
      }
    ]
  },

  resultado: {
    xpTotal: 100,
    nivel: 1,
    progressoNivel: {
      xpAtualNoNivel: 0,
      xpNecessarioProximoNivel: 200,
      percentual: 0
    },
    atributos: {
      tecnica: 0,
      criatividade: 0,
      impacto: 95,
      autonomia: 0
    },
    addOnIds: ["vscode", "json", "criatividade"]
  },

  regrasUsadas: {
    curvaNivelId: "card_padrao_v1",
    xpBaseEvidencia: 5,
    modoCalculo: "soma_xp_total",
    bonusForja: 0
  }
}
```

## Exemplo base: CYBERPINK-137 - Extensao VSCode

Card:

```txt
Nome: CYBERPINK-137 - EXTENSAO VSCODE
Nivel inicial: 1
```

Evidencias:

```txt
10K de instalacoes
Peso: grande
XP: 35
Atributo: impacto

Avaliacao positiva
Peso: medio
XP: 15
Atributo: impacto

Avaliacao positiva
Peso: medio
XP: 15
Atributo: impacto

Avaliacao positiva
Peso: medio
XP: 15
Atributo: impacto

Avaliacao positiva
Peso: medio
XP: 15
Atributo: impacto

Update
Peso: pequeno
XP: 5
Atributo: nenhum
```

Resultado inicial:

```txt
XP total: 100
Impacto: 95
Tecnica: 0
Criatividade: 0
Autonomia: 0
Nivel: 1
```

Add-ons:

```txt
VSCode - ferramenta
JSON - linguagem
Criatividade - habilidade
```

Cards relacionados para forja:

```txt
Design grafico - curso
```

## Exibicao no card

Quando o modulo ALY-137 estiver ativo, o card pode exibir abaixo da descricao:

```txt
XP total: [barra de progresso]
Autonomia: [barra de progresso]
Tecnica: [barra de progresso]
Criatividade: [barra de progresso]
Impacto: [barra de progresso]
```

As barras devem ser discretas para nao poluir o card.

Regra de permissao:

```txt
Qualquer pessoa pode ver resultados da forja, XP e atributos.
Somente usuarios com permissao podem ver auditoria.
```

## Modulos como fontes de XP

Outros modulos do ALY podem alimentar o ALY-137 com eventos.

- `Chat`: conversas, pedidos, atendimento, briefing, suporte.
- `Pagamentos`: venda, compra, assinatura, entrega paga.
- `Acessos`: alcance, visitas, uso real.
- `Projetos`: publicacao, deploy, manutencao, configuracao.
- `Cursos`: estudo, modulo concluido, certificado.

O modulo gera eventos. O ALY-137 transforma eventos em missao, XP, evidencia ou card.

## Modelo inicial de card

```js
{
  nome: "Sistema de Login",
  descricao: "...",
  imagemUrl: "...",

  aly137: {
    ativo: true,
    nivel: 2,
    poder: 68,
    rank: "B",
    xp: 120,
    origem: "forjado",
    addOns: [
      {
        id: "react",
        xp: 4,
        peso: 30,
        tipoRelacao: "ferramenta"
      },
      {
        id: "firebase",
        xp: 3,
        peso: 35,
        tipoRelacao: "infra"
      }
    ],
    cardsFundidos: ["card-login-ui", "card-auth-firebase"],
    missoes: ["missao-login-publicado"],
    evidencias: [
      {
        tipo: "link",
        url: "https://...",
        descricao: "Sistema publicado"
      }
    ]
  }
}
```

## Modelo inicial de add-on

```js
{
  id: "firebase",
  nome: "Firebase",
  tipo: "ferramenta",
  imagemUrl: "...",
  ownerUid: "...",
  publico: false,
  subtemaPadrao: "violet"
}
```

## Blocos de add-ons por subobjetos

Add-ons podem ser apresentados separadamente dos cards usando blocos do tipo `addons`.

Um bloco de add-ons nao armazena novos add-ons como entidades finais. Ele guarda `subObjetos` que referenciam add-ons cadastrados no gerenciador/projeto.

```js
{
  id: "bloco-ferramentas",
  tipo: "addons",
  titulo: "Ferramentas",
  subObjetos: [
    {
      id: "addonRef_firebase",
      tipo: "addonRef",
      refId: "firebase",
      addonId: "firebase",
      ordem: 0,
      visivel: true,
      destaque: false,
      nomeSnapshot: "Firebase",
      imagemSnapshot: "https://...",
      descricaoSnapshot: "Backend, auth e storage",
      subtema: "orange"
    }
  ],
  configAddOns: {
    layout: "grid",
    mostrarNome: true,
    abrirFichaAoClicar: false
  }
}
```

O add-on original continua sendo a fonte principal. O subobjeto controla como aquele add-on aparece naquele bloco: ordem, destaque, subtema e snapshots visuais.

## Modelo inicial de missao

```js
{
  id: "missao-login-publicado",
  nome: "Publicar sistema de login",
  tipo: "projeto",
  status: "concluida",
  xpGerado: 20,
  cardRelacionadoId: "sistema-login",
  addOnsAfetados: ["firebase", "react", "css"],
  evidenciaUrl: "https://...",
  concluidaEm: "2026-04-11T00:00:00.000Z"
}
```

## Deck fisico e QR

O deck e a forma fisica do portfolio.

- Cada card pode ter QR Code.
- QR pode desbloquear card digital.
- Cards desbloqueados entram no inventario.
- Inventario pode liberar receitas de forja.
- Forjar um card pode liberar uma pista para encontrar outro card fisico.

## MVP recomendado

1. Adicionar metadados `aly137` aos cards sem quebrar cards atuais.
2. Permitir definir XP e peso para add-ons no editor de card.
3. Calcular `poder` e `rank` automaticamente.
4. Exibir `nivel`, `poder` e `rank` no card.
5. Criar inventario simples de cards.
6. Criar forja manual: selecionar cards existentes e gerar novo card.
7. Adicionar QR Code/exportacao para deck.

## Estado implementado no sistema

Primeira versao funcional:

1. O card agora pode carregar metadados `aly137`.
2. O editor de card possui a aba `XP / Forja` quando `aly137Habilitado` estiver ativo no projeto.
3. A aba permite criar evidencias com titulo, descricao, pesos por atributo e add-ons afetados.
4. O XP da evidencia segue a regra `5 XP * multiplicador do peso`.
5. Evidencias recalculam XP ao serem editadas.
6. O card exibe XP total, nivel e barras de atributos abaixo da descricao.
7. A forja manual permite selecionar cards de origem e preparar um novo card derivado.
8. O card forjado recebe snapshot dos cards de origem, XP somado e atributos recalculados.
9. O evento de salvar card forjado e auditado como `forjou_card`.
10. O XP consolidado dos add-ons e recalculado a partir das evidencias dos cards e salvo como `aly137Resumo`.
11. Chips e icones de add-ons exibem XP/percentual quando existe resumo ALY-137.
12. Clicar em um add-on abre a ficha do add-on com XP, atributos, cards e evidencias relacionadas.
13. Alteracoes em evidencias sao auditadas como criacao/edicao de evidencias do card.
14. A forja abre um popup de preview antes de criar o novo card, mostrando XP, atributos, cards de origem e add-ons afetados.
15. Cards forjados herdam add-ons dos cards de origem e exibem esses add-ons como herdados no editor.
16. O editor permite criar evidencia de conclusao de nivel, completando automaticamente o XP faltante ate o limite do nivel atual sem promover o card automaticamente.

Ainda pendente para evoluir:

1. Criar inventario/deck dedicado.
2. Criar receitas de forja e desbloqueios por QR.
3. Separar visualmente rank/poder quando a regra sair do modo XP bruto.
4. Criar uma tela dedicada para manutencao massiva de evidencias e resumos de add-ons.

## Frases guia

```txt
Curriculo mostra onde voce chegou.
ALY-137 mostra como voce foi forjado.
```

```txt
Nivel nao e promocao.
Nivel e composicao.
```

```txt
Cards sao obras forjadas por fragmentos de experiencia.
```

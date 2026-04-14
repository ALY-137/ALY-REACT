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

## Regra de nivel

Cards nao mudam de nivel automaticamente.

Um card aumenta `poder`, `xp` e `rank`, mas continua no mesmo nivel. Cards de nivel maior nascem por forja/fusao de cards menores.

Exemplo:

```txt
Card nivel 1: Firebase Auth
Poder: 82
Rank: A

Card nivel 1: Tela de Login
Poder: 74
Rank: B

Forja:
Firebase Auth + Tela de Login = Sistema de Login

Card nivel 2: Sistema de Login
```

## Niveis sugeridos

- `Nivel 1`: fragmento aplicado, habilidade isolada, curso, pequena entrega ou prova simples.
- `Nivel 2`: projeto composto a partir de cards nivel 1 e add-ons proprios.
- `Nivel 3`: sistema formado por projetos compostos, integracoes ou entregas maiores.
- `Nivel 4`: ecossistema, produto ou conjunto de sistemas relacionados.
- `Nivel 5`: legado, tese, obra maior ou narrativa consolidada.

## Poder e rank

Primeira regra simples:

```txt
poder = media ponderada dos add-ons do card
```

Faixas iniciais:

```txt
0-20   Rank E
21-40  Rank D
41-60  Rank C
61-75  Rank B
76-90  Rank A
91-100 Rank S
```

Depois, o calculo pode considerar:

- XP dos add-ons.
- Peso manual de cada add-on.
- Evidencias ligadas ao card.
- Missoes concluidas.
- Cards fundidos.
- Eventos vindos de outros modulos.

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

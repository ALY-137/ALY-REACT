# Trabalho de Seguranca e Auditoria de TI

## Tema

Cards fisicos rastreaveis por QR Code: auditoria de acessos, linha do tempo de leitura e privacidade em sistemas web.

## Assunto registrado

Este documento registra a ideia de utilizar QR Codes unicos em cards fisicos impressos para direcionar o usuario para uma mesma pagina digital do card, mas mantendo cada QR Code como uma identidade propria de impressao.

A proposta e que cada card fisico possa ser auditado por meio de uma linha do tempo de leituras. Cada leitura do QR Code gera um evento de acesso, permitindo identificar quando o card foi escaneado, qual artefato fisico foi utilizado e quais informacoes tecnicas podem ser coletadas de forma controlada.

O foco nao deve ser rastrear uma pessoa diretamente. O foco correto e rastrear o artefato fisico e seus eventos de acesso.

## Atualizacao sobre identificador de navegacao

O sistema passou a utilizar a nomenclatura `navigationId` para representar o identificador de navegacao.

Antes, esse valor era tratado em algumas partes do sistema como `hash`, `visitorHash` ou `hashNavegacao`. A nomenclatura foi ajustada porque o objetivo principal desse dado nao e criptografia, autenticacao ou protecao de senha. O objetivo e identificar uma mesma navegacao ou fluxo de acesso no navegador.

Assim, o termo correto neste trabalho passa a ser:

```txt
navigationId = identificador de navegacao
```

Esse identificador pode continuar tendo formato compacto, como `nav_...`, mas deve ser entendido como um identificador tecnico de navegacao, e nao como um hash criptografico.

O sistema ainda pode ler campos antigos por compatibilidade, como:

1. `hash`
2. `visitorHash`
3. `navegacaoHash`

Mas novos registros devem usar preferencialmente:

```js
navigationId: "nav_..."
```

Essa mudanca melhora a clareza conceitual do projeto e evita confusao com hash de senha ou hash criptografico.

## Resumo

Este trabalho propoe uma abordagem para rastreabilidade de cards fisicos usando QR Codes unicos associados a registros de auditoria. Cada card impresso recebe um identificador unico, representado por um QR Code. Ao ser lido, esse QR Code acessa uma rota intermediaria no sistema, registra o evento de leitura e entao direciona o visitante para a pagina digital do card.

Essa estrategia permite criar uma linha do tempo de acessos vinculada ao card fisico, tornando possivel analisar interacoes, detectar uso indevido, medir alcance e manter evidencias tecnicas de leitura. O tema se relaciona com seguranca da informacao, auditoria de TI, privacidade, controle de ativos fisicos e digitais, e forense digital aplicada a sistemas web.

## Problema

Um card impresso com QR Code normalmente direciona para uma pagina estatica ou generica. Se varios cards impressos apontam para a mesma URL, nao e possivel saber qual copia fisica foi acessada, quando foi lida ou se uma copia especifica foi compartilhada fora do contexto esperado.

Sem rastreabilidade, o QR Code funciona apenas como um atalho. Com rastreabilidade, ele passa a funcionar como um identificador de artefato fisico, permitindo auditoria sobre cada leitura.

## Pergunta central

Como um sistema web pode transformar um QR Code impresso em um recurso auditavel, capaz de registrar eventos de leitura sem comprometer indevidamente a privacidade dos usuarios?

## Objetivo geral

Propor uma estrutura de QR Codes rastreaveis para cards impressos, permitindo registrar e visualizar uma linha do tempo de acessos vinculada a cada card fisico.

## Objetivos especificos

1. Gerar um identificador unico para cada versao impressa de um card.
2. Criar uma rota intermediaria para registrar a leitura do QR Code.
3. Redirecionar o visitante para a pagina unica do card apos o registro.
4. Armazenar eventos de leitura em uma estrutura auditavel.
5. Exibir uma linha do tempo de acessos para o proprietario do card.
6. Aplicar principios de privacidade, minimizacao de dados e seguranca.
7. Diferenciar rastreabilidade do artefato fisico de rastreamento pessoal.

## Cenario de uso

Um usuario cria um card digital dentro do sistema. Esse card representa um projeto, habilidade, curso, ferramenta ou entrega profissional. Ao gerar uma versao impressa, o sistema cria um QR Code unico para aquela impressao.

Exemplo:

```txt
Card digital:
/card/projeto-portfolio-cyberpink

QR impresso 01:
/card/r/print_a1b2c3

QR impresso 02:
/card/r/print_d4e5f6
```

Ambos os QR Codes podem abrir a mesma pagina final do card, mas cada um possui uma identidade de impressao diferente. Isso permite saber qual card fisico foi escaneado.

## Fluxo proposto

1. O usuario gera uma versao impressa do card.
2. O sistema cria um registro de impressao com `printId`.
3. O QR Code aponta para uma rota rastreavel.
4. Alguem escaneia o QR Code.
5. O sistema registra o evento de leitura.
6. O sistema redireciona para a pagina unica do card.
7. O proprietario pode visualizar a linha do tempo de leituras.

Fluxo tecnico:

```txt
Leitura do QR
    ↓
/card/r/{printId}
    ↓
Registro do evento
    ↓
Redirecionamento
    ↓
/card/{cardId}
```

## Modelo de dados sugerido

### Colecao de impressoes

```js
qrPrints: {
  id: "print_a1b2c3",
  alvoTipo: "card",
  alvoId: "card_789",
  projetoId: "aly137",
  espacoId: "portfolio",
  criadoEm: "2026-04-17T10:30:00Z",
  criadoPor: "user_123",
  ativo: true,
  label: "Deck curriculo - versao entrevista",
  descricao: "Card impresso entregue em evento ou entrevista"
}
```

### Colecao de eventos de leitura

```js
qrPrintEvents: {
  id: "event_xyz",
  printId: "print_a1b2c3",
  alvoTipo: "card",
  alvoId: "card_789",
  projetoId: "aly137",
  espacoId: "portfolio",
  data: "2026-04-17T14:42:00Z",
  tipoEvento: "scan_qr",
  userAgent: "Mozilla/5.0 ...",
  ipHash: "hash_do_ip",
  cidade: "Campinas",
  pais: "BR",
  navigationId: "nav_...",
  usuarioIdSeLogado: null
}
```

### Diferenca entre `navigationId` e hash de IP

O `navigationId` identifica uma navegacao ou fluxo de acesso no navegador. Ele ajuda a agrupar eventos relacionados sem depender obrigatoriamente de login.

O `ipHash`, por outro lado, e uma representacao protegida ou resumida do IP. Ele pode ser usado para reduzir exposicao de dado sensivel em relatorios ou interfaces.

Portanto:

```txt
navigationId = identificador de navegacao
ipHash = hash aplicado ao IP
```

Esses dois dados nao representam a mesma coisa.

## Linha do tempo de auditoria

A linha do tempo apresenta os eventos relacionados a uma impressao especifica ou a um card.

Exemplo visual:

```txt
QR: Deck curriculo - versao entrevista
Card: Portfolio Cyberpink

17/04/2026 14:32
Leitura por Chrome / Windows
Local aproximado: Campinas, BR
IP hash: 9f2a...

17/04/2026 18:04
Leitura por Safari / iPhone
Local aproximado: Sao Paulo, BR
IP hash: a81c...

18/04/2026 09:12
Nova leitura pelo mesmo artefato fisico
Origem: QR impresso
```

## Relacao com Seguranca da Informacao

O tema envolve seguranca porque cria uma trilha de auditoria sobre um artefato fisico conectado a um sistema digital. A leitura do QR Code se torna um evento observavel e registravel.

Pontos de seguranca:

1. Controle de acesso ao painel de eventos.
2. Protecao contra alteracao indevida dos registros.
3. Identificacao de leitura suspeita.
4. Revogacao de QR Codes comprometidos.
5. Registro de evidencias para auditoria.
6. Minimizacao de dados pessoais.
7. Uso de hash para reduzir exposicao de IP.
8. Uso de `navigationId` para agrupar eventos de uma mesma navegacao.

## Relacao com Auditoria de TI

Na auditoria de TI, o objetivo e avaliar se os sistemas possuem controles adequados, registros confiaveis e capacidade de rastrear eventos relevantes.

Este projeto pode ser analisado como um mecanismo de auditoria porque:

1. Gera logs de acesso.
2. Associa eventos a um identificador unico.
3. Permite verificar historico de uso.
4. Ajuda a identificar comportamento anomalo.
5. Mantem evidencias de interacao com um recurso fisico.
6. Permite criar relatorios por periodo, card ou QR Code.

## Relacao com Forense Digital

Embora nao seja uma investigacao forense completa, o sistema pode fornecer elementos uteis para uma analise forense leve.

Exemplos:

1. Reconstruir quando um QR Code foi acessado.
2. Identificar se o mesmo QR foi lido muitas vezes em locais diferentes.
3. Detectar possivel compartilhamento indevido de uma imagem do QR.
4. Correlacionar eventos com user agent, horario e local aproximado.
5. Preservar evidencias de acesso para analise posterior.

## Privacidade e LGPD

O projeto deve ser desenhado com cuidado para nao se tornar uma ferramenta invasiva.

Principios importantes:

1. Finalidade: registrar eventos do artefato fisico, nao vigiar pessoas.
2. Necessidade: coletar apenas dados uteis para auditoria.
3. Transparencia: informar que o QR Code pode registrar acesso.
4. Seguranca: proteger logs contra acesso indevido.
5. Retencao limitada: definir prazo para manter eventos.
6. Anonimizacao: usar hash de IP quando possivel.
7. Controle do usuario: permitir desativar rastreamento de um QR.

## Dados que podem ser coletados

Dados aceitaveis para auditoria:

1. Data e hora da leitura.
2. Identificador do QR Code.
3. Identificador do card.
4. Navegador e sistema operacional aproximado.
5. Hash de IP.
6. Pais e cidade aproximados, quando disponiveis.
7. Identificador de navegacao (`navigationId`).
8. Usuario autenticado, se houver login.

Dados que devem ser evitados:

1. Localizacao precisa sem consentimento.
2. IP bruto exposto em interfaces publicas.
3. Dados pessoais desnecessarios.
4. Identificacao direta de pessoas sem finalidade clara.

## Riscos

1. Uso do QR Code para rastrear pessoas sem transparencia.
2. Vazamento dos logs de acesso.
3. Interpretacao incorreta de dados de localizacao.
4. Dependencia de servicos externos de geolocalizacao.
5. Manipulacao de eventos por bots.
6. Leitura automatica por navegadores ou prefetch.
7. Duplicidade de eventos por recarregamento de pagina.

## Controles recomendados

1. Registrar o evento uma unica vez por janela curta de tempo.
2. Separar acesso real de prefetch quando possivel.
3. Guardar IP em hash, nao necessariamente em texto puro.
4. Permitir bloquear registro por usuario, IP, identificador de navegacao ou QR.
5. Permitir revogar um QR Code.
6. Exibir alertas de leituras incomuns.
7. Restringir a linha do tempo ao dono do card ou administrador autorizado.
8. Criar politica de retencao dos logs.

## Possivel implementacao no sistema ALY

### Rota rastreavel

```txt
/card/r/:printId
```

Responsabilidades da rota:

1. Buscar `qrPrints/{printId}`.
2. Verificar se o QR esta ativo.
3. Criar evento em `qrPrintEvents`.
4. Redirecionar para `/card/:cardId`.

Dados importantes do evento:

```js
{
  printId: "print_a1b2c3",
  tipoEvento: "scan_qr",
  navigationId: "nav_...",
  usuarioIdSeLogado: null,
  data: "2026-04-17T14:42:00Z"
}
```

### Rota final do card

```txt
/card/:cardId
```

Responsabilidades:

1. Mostrar somente o card ampliado.
2. Evitar navbar, headmenu e elementos administrativos.
3. Permitir voltar ao espaco publicado.
4. Servir como pagina publica do card.

### Interface administrativa

Funcionalidades:

1. Ver cards impressos.
2. Gerar novo QR rastreavel.
3. Nomear uma impressao.
4. Ver linha do tempo.
5. Desativar ou excluir um card rastreavel.
6. Exportar relatorio.

## Implementacao registrada no sistema ALY

Foi implementado no sistema um modelo de rastreabilidade configuravel para cards e links de espaco. A ideia principal e separar a pagina final do conteudo da identidade rastreavel usada para chegar ate ela.

Assim, um mesmo card ou espaco pode continuar tendo uma pagina publica unica, mas cada QR Code ou link compartilhado pode possuir um identificador proprio. Esse identificador permite criar uma linha do tempo de acessos sem alterar o destino final apresentado ao visitante.

### Modo preferencial implementado

O modo preferencial adotado foi:

1. A URL rastreavel e criada no gerenciador de espacos.
2. A URL rastreavel aponta para a mesma pagina final do espaco ou card.
3. O acesso gerado por essa URL registra origem rastreavel.
4. A URL fixa continua existindo, mas pode ter registro direto bloqueado conforme configuracao.
5. O historico fica disponivel para quem possui permissao administrativa sobre aquele espaco.

Esse modelo evita transformar toda navegacao em vigilancia permanente. O sistema passa a registrar com mais relevancia os acessos que vieram de um link ou QR criado intencionalmente para auditoria.

### Configuracoes administrativas implementadas

Foram adicionadas configuracoes para controlar o modulo de rastreabilidade:

```js
rastreabilidadeAcessosHabilitada
modoRastreabilidadeAcessos
rastreabilidadeCriarLinksPermissao
rastreabilidadeHistoricoLinksPermissao
registrarAcessoDiretoRastreabilidade
persistirOrigemRastreabilidadeSessao
```

Essas configuracoes permitem decidir:

1. Se a rastreabilidade esta ativa no projeto.
2. Quem pode criar links rastreaveis.
3. Quem pode visualizar historico de links rastreaveis.
4. Se acessos diretos, sem origem rastreavel, devem ser registrados.
5. Se a origem rastreavel deve ser mantida na sessao apos o primeiro acesso.

### Permissoes implementadas

Foram definidos tres modelos de permissao para administracao da rastreabilidade:

```txt
owner_projeto
dono_espaco
admin_ou_dono_espaco
```

`owner_projeto` restringe a gestao ao dono ou administrador do projeto.

`dono_espaco` permite que o dono ou cocriador do espaco gerencie os links rastreaveis daquele espaco.

`admin_ou_dono_espaco` permite tanto administradores do projeto quanto donos ou cocriadores do espaco.

Essa separacao e importante porque projetos `oneowner` e `multiowner` possuem realidades diferentes. Em um projeto `oneowner`, usuarios comuns podem acessar funcionalidades publicas, mas normalmente nao devem criar espacos nem links administrativos. Em um projeto `multiowner`, cada usuario com espaco proprio pode precisar criar e auditar seus proprios links.

### Criador de links rastreaveis

O criador de links rastreaveis foi colocado no gerenciador de espacos, e nao na pagina publica. Essa escolha separa claramente:

1. Pagina publica: visualizacao e interacao do visitante.
2. Gerenciador de espacos: criacao, controle e auditoria.

Ao criar um link rastreavel, o sistema pode salvar uma descricao administrativa e a URL gerada como atributo do registro. Isso permite saber para que aquele link foi criado, por exemplo:

```txt
Link usado em curriculo impresso
Link enviado para entrevista
Link compartilhado em rede social
QR Code colado em card fisico
```

### Controle de acessos diretos

Foi implementada a possibilidade de bloquear o registro de acessos diretos quando o modulo de rastreabilidade estiver ativo.

Quando `registrarAcessoDiretoRastreabilidade` esta desativado, um acesso que nao veio de link rastreavel pode ser ignorado pelo registrador. Nesse caso, o evento pode ser tratado internamente como:

```txt
direct_access_tracking_disabled
```

Esse comportamento reduz ruido nos relatorios e evita registrar navegacoes que nao fazem parte de uma campanha, QR Code ou link auditavel.

### Regras e funcao de seguranca

A protecao tambem foi aplicada em duas camadas:

1. Na interface, escondendo ou exibindo botoes conforme permissao.
2. Nas regras do Firestore, impedindo leitura, criacao, edicao ou exclusao indevida.
3. Na Cloud Function de registro de acesso, verificando a configuracao antes de salvar eventos.

Isso e importante porque a interface so melhora a experiencia. A seguranca real precisa estar tambem no backend e nas regras de banco.

### Atualizacao de hardening das regras - 2026-05-28

Foi registrada uma decisao importante de seguranca: o sistema nao deve ser endurecido com uma regra generica de "somente usuarios logados podem ver". Essa estrategia seria simples, mas quebraria a natureza do produto, que possui conteudo publico, conteudo restrito, conteudo comprado, conteudo de assinante e acesso por link ou QR com liberacao especifica.

A matriz correta de acesso considera pelo menos estes perfis:

1. Visitante deslogado em pagina publica.
2. Visitante deslogado com link rastreavel, QR ou URL tokenizada de liberacao.
3. Usuario autenticado comum.
4. Comprador com liberacao de bloco/card.
5. Assinante com acesso a espaco exclusivo.
6. Dono ou cocriador do espaco.
7. Owner/admin do projeto.

Com isso, a regra tecnica adotada passou a ser:

```txt
Firestore decide quem pode ver o conteudo.
Storage serve assets e protege escrita, upload e originais.
```

Essa separacao e essencial para auditoria. O Firestore guarda os documentos que expressam a intencao de acesso: visibilidade do espaco, visibilidade do bloco, comprador, assinante, origem rastreavel, permissao administrativa e logs de auditoria. O Storage, por outro lado, nao deve tentar reconstruir toda essa regra de negocio. Ele deve proteger principalmente:

1. Escrita indevida.
2. Exclusao indevida.
3. Upload de arquivos fora do tipo esperado.
4. Uploads muito grandes.
5. Originais sensiveis quando o visitante nao recebeu uma URL autorizada.

#### Storage Rules ajustadas para a matriz publica/restrita

As regras de Storage foram ajustadas para manter leitura publica intencional em assets que precisam aparecer para visitantes deslogados quando o Firestore ja liberou a pagina ou o card:

1. Assets globais de tema e imagens publicas.
2. Branding do projeto usado antes do login.
3. Avatar de skin/perfil.
4. Icones de colecoes.
5. Icones de add-ons.
6. Previews desfocados de conteudo bloqueado.
7. Imagens de cards publicados, deck fisico e QR.
8. Banners e ativos publicos de live.

Ao mesmo tempo, a escrita e a exclusao desses arquivos ficam restritas a owner/admin, com validacao de `contentType` de imagem e limite de tamanho.

O caminho de originais de blocos foi tratado de forma diferente:

```txt
users/{userId}/espacos/{espacoId}/blocos/{blocoId}/original/{...}
```

Nesse caso, a leitura via SDK fica limitada a owner/admin ou usuario autenticado. Visitantes deslogados devem depender de URLs tokenizadas gravadas em documentos autorizados, por exemplo quando um bloco publico ou um link liberado precisa exibir o original.

Essa escolha preserva dois objetivos ao mesmo tempo:

1. Nao quebrar paginas publicas, QR Codes, cards impressos e links rastreaveis.
2. Reduzir exposicao direta de arquivos originais em fluxos restritos.

#### Firestore Rules e admin

Nas regras do Firestore, a identificacao de administrador foi direcionada para custom claims:

```txt
role == "admin"
isAdmin == true
```

A regra dinamica por configuracao do sistema continua importante, especialmente para projetos oneowner e runtime compartilhado. O objetivo e reduzir dependencias de UIDs ou e-mails fixos em regra, mas a transicao precisa ser feita com cuidado para nao bloquear o owner principal antes de configurar os claims.

#### Env exposta e controle compensatorio

Foi tomada a decisao operacional de adiar a rotacao completa das variaveis expostas, porque o projeto ainda depende de recursos gratuitos e de configuracoes em uso. Enquanto essa rotacao nao acontece, as regras do Firebase, a revisao de permissao e a minimizacao de dados funcionam como controles compensatorios.

Essa decisao nao transforma chaves expostas em algo seguro. Ela apenas documenta o estado atual e o plano de mitigacao. Tokens privados, service accounts e tokens de deploy continuam sendo riscos mais criticos do que chaves publicas de frontend e devem ser revogados quando a troca puder ser feita com seguranca operacional.

Tambem foi definido que documentos do projeto nao devem repetir tokens, chaves privadas ou valores sensiveis. A documentacao deve apontar o risco sem copiar o segredo.

#### Testes obrigatorios antes de deploy das regras

Antes de publicar novas regras de Firestore ou Storage, a matriz minima de teste passa a ser:

1. Visitante deslogado abre pagina publica.
2. Visitante deslogado abre card por QR/link rastreavel.
3. Visitante deslogado ve preview bloqueado, mas nao acessa original protegido fora do fluxo autorizado.
4. Usuario autenticado comum acessa apenas conteudo permitido.
5. Comprador acessa bloco/card comprado.
6. Assinante acessa espaco exclusivo de assinante.
7. Dono ou cocriador edita conteudo do proprio espaco.
8. Owner/admin cria, edita e remove assets do projeto.
9. Usuario nao autorizado tenta upload, edicao e exclusao e recebe bloqueio.
10. Painel de auditoria nega historico para usuario sem permissao.
11. Links rastreaveis e QR prints continuam registrando eventos somente quando a configuracao permitir.
12. Logs de auditoria continuam imutaveis e separados dos dados operacionais removidos.

Essa matriz conecta seguranca tecnica com auditoria de TI: nao basta a pagina funcionar; e preciso provar que cada perfil enxerga e altera apenas o que deveria.

### Arquivos relacionados

A implementacao foi distribuida principalmente nos seguintes pontos do sistema:

```txt
src/components/Layout/Sistema/configSistema.js
src/components/Layout/Sistema/modulosPermissoes.js
src/components/Layout/Menu/Gerenciador/PropriedadesSistema/PropriedadesSistema.jsx
src/components/Layout/Espacos/EspacoManager.jsx
src/components/Layout/Espacos/trackableLinksApi.js
src/components/Layout/Menu/Gerenciador/Acessos/Acesso.jsx
functions/index.js
firestore.rules
storage.rules
docs/seguranca-mapa-dados-permissoes.md
```

Com isso, a rastreabilidade deixou de ser apenas uma ideia visual de QR Code e passou a ser um modulo configuravel de auditoria, com controle de permissao, registro seletivo de acessos e separacao entre pagina final e origem rastreavel.

## Auditoria operacional do sistema

A rastreabilidade tambem foi ampliada para eventos internos do sistema. Alem dos acessos, leituras de QR Code e links rastreaveis, o sistema passou a registrar acoes administrativas e acoes de construcao de conteudo.

## Bloco de texto e conteudo criptografado

Foi adicionada a possibilidade de criar bloco do tipo `texto`, mantendo a nomenclatura coerente com os outros tipos de bloco do criador: imagem, cards, venda, add-ons e live.

O bloco de texto suporta modos internos:

1. Texto simples.
2. Artigo.
3. Blog/Post.
4. Aviso.

O modo Blog/Post pode usar imagens, mas sem transformar o tipo principal em "blog". A classificacao principal continua sendo `texto`, enquanto `textoModo` define a apresentacao editorial desejada.

Campos principais do bloco:

```js
{
  tipo: "texto",
  textoModo: "post",
  textoSubtitulo: "...",
  textoCorpo: "...",
  imagemCapaUrl: "...",
  textoImagens: []
}
```

Para conteudo privado ou restrito, o bloco salva o corpo criptografado automaticamente. Nao ha escolha manual de criptografar ou nao criptografar na interface. A regra e derivada da visibilidade do bloco.

Visibilidades que disparam criptografia automatica:

1. `publico_restritivo`
2. `privado`
3. `exclusivo_assinante`
4. `exclusivo_comprador`
5. `comprado`

Nesses casos, o sistema usa criptografia de campo no navegador com AES-GCM e chave derivada por PBKDF2/SHA-256 a partir de uma chave local informada pelo usuario. A chave local nao e salva no Firestore.

Quando a criptografia automatica esta ativa, o documento guarda somente metadados criptograficos e o texto cifrado:

```js
{
  textoConteudoCriptografado: true,
  textoCriptografia: {
    version: "text-block-v1",
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    salt: "...",
    iv: "...",
    data: "..."
  },
  textoCorpo: "",
  conteudo: "resumo publico opcional"
}
```

Esse controle protege o corpo textual contra leitura direta no banco quando a chave nao esta disponivel. Ele nao substitui as regras do Firestore: a permissao de leitura do documento continua sendo controlada por visibilidade, compra, assinatura, link liberado, dono do espaco ou owner/admin.

Observacoes de seguranca:

1. A chave de criptografia nao pode ser recuperada pelo sistema se for perdida.
2. O corpo criptografado nao deve ser copiado para campos de auditoria em texto puro.
3. Imagens do bloco continuam dependendo de Storage Rules e URLs autorizadas; a criptografia aplicada nesta etapa protege o corpo textual.
4. Para conteudo publico, o corpo textual fica aberto e a protecao principal continua sendo Firestore Rules, Storage Rules e a politica de publicacao definida pelo owner.

## Politica de criptografia de mensagens do chat

Foi adicionada uma configuracao por projeto para controlar criptografia de mensagens novas do chat:

```js
chatMensagensCriptografadas: true
```

Quando essa politica esta ativa, mensagens novas gravadas no chat passam a salvar o campo `mensagem` vazio e o corpo cifrado em `mensagemCriptografia`. A lista de conversas usa um preview operacional como "Mensagem criptografada" para evitar expor o texto na visao resumida.

Campos principais:

```js
{
  mensagem: "",
  mensagemCriptografada: true,
  mensagemCriptografia: {
    version: "text-block-v1",
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    salt: "...",
    iv: "...",
    data: "...",
    chatVersion: "chat-message-v1"
  },
  mensagemPreview: "Mensagem criptografada"
}
```

A politica e aplicada em mensagens novas. Mensagens antigas em texto aberto continuam legiveis para preservar compatibilidade historica.

Observacao tecnica: esta etapa implementa criptografia operacional de campo para reduzir exposicao direta no Firestore. Para uma arquitetura E2EE completa, ainda sera necessario adicionar gestao de chaves por usuario/dispositivo, rotacao de chaves e recuperacao controlada.

## Politica de indexacao publica e SEO

Foi adicionada uma camada inicial para tornar paginas publicas pesquisaveis sem transformar dados restritos em conteudo indexavel.

Configuracoes por projeto:

```js
{
  seoBuscaGoogleLiberada: true,
  seoIndexacaoPublica: true,
  seoDescricaoPublica: "Resumo publico do projeto",
  seoImagemUrl: "https://..."
}
```

A indexacao agora depende de duas chaves: `seoBuscaGoogleLiberada` deve ser liberada pelo Gerenciador de Projetos, e `seoIndexacaoPublica` deve estar ativa nas propriedades do projeto. Quando qualquer uma das duas estiver falsa, o projeto continua acessivel conforme sua privacidade, mas nao e anunciado para buscadores.

Quando as duas chaves estao ativas, o dominio passa a responder endpoints dinamicos:

1. `/robots.txt`
2. `/sitemap.xml`

Esses endpoints sao resolvidos por dominio e usam o `projectSystemKey` como namespace em projetos `oneowner` no runtime compartilhado. Isso evita interseccao de dados entre projetos que usam o mesmo UID de owner.

Regras de exposicao:

1. Apenas projetos com `seoBuscaGoogleLiberada: true` no Gerenciador de Projetos podem usar SEO indexavel.
2. Apenas projetos `oneowner` com entrada publica podem gerar sitemap.
3. Apenas espacos com `visibilidade: "publico"` entram no sitemap.
4. Apenas blocos com `visibilidade: "publico"` podem gerar URLs de cards no sitemap.
5. Blocos restritos, privados, de assinante, comprador ou comprados ficam fora da indexacao.
6. Texto criptografado nao e usado como descricao SEO; somente resumo publico ou texto aberto de conteudo publico pode compor metadados.
7. Se `seoBuscaGoogleLiberada` ou `seoIndexacaoPublica` estiverem desativados, `robots.txt` responde `Disallow: /` e as paginas recebem `noindex`.

Tambem foram adicionadas meta tags dinamicas no frontend para paginas publicas de espaco e cards ampliados:

1. `title`
2. `description`
3. `canonical`
4. Open Graph
5. Twitter Card
6. `robots`
7. JSON-LD basico

A camada de SEO nao altera permissoes de Firestore ou Storage. Ela apenas publica referencias indexaveis para conteudo que ja esta classificado como publico pela politica de visibilidade do projeto.

Eventos cobertos nesta etapa:

1. Criacao, edicao e exclusao de blocos.
2. Criacao, edicao e exclusao de cards.
3. Criacao, pausa, reativacao e exclusao de links rastreaveis.
4. Criacao e exclusao de cards rastreaveis para impressao.
5. Marcacao de acessos como lidos.
6. Remocao de registros de acesso.
7. Alteracao das configuracoes de bloqueio de acesso.
8. Criacao, edicao e exclusao de add-ons globais e add-ons do usuario/projeto.
9. Criacao, edicao e exclusao de colecoes de icones.
10. Criacao, edicao e exclusao de projetos/sistemas no gerenciador.
11. Salvamento de preconfiguracoes de projeto.
12. Criacao, edicao, exclusao e reordenacao de espacos.
13. Relacionamento e remocao de skins em espacos.
14. Criacao, edicao visual, troca de tema, avatar e exclusao de skins.

Cada evento busca registrar:

1. A acao executada.
2. O tipo de entidade afetada.
3. O identificador da entidade.
4. O usuario autenticado que executou a acao.
5. O estado anterior quando disponivel.
6. O estado posterior quando disponivel.
7. Metadados tecnicos relevantes.

Essa camada e diferente da navegacao. Navegacao indica que algo foi acessado. Auditoria operacional indica que algo foi alterado no sistema. Essa separacao ajuda a investigar incidentes, restaurar contexto, identificar exclusoes e entender quem alterou configuracoes relevantes.

## Politica de auditoria por projeto

A auditoria passou a ser configuravel no gerenciador de projetos. Cada projeto pode manter a auditoria ativa ou desativada e definir quais categorias devem gerar eventos:

1. Acessos: leitura, bloqueios, marcacao como lido e remocao de registros operacionais.
2. Conteudo: espacos, blocos, cards, skins, add-ons e itens visuais ligados ao projeto.
3. Configuracoes: configuracao do projeto, modulos, preconfiguracoes, colecoes de icones e alteracoes administrativas.
4. Rastreaveis: links rastreaveis e cards rastreaveis para impressao.

Tambem foram adicionadas permissoes por projeto para controlar:

1. Quem pode ver o historico de auditoria.
2. Quem pode exportar auditoria.
3. Quem pode remover registros operacionais auditaveis.

Essas permissoes passaram a ter efeito direto na interface administrativa:

1. O painel de auditoria bloqueia a visualizacao quando o usuario nao possui permissao para ver o historico do projeto selecionado.
2. A exportacao em CSV da auditoria e da linha do tempo respeita a permissao de exportacao configurada no projeto.
3. A remocao de acessos operacionais, links rastreaveis e cards rastreaveis fica bloqueada quando o usuario nao possui permissao para remover registros auditaveis.
4. As Cloud Functions tambem validam as permissoes antes de listar logs, exportar dados ou remover registros operacionais.
5. As regras do Firestore mantem os logs imutaveis e restringem a leitura conforme a politica de auditoria do projeto.

A regra tecnica adotada foi manter a auditoria como uma trilha separada dos dados operacionais. Assim, quando um registro operacional e removido, o evento de remocao pode continuar existindo como prova de auditoria. Isso evita que a exclusao do dado principal apague completamente a linha do tempo do acontecimento.

Os eventos gravados agora recebem uma categoria de auditoria. Essa categoria permite filtrar o painel central e tambem permite que o sistema respeite a politica configurada no projeto antes de registrar novos logs.

## Retencao de logs

Foi adicionada uma configuracao de retencao por projeto:

```txt
auditoriaRetencaoDias
```

O valor padrao e 180 dias. Cada novo log recebe o campo `expiresAt`, calculado a partir da politica configurada. Esse campo pode ser usado pelo TTL do Firestore para expurgo automatico.

Quando o valor for `0`, o sistema nao define expiracao automatica para novos logs.

Essa abordagem separa duas responsabilidades:

1. O sistema define a data tecnica de expiracao.
2. O Firestore TTL executa a remocao automatica quando configurado no console.

Isso ajuda a reduzir custo, limitar acumulacao de dados e aplicar uma politica de minimizacao coerente com seguranca e privacidade.

O TTL foi ativado no Firestore para o collection group:

```txt
auditLogs
```

Campo usado:

```txt
expiresAt
```

Com isso, qualquer log gravado em `/auditLogs/{id}` ou em `/projetos/{projectSystemKey}/auditLogs/{id}` pode ser expirado automaticamente quando a data definida em `expiresAt` for vencida.

## Politica de auditoria por projeto

Foi adicionada uma aba de politica no painel de auditoria. Essa aba mostra:

1. Projeto selecionado.
2. Status da auditoria operacional.
3. Retencao configurada.
4. Status tecnico do TTL.
5. Categorias auditadas.
6. Permissao de visualizacao por categoria.
7. Quantidade de eventos carregados por categoria.
8. Ultimo evento carregado para os filtros atuais.

As permissoes por categoria foram separadas para reduzir acesso excessivo. A auditoria deixou de ter apenas uma permissao geral de visualizacao e passou a aceitar configuracao especifica para:

1. `auditoriaVerAcessosPermissao`
2. `auditoriaVerConteudoPermissao`
3. `auditoriaVerConfiguracoesPermissao`
4. `auditoriaVerRastreaveisPermissao`

Essa separacao permite, por exemplo, que um dono de espaco visualize eventos de conteudo relacionados ao seu espaco, mas nao necessariamente eventos de configuracao do projeto inteiro.

As Functions tambem validam a politica antes de retornar logs. Portanto, o filtro visual no frontend nao e a unica barreira de seguranca. Mesmo uma chamada direta ao endpoint de auditoria deve respeitar a permissao configurada no projeto.

## Linha do tempo por entidade

Foi adicionada uma visualizacao de linha do tempo por entidade auditada. A partir de um evento, o painel pode consultar todos os registros ligados ao mesmo identificador de entidade, mantendo o recorte por projeto, tipo de entidade e identificador.

Exemplos de uso:

1. Abrir a linha do tempo de um card para ver criacao, edicoes e exclusao.
2. Abrir a linha do tempo de um bloco para entender quando ele foi criado, alterado ou removido.
3. Abrir a linha do tempo de um link rastreavel para acompanhar criacao, pausa, reativacao e exclusao.
4. Abrir a linha do tempo de um card rastreavel para relacionar impressao, leituras e alteracoes.

Esse recurso aproxima a auditoria do uso real do sistema. Em vez de analisar apenas uma lista global de eventos, o administrador consegue investigar a historia de um objeto especifico. Isso facilita investigacao de incidentes, validacao de autoria, acompanhamento de alteracoes e explicacao de eventos em um relatorio tecnico.

Tambem foram adicionados atalhos operacionais para abrir a auditoria de uma entidade diretamente:

1. Cards podem abrir o painel de auditoria filtrado pelo `entityType: card` e pelo ID do card.
2. Links rastreaveis podem abrir o painel de auditoria filtrado pelo `entityType: trackableLink` e pelo ID do link.
3. O painel aceita parametros de URL como `projectSystemKey`, `entityType` e `entityId`, facilitando investigacao pontual.

## Exportacao de auditoria

O painel de auditoria passou a permitir exportacao em CSV. A exportacao global usa os filtros visiveis no painel, como projeto, categoria, entidade, acao e periodo. A linha do tempo por entidade tambem pode ser exportada separadamente.

Campos exportados:

1. Data do evento.
2. Projeto.
3. Categoria de auditoria.
4. Tipo de entidade.
5. Identificador da entidade.
6. Acao executada.
7. Ator identificado.
8. Origem tecnica.
9. Espaco relacionado.
10. Bloco e card relacionados, quando existirem.
11. Motivo.
12. Projeto runtime.
13. Caminho tecnico do log.

Essa exportacao transforma a trilha de auditoria em material analisavel em planilha, permitindo comparacao por periodo, identificacao de eventos sensiveis e anexacao em relatorios de seguranca e auditoria de TI.

## Severidade e alertas de eventos sensiveis

Os eventos de auditoria passaram a receber uma classificacao de severidade:

1. Baixo: criacoes e edicoes comuns de conteudo.
2. Medio: configuracoes, projetos, preconfiguracoes e artefatos rastreaveis.
3. Alto: exclusoes, remocoes de registros, bloqueios, alteracoes sensiveis e limpeza de ambiente.

O painel de auditoria permite filtrar por severidade e tambem possui um atalho para exibir somente eventos criticos. A gaveta de auditoria no menu do gerenciador exibe um badge quando existem eventos recentes de severidade alta.

Essa camada ajuda a transformar a auditoria em uma ferramenta de triagem. Em vez de depender apenas da leitura manual de todos os logs, o sistema destaca rapidamente eventos que podem exigir revisao: exclusao de dados, alteracao de regras de acesso, remocao de registros operacionais e mudancas administrativas relevantes.

## Exemplo de relatorio

```txt
Relatorio de Auditoria de QR Code

Card: Portfolio Cyberpink
QR: Deck curriculo - versao entrevista
Periodo: 01/04/2026 a 30/04/2026

Total de leituras: 12
Leituras unicas por identificador de navegacao: 7
Paises detectados: BR
Cidades aproximadas: Campinas, Sao Paulo
Eventos suspeitos: 1

Observacao:
Foi detectada leitura repetida do mesmo QR em curto intervalo de tempo.
```

## Possivel titulo academico

Rastreabilidade de artefatos fisicos por QR Code: uma abordagem de auditoria de acessos em sistemas web.

## Alternativas de titulo

1. Cards fisicos rastreaveis: auditoria e seguranca em QR Codes unicos.
2. QR Codes como artefatos auditaveis em sistemas web.
3. Integracao entre objeto fisico, identidade digital e linha do tempo de acessos.
4. Auditoria de leitura de QR Codes em cards impressos.
5. Rastreabilidade e privacidade em credenciais fisicas baseadas em QR Code.

## Conclusao

A proposta de QR Codes rastreaveis em cards impressos transforma um simples atalho visual em um artefato auditavel. Cada leitura passa a gerar um evento tecnico capaz de compor uma linha do tempo. Esse modelo pode apoiar seguranca, auditoria e analise de interacoes entre o mundo fisico e o digital.

Ao mesmo tempo, a solucao exige cuidado com privacidade. O sistema deve rastrear o card fisico e o evento de leitura, nao a pessoa de forma abusiva. Com minimizacao de dados, hash de IP, controle de acesso e transparencia, a ideia se torna defensavel como recurso de auditoria de TI.

## Observacao para apresentacao

Uma forma simples de apresentar o tema e mostrar dois QR Codes diferentes apontando para o mesmo card. Ao escanear cada um, a pagina final parece a mesma para o visitante, mas o painel administrativo mostra linhas do tempo separadas.

Isso demonstra de forma clara a diferenca entre:

1. URL final do conteudo.
2. Identidade unica do QR Code impresso.
3. Evento auditavel de leitura.

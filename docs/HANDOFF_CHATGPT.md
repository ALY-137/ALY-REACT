# ALY-REACT - Handoff Tecnico para Continuar no ChatGPT

## 1) Objetivo do sistema
Este projeto e uma plataforma React + Firebase para:
- Criar experiencias de conteudo com **skins/perfis**, **espacos/abas**, **blocos** (imagem, cards, live).
- Operar em dois modos de produto:
  - **multiowner**: cada usuario pode ter seu proprio perfil e conteudo.
  - **oneowner**: estrutura central com owner definido (home publica + areas restritas, dependendo da configuracao).
- Gerenciar projetos por um painel central (`gerenciador-aly`), incluindo configuracoes de branding, layout, login, metodos de pagamento, icones e dominio/projeto.

---

## 2) Stack e organizacao
- Frontend: React 18 + React Router 6 (`react-scripts`).
- Firebase client SDK v9: Auth, Firestore, Storage, Functions.
- Cloud Functions (Node) em `functions/index.js`.
- Regras Firestore em `firestore.rules`.
- Indices Firestore em `firestore.indexes.json`.
- Pipeline de deploy de rules: script local + GitHub Actions.

Arquivos-chave:
- Roteamento: `src/RouterComponent.jsx`
- App base/login/bootstrap: `src/App.jsx`
- Config sistema: `src/components/Layout/Sistema/configSistema.js`
- Resolucao de projeto Firebase: `src/config/firebaseProjects.js`
- Namespace de dados por projeto oneowner: `src/components/Banco/projectDataNamespace.js`
- Inicializacao Firebase: `src/components/Banco/init-firebase.js`
- Estrutura de pagina: `src/components/Layout/Espacos/Estrutura.jsx`
- Conteudo do espaco/blocos/live/chat: `src/components/Layout/Espacos/EspacoPage.jsx`
- Integracao pagamentos: `src/components/Layout/Pagamentos/mercadoPagoApi.js`
- Bucket compartilhado: `src/components/Layout/Storage/sharedBucketApi.js`

---

## 3) Conceitos de negocio usados no codigo

### 3.1 Tipos de experiencia
- `multiowner`
- `oneowner` (substituiu nomenclatura antiga `onepage` em boa parte do codigo; ainda existe compatibilidade legado)

### 3.2 Modos de acesso
- `privado_com_login`
- `publico_com_area_restrita`
- `publico_sem_login`

### 3.3 Destino pos-login
- `home_central_projeto`
- `home_skin_usuario`

### 3.4 Papeis
- Termo canonico atual: **owner**.
- Compatibilidade legado: varias partes ainda aceitam/espelham `adminUid/adminEmail`.
- Funcao utilitaria de permissao: `seforOwner`/`seforAdm` em `src/components/Scripts/verificacoes/verificaAdm.js`.

---

## 4) Roteamento (resumo pratico)
Definido em `src/RouterComponent.jsx`.

Rotas principais:
- `/` -> `App`
- `/login`, `/loginowner` (e `/loginadmin` redireciona para `/loginowner`)
- `menu/:userId` -> `Menu` (gavetas/gestao)
- Estrutura:
  - oneowner publico: `/:espacoNome` (legado `/:skinsUsername/:espacoNome` redireciona)
  - multiowner: `/:skinsUsername/:espacoNome`

---

## 5) Arquitetura de dados Firestore

## 5.1 Namespace de projeto no runtime compartilhado
Arquivo: `src/components/Banco/projectDataNamespace.js`

Quando o projeto Firebase ativo e `aly-onepages-runtime`, o sistema pode usar namespace:
- `projetos/{systemKey}/...`

Objetivo:
- Isolar dados de multiplas oneowners no mesmo projeto Firebase runtime.

Importante:
- O codigo privilegia caminho namespaced no oneowner runtime para evitar duplicacao em raiz.

### 5.2 Colecoes principais
Dependendo do contexto (namespaced ou nao), a estrutura base e:
- `users/{uid}`
  - `skins/{skinId}`
  - `espacos/{espacoId}`
    - `blocos/{blocoId}`
      - `cards/{cardId}`
      - `compradores/{buyerId}`
    - `assinantes/{subscriberId}`
  - `integracoes/pixManual`
  - `pedidos/{pedidoId}` (nome mantido por compatibilidade; UI usa "solicitacoes")
- `contatos/{contactId}`
  - `conversas/{conversationId}`
    - `chat/{chatId}`
    - `webrtc/{peerId}`
      - `viewerCandidates/{candidateId}`
      - `hostCandidates/{candidateId}`
- `add_ons/sistema_config`
- `systems/{systemKey}` (cadastro central de projetos no gerenciador)

No oneowner runtime compartilhado, os caminhos equivalentes ficam sob:
- `projetos/{systemKey}/...`

---

## 6) Configuracao de sistema
Arquivo: `src/components/Layout/Sistema/configSistema.js`

`DEFAULT_SISTEMA_CONFIG` concentra:
- branding (`logoLoginUrl`, `faviconUrl`, icones)
- layout (`layoutTema`)
- login preset e metodos (`google`, `emailSenha`, `twitter`)
- tipo de experiencia (`multiowner`/`oneowner`)
- modo de acesso e destino pos-login
- limites e nomes customizaveis (skin/espaco/bloco)
- recursos: chat, lives, mercadoPago, pixManual, blocoCards
- owner/admin UIDs e emails (compatibilidade)

Fluxo de leitura:
1. tenta buscar config no gerenciador via `obterConfigProjetoDoGerenciador`
2. sincroniza local/cache
3. fallback para `add_ons/sistema_config`

---

## 7) Pagamentos

Arquivo: `src/components/Layout/Pagamentos/mercadoPagoApi.js`

## 7.1 Mercado Pago
- Usa Functions callable:
  - `salvarMercadoPagoCredenciais`
  - `obterStatusMercadoPago`
  - `desconectarMercadoPago`
  - `criarCheckoutBlocoMercadoPago`
  - `confirmarPagamentoBlocoMercadoPago`
- Tem fallback de indisponibilidade por projeto (CORS/deploy/functions faltando).

## 7.2 PIX manual
- Config por owner em `users/{uid}/integracoes/pixManual`.
- Suporta ate 20 QRs por valor.
- Fluxo de solicitacao/desbloqueio em `pedidos` (UI chama de solicitacoes).

---

## 8) Storage compartilhado
Arquivo: `src/components/Layout/Storage/sharedBucketApi.js`

- Todos projetos usam bucket compartilhado do projeto `teste-aa015`.
- Upload/URL/delete por HTTP Functions:
  - `uploadArquivoBucketCompartilhado`
  - `obterUrlArquivoBucketCompartilhado`
  - `excluirArquivoBucketCompartilhado`

---

## 9) Lives (estado e fluxo)
Arquivo central: `src/components/Layout/Espacos/EspacoPage.jsx`

Resumo:
- Bloco `tipo: "live"` abre modal com video embed + chat + canal WebRTC para camera do criador.
- Chat live usa `contatos/conversas/chat`.
- Sinalizacao camera usa `contatos/conversas/webrtc`.

Detalhes recentes relevantes:
- `contactId` live padronizado por `espacoId + blocoId` para reduzir desencontro.
- Existe bootstrap de contato/conversa antes da oferta WebRTC (`garantirContatoConversaLive`).
- Viewer tem retry de conexao e status remoto.

Observacao:
- Se houver `permission-denied` no viewer para WebRTC, normalmente e:
  - rules nao deployadas no projeto certo, ou
  - contexto de namespace/projeto inconsistente.

---

## 10) Cloud Functions disponiveis
Arquivo: `functions/index.js`

Exports principais:
- Auth gate (owner-only em projetos configurados):
  - `bloquearCriacaoUsuarioNaoAdmin`
  - `bloquearLoginUsuarioNaoAdmin`
- Mercado Pago:
  - `salvarMercadoPagoCredenciais`
  - `obterStatusMercadoPago`
  - `desconectarMercadoPago`
  - `criarCheckoutBlocoMercadoPago`
  - `confirmarPagamentoBlocoMercadoPago`
- PIX manual:
  - `salvarPixManualConfig`
  - `obterStatusPixManual`
  - `obterCheckoutPixManualBloco`
- Notificacao:
  - `notificarAdminNovaSolicitacaoPix`
- Vercel:
  - `limparEnvsProjetoNoVercel`
- Bucket compartilhado HTTP:
  - `uploadArquivoBucketCompartilhado`
  - `obterUrlArquivoBucketCompartilhado`
  - `excluirArquivoBucketCompartilhado`

---

## 11) Deploy de rules e pipeline

Scripts npm (package.json):
- `npm run firestore:rules:deploy:portable`
- `npm run functions:deploy`

Script de rules:
- `scripts/deploy-firestore-rules.js`
- suporta `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_RULES_PROJECTS`, `FIREBASE_TOKEN`.

GitHub Action:
- `.github/workflows/deploy-firestore-rules.yml`
- dispara em `main` e `anova` quando `firestore.rules` muda.

---

## 12) Ambiente e variaveis importantes

Frontend:
- `REACT_APP_FIREBASE_PROJECT_KEYS` e blocos `REACT_APP_FIREBASE_<PREFIX>_*`
- `REACT_APP_FIREBASE_VAPID_KEY` ou por projeto `..._<PREFIX>_VAPID_KEY`
- `REACT_APP_MERCADO_PAGO_DISABLE_PROJECTS`
- (opcional) `REACT_APP_FIREBASE_TARGET`

Functions:
- `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`
- `SHARED_STORAGE_BUCKET`, `SHARED_BUCKET_AUTH_PROJECTS`
- `SYSTEM_MANAGER_OWNER_UID(S)` / `SYSTEM_MANAGER_OWNER_EMAIL(S)` (e legados admin)

---

## 13) Problemas recorrentes e diagnostico rapido

1. `Missing or insufficient permissions`
- Confirmar deploy de `firestore.rules` no projeto correto.
- Confirmar contexto do projeto (oneowner runtime namespaced).

2. `Failed precondition / index required`
- Criar/deploy dos indices em `firestore.indexes.json`.

3. CORS em Functions
- Verificar se endpoint e callable/onRequest com `cors: true`.
- Verificar projeto correto e deploy de functions nesse projeto.

4. `ERR_CONNECTION_CLOSED` / `ERR_NAME_NOT_RESOLVED`
- Problema de rede local/proxy/DNS/firewall (nao e bug de regra/codigo).

---

## 14) Como pedir ajuda ao ChatGPT externo (prompt pronto)
Cole isso no ChatGPT externo:

```text
Estou trabalhando no projeto ALY-REACT (React + Firebase).
Leia este handoff e me ajude a finalizar o projeto sem quebrar arquitetura existente.

Regras:
1) Preserve compatibilidade legado (admin/owner, onepage/oneowner).
2) Priorize correcoes pequenas e seguras, com diff objetivo.
3) Sempre indique arquivos afetados e risco de regressao.
4) Para problemas de permissao, considere firestore.rules + namespace oneowner.
5) Para lives, considere contato/conversa/webrtc e bootstrap de participantes.

Objetivo atual:
[cole aqui o objetivo da vez]
```

---

## 15) Proximos passos recomendados
1. Fechar fluxos de live (viewer) com observabilidade:
   - gravar status tecnico no doc `webrtc/{peerId}` (offer/answer/ice).
2. Consolidar nomenclaturas no frontend inteiro:
   - `owner`/`oneowner` sem residuos de `admin`/`onepage`.
3. Revisar permissao de join em `contatos` para live e chat.
4. Escrever testes de regressao para:
   - redirecionamento pos-login
   - carregamento de skin owner em oneowner
   - solicitacoes PIX e liberacao de conteudo
5. Documentar matriz de deploy por projeto:
   - quais projetos recebem `rules`, `indexes`, `functions`.

---

## 16) Nota final
Este documento foi feito para continuidade tecnica fora do Codex.
Use sempre os caminhos e contratos aqui como fonte de verdade antes de refatorar.

---

## 17) Estado atual (bugs abertos)
1. Viewer de live em alguns cenarios fica em "Conectando camera do criador..." ou falha com `permission-denied` em `webrtc`.
2. Alguns projetos reportam CORS em `obterStatusMercadoPago` quando functions/rules nao estao alinhadas no projeto alvo.
3. Em multiowner, acesso a skin de outro usuario pode cair em erro quando a leitura de espacos falha por regra.
4. Em alguns fluxos, carga inicial de home/layout ainda tem "piscada" visual antes de aplicar estilo final.

Checklist minimo ao retomar:
- Validar deploy de `firestore.rules` + `firestore.indexes.json` em todos os projetos ativos.
- Conferir se o runtime de oneowner esta namespaced em `projetos/{systemKey}` e sem escrita duplicada em raiz.
- Verificar grants de leitura/escrita para `contatos/conversas/webrtc/*` para host e viewers autorizados.

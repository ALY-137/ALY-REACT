# ALY-REACT - Trabalho de Seguranca

Atualizado em: 2026-06-07

## Objetivo

Este documento registra o trabalho atual de seguranca do ALY-REACT e as decisoes tomadas para proteger o sistema sem quebrar a matriz de acesso do produto.

O sistema nao usa uma regra simples de "logado ve, deslogado nao ve". Existem fluxos diferentes para:

- visitantes deslogados em paginas publicas;
- visitantes deslogados com link, QR ou liberacao especifica;
- usuarios logados comuns;
- compradores;
- assinantes;
- owner/admin.

Por isso, a estrategia adotada foi fortalecer escrita, uploads e conteudo sensivel sem bloquear assets que precisam aparecer publicamente.

## Decisao atual sobre credenciais expostas

Algumas variaveis de ambiente e chaves ja foram expostas no historico do projeto.

Decisao atual:

- a rotacao completa das envs ficara para uma etapa futura;
- enquanto isso, as regras do Firebase serao usadas como controle compensatorio;
- nenhum token, chave privada ou segredo deve ser repetido em documentacao, issues ou commits;
- `.env.local`, `.env.discord.local` e `/functions/.env.*` devem continuar ignorados pelo Git;
- `.env.example` deve servir apenas como template sem valores reais.

Observacao importante: chaves `REACT_APP_FIREBASE_*` do frontend nao devem ser tratadas como segredo absoluto, porque apps web Firebase precisam envia-las ao navegador. A protecao real vem de Firestore Rules, Storage Rules, Auth, App Check, restricoes de API key e regras de deploy.

Tokens privados, service accounts e tokens de deploy continuam sendo risco critico se expostos. Eles devem ser revogados quando for possivel fazer a troca sem interromper o uso atual.

## Controles aplicados

### 1. XSS em conteudo HTML

Arquivos envolvidos:

- `src/components/Layout/Espacos/SkinsEspaco.jsx`
- `src/components/Layout/Espacos/EspacoPage.jsx`
- `package.json`
- `package-lock.json`

Status:

- `dompurify` foi adicionado ao projeto;
- renderizacoes com `dangerouslySetInnerHTML` passaram a sanitizar o HTML antes de exibir;
- o objetivo e manter suporte a conteudo rico sem aceitar HTML perigoso diretamente.

Pendente:

- testar paginas com conteudo HTML real;
- revisar se existem outras entradas futuras usando HTML customizado.

### 2. Firestore Rules

Arquivo:

- `firestore.rules`

Mudanca principal:

- `isAdmin()` passou a priorizar custom claims (`role == "admin"` ou `isAdmin == true`);
- a regra dinamica por configuracao do sistema foi preservada via `isAdminDinamico()`;
- UIDs/e-mails hardcoded foram removidos dessa funcao.

Cuidados:

- antes de depender somente de custom claims, configurar os claims no Firebase Admin SDK;
- validar se o owner principal continua com permissao em todos os projetos ativos;
- testar especialmente os fluxos de oneowner/runtime namespaced.

### 3. Storage Rules

Arquivo:

- `storage.rules`

Principio adotado:

```txt
Firestore decide quem pode ver o conteudo.
Storage serve assets e protege escrita, upload e originais.
```

Isso evita endurecer tudo para usuario logado e quebrar:

- paginas publicas;
- cards publicados;
- deck fisico;
- QR;
- previews bloqueados;
- imagens de add-ons;
- banners de live;
- branding usado antes do login.

#### Leitura publica mantida

Os seguintes paths continuam com leitura publica intencional:

- `imagens/{...}`
- `branding/{projectKey}/{userId}/{...}`
- `users/{userId}/branding/{projectKey}/{...}`
- `users/{userId}/icon-collections/{...}`
- `users/{userId}/skins/{skinId}/avatar/{...}`
- `users/{userId}/add_ons/{...}`
- `users/{userId}/espacos/{espacoId}/blocos/{blocoId}/preview/{...}`
- `users/{userId}/espacos/{espacoId}/blocos/{blocoId}/cards/{cardId}/{...}`
- `users/{userId}/espacos/{espacoId}/blocos/{blocoId}/live/{...}`

Motivo: esses assets podem aparecer para visitantes deslogados quando o Firestore ja liberou a pagina, o card, a skin, o preview ou a live.

#### Originais protegidos

Path:

- `users/{userId}/espacos/{espacoId}/blocos/{blocoId}/original/{...}`

Regra atual:

- leitura via SDK permitida para owner/admin ou usuario autenticado;
- visitantes deslogados devem depender de URLs tokenizadas gravadas nos documentos autorizados;
- escrita/delecao somente owner/admin.

Motivo: preservar o fluxo de conteudo pago/restrito sem vazar o original diretamente para todo visitante anonimo.

#### QR PIX

Path:

- `users/{userId}/integracoes/pixManual/qrs/{...}`

Regra atual:

- owner/admin podem gerenciar;
- usuarios autenticados podem ler quando o fluxo precisar exibir QR;
- links tokenizados continuam funcionando quando o documento autorizado trouxer a URL.

#### Escrita e upload

Para novos uploads:

- escrita/delecao fica restrita a owner/admin;
- uploads precisam ser `image/*`;
- foram adicionados limites de tamanho por tipo de asset.

Limites atuais:

- branding, avatar, icones, add-ons e QR PIX: 5 MB;
- imagens globais, previews, cards e live: 10 MB;
- originais de blocos: 25 MB.

#### Admin temporario

`storage.rules` ainda possui fallback temporario por UID do owner principal enquanto custom claims nao estiverem configuradas em todos os ambientes.

Plano:

1. configurar custom claims para owner/admin;
2. testar permissao de upload/delecao;
3. remover fallback por UID.

### 4. Hash de logins por e-mail e senha

Arquivos envolvidos:

- `src/components/Banco/loginSecurityHash.js`
- `src/components/Banco/bootstrapUser.js`
- `src/components/Layout/Geral/LoginCadastroEmail.jsx`

Status:

- foi adicionada uma camada de hash SHA-256 para registros de login feitos por e-mail/senha;
- os hashes sao gravados nos subdocumentos `users/{uid}/logins/{loginId}` e no namespace equivalente `projetos/{projectKey}/users/{uid}/logins/{loginId}`;
- o hash usa e-mail normalizado, UID e contexto do projeto para gerar identificadores de auditoria sem gravar o e-mail puro no registro de login;
- o fluxo tambem registra `provider: "email_password"`, `providerId: "password"` e `loginFlow` (`login` ou `cadastro`).

Decisao de seguranca:

- a senha nao e salva no app;
- a senha tambem nao e hasheada no frontend, porque hash de senha no cliente ainda poderia virar credencial reutilizavel se vazasse;
- o armazenamento e a verificacao da senha continuam sob responsabilidade do Firebase Auth;
- o app registra somente hashes auxiliares para auditoria/correlacao de login por e-mail/senha.

Campos adicionados ao log:

- `emailHash`
- `loginFingerprintHash`
- `emailPasswordHash.hashAlgorithm`
- `emailPasswordHash.hashVersion`
- `emailPasswordHash.passwordManagedBy`
- `emailPasswordHash.passwordStoredInApp`

## Arquivos alterados neste trabalho

- `.gitignore`
- `.env.example`
- `SECURITY_FIXES.md`
- `firestore.rules`
- `storage.rules`
- `package.json`
- `package-lock.json`
- `src/components/Layout/Espacos/SkinsEspaco.jsx`
- `src/components/Layout/Espacos/EspacoPage.jsx`
- `src/components/Banco/loginSecurityHash.js`
- `src/components/Banco/bootstrapUser.js`
- `src/components/Layout/Geral/LoginCadastroEmail.jsx`

## Checklist antes de deployar rules

Validar estes fluxos antes de rodar deploy:

1. Visitante deslogado abre uma pagina publica.
2. Visitante deslogado abre card/QR/link liberado.
3. Visitante deslogado ve previews de conteudo bloqueado, mas nao original protegido.
4. Usuario logado comum acessa conteudo permitido.
5. Comprador ve conteudo comprado.
6. Assinante ve conteudo exclusivo de assinante.
7. Owner cria, edita e exclui:
   - imagem de bloco;
   - card com imagem;
   - banner de live;
   - add-on com icone;
   - branding/logo/favicon;
   - avatar de skin;
   - QR PIX.
8. Usuario nao owner tenta upload/delecao e recebe bloqueio.
9. Pagina de login carrega branding antes da autenticacao.
10. Live publica carrega banner/asset esperado.

## Checklist tecnico pendente

- Configurar custom claims para admins/owners.
- Avaliar App Check para reduzir abuso de API pelo frontend.
- Restringir API keys por dominio e APIs permitidas no Google Cloud.
- Planejar rotacao futura de tokens privados e chaves expostas.
- Remover arquivos sensiveis do historico quando a rotacao for feita.
- Adicionar rotina/pre-commit de deteccao de segredos.
- Validar `npm run build`; na ultima tentativa o build ficou preso em `Creating an optimized production build...`.

## Comandos uteis

Validar build:

```bash
cmd /c npm run build
```

Deploy de Firestore Rules:

```bash
npm run firestore:rules:deploy:portable
```

Deploy de Storage Rules:

```bash
npx firebase-tools deploy --only storage
```

## Observacao final

O foco desta etapa foi reduzir risco sem perder a natureza publica/restrita/hibrida do ALY. A prioridade agora e testar a matriz de acesso antes de deployar as regras em producao.

# Protocolo de Seguranca Codex e Operacoes Sensiveis

Status: ativo
Data: 2026-06-23

## Objetivo

Este protocolo define como o Codex deve agir quando receber pedidos que possam afetar seguranca, privacidade, dados, deploy, repositorio, banco, regras de acesso ou credenciais do projeto.

O objetivo nao e provar identidade pela conversa. O objetivo e reduzir dano caso a sessao, o navegador, o IDE ou o computador estejam comprometidos.

## Premissa principal

O Codex nao consegue garantir que a pessoa digitando e a proprietaria legitima da sessao.

Se alguem invadir o computador, abrir o IDE ou usar uma sessao autenticada, essa pessoa pode parecer ser a usuaria legitima para o Codex. Portanto:

```txt
PC comprometido = identidade da sessao comprometida.
```

Este protocolo trata a conversa como uma interface operacional, nao como prova forte de identidade.

## Regra de ouro

Para acoes sensiveis, o Codex deve reduzir autonomia e aumentar confirmacao.

O Codex deve:

1. Explicar o risco quando a acao puder causar perda, exposicao ou mudanca irreversivel.
2. Confirmar escopo antes de executar acoes sensiveis.
3. Evitar operar sobre segredos, tokens e arquivos `.env`.
4. Nunca expor valores secretos em respostas.
5. Recusar pedidos que reduzam seguranca sem justificativa tecnica clara.
6. Pausar quando o pedido parecer fora do padrao normal de trabalho.

## Classificacao de acoes

### Baixo risco

Podem ser executadas sem confirmacao extra quando fizerem parte da tarefa:

1. Ler arquivos comuns do projeto.
2. Buscar texto com `rg`.
3. Explicar codigo.
4. Editar documentacao.
5. Rodar build, lint ou testes locais.
6. Criar componentes, estilos e funcoes dentro do escopo pedido.

Mesmo em baixo risco, o Codex deve evitar ler arquivos sensiveis como `.env.local`, chaves privadas, dumps, tokens ou credenciais.

### Medio risco

Podem ser executadas quando o pedido do usuario indicar claramente a tarefa, mas exigem cuidado de escopo:

1. Alterar codigo de autenticacao.
2. Alterar regras de privacidade visual.
3. Alterar telas administrativas.
4. Alterar fluxos de login/cadastro.
5. Alterar validacoes de formularios.
6. Criar scripts internos.

Nesses casos, o Codex deve testar quando possivel e explicar o que mudou.

### Alto risco

Exigem pedido explicito no turno atual ou confirmacao clara antes da execucao:

1. `git commit`.
2. `git push`.
3. Deploy em producao.
4. Deploy de Cloud Functions.
5. Deploy de Firestore Rules ou Storage Rules.
6. Alterar configuracoes de Vercel, Firebase, GitHub ou Google Cloud.
7. Alterar permissoes administrativas.
8. Exportar dados de usuarios.
9. Alterar politicas LGPD, termos, privacidade ou retencao.
10. Rodar scripts que escrevem no banco.
11. Instalar dependencias novas.
12. Rodar comandos com acesso de rede que alterem estado externo.

Atalhos como `c and p` ou `c e p` podem ser entendidos como commit e push apenas quando o contexto estiver claro e a mudanca nao incluir operacao destrutiva, segredo, deploy ou banco. Se houver duvida, o Codex deve pausar.

### Critico ou destrutivo

Exigem confirmacao detalhada e devem ser recusadas ou pausadas se o risco nao estiver claro:

1. Apagar colecoes/documentos em massa.
2. Rodar `git reset --hard`, force push ou comandos equivalentes.
3. Remover historico de auditoria.
4. Desativar logs de seguranca.
5. Tornar dados privados publicos.
6. Expor tokens, secrets, chaves privadas ou `.env`.
7. Desabilitar regras de seguranca.
8. Criar bypass de login, admin ou auditoria.
9. Alterar owner/admin sem trilha clara.
10. Baixar e executar scripts remotos sem auditoria.

Para essas acoes, o Codex deve explicar o risco, confirmar alvo exato e preferir alternativas reversiveis.

## Confirmacao para operacoes sensiveis

Quando precisar confirmar, o Codex deve pedir confirmacao com os dados objetivos:

```txt
Acao:
Alvo:
Ambiente:
Branch/projeto:
Risco:
Plano de reversao:
```

Exemplo:

```txt
Confirmar deploy de Firestore Rules para o projeto X em producao.
Risco: regra incorreta pode bloquear usuarios ou expor dados.
Reversao: restaurar rules anteriores e redeploy.
```

Uma frase secreta dentro do chat nao deve ser usada como fator forte de identidade. Se o PC estiver comprometido, ela tambem pode ser vista ou digitada pelo invasor.

## Arquivos e dados sensiveis

O Codex deve tratar como sensiveis:

1. `.env`, `.env.local`, `.env.production` e similares.
2. Chaves privadas.
3. Service accounts.
4. Tokens GitHub, Firebase, Vercel, Google Cloud, Discord ou Stripe.
5. Dumps de banco.
6. Dados pessoais de usuarios.
7. Logs com IP bruto, e-mail, telefone ou identificadores sensiveis.
8. Arquivos de estado com tokens ou sessoes locais.

O Codex pode orientar sobre como proteger esses arquivos, mas nao deve imprimir seus conteudos.

## Comportamentos que devem acionar pausa

O Codex deve pausar e pedir confirmacao quando o pedido:

1. Tentar remover auditoria, logs, historico ou trilhas de seguranca.
2. Pedir para "liberar tudo", "desativar regras" ou "ignorar permissao".
3. Pedir commit/push/deploy logo apos mudancas nao revisadas.
4. Pedir acesso a `.env.local` ou exibicao de token.
5. Pedir alteracao de owner/admin.
6. Pedir exclusao de dados sem backup ou alvo preciso.
7. Contrariar decisoes anteriores de seguranca documentadas.
8. Parecer urgente demais e sem contexto tecnico.

## Se houver suspeita de invasao

Se a usuaria suspeitar de invasao ou comportamento estranho, o Codex deve orientar a:

1. Parar commits, pushes e deploys.
2. Bloquear a tela e desconectar sessoes suspeitas.
3. Trocar senhas a partir de outro dispositivo confiavel.
4. Revogar tokens e sessoes no GitHub, Google/Firebase e Vercel.
5. Ativar ou revisar 2FA.
6. Verificar extensoes do navegador e programas instalados.
7. Fazer varredura com antivirus/Windows Defender.
8. Revisar ultimos commits, deploys, rules e logs de auditoria.

Durante suspeita ativa, o Codex deve evitar executar comandos que alterem estado remoto.

## Regras especificas para este projeto

Neste projeto, o Codex deve considerar sensiveis:

1. Regras do Firebase.
2. Cloud Functions.
3. Configuracoes do gerenciador.
4. Controle de IP do gerenciador.
5. Auditoria operacional.
6. Registros de acesso.
7. Solicitacoes LGPD.
8. Modulos de vendas e pedidos.
9. Configuracoes SEO/indexacao.
10. Dados de projetos oneowner em runtime compartilhado.

Alteracoes nesses pontos exigem explicacao clara e validacao depois da implementacao.

## Compromisso operacional do Codex

O Codex deve trabalhar de forma proativa, mas nao inconsequente.

Para mudancas comuns, ele pode implementar e validar.

Para mudancas sensiveis, ele deve:

1. Ler o contexto.
2. Explicar o impacto.
3. Confirmar o alvo quando necessario.
4. Executar o menor escopo suficiente.
5. Validar com build, teste ou checagem aplicavel.
6. Registrar no documento de seguranca quando a mudanca fizer parte da postura de seguranca/auditoria.

Este protocolo passa a ser a referencia de comportamento para operacoes sensiveis solicitadas ao Codex neste repositorio.

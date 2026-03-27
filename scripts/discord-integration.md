# Integracao com Discord

## Objetivo
Permitir comandos simples no projeto pelo Discord, com uma whitelist segura.

## Arquivos
- `scripts/discord-bot.mjs`
- `scripts/discord-notify.mjs`
- `scripts/discord-common.mjs`

## Variaveis de ambiente
Crie um arquivo local `/.env.discord.local` com:

```env
DISCORD_BOT_TOKEN=seu_token_do_bot
DISCORD_CHANNEL_ID=id_do_canal
DISCORD_ALLOWED_USER_IDS=seu_user_id_discord
DISCORD_COMMAND_PREFIX=!
DISCORD_POLL_INTERVAL_MS=8000
```

Opcional para notificacoes simples via webhook:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## Como criar o bot
1. Discord Developer Portal
2. Crie uma Application
3. Aba `Bot` -> `Add Bot`
4. Copie o token
5. Convide o bot para o servidor com permissao de ler e enviar mensagens no canal escolhido

## Como pegar o channel id
1. Ative `Modo Desenvolvedor` no Discord
2. Clique direito no canal
3. `Copiar ID do Canal`

## Como pegar seu user id
1. Ative `Modo Desenvolvedor`
2. Clique direito no seu usuario
3. `Copiar ID`

## Comandos suportados
- `!help`
- `!ping`
- `!status`
- `!gitstatus`
- `!build`
- `!notify texto livre`

## Execucao
```powershell
node scripts/discord-bot.mjs
```

## Notificacao avulsa
```powershell
node scripts/discord-notify.mjs "Build finalizado"
```

## Observacao de seguranca
O bot executa apenas comandos permitidos no codigo. Nao aceite comandos arbitrarios do Discord.

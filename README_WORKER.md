# ZEN Seguros - Cloudflare Worker + Static Assets

Esta versão usa o fluxo novo do Cloudflare Workers com Static Assets.

- Site estático: `public/`
- Worker: `src/index.js`
- API do formulário: `/api/cotacao`
- Configuração: `wrangler.jsonc`

Variáveis runtime obrigatórias no Cloudflare:
- `APPS_SCRIPT_URL`
- `APPS_SCRIPT_SECRET`

Deploy command: `npx wrangler deploy`
Build command: vazio

Depois do deploy, habilite o subdomínio `workers.dev` na aba Domains.

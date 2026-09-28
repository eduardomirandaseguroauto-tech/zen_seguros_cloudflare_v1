# ZEN Seguros — Cloudflare Pages

Esta versão substitui apenas a camada Netlify. O Google Apps Script e a planilha continuam iguais.

## Estrutura

- `public/` — site estático
- `functions/api/cotacao.js` — Pages Function responsável por enviar o formulário ao Apps Script
- `Code.gs` — backend Google Apps Script já usado no projeto

## Variáveis necessárias no Cloudflare Pages

Cadastre duas variáveis de produção no projeto:

- `APPS_SCRIPT_URL` = URL do Web App do Google Apps Script terminando em `/exec`
- `APPS_SCRIPT_SECRET` = chave criada pela função `showApiSecret`

O segredo não deve ser colocado no HTML ou JavaScript público.

## Configuração no Cloudflare Pages

Ao importar o repositório GitHub:

- Framework preset: `None`
- Production branch: `main`
- Build command: deixe vazio
- Build output directory: `public`
- Root directory: `/` (padrão)

A pasta `functions/` na raiz é descoberta automaticamente pelo Pages.

## Teste da Function

Depois do deploy, abra:

`https://SEU-PROJETO.pages.dev/api/cotacao`

Uma visita GET deve responder JSON com `Método não permitido.`. Isso confirma que a Function foi publicada.

Depois teste o formulário normalmente.

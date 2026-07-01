# Finly Assistente Financeiro

Finly e um assistente financeiro dark-first para controle pessoal de receitas, despesas, parcelas, categorias, investimentos e administracao de usuarios por convite.

App em producao:

```text
https://assistente-de-planilha.pages.dev/
```

## Status

Versao atual: `v1.0.0`

Esta versao entrega a base funcional do produto:

- Login por email/senha e Google via Supabase Auth.
- Criacao de conta somente por convite.
- Usuarios com dados separados e categorias padrao.
- Dashboard mensal com resumo compacto e expansivel.
- Lancamentos fixos, variaveis, parcelados e recebidos.
- Graficos financeiros.
- Perfil com nome de exibicao e troca de senha.
- Painel admin com usuarios, convites, logs e backup manual.
- Politica de privacidade publica.
- Deploy web em Cloudflare Pages + Supabase.

## Stack

- Frontend: HTML, CSS e JavaScript sem framework.
- Backend web: Cloudflare Pages Functions em TypeScript.
- Banco e autenticacao: Supabase Auth + Supabase Postgres.
- Hospedagem: Cloudflare Pages.
- Validacao TypeScript: `tsc --noEmit`.
- Versao local/desktop: Python, FastAPI, React e Tauri permanecem no repositorio para evolucao futura.

## Estrutura principal

```text
finance_app/web/static/     Front web publicado
functions/api/              API para Cloudflare Pages Functions
supabase/schema.sql         Schema do banco Supabase
desktop/                    Versao desktop Tauri
finance_app/                Core Python/local
scripts/                    Scripts auxiliares
tests/                      Testes Python
```

## Variaveis necessarias

Configure estas variaveis no Cloudflare Pages:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-publica
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
LEGACY_OWNER_EMAIL=seu-email-legado
ADMIN_EMAIL=email-admin
```

Notas:

- `SUPABASE_ANON_KEY` e publica e pode ser usada pelo front.
- `SUPABASE_SERVICE_ROLE_KEY` e secreta, deve ficar somente no Cloudflare e nunca deve ser exposta no JavaScript do navegador.
- `ADMIN_EMAIL` define qual conta recebe acesso ao painel Admin.
- `LEGACY_OWNER_EMAIL` preserva acesso/dados do primeiro usuario usado durante a migracao.

## Deploy no Cloudflare Pages

Configuracao recomendada:

```text
Production branch: main
Framework preset: None
Build command: deixe vazio
Build output directory: finance_app/web/static
```

Fluxo de trabalho:

1. Desenvolver e testar na branch `develop`.
2. Fazer merge de `develop` para `main`.
3. O Cloudflare Pages publica automaticamente a branch `main`.
4. Conferir o app em `https://assistente-de-planilha.pages.dev/`.

Antes do primeiro deploy, rode o schema no Supabase:

```text
supabase/schema.sql
```

No Supabase, configure Authentication > URL Configuration:

```text
Site URL:
https://assistente-de-planilha.pages.dev/

Redirect URLs:
https://assistente-de-planilha.pages.dev/
https://assistente-de-planilha.pages.dev/*
```

## Observacoes sobre Supabase e Cloudflare

- O Cloudflare Pages hospeda o front estatico e executa a API serverless em `functions/api`.
- O Supabase guarda usuarios, dados financeiros, categorias, convites, logs e configuracoes.
- O app depende das variaveis de ambiente do Cloudflare para a API acessar o Supabase com seguranca.
- Backups manuais podem ser baixados pelo painel Admin.
- Criacao de novas contas deve passar por convite; o convite e validado pelo email autenticado.

## Como rodar localmente

Instale as dependencias Node:

```powershell
npm install
```

Valide TypeScript:

```powershell
& "D:\Program Files\nodejs\node.exe" .\node_modules\typescript\bin\tsc --noEmit
```

Valide o JavaScript do front:

```powershell
node --check finance_app\web\static\app.js
```

Para a versao Python local:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

## Versao desktop

A versao desktop usa FastAPI no Python, React no visual e Tauri para abrir como app de PC.

Pre-requisitos:

- Node.js LTS
- Rust
- WebView2 no Windows

Rodar em desenvolvimento:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\scripts\start_api.ps1
```

Em outro terminal:

```powershell
cd desktop
npm install
npm run desktop:dev
```

Gerar pacote desktop:

```powershell
cd desktop
npm run desktop:build
```

## Testes

Testes Python:

```powershell
python -m unittest discover
```

Checks usados antes da release:

```powershell
node --check finance_app\web\static\app.js
& "D:\Program Files\nodejs\node.exe" .\node_modules\typescript\bin\tsc --noEmit
git diff --check
```

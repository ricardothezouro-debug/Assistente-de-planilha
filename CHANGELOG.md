# Changelog

## v1.0.0 - 2026-07-01

Primeira versao estavel do Finly Assistente Financeiro.

### Adicionado

- App web publicado em Cloudflare Pages.
- Autenticacao por email/senha e Google via Supabase.
- Criacao de contas por convite com validacao por email.
- Dashboard financeiro com resumo mensal compacto e expansivel.
- Lancamentos fixos, variaveis, parcelados e recebidos.
- Categorias padrao e categorias personalizadas por usuario.
- Graficos financeiros de mes e ano.
- Perfil com nome de exibicao e troca de senha.
- Painel admin com usuarios, convites, logs, backup manual e controle de contas.
- Politica de privacidade publica.

### Infraestrutura

- Supabase Auth e Supabase Postgres como backend de dados.
- Cloudflare Pages Functions como API serverless.
- Schema SQL versionado em `supabase/schema.sql`.
- Fluxo de producao usando `develop` para desenvolvimento e `main` para deploy.

# Assistente de planilha

App local em Python para controle financeiro de 2026.

## Como rodar

No terminal do VS Code, com o ambiente virtual ativo:

```powershell
.\.venv\Scripts\Activate.ps1
python main.py
```

## Como rodar o front web

No terminal do VS Code, com o ambiente virtual ativo:

```powershell
python web_main.py
```

Depois abra:

```text
http://127.0.0.1:8765
```

## Como testar

```powershell
python -m unittest discover
```

## Como publicar no Cloudflare Pages

Essa versao usa o front estatico em `finance_app/web/static`, Cloudflare Pages Functions em `functions/api` e Supabase como banco/autenticacao.

Antes do primeiro deploy, abra o SQL Editor do Supabase e rode o arquivo:

```text
supabase/schema.sql
```

No Cloudflare Pages, use:

```text
Production branch: main
Framework preset: None
Build command: deixe vazio
Build output directory: finance_app/web/static
```

Configure estas variaveis de ambiente no Cloudflare:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-publica
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
LEGACY_OWNER_EMAIL=gamoxkun@gmail.com
ADMIN_EMAIL=gamoxkun@gmail.com
```

`SUPABASE_SERVICE_ROLE_KEY` e secreta. Ela fica em Supabase > Project Settings > API Keys e deve ir apenas no Cloudflare, nunca no JavaScript do front.

Depois do deploy, atualize em Supabase > Authentication > URL Configuration:

```text
Site URL: https://seu-site.pages.dev
Redirect URLs:
https://seu-site.pages.dev/
https://seu-site.pages.dev/*
```

## Como rodar a versao desktop moderna

Essa versao usa FastAPI no Python, React no visual e Tauri para abrir como app de PC.

Pre-requisitos dessa versao:

- Node.js LTS
- Rust
- WebView2, que normalmente ja vem no Windows 10/11

Primeiro, instale as dependencias Python:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Para desenvolvimento, voce pode subir a API manualmente:

```powershell
.\scripts\start_api.ps1
```

Em outro terminal, rode a janela desktop:

```powershell
cd desktop
npm install
npm run desktop:dev
```

Depois da primeira instalacao, tambem pode usar:

```powershell
.\scripts\start_desktop_front.ps1
```

Se precisar trocar o endereco da API, copie `desktop/.env.example` para `desktop/.env` e ajuste `VITE_API_URL`.

## Como gerar o app desktop empacotado

Para gerar apenas o sidecar da API Python:

```powershell
.\scripts\build_sidecar.ps1
```

Para gerar o aplicativo instalavel completo:

```powershell
cd desktop
npm run desktop:build
```

O app empacotado abre a API Python automaticamente por tras da janela. No Windows, o banco do app empacotado fica em:

```text
%LOCALAPPDATA%\Financeiro\data\financeiro.db
```

Se quiser rodar a janela desktop em modo desenvolvimento usando a API manual, sem iniciar o sidecar, use:

```powershell
$env:FINANCEIRO_SKIP_SIDECAR = "1"
cd desktop
npm run desktop:dev
```

## Uso rapido

- No app web publicado, o login usa email/senha ou Google pelo Supabase.
- A conta com email igual a `ADMIN_EMAIL` ganha a aba Admin automaticamente.
- Novas contas podem ser criadas pela tela de login; cada usuario comeca com categorias padrao e planilha sem lancamentos.
- Use o formulario da esquerda para lancar gastos, parcelas e recebidos.
- Use Nova ao lado de Categoria para criar uma categoria personalizada.
- Use Calendario ao lado de Data para escolher uma data clicando; ele abre no dia atual.
- Clique duas vezes em um lancamento para alternar entre Pago e Nao pago.
- Clique com o botao direito em uma fixa para remover todos os meses, deste mes em diante ou somente o mes atual.
- Clique com o botao direito em uma parcela para remover todas as parcelas, desta parcela em diante ou somente esta parcela.
- Clique com o botao direito em variaveis e recebidos para remover o lancamento.
- Use a aba Graficos para visualizar gastos por categoria no mes e recebido versus despesas no ano.
- Use Alterar investido inicial para corrigir o saldo investido que entra no total do ano.

## Dados

No app Python de desenvolvimento, o banco SQLite fica em:

```text
data/financeiro.db
```

Se quiser recomecar do zero, feche o app e apague esse arquivo. Na proxima abertura, os dados iniciais serao recriados.

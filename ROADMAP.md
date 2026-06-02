# Roadmap do app financeiro

## Agora: app local funcional

- Manter o app Python/Tkinter como laboratorio das regras.
- Usar o front web local como primeira experiencia visual moderna.
- Manter a nova camada React/Tauri como caminho principal para desktop.
- Melhorar a experiencia de lancamento, edicao, remocao e graficos.
- Consolidar testes para parcelas, fixas, recebidos, investimentos, categorias e exclusoes parciais.

## Proxima etapa: base mais forte

- Separar melhor o dominio financeiro da interface.
- Evoluir a camada de API local em FastAPI.
- Manter SQLite no inicio, com caminho aberto para trocar por Postgres se o app crescer.
- Criar exportacao/importacao de backup.
- Adicionar tela de edicao completa de lancamentos existentes.
- Empacotar o backend como sidecar do Tauri para abrir tudo em um clique.

## Front moderno

- Criar um front escuro e moderno com React + TypeScript.
- Usar componentes de dashboard, cards compactos, tabela filtravel e graficos melhores.
- Manter o Python como backend local/API.
- Considerar Tauri para empacotar como aplicativo desktop leve.

## Celular

- Primeiro caminho recomendado: transformar o front em PWA responsivo.
- Rodar a API no computador e acessar pelo celular na mesma rede.
- Depois adicionar sincronizacao e autenticacao simples, se fizer sentido.

## Android

- Se a experiencia mobile virar prioridade, criar app com React Native/Expo.
- Reaproveitar regras da API em Python no inicio.
- Em uma fase mais madura, decidir entre:
  - app Android falando com backend local/nuvem;
  - app Android com banco local e sincronizacao;
  - PWA instalada como aplicativo, se for suficiente.

## Ordem recomendada

1. Fechar bem as regras financeiras no app atual.
2. Adicionar edicao e relatorios melhores.
3. Criar API local em Python.
4. Criar front React dark moderno.
5. Adaptar para celular como PWA.
6. Decidir se vale criar Android nativo/Expo.

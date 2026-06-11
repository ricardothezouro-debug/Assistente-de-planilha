# Finly - Visual Design Specifications

Este documento define a identidade visual e os padrões de interface do Finly, um assistente financeiro dark-first de alta performance.

## 1. Core Visual Identity

- **Design System:** Finly Modern Dark
- **Visual Style:** Dark-First, profissional, minimalista, tech-finance.
- **Atmosphere:** Superfícies em camadas, contrastes vibrantes em tons de verde-água e tipografia nítida.

## 2. Design Tokens

### Colors

- **Background (Canvas):** `#070B14`
- **Primary (Action):** `#2DE2C3`
- **Surface (Elevated):** `#0D1320`
- **Surface Dim:** `#080D16`
- **Text Primary:** `#F8FAFC`
- **Text Secondary:** `#94A3B8`
- **Negative (Danger):** `#FB7185`
- **Positive (Success):** `#22C55E`

### Typography

- **Primary Font:** Inter
- **Display:** 32px / Bold
- **Headline:** 24px / Bold
- **Title:** 18px / Semibold
- **Body:** 14px / Regular
- **Label:** 12px / Medium

### Geometry & Spacing

- **Border Radius:** 12px para botões e inputs; 16px para cards principais.
- **Grid:** 12 colunas em desktop, com 24px de gap.
- **Padding:** mínimo de 24px em containers de conteúdo.

## 3. UI Component Patterns

### Navigation

- Sidebar fixa entre 240px e 260px, com fundo `#080D16`.
- Estados ativos usam `#2DE2C3`.
- Top bar transparente ou com blur `backdrop-filter: blur(12px)`.

### Cards & Containers

- Fundo `#0D1320`.
- Borda sutil de 1px em `#1E293B`.
- Sombra suave `0 14px 40px rgba(0,0,0,0.22)`.

### Inputs & Forms

- Fundo `#0A111D`.
- Borda `#2B3A52`.
- Foco com borda `#2DE2C3` e glow sutil.

### Data Visualization

- Gráficos principais em `#2DE2C3`.
- Comparações usam gradientes entre `#2DE2C3` e `#38BDF8`, com estados negativos em `#FB7185`.

## 4. Layout Architecture

1. Sidebar navigation à esquerda.
2. Main content area ao centro/direita.
3. Header com título e ações rápidas.
4. Grid de cards no dashboard.
5. Tabelas de dados com linhas zebradas sutis.

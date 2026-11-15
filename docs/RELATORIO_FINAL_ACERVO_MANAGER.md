# Relatório Técnico Final — Acervo Manager CDE, Pipeline Pré-Build 3D, Studio 3D Isolado & Plugins Windows (2022–2026)

**Repositório:** `ArqVertice_Flow/Arqvertice_Flow`  
**Ambiente de Produção:** `https://arqvertice-flow.vercel.app`  
**Data de Fechamento:** 14 de Novembro de 2026  

---

## 1. Arquitetura Consolidada do Módulo Acervo Manager (CDE)

O módulo **Acervo Manager** opera como um Ambiente Comum de Dados (CDE) completo para escritórios de Arquitetura e Engenharia, com paridade 1:1 entre `/admin/acervo/**` e `/equipe/acervo/**`, governança estrita por empreendimento (`ProjectAccess`), bloqueio de revisões `OBSOLETO` e conformidade com LGPD / CSP.

### 1.1 Gestão Documental, GRD, QR Code & Plugins Windows (2022–2026)
- **Workspace Unificado (`/admin/acervo/[projectId]` & `/equipe/acervo/[projectId]`):**
  - Zona A (Cabeçalho Técnico, Código `EMP-DIS-FASE-PRANCHA`, Seletor de Revisões `R00..RN` com alerta de obsolescência e emissão de GRD).
  - Visualizador Dual 2D (PDF/PRANCHA) + 3D (IFC/GLB/FBX) + QR Code de conferência em obra (`/verificar/[qrToken]`).
  - Central de Plugins Windows (`/admin/acervo/plugins` & `/equipe/acervo/plugins`) conectando Revit, AutoCAD, TQS e 3ds Max via Tokens API (`AcervoApiToken` SHA-256).

---

## 2. Pipeline Pré-Build 3D & Política Zero Modelagem Procedural

Para preservar performance WebGL 2.0 e fidelidade visual arquitetônica, toda conversão, otimização de texturas e compressão Meshopt foi isolada fora do visualizador 3D na **Central de Pipeline Pré-Build 3D** (`/admin/acervo/pipeline-3d` e `/equipe/acervo/pipeline-3d`):

- **Regra Estrita Zero Modelagem 3D:** Nenhum modelo, parede ou personagem humano é gerado proceduralmente por código. Arquivos proprietários fechados (`.max`, `.rvt`) ou imagens 2D sem malha aberta são marcados como `NEEDS_EXPORT` (`ERROR`) até exportação prévia em `.glb`, `.usdz` ou `.fbx`.
- **Ativos Reais Compilados (`npm run compile:3d` -> `public/assets/3d-templates/`):**
  - `cozinha-interna.glb` (124.6 KB, 2.816 triângulos, 5 texturas PBR, Meshopt) — `READY`
  - `movel-design-autoral.glb` (271.7 KB, 5.660 triângulos, 4 texturas PBR, Meshopt) — `READY`
  - `living-suite-master.glb` (325.9 KB, 21.600 triângulos, 4 texturas PBR, Meshopt) — `READY`
  - `fachada-deck-lazer` (`Little_Houses_max2016..max`) — `NEEDS_EXPORT` (sem fallback procedural)
  - Avatares (`Blocos Perrsonagens`): `feminino.glb`, `masculino.glb` + previews `.webp`
  - 4 mapas HDRI (`dia-claro.hdr`, `interno.hdr`, `nublado-24k.hdr`, `noite-24k.hdr`)
- **Resiliência Cloud & Serverless (`<= 4 MB`):**
  - `GET /api/acervo/pipeline-3d` lê `manifest.json` + estado persistido no PostgreSQL (`Pipeline3DAssetState`), protegido por `fs.existsSync(...)` contra erros `ENOENT` em servidores Linux/Vercel.
  - `POST /api/acervo/pipeline-3d/step` executa os 3 passos sequenciais (`CONVERT_MESH`, `OPTIMIZE_IMAGES_PBR`, `BUILD_MESHOPT`), comprime `.glb` via Meshopt (`optimizeGlbBuffer`), valida teto serverless de `4 MB` e persiste `binaryBase64` servido por `GET /api/acervo/pipeline-3d/asset/[id]`.

---

## 3. Studio 3D Isolado — Viewport Padrão Sketchfab 1:1 + Controles Nativos 3ds Max (`/acervo/studio-3d/[assetId]`)

- **Céu Real HDRI (2K WebP) + Grounded Skybox + Chão Físico PBR (`StudioGroundSystem.tsx`):**
  - Cada um dos 4 mapas em `\Arquivos\HDRI` (`Dia Claro`, `Interno`, `Nublado`, `Noite`) compila tanto o mapa `.hdr` (`256×128` RGBE para iluminação difusa PMREM) quanto o **Skybox Equiretangular 2K** (`2048×1024` WebP `q82` com *ACES Filmic Tone Mapping*): `dia-claro-sky.webp` (9.8 KB), `interno-sky.webp` (7.4 KB), `nublado-24k-sky.webp` (7.2 KB) e `noite-24k-sky.webp` (12.2 KB).
  - **Domo 360° Ground-Projected:** Hemisfério inferior suavizado sobre o plano do solo e rotacionado em sincronia com o azimute solar (`0°–360°`), com controle de **Suavização / Desfoque do Céu (`0%–100%`)** ou alternância para **Estúdio Infinito Sketchfab** (`Warm Minimalist #EDE5D8`, `Studio Dark #18181B`, `Pure White #F5F5F7`).
  - **Plano de Solo PBR com Fade Radial Infinito (`Y = 0`):** Sem bordas quadradas duras nem *Z-fighting* (`polygonOffset`), com 4 superfícies selecionáveis: *Concreto Arquitetônico Polido* (`ground-concreto.webp`), *Deck / Madeira Natural Cumaru* (`ground-cumaru.webp`), *Mármore / Pedra Acetinada* (`ground-pedra.webp`) e *Shadow Catcher Puro*.
- **Navegação Híbrida Nativa 3ds Max + Sketchfab (`StudioCameraRig.tsx`):**
  - **Mouse:** Orbitar via `Alt + MMB` (3ds Max) ou `LMB` (Sketchfab); Pan via `MMB` (3ds Max) ou `RMB` / `Shift + LMB`; Zoom suave via `Scroll Wheel` adaptativo ou `Ctrl + Alt + MMB`; Duplo-Clique com **Anel de Foco Dinâmico (`#EDE5D8`)** orientado pela normal da superfície clicada.
  - **Atalhos de Teclado 3ds Max:** `Z` (*Zoom Extents* — enquadra o modelo inteiro), `F3` (alterna *Realista PBR Shaded* ↔ *Wireframe*), `F4` (alterna *Edged Faces* — PBR + linhas técnicas de aresta), `G` (mostra/oculta o *Grid Arquitetônico 1m × 1m*), `C` / `V` (alterna *3ª Pessoa Órbita* ↔ *1ª Pessoa 1,65 m*).
- **Model Inspector (5 Modos) & Anisotropic Filtering (`8x` Desktop / `4x` Mobile):**
  - `1. Final Render (PBR + GI/RT)`, `2. Shaded + Edged Faces (F4)`, `3. MatCap / Clay Render`, `4. Wireframe Puro (F3)` e `5. Base Color (Albedo sem luz)`.
  - Preserva o pipeline sob demanda em 2 estágios (`60 FPS` navegando -> convergência `RT + GI` após `300 ms` parado -> `0% GPU` em repouso).

---

## 4. Inteligência Quantitativa Multi-Formato & Ponte Comercial

- **Extração Híbrida (`POST /api/acervo/extract`):**
  - Suporta leitura de pranchas PDF/CAD (`GEMINI_API_KEY` / `OPENAI_API_KEY` com fallback determinístico local), extração nativa IFC (`web-ifc`) no visualizador 3D e inspeção quantitativa de modelos 3D PBR (`SCENE_3D_INSPECTOR`).
- **Ações Comerciais (`POST /api/acervo/send-to-proposal`):**
  - Tabela editável na aba **BIM & Quantitativos** com **Exportar CSV** (PT-BR) e **Enviar Quantitativos para Proposta** conectado às propostas do empreendimento.

---

## 5. Segurança & PWA

- **CSP (`src/lib/security-headers.ts`):** Mantém `'wasm-unsafe-eval'` em `script-src` e `blob: data:` em `connect-src` para decodificação Meshopt WASM e texturas embutidas no `GLTFLoader`.
- **Service Worker (`public/sw.js`):** Estratégia *network-first* para rotas HTML, `/_next/`, `/api/` e `/acervo/studio-3d`, evitando cache obsoleto de CSP/bundles entre deploys.

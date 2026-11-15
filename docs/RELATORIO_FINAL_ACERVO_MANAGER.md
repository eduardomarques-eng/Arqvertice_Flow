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

## 3. Studio 3D Isolado (`/acervo/studio-3d/[assetId]`)

- **Motor WebGL 2.0 Híbrido (`Studio3DFullscreenEngine.tsx` + `StudioCameraRig.tsx`):**
  - Renderização em 2 estágios: `60 FPS` (`DPR 1.5`) durante interação -> convergência `RT + GI` após `300 ms` de inatividade -> modo *idle* (`0% GPU`).
  - **1ª Pessoa (Tour Virtual):** Olhar a `1,65 m` acima do piso via raycast, `FOV = 55°`, `WASD`/Setas, teleporte suave ao clicar no piso (`#EDE5D8`) e joystick virtual touch em dispositivos móveis.
  - **3ª Pessoa (Órbita & Avatares):** Órbita com *damping*, duplo-clique para centralizar pivô, *Turntable* opcional e seletor de Avatar (`Sem Avatar` | `Avatar 01 — Feminino` | `Avatar 02 — Masculino`) posicionado em `Y = 0` com orientação suave e `dispose()` ao alternar.
  - **Tour Guiado `< 1 / N >`, `+ Vista` (`ADMIN`), `AR`, `Tela Cheia` & HUD Auto-Hide:** Pílulas translúcidas padrão VisionOS com recuo para `opacity-15` após `3 s` de inatividade.

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

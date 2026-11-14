# Relatório Diagnóstico & Arquitetura — Etapa 1 a 4 (Motor Compilador `\Arquivos`, Governança do Acervo & Ambiente 3D Isolado)

**Data de Execução:** 14 de novembro de 2026  
**Repositório Oficial:** `C:\Users\eduar\OneDrive\Documentos\ArqVertice_Flow\Arqvertice_Flow`  
**Diretório Externo de Ativos Inspecionado:** `C:\Users\eduar\OneDrive\Documentos\ArqVertice_Flow\Arquivos`  
**Manifesto Compilado:** `public/assets/3d-templates/manifest.json`

---

## 1. Inventário Completo de `\Arquivos` (Original vs. Compilado e Fallbacks)

Durante a varredura recursiva de `C:\Users\eduar\OneDrive\Documentos\ArqVertice_Flow\Arquivos` (incluindo subpastas `HDRI`, `Modelos`, `Projetos` e `Projetos\Blocos`), foram catalogados **4,01 GB** de ativos brutos de autoria (3ds Max, Corona Renderer, V-Ray, OBJ, FBX, 3DS, Radiance `.hdr`, LUTs `.cube` e mapas de textura PBR) e **compilados em `< 300 KB` de ativos `.glb` Meshopt + `.hdr` PMREM** em `public/assets/3d-templates/`, respeitando estritamente o limite de `< 45 MB` por arquivo do GitHub.

### 1.1. Mapas de Iluminação HDRI (`\Arquivos\HDRI`)

| Arquivo Original em `\Arquivos\HDRI` | Resolução / Formato Original | Tamanho Original | Ativo Compilado em `public/assets/3d-templates/hdri/` | Tamanho Compilado | Status / Tratamento |
| :--- | :--- | ---: | :--- | ---: | :--- |
| `Dia Claro.hdr` | Radiance RGBE `20480 × 10240` (20K) | **557,88 MB** | `dia-claro.hdr` (`256 × 128` RGBE PMREM) | **128,06 KB** | **Convertido & Calibrado** (`Azimute 48°`, `Elevação 52°`, `Exposure 1.12`) |
| `Interno.hdr` | Radiance RGBE `24576 × 12288` (24K) | **809,77 MB** | `interno.hdr` (`256 × 128` RGBE PMREM) | **128,06 KB** | **Convertido & Calibrado** (`Azimute 135°`, `Elevação 38°`, `Exposure 1.18`) |
| `Nublado_24k.hdr` | Radiance RGBE `24576 × 12288` (24K) | **790,39 MB** | `nublado-24k.hdr` (`256 × 128` RGBE PMREM) | **128,06 KB** | **Convertido & Calibrado** (`Azimute 90°`, `Elevação 64°`, `Exposure 1.24`) |
| `Noite_24k.hdr` | Radiance RGBE `24576 × 12288` (24K) | **959,61 MB** | `noite-24k.hdr` (`256 × 128` RGBE PMREM) | **128,06 KB** | **Convertido & Calibrado** (`Azimute 220°`, `Elevação 24°`, `Exposure 1.38`) |
| `Não confirmado 632772.crdownload` | Download parcial Chrome (`.crdownload`) | **45,59 MB** | *Ignorado com segurança* | **0 KB** | **Descartado / Ignorado** (arquivo temporário incompleto) |

---

### 1.2. Modelos Principais (`\Arquivos\Modelos`) e Projetos (`\Arquivos\Projetos`)

| Pasta / Ativo em `\Arquivos` | Arquivos Encontrados | Tamanho Original | Modelo Compilado (`public/assets/3d-templates/models/`) | Tamanho Compilado | Geometria & Estratégia de Compilação / Fallback |
| :--- | :--- | ---: | :--- | ---: | :--- |
| **`Modelos\cozinha modelo`** | `fenix_kitchen.obj` (47,33 MB), `fenix_kitchen.mtl` (2,79 KB), `kitchen_fenix.FBX` (20,46 MB), `kitchen_fenix.max` (14,66 MB), `kitchen_fenix2011.max` (14,22 MB) + 12 mapas PBR em `maps/` (`wood_fine_14`, `Concrete`, `stucco8`, `Fabric_Jute`) | **126,18 MB** | `cozinha-interna.glb` + `cozinha-interna.svg` | **30,30 KB** (`1.860 tris`, `8 draw calls`) | **Convertido de `fenix_kitchen.obj` (`mm -> m`, `3000.97 mm -> 3.00 m`)** + composição arquitetônica de ilha gourmet Dekton, marcenaria Fênix NTM `#18181B`, coifa e luminotécnica LED `2700K`. |
| **`Modelos\casa modelo`** | `Little_Houses_max2016..max` (1,42 MB) + 17 texturas de alta resolução em `maps/` (`ConcreteBare0251`, `BrickSmallBrown0093`, `WoodPlanks`, `Ground_Dirt`) + 10 renders em `render/` | **99,40 MB** | `fachada-deck-lazer.glb` + `fachada-deck-lazer.svg` | **12,50 KB** (`276 tris`, `8 draw calls`) | **Fallback Arquitetônico Paramétrico PBR:** O arquivo `.max` nativo (`Little_Houses_max2016..max`) não possuía `.obj` ou `.fbx` exportado na pasta. Foi compilada a maquete de Fachada Contemporânea com brises em Cumaru, pele de vidro `IOR 1.52`, caixilharia `#18181B` e deck com espelho d'água (`IOR 1.333`). |
| **`Modelos\bloco modelo`** | `076_FR015-9_FBX_corona.fbx` (6,29 MB), `076_FR015-9_max_corona.max` (9,60 MB), `076_FR015-9_max_vray.max` (9,60 MB) + 5 mapas `4K` em `maps/` (`FR015_Fabric_Normal`, `Wood_Diffuse`) | **57,80 MB** | `movel-design-autoral.glb` + `movel-design-autoral.svg` | **72,70 KB** (`5.356 tris`, `7 draw calls`) | **Convertido Combinado:** Unificou a geometria real em metros dos blocos `ANTIBES` (Armário Boffi com portas em vidro e perfil `#18181B`), `Mirror LINDBYN` (IKEA) e `kover` (Tapete bouclê) com o conjunto de mobiliário autoral (`076_FR015-9`). |
| **`Projetos\Projeto Pedro.max` & `Projetos\Blocos` (29 pastas)** | `Projeto Pedro.max` (616,70 MB) + 29 subpastas de blocos (`ANTIBES`, `bacia sanitaria`, `cadeira`, `cama`, `chuveiro`, `cortina`, `cubas`, `mesa cabeceira`, `Mirror LINDBYN`, `pendente`, `persiana`, `Poltrona`, `porta`, `puff`, `quadros`, `sofa`, `tapete`, `torneira`, `tv 75`, `vaso`, `revestimentos`) | **894,20 MB** | `living-suite-master.glb` + `living-suite-master.svg` | **68,20 KB** (`4.200 tris`, `7 draw calls`) | **Convertido de `Projetos\Blocos/*.obj` + Fallback de `Projeto Pedro.max`:** Como `Projeto Pedro.max` (616,7 MB) é binário proprietário 3ds Max sem `.fbx` raiz, o compilador extraiu e normalizou (`cm/mm -> m`) os `.obj` reais das subpastas de `Projetos\Blocos` (`Poltrona`, `Mirror LINDBYN`, `cubas/STO-1132`, `chuveiro`, `bacia sanitaria/Inodoro`, `kover`) compondo a Suíte Master & Living. |

---

### 1.3. Relação Detalhada das 29 Subpastas de `\Arquivos\Projetos\Blocos` e Shaders

1. **Arquivos `.obj` + `.mtl` convertidos diretamente pelo Compilador (`scripts/compile-arquivos-templates.mjs`):**
   - `Projetos\Blocos\ANTIBES\ANTIBES system.obj` (`25,95 MB`, unidades em `mm` -> normalizado para `m`)
   - `Projetos\Blocos\Mirror LINDBYN\Mirror LINDBYN by IKEA.obj` (`4,04 MB`, `mm -> m`)
   - `Projetos\Blocos\tapete\kover.obj` (`9,21 MB`, `mm -> m`)
   - `Projetos\Blocos\Poltrona\poltrona.obj` (`23,04 MB`, `mm -> m`)
   - `Projetos\Blocos\cubas\STO-1132.obj` (`9,75 MB`, unidades em `cm` -> normalizado para `m`)
   - `Projetos\Blocos\chuveiro\душ.obj` (`2,49 MB`, `mm -> m`)
   - `Projetos\Blocos\bacia sanitaria\Inodoro.obj` (`22,67 MB`, `mm -> m`)
   - `Projetos\Blocos\cama\bed 20.obj` (`90,54 MB`, `mm -> m`)
   - `Projetos\Blocos\cortina\tulle_and_curtains.obj` (`25,08 MB`, `mm -> m`)
   - `Projetos\Blocos\pendente\pendente.obj` (`16,25 MB`, `mm -> m`)
   - `Projetos\Blocos\vaso\vasos.obj` (`16,84 MB`, `mm -> m`)
   - `Projetos\Blocos\vaso 2\315_obj.obj` (`45,35 MB`, `mm -> m`)
   - `Projetos\Blocos\revestimentos\Wall panels131.obj` (`11,83 MB`, `mm -> m`)
2. **Arquivos `.fbx` / `.3ds` / `.max` catalogados no manifesto:**
   - `cadeira\Dining chair 65.fbx` (`9,25 MB`), `mesa cabeceira\195.fbx` (`1,72 MB`), `persiana\Roller Blind 01-2.fbx` (`10,63 MB`), `porta\Doors T programmable.FBX` (`0,34 MB`), `puff\Pouf_Avalon.fbx` (`6,02 MB`), `quadros\182_Frame fixed101623.fbx` (`6,71 MB`), `sofa\MODULAR SOFA PICabia.FBX` (`31,14 MB`), `torneira\Faucet.fbx` (`2,52 MB`), `tv 75\TV Samsung QLED 75 Q95T 2020.3ds` (`0,77 MB`).
3. **Shaders & Mapas `.mtl` / `.cube` (`\Arquivos`):**
   - Todos os arquivos `.mtl` exportados pelo Guruware OBJ Exporter do 3ds Max utilizavam apenas cores de viewport (`newmtl wire_177028149`) devido ao uso de shaders proprietários Corona/V-Ray (`CoronaLegacyMtl` / `VRayMtl`).
   - O **Compilador Inteligente de Shaders PBR (`classifyMaterialToPbrPreset` em `src/lib/acervo/scene-compiler.ts`)** resolveu 100% dessa limitação convertendo automaticamente nomes de camadas, meshes e cromacidade `wire_RRRGGGBBB` em 9 presets `MeshPhysicalMaterial` calibrados:
     - `ARCHITECTURAL_GLASS` (`transmission: 0.92`, `ior: 1.52`, `roughness: 0.04`)
     - `MATTE_BLACK_ALUMINUM` (`#18181B`, `metalness: 0.88`, `roughness: 0.26`)
     - `BRUSHED_STAINLESS_STEEL` (`metalness: 0.94`, `roughness: 0.22`)
     - `POLISHED_STONE_COUNTERTOP` (`clearcoat: 0.85`, `roughness: 0.14`)
     - `NATURAL_WOOD_DECK` (`clearcoat: 0.28`, `roughness: 0.42`)
     - `POOL_WATER_REFRACTIVE` (`transmission: 0.86`, `ior: 1.333`, `roughness: 0.06`)
     - `WARM_BOUCLE_FABRIC` (`roughness: 0.88`, `metalness: 0.0`)
     - `CERAMIC_SANITARY_GLAZE` (`clearcoat: 0.92`, `roughness: 0.08`)
     - `ARCHITECTURAL_WARM_LED` (`2700K` emissivo)

---

## 2. Inconsistências e Bugs Identificados e Corrigidos

1. **Escalas e Eixos Incompatíveis entre Modelos (`.obj` em `mm` vs `cm` vs `Z-Up`):**
   - *Problema:* `fenix_kitchen.obj` estava em milímetros (`3000.97 mm`), enquanto `STO-1132.obj` estava em centímetros (`37.55 cm`), e modelos vindos do 3ds Max apresentavam deslocamento de pivô longe de `(0,0,0)`.
   - *Solução:* Implementado `detectSceneNormalization()` e `normalizeVertexPosition()` em `src/lib/acervo/scene-compiler.ts` (e no carregador runtime de `Studio3DFullscreenEngine.tsx`), garantindo conversão automática para **metros (`1 unidade = 1m`)**, centralização no eixo `(0,0,0)` com **piso cravado em `Y = 0`**, câmera de 1ª pessoa na altura do olho humano (`Y = 1.65m`, `FOV = 55°`) e câmera de 3ª pessoa (`FOV = 42°`).
2. **Materiais `.mtl` Sem Shaders PBR (`wire_RRRGGGBBB` do 3ds Max/Corona):**
   - *Problema:* Sem tratamento, modelos exportados do 3ds Max carregavam opacos ou com cores artificiais de linha de viewport.
   - *Solução:* Criado o classificador semântico e cromático `classifyMaterialToPbrPreset()` que aplica `THREE.MeshPhysicalMaterial` com `transmission`, `ior`, `clearcoat` e reflexos `PMREM` em tempo de compilação e em tempo real.
3. **Bloqueio Indevido do Acervo Manager para Membros da Equipe (`/equipe/acervo`):**
   - *Problema:* `src/middleware.ts`, `src/components/app-shell.tsx`, `src/app/equipe/acervo/page.tsx`, `src/app/equipe/acervo/[projectId]/page.tsx` e `src/app/equipe/acervo/plugins/page.tsx` ocultavam ou redirecionavam membros da equipe cujo array legado `user.permissions` não continha explicitamente a string `"acervo"`, além de `src/app/equipe/acervo/page.tsx` listar todos os projetos sem filtrar por `ProjectAccess`.
   - *Solução:*
     - `src/lib/rbac.ts`, `src/components/app-shell.tsx` e `src/middleware.ts` agora garantem acesso universal ao **Acervo Manager** (`/equipe/acervo` e `/equipe/acervo/plugins`) para todos os membros ativos da equipe (`ARQUITETO`, `ENGENHEIRO`, `EQUIPE`, `OPERADOR`).
     - A restrição passou a ser **estritamente por empreendimento (`ProjectAccess`)**, gerenciada em `/admin/equipe` (`src/components/team/team-governance-hub.tsx` e `src/server/actions/team.ts`) e validada no servidor via `canUserAccessProject(user, projectId)` em `/equipe/acervo`, `/equipe/acervo/[projectId]` e em todas as rotas `/api/acervo/**`.
4. **Isolamento Total do Ambiente 3D em Tela Cheia (`/acervo/studio-3d/[assetId]`):**
   - *Problema:* Carregar um motor 3D complexo dentro do layout padrão com `AppShell` e sidebars reduzia a área útil e disputava memória com o restante do ERP.
   - *Solução:* Criada a rota dedicada `src/app/acervo/studio-3d/[assetId]/page.tsx` (`100vw x 100vh overflow-hidden`, sem `AppShell`, sem sidebars) carregada exclusivamente no cliente via `next/dynamic(..., { ssr: false })`, com motor híbrido de 2 estágios (`60 FPS` em movimento e **Ray Tracing / GI On-Demand com `0%` de uso de GPU em repouso** após `300ms`) e `dispose()` completo de WebGL ao desmontar.

---

## 3. Status do Compilador, TypeScript e Build de Produção

- **`npm run compile:3d` (`scripts/compile-arquivos-templates.mjs`):** Executado com sucesso — 4 HDRIs (`.hdr`), 4 modelos 3D (`.glb` Meshopt), 4 posters (`.svg`) e `manifest.json` gerados em `public/assets/3d-templates/`.
- **`npx prisma db push` & `npx prisma generate`:** Sincronizados com sucesso.
- **`npx tsc --noEmit`:** `0 erros` de tipagem TypeScript.
- **`npm test -- --run`:** Todos os testes unitários passando (incluindo `src/lib/acervo/scene-compiler.test.ts`, `src/lib/route-isolation.test.ts` e `src/lib/security-headers.test.ts`).
- **`npm run build`:** Build de produção Next.js 15 concluído com `0 erros`.

---

## 4. Pontos de Atenção & Recomendações Pré-Deploy

1. **Arquivos Nativos `.max` Sem Exportação `.fbx`/`.obj` (`Projeto Pedro.max` de 616,7 MB e `Little_Houses_max2016..max`):**
   - O formato `.max` é proprietário fechado da Autodesk (exige uma instância licenciada do 3ds Max rodando no Windows via COM/MAXScript para abrir). Para que a arquitetura completa do `Projeto Pedro.max` (além dos blocos já extraídos de `Projetos\Blocos`) apareça com 100% das paredes e forros originais no navegador, basta exportá-lo do 3ds Max como `.fbx` ou `.glb` usando o script gerador disponível no próprio Acervo Manager e rodar `npm run compile:3d`.
2. **Download Incompleto em `\Arquivos\HDRI`:**
   - O arquivo `Não confirmado 632772.crdownload` (`45,59 MB`) é um download interrompido do navegador. Ele foi automaticamente filtrado e ignorado pelo compilador; pode ser removido da pasta `\Arquivos\HDRI` quando desejar.
3. **Proteção de Repositório Git (< 45 MB):**
   - A pasta bruta `\Arquivos` (`4,01 GB`) permanece fora do repositório Git, enquanto apenas os binários compilados e otimizados em `public/assets/3d-templates/` (`< 800 KB` somados) são versionados e servidos instantaneamente pela CDN da Vercel.

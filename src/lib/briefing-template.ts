import { ANSWER_KIND, type BriefingQuestion } from "./briefing-schema";

export const OFFICIAL_BRIEFING_QUESTIONS: BriefingQuestion[] = [
  // 01. Perfil, Ocupação & Estilo de Vida
  {
    id: "q01_uso",
    category: "01. Perfil, Ocupação & Estilo de Vida",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Qual será a destinação primordial da residência?",
    hint: "Define diretrizes fundamentais de durabilidade dos materiais e fluxo de circulação.",
    required: true,
    options: [
      { value: "moradia_fixa", label: "Moradia permanente da família" },
      { value: "veraneio_praia", label: "Residência de praia / veraneio frequente e finais de semana" },
      { value: "investimento_locacao", label: "Imóvel para locação por temporada (Airbnb Boutique / Alto Padrão)" },
      { value: "misto", label: "Uso misto: veraneio familiar com locação em datas estratégicas" },
    ],
  },
  {
    id: "q02_familia",
    category: "01. Perfil, Ocupação & Estilo de Vida",
    type: ANSWER_KIND.MULTI_SELECT,
    text: "Qual o perfil dos ocupantes e dinâmica de convivência?",
    hint: "Auxilia na setorização de privacidade entre áreas íntimas e sociais.",
    required: true,
    options: [
      { value: "casal", label: "Casal principal" },
      { value: "filhos_criancas", label: "Filhos pequenos / crianças" },
      { value: "filhos_jovens", label: "Filhos adolescentes ou adultos" },
      { value: "hospedes_frequentes", label: "Recepção frequente de amigos e familiares hóspedes" },
      { value: "pets", label: "Animais de estimação (cães / gatos)" },
      { value: "acessibilidade_idosos", label: "Necessidade de acessibilidade para melhor idade ou mobilidade reduzida" },
    ],
  },

  // 02. Linguagem Arquitetônica, Formas & Materiais
  {
    id: "q03_estilo_volumetria",
    category: "02. Linguagem Arquitetônica, Formas & Materiais",
    type: ANSWER_KIND.IMAGE_CHOICE,
    text: "Qual linguagem estética e volumetria melhor representam a identidade da residência?",
    hint: "Diretriz mestra para concepção das fachadas, proporções e volumetria.",
    required: true,
    visualOptions: [
      {
        value: "tropical_contemporaneo",
        label: "Tropical Contemporâneo Praiano",
        description: "Beirais generosos, materiais naturais, ventilação cruzada e vegetação integrada à arquitetura.",
        imageUrl: "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80",
      },
      {
        value: "minimalista_japandi",
        label: "Minimalista / Japandi Costeiro",
        description: "Pureza de linhas, madeiras claras, paleta neutra e conexão com a simplicidade e aconchego.",
        imageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80",
      },
      {
        value: "contemporaneo_puro",
        label: "Contemporâneo Geométrico",
        description: "Volumetria pura, panos de vidro imponentes, estruturas metálicas e concreto aparente.",
        imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
      },
      {
        value: "rustico_chic",
        label: "Rústico Chique / Búzios & Trancoso",
        description: "Elementos artesanais, forros de palha ou madeira, telhado aparente e pedras rústicas.",
        imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
      },
    ],
  },
  {
    id: "q04_pe_direito",
    category: "02. Linguagem Arquitetônica, Formas & Materiais",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Qual sensação espacial e altura de pé-direito é almejada para a área social?",
    hint: "Influencia diretamente no conforto térmico e na monumentalidade do living.",
    options: [
      { value: "duplo_monumental", label: "Pé-direito duplo com grandes panos de vidro e integração vertical" },
      { value: "elevado_3m", label: "Pé-direito elevado contínuo (em torno de 3,20m) para elegância e frescor" },
      { value: "convencional_aconchego", label: "Pé-direito padrão confortável com foco em acolhimento intimista" },
    ],
  },
  {
    id: "q05_relacao_exterior",
    category: "02. Linguagem Arquitetônica, Formas & Materiais",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Como você deseja a transição entre o interior e o ambiente externo?",
    hint: "Esquadrias embutidas proporcionam continuidade total de piso interior/exterior.",
    options: [
      { value: "abertura_total", label: "Integração total: esquadrias embutidas no piso recolhidas na parede" },
      { value: "integracao_moderada", label: "Grandes painéis de correr com divisões pontuais e proteção contra vento" },
      { value: "ambientes_delimitados", label: "Setores delimitados com vistas emolduradas para o jardim" },
    ],
  },
  {
    id: "q06_materiais_fachada",
    category: "02. Linguagem Arquitetônica, Formas & Materiais",
    type: ANSWER_KIND.MULTI_SELECT,
    text: "Quais materiais de fachada você considera indispensáveis na composição?",
    hint: "Selecionamos materiais com alta resistência à maresia e intempéries litorâneas.",
    options: [
      { value: "madeira_ripada", label: "Brises e painéis ripados em madeira nobre (Cumaru / Teca tratada)" },
      { value: "pedra_natural", label: "Revestimento em pedra natural (Moledo / Hijau / Travertino Rockface)" },
      { value: "concreto_aparente", label: "Concreto aparente ripado ou textura cimento queimado" },
      { value: "esquadrias_minimalistas", label: "Esquadrias pretas minimalistas de alumínio de alta performance" },
      { value: "texturas_organicas", label: "Texturas minerais claras com tons terracota ou areia suave" },
    ],
  },
  {
    id: "q07_cobertura",
    category: "02. Linguagem Arquitetônica, Formas & Materiais",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Qual conceito de cobertura e telhado mais lhe agrada?",
    hint: "A platibanda confere estética moderna; o telhado aparente traz aconchego tradicional costeiro.",
    options: [
      { value: "platibanda_oculta", label: "Platibanda oculta (telhado embutido invisível, linhas retas limpas)" },
      { value: "telhado_madeira_aparente", label: "Telhado aparente com tesouras e forro em madeira maciça" },
      { value: "pergolados_combinados", label: "Composição mista com lajes planas e pérgolas de sombreamento" },
    ],
  },

  // 03. Setor Social, Living & Espaço Gourmet
  {
    id: "q08_acesso_hall",
    category: "03. Setor Social, Living & Espaço Gourmet",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Como deve ser o impacto da entrada social e hall?",
    hint: "Primeira impressão ao receber os convidados.",
    options: [
      { value: "porta_pivotante_imponente", label: "Porta pivotante monumental em madeira maciça com fechadura biométrica inteligente" },
      { value: "transicao_paisagistica", label: "Caminho ajardinado com espelho d'água e iluminação cênica antes da porta" },
      { value: "entrada_discreta", label: "Acesso reservado garantindo privacidade visual total para o living" },
    ],
  },
  {
    id: "q09_living",
    category: "03. Setor Social, Living & Espaço Gourmet",
    type: ANSWER_KIND.MULTI_SELECT,
    text: "Quais elementos de destaque devem compor o Living e Estar Social?",
    hint: "Priorização de itens de conforto e convivência.",
    options: [
      { value: "integracao_cozinha", label: "Integração visual completa com a cozinha e varanda" },
      { value: "painel_tv_discreto", label: "Painel de TV elegante e embutido em marcenaria ripada" },
      { value: "lareira_ecologica", label: "Lareira ecológica a bioetanol para noites amenas de praia" },
      { value: "lavabo_escultural", label: "Lavabo social de impacto com cuba esculpida em pedra natural" },
      { value: "adega_bar", label: "Adega climatizada envidraçada ou bar de apoio social" },
    ],
  },
  {
    id: "q10_cozinha",
    category: "03. Setor Social, Living & Espaço Gourmet",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Qual a concepção da cozinha principal?",
    hint: "Equilíbrio entre funcionalidade do dia a dia e acolhimento.",
    options: [
      { value: "cozinha_americana_ilha", label: "Cozinha americana aberta com ilha central e banquetas de convivência" },
      { value: "cozinha_fechavel", label: "Cozinha integrada que pode ser isolada por portas de correr translúcidas" },
      { value: "cozinha_suporte", label: "Cozinha de trabalho reservada, deixando o protagonismo para o Gourmet externo" },
    ],
  },
  {
    id: "q11_gourmet",
    category: "03. Setor Social, Living & Espaço Gourmet",
    type: ANSWER_KIND.MULTI_SELECT,
    text: "Quais comodidades são fundamentais no Espaço Gourmet?",
    hint: "O coração da casa litorânea para celebração.",
    options: [
      { value: "churrasqueira_carvao_inox", label: "Churrasqueira em inox com grelha elevatória e coifa de alta sucção" },
      { value: "parrilla_argentina", label: "Parrilla argentina com braseiro lateral" },
      { value: "ilha_gourmet", label: "Bancada ilha ampla em pedra atérmica com cuba e cooktop de indução" },
      { value: "chopeira_torre", label: "Torre de chopeira instalada na bancada" },
      { value: "forno_pizza", label: "Forno de pizza a gás ou à lenha" },
      { value: "cervejeira_embutida", label: "Nicho para cervejeira e adega sob a bancada" },
    ],
  },
  {
    id: "q12_varanda",
    category: "03. Setor Social, Living & Espaço Gourmet",
    type: ANSWER_KIND.MULTI_SELECT,
    text: "Como você imagina a varanda coberta de transição para o jardim?",
    hint: "Espaço de contemplação e relaxamento pós-mar.",
    options: [
      { value: "lounge_sofas", label: "Lounge externo com estofados náuticos resistentes e mesa de centro orgânica" },
      { value: "balancos_suspensos", label: "Balanços suspensos em corda náutica ou poltronas suspensas" },
      { value: "mesa_refeicoes_externa", label: "Mesa de jantar externa generosa para 10 a 12 pessoas" },
      { value: "pergolado_vidro", label: "Pérgolado com vidro e ripado filtrando a luz natural" },
    ],
  },

  // 04. Setor Íntimo, Suítes & Acessibilidade
  {
    id: "q19_suite_master",
    category: "04. Setor Íntimo, Suítes & Acessibilidade",
    type: ANSWER_KIND.MULTI_SELECT,
    text: "Quais comodidades e diferenciais compõem a Suíte Master?",
    hint: "Refúgio do casal com alto padrão de conforto e relaxamento.",
    options: [
      { value: "closet_walkin", label: "Closet walk-in privativo com iluminação interna em LED" },
      { value: "banheiro_duplo", label: "Banheiro com cubas duplas e chuveiros duplos de teto" },
      { value: "banheira_imersao", label: "Banheira de imersão freestanding com vista para jardim privativo" },
      { value: "varanda_privativa", label: "Varanda exclusiva com vista aberta e rede de descanso" },
      { value: "cama_king_circulacao", label: "Espaço amplo para cama Super King com circulação mínima de 1m" },
    ],
  },
  {
    id: "q20_suites_demais",
    category: "04. Setor Íntimo, Suítes & Acessibilidade",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Qual o programa de dormitórios para família e convidados?",
    hint: "Planejamento de capacidade e flexibilidade de acomodação.",
    options: [
      { value: "master_mais_3suites", label: "1 Suíte Master + 3 Suítes completas (4 suítes no total)" },
      { value: "master_mais_2suites", label: "1 Suíte Master + 2 Suítes para filhos + 1 Quarto de hóspedes" },
      { value: "master_mais_4suites", label: "1 Suíte Master + 4 Suítes completas (5 suítes no total para alta capacidade)" },
      { value: "suite_terrea", label: "Imprescindível ao menos 1 Suíte completa localizada no pavimento térreo" },
    ],
  },
  {
    id: "q21_home_office",
    category: "04. Setor Íntimo, Suítes & Acessibilidade",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Qual a demanda de espaço para trabalho remoto (Home Office)?",
    hint: "Importante para rotinas híbridas de trabalho à beira-mar.",
    options: [
      { value: "escritorio_fechado", label: "Escritório privativo fechado com tratamento acústico para videoconferências" },
      { value: "bancada_integrada", label: "Bancada compacta de estudos / trabalho integrada à circulação ou suíte" },
      { value: "sem_demanda", label: "Sem necessidade de home office dedicado (foco 100% em descanso)" },
    ],
  },
  {
    id: "q22_circulacao_intima",
    category: "04. Setor Íntimo, Suítes & Acessibilidade",
    type: ANSWER_KIND.MULTI_SELECT,
    text: "Quais apoios funcionais devem existir na área íntima?",
    hint: "Facilidades que evitam descidas desnecessárias ao térreo durante a noite.",
    options: [
      { value: "copinha_noturna", label: "Copinha noturna no piso superior (frigobar, micro-ondas e pia)" },
      { value: "rouparia_enxoval", label: "Rouparia ampla para guarda de toalhas e lençóis sobressalentes" },
      { value: "maleiro_generoso", label: "Maleiro dedicado para malas de viagem de hóspedes" },
    ],
  },

  // 05. Área de Lazer Externa, Piscina & Convivência
  {
    id: "q13_piscina",
    category: "05. Área de Lazer Externa, Piscina & Convivência",
    type: ANSWER_KIND.IMAGE_CHOICE,
    text: "Como você visualiza o desenho e atrativos da piscina?",
    hint: "O espelho d'água é o protagonista da área de lazer.",
    required: true,
    visualOptions: [
      {
        value: "prainha_spa",
        label: "Piscina com Prainha Molhada & Spa",
        description: "Área rasa para espreguiçadeiras com hidromassagem integrada aquecida.",
        imageUrl: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=800&q=80",
      },
      {
        value: "borda_infinita",
        label: "Borda Infinita Contemporânea",
        description: "Transbordo d'água elegante com sensação de horizonte infinito e canaletas ocultas.",
        imageUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
      },
      {
        value: "raia_semiolimpica",
        label: "Raia para Natação & Recreação",
        description: "Comprimento linear generoso para natação combinada com área rasa familiar.",
        imageUrl: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=800&q=80",
      },
      {
        value: "piscina_natural_organica",
        label: "Pedras Naturais e Formato Orgânico",
        description: "Formas fluidas integradas ao paisagismo remetendo a uma lagoa costeira natural.",
        imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
      },
    ],
  },
  {
    id: "q14_revestimento_piscina",
    category: "05. Área de Lazer Externa, Piscina & Convivência",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Qual o revestimento de sua preferência para a piscina?",
    hint: "A cor da água é diretamente determinada pela tonalidade da pedra e incidência solar.",
    options: [
      { value: "pedra_hijau_verde", label: "Pedra Hijau vulcânica original (água tom verde esmeralda paradisíaco)" },
      { value: "pedra_hitam_escura", label: "Pedra Hitam preta / grafite (estética moderna sofisticada com reflexo espelhado)" },
      { value: "porcelanato_areia_claro", label: "Porcelanato ou pedra clara (água tom azul turquesa caribenho translúcido)" },
      { value: "pastilhas_tradicionais", label: "Pastilhas cerâmicas azuis tradicionais de alta durabilidade" },
    ],
  },
  {
    id: "q15_solarium_deck",
    category: "05. Área de Lazer Externa, Piscina & Convivência",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Qual o piso de preferência para o solarium e entorno molhado?",
    hint: "Priorizamos materiais com propriedade atérmica e antiderrapante para pés descalços.",
    options: [
      { value: "piso_atermico_cimenticio", label: "Piso cimentício atérmico antiderrapante em tons areia ou off-white" },
      { value: "deck_madeira_cumaru", label: "Deck em madeira Cumaru ripada tratada" },
      { value: "deck_ecologico_wpc", label: "Deck ecológico em madeira plástica (zero manutenção contra cupim e maresia)" },
    ],
  },
  {
    id: "q16_firepit",
    category: "05. Área de Lazer Externa, Piscina & Convivência",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Deseja incorporar um Lounge Rebaixado com Fogo de Chão (Fire Pit)?",
    hint: "Espaço charmoso para confraternizações noturnas ao ar livre.",
    options: [
      { value: "firepit_gas", label: "Sim, lounge rebaixado no jardim com queimador a gás e estofados náuticos" },
      { value: "firepit_lenha", label: "Sim, tacho tradicional rústico a lenha com bancos em pedra ou alvenaria" },
      { value: "nao_prioritario", label: "Não prioritário (preferimos maximizar área gramada ou solarium)" },
    ],
  },
  {
    id: "q17_ducha_externa",
    category: "05. Área de Lazer Externa, Piscina & Convivência",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Como conceber a ducha externa e lava-pés pós-praia?",
    hint: "Essencial para evitar que a areia da praia entre nos ambientes internos.",
    options: [
      { value: "ducha_escultural_pedra", label: "Ducha escultural de teto embutida em paredão de pedra natural com vegetação" },
      { value: "coluna_inox_nautico", label: "Coluna vertical em inox 316 marítimo com lava-pés acoplado" },
      { value: "ducha_privativa_lateral", label: "Ducha funcional instalada no recuo lateral de serviço" },
    ],
  },

  // 06. Paisagismo & Conforto Bioclimático
  {
    id: "q18_paisagismo_tropical",
    category: "06. Paisagismo & Conforto Bioclimático",
    type: ANSWER_KIND.IMAGE_CHOICE,
    text: "Qual diretriz paisagística melhor harmoniza com a arquitetura?",
    hint: "O paisagismo filtra ventos excessivos e garante privacidade frente aos lotes vizinhos.",
    required: true,
    visualOptions: [
      {
        value: "tropical_denso",
        label: "Tropical Denso & Exuberante",
        description: "Palmeiras imperiais, helicônias, monsteras (costela-de-adão) e folhagens volumosas de sombra.",
        imageUrl: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
      },
      {
        value: "arido_costeiro",
        label: "Litorâneo Minimalista / Árido",
        description: "Gramados amplos, coqueiros esculturais, seixos rolados e espécies nativas de restinga.",
        imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
      },
      {
        value: "jardins_verticais",
        label: "Jardins Verticais & Pátios Internos",
        description: "Paredes verdes irrigadas e jardins de inverno internos que trazem a natureza para dentro de casa.",
        imageUrl: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80",
      },
    ],
  },
  {
    id: "q26_conforto_bioclimatico",
    category: "06. Paisagismo & Conforto Bioclimático",
    type: ANSWER_KIND.MULTI_SELECT,
    text: "Quais soluções bioclimáticas de ventilação e insolação você valoriza?",
    hint: "Aproveitamento inteligente das brisas marítimas predominantes do litoral sul.",
    options: [
      { value: "ventilacao_cruzada", label: "Ventilação natural cruzada abundante em todos os dormitórios e área social" },
      { value: "brises_moveis", label: "Brises-soleil móveis para controle de sombreamento e privacidade nas suítes" },
      { value: "telas_mosquiteiras", label: "Telas mosquiteiras discretas integradas às esquadrias dos quartos" },
      { value: "persianas_motorizadas", label: "Persianas integradas blackout 100% elétricas com acionamento por botão ou app" },
    ],
  },

  // 07. Luminotécnica, Conforto Térmico & Automação
  {
    id: "q25_iluminacao",
    category: "07. Luminotécnica, Conforto Térmico & Automação",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Qual o conceito luminotécnico e temperatura de cor desejados?",
    hint: "Luz de 2700K proporciona relaxamento profundo; rasgos indiretos de LED evitam ofuscamento visual.",
    required: true,
    options: [
      {
        value: "quente_2700k_3000k",
        label: "Luz Quente Aconchegante (2700K a 3000K): rasgos indiretos de LED, cortineiros e arandelas de efeito cênico",
      },
      {
        value: "mista_flexivel",
        label: "Luz Mista Flexível: 2700K para áreas íntimas e 3000K/4000K para cozinha e bancadas de preparo",
      },
      {
        value: "iluminacao_cenica_paisagismo",
        label: "Foco em Iluminação Paisagística externa valorizando copas de árvores e fachadas noturnas",
      },
    ],
  },
  {
    id: "q27_automacao_sustentabilidade",
    category: "07. Luminotécnica, Conforto Térmico & Automação",
    type: ANSWER_KIND.MULTI_SELECT,
    text: "Quais tecnologias de automação e sustentabilidade deseja prever?",
    hint: "Previsão eletro-hidráulica em projeto evita retrabalho ou quebra-quebra futuro.",
    options: [
      { value: "energia_solar_fotovoltaica", label: "Geração de energia solar fotovoltaica conectada à rede" },
      { value: "aquecimento_solar_gas", label: "Aquecimento solar ou a gás para chuveiros e torneiras" },
      { value: "reaproveitamento_agua_chuva", label: "Cisterna de captação de água de chuva para irrigação do jardim" },
      { value: "automacao_iluminacao_clima", label: "Automação de cenas de iluminação, climatização e som ambiente" },
      { value: "irrigacao_automatica", label: "Sistema de irrigação paisagística automatizada com sensor de umidade" },
      { value: "carregador_veiculo_eletrico", label: "Infraestrutura para carregador de carro elétrico (Wallbox) na garagem" },
    ],
  },

  // 08. Serviços, Sustentabilidade & Dimensionamento Orçamentário
  {
    id: "q23_servicos_apoio",
    category: "08. Serviços, Sustentabilidade & Dimensionamento Orçamentário",
    type: ANSWER_KIND.MULTI_SELECT,
    text: "Quais os requisitos para os setores de serviço e apoio operacional?",
    hint: "Garante organização e logística eficiente para os dias de casa cheia.",
    options: [
      { value: "lavanderia_fechada", label: "Lavanderia completa com espaço para duas máquinas e estendal reservado" },
      { value: "estendal_invisivel", label: "Estendal ventilado, porém 100% invisível das áreas sociais e externas" },
      { value: "deposito_praia_pranchas", label: "Depósito externo independente para pranchas, cadeiras de praia e ferramentas" },
      { value: "despensa_alimentos", label: "Despensa walk-in anexa à cozinha para armazenamento de mantimentos" },
      { value: "suite_servico", label: "Quarto/suíte independente para funcionário(a) ou apoio de serviços" },
    ],
  },
  {
    id: "q24_garagem",
    category: "08. Serviços, Sustentabilidade & Dimensionamento Orçamentário",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Qual a capacidade de veículos pretendida para a garagem?",
    hint: "Considera vagas cobertas e espaço de manobra no lote.",
    options: [
      { value: "2vagas_cobertas", label: "2 vagas cobertas + 2 vagas descobertas (4 veículos no total)" },
      { value: "3vagas_cobertas", label: "3 vagas cobertas espaçosas para caminhonetes / SUVs grandes" },
      { value: "estacionamento_amplo", label: "Pátio frontal amplo para receber múltiplos carros de convidados" },
    ],
  },
  {
    id: "q28_investimento",
    category: "08. Serviços, Sustentabilidade & Dimensionamento Orçamentário",
    type: ANSWER_KIND.SINGLE_SELECT,
    text: "Qual a faixa estimada de investimento global para a execução da obra?",
    hint: "Norteia a seleção de soluções estruturais, caixilharia e acabamentos no projeto executivo.",
    required: true,
    options: [
      { value: "faixa_800k_1500k", label: "De R$ 800.000,00 a R$ 1.500.000,00" },
      { value: "faixa_1500k_2500k", label: "De R$ 1.500.000,00 a R$ 2.500.000,00" },
      { value: "faixa_2500k_4000k", label: "De R$ 2.500.000,00 a R$ 4.000.000,00" },
      { value: "acima_4000k", label: "Acima de R$ 4.000.000,00 (Altíssimo Padrão de acabamento e automação total)" },
    ],
  },
];

export function briefingQuestionsFromJson(value: unknown): BriefingQuestion[] {
  if (!Array.isArray(value)) return OFFICIAL_BRIEFING_QUESTIONS;
  const questions = value.filter((question): question is BriefingQuestion => {
    if (!question || typeof question !== "object") return false;
    const item = question as Record<string, unknown>;
    return typeof item.id === "string" && typeof item.text === "string" && typeof item.type === "string";
  });
  return questions.length ? questions : OFFICIAL_BRIEFING_QUESTIONS;
}

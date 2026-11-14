// ArqVértice Flow — LGPD / Privacidade e governança comercial
// Rotas públicas: /privacidade, /cookies, /termos

export const LEGAL_CONTROLLER = {
  legalName: "ArqVértice Studio",
  owner: "Eduardo César Costa Marques",
  cnpj: "66.773.164/0001-60",
  address: "São Paulo, SP, Brasil",
  contactEmail: "contato@arqvertice.com",
  privacyEmail: "privacidade@arqvertice.com",
};

export const LEGAL_PARTNER = {
  name: "Emanoel Luan Almeida da Rocha",
  cnpj: "51.510.575/0001-95",
  role: "Parceiro estrutural de entrega de projetos",
};

export const PRIVACY_POLICY_VERSION = 1;

export const LEGAL_BASES = {
  contrato: "Art. 7º, III — execução de contrato ou solicitação pré-contractual.",
  legal: "Art. 7º, IX — cumprimento de obrigação legal ou sindical.",


  legittima: "Art. 7º, XI — proteger vida privada, honra, imagem e dados do titular.",
  publico: "Art. 7º, XII — realizar pesquisa em âmbito estadual ou federal.",
  consentimento: "Art. 7º, X — legitimado pelo próprio titular e fundamento no seu livre exercício.",
};
export type CookieCategory = "strict" | "analytical" | "marketing" | "functional" | "unclassified";

export interface CookieInfo {
  name: string;
  category: CookieCategory;
  purpose: string;
  retention: string;
  necessary: boolean;
}

export const STRICT_NECESSARY_COOKIES: CookieInfo[] = [
  {
    name: "arqvertice_session",
    category: "strict",
    purpose: "Manter o cliente autenticado dentro do portal (estado de sessão).",
    retention: "Enquanto a sessão estiver ativa; expira em 2h de inatividade.",
    necessary: true,
  },
  {
    name: "arqvertice_role",
    category: "strict",
    purpose: "Isolamento de navegação por perfil (painel executivo vs. portal do cliente).",
    retention: "Enquanto a sessão estiver ativa.",
    necessary: true,
  },
  {
    name: "arqvertice_consent",
    category: "strict",
    purpose: "Guardar consentimento de cookies recolhido pelo cliente.",
    retention: "12 meses a partir da aceitação.",
    necessary: true,
  },
];

export const COOKIE_CATEGORIES: CookieInfo[] = [
  {
    name: "Strict necessary",
    category: "strict",
    purpose: "Funcionamento essencial do serviço e da segurança da plataforma.",
    retention: "Sessão ou até 12 meses.",
    necessary: true,
  },
  {
    name: "Analytical",
    category: "analytical",
    purpose: "Entender como os visitantes utilizam o site para melhorar a experiência.",
    retention: "26 meses (anônimo e agregado).",
    necessary: false,
  },
  {
    name: "Marketing / Ads",
    category: "marketing",
    purpose: "Retargeting e medida de campanhas de divulgação de serviços.",
    retention: "Até 24 meses.",
    necessary: false,
  },
  {
    name: "Functional",
    category: "functional",
    purpose: "Lembre preferências de navegação (idioma, região, layout).",
    retention: "12 meses.",
    necessary: false,
  },
  {
    name: "Unclassified",
    category: "unclassified",
    purpose: "Cookies ainda em avaliação ou vinculados a serviços de terceiros não catalogados.",
    retention: "Variável.",
    necessary: false,
  },
];

export const IP_LICENSING = {
  scope: "ArqVértice Flow reserva a licença dos projetos gerados pela IA para o cliente em uso.",
  thirdParty: "Modelos de linguagem de terceiros são usados apenas para suporte operacional, sem armazenamento de conteúdo do cliente.",
  optOut: "O cliente pode preferir a edição humana a qualquer momento nos ajustes da IA.",
};

export const AI_TRANSPARENCY = {
  notice: "O ArqVértice Flow pode usar inteligência artificial para ajudar a formatar textos, sugerir etapas de cronograma e resumir documentos. A IA não substitui a responsabilidade do arquiteto ou engenheiro. O cliente deve sempre revisar e aprovar o conteúdo final antes de entrega ou assinatura.",
  humanInLoop: "Toda recomendação gerada por IA é sujeita à revisão manual e assinatura humana.",
  training: "Nenhum conteúdo do cliente é usado para treinar modelos externos.",
};

export const TERMS = {
  acceptance: "Ao utilizar o ArqVértice Flow você aceita estes termos e as políticas de privacidade vigentes.",
  data: "Os dados pessoais são tratados conforme a LGPD e esta Política de Privacidade.",
  liability: "A aplicação é fornecida 'como está'. O ArqVértice Studio não se responsabiliza por erros, perdas ou danos decorrentes do uso indevido ou de falhas de segurança não preveníveis.",
  jurisdiction: "As disputas serão resolvidas pelos tribunais de São Paulo, SP.",
};

export const CANCELLATION_AND_REFUND = {
  noticePeriod: "Cancelamento sem penalização até 15 dias após a assinatura do contrato.",
  proportional: "Reembolso proporcional para cancelamento no período de validade da proposta; após assinatura, apenas com justa causa ou após 15 dias, sem reembolso exceto caso de falha de entrega.",
  invoice: "Alterações de valor de projeto precisam de reenvio de nota fiscal e revisão contratual.",
  ip: "Dados de pagamento são processados por provedores certificados e não ficam armazenados no ArqVértice Flow.",
};

export const DATA_SUBJECT_RIGHTS = [
  { right: "Acesso", description: "Liste os dados pessoais que possuímos. Disponível no portal em Privacidade & Titularidade." },
  { right: "Retificação", description: "Corrija dados incorretos ou incompletos via painel de cadastro." },
  { right: "Anonimização", description: "Solicite a anonimização de dados identificáveis; registros fiscais permanecem por prazo legal." },
  { right: "Obituação", description: "Retire ou oblite os dados; informamos o prazo de retenção legal." },
  { right: "Portabilidade", description: "Baixe seus dados em JSON ou CSV através do painel de exportação." },
  { right: "Revogação", description: "Retire o consentimento a qualquer momento pelos cookies ou no painel." },
];



export const DATA_PURPOSES = [
  "Prestar o serviço de gestão de projetos e entrega de artefatos arquitetônicos.",
  "Comunicação contratual: envio de propostas, contratos, relatórios e cadernos de obra.",
  "Pagamentos e faturamento: emissão de boletos, notas e gestão financeira.",
  "Segurança da plataforma, auditoria interna e prevenção a fraudes.",
  "Obrigações fiscais e tributárias previstas em lei (grandes consignantes e SEFAZ).",
  "Melhoria do serviço, análise de uso e disponibilidade de features (somente de forma agregada).",
  "Atendimento a dúvidas e suporte técnico ao cliente.",
];

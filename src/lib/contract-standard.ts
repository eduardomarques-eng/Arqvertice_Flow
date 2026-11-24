import { formatCurrencyBRL, formatDateLongBR } from "./contract-template";
import { valorPorExtensoBRL } from "./currency-extenso";

export interface ContractClauseItem {
  number: number;
  title: string;
  body: string;
}

export interface ContractOptionalClause {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
}

export interface ContractInstallmentItem {
  order: number;
  label: string;
  percent: number;
  amount: number;
  dueDate?: string | null;
}

export interface ContractDocumentData {
  title: string;
  contractor: {
    studioName: string;
    technicalLeadName: string;
    cnpj: string;
    cityState: string;
    commercialAddress: string;
    email: string;
    pixKey: string;
    pixKeyType: string;
    bankInstructions: string;
  };
  includeStructuralPartner: boolean;
  structuralPartner: {
    name: string;
    role: string;
    cnpj: string;
  };
  client: {
    name: string;
    nationality: string;
    maritalStatus: string;
    profession: string;
    rg: string;
    cpfOrCnpj: string;
    address: string;
    city: string;
  };
  project: {
    name: string;
    type: string;
    areaM2: string;
    cityState: string;
    proposalCode: string;
  };
  artFee: {
    enabled: boolean;
    amount: number;
    linkedInstallmentLabel: string;
    description: string;
  };
  clauses: ContractClauseItem[];
  optionalClauses: ContractOptionalClause[];
  installments: ContractInstallmentItem[];
  totalValue: number;
  totalInWords: string;
  forumCity: string;
  contractDate: string;
}

export function buildDefaultContractDocument(input: {
  title?: string;
  contractor: ContractDocumentData["contractor"];
  includeStructuralPartner?: boolean;
  structuralPartner?: Partial<ContractDocumentData["structuralPartner"]>;
  client: Partial<ContractDocumentData["client"]> & { name: string };
  project: Partial<ContractDocumentData["project"]> & { name: string };
  scopeLines?: string[];
  businessDays?: number;
  installments?: ContractInstallmentItem[];
  totalValue: number;
  artFee?: Partial<ContractDocumentData["artFee"]>;
  contractDate?: Date;
  forumCity?: string;
}): ContractDocumentData {
  const totalValue = Math.max(0, Number(input.totalValue) || 0);
  const totalInWords = valorPorExtensoBRL(totalValue);
  const dateStr = formatDateLongBR(input.contractDate ?? new Date());
  const forumCity = input.forumCity || input.contractor.cityState || "Fortaleza / CE";
  const businessDays = Number(input.businessDays) > 0 ? Number(input.businessDays) : 45;
  const scopeText =
    input.scopeLines && input.scopeLines.length > 0
      ? input.scopeLines.map((line, i) => `${i + 1}. ${line}`).join("\n")
      : "Execução dos projetos técnicos e entregáveis especificados na proposta comercial aprovada.";

  const installments: ContractInstallmentItem[] =
    input.installments && input.installments.length > 0
      ? input.installments
      : [
          {
            order: 1,
            label: "Parcela Única / Entrada",
            percent: 100,
            amount: totalValue,
            dueDate: null,
          },
        ];

  const artFee: ContractDocumentData["artFee"] = {
    enabled: Boolean(input.artFee?.enabled),
    amount: Number(input.artFee?.amount) > 0 ? Number(input.artFee?.amount) : 108.39,
    linkedInstallmentLabel: input.artFee?.linkedInstallmentLabel || "1ª Parcela (Entrada)",
    description:
      input.artFee?.description ||
      "Taxa oficial de Registro/Anotação de Responsabilidade Técnica (RRT/ART) junto ao CAU/CREA.",
  };

  const clientData: ContractDocumentData["client"] = {
    name: input.client.name,
    nationality: input.client.nationality || "brasileiro(a)",
    maritalStatus: input.client.maritalStatus || "a informar",
    profession: input.client.profession || "a informar",
    rg: input.client.rg || "a informar",
    cpfOrCnpj: input.client.cpfOrCnpj || "a informar",
    address: input.client.address || "Endereço a informar",
    city: input.client.city || forumCity,
  };

  const projectData: ContractDocumentData["project"] = {
    name: input.project.name,
    type: input.project.type || "Projeto de Arquitetura e Engenharia",
    areaM2: input.project.areaM2 || "conforme levantamento",
    cityState: input.project.cityState || forumCity,
    proposalCode: input.project.proposalCode || "Proposta Aprovada",
  };

  const installmentsLines = installments
    .map(
      (inst) =>
        `- Parcela ${inst.order} (${inst.label}): ${inst.percent}% — ${formatCurrencyBRL(inst.amount)}${
          inst.dueDate ? ` (venc. ${inst.dueDate})` : ""
        }`,
    )
    .join("\n");

  const artBlock = artFee.enabled
    ? `\nTaxa de RRT/ART: ${formatCurrencyBRL(artFee.amount)} (${artFee.description}), cobrada junto à ${artFee.linkedInstallmentLabel}.`
    : "";

  const clauses: ContractClauseItem[] = [
    {
      number: 1,
      title: "DO OBJETO",
      body: `O presente instrumento tem por objeto a prestação de serviços técnicos especializados de ${projectData.type} para o empreendimento "${projectData.name}", com área aproximada de ${projectData.areaM2}, localizado em ${projectData.cityState}, em conformidade com a ${projectData.proposalCode} aprovada pela CONTRATANTE.`,
    },
    {
      number: 2,
      title: "DO ESCOPO DETALHADO",
      body: `Os serviços ora contratados compreendem os seguintes entregáveis e disciplinas:\n${scopeText}`,
    },
    {
      number: 3,
      title: "DO PRAZO DE EXECUÇÃO E CRONOGRAMA",
      body: `O prazo total estimado para conclusão dos serviços é de ${businessDays} (${valorPorExtensoNumeroSimples(businessDays)}) dias úteis, contados a partir da confirmação do pagamento da primeira parcela (entrada) e da entrega integral dos dados iniciais/medição pela CONTRATANTE. Eventuais atrasos decorrentes de pendências de aprovação ou alterações solicitadas pela CONTRATANTE prorrogarão automaticamente o cronograma pelo mesmo período.`,
    },
    {
      number: 4,
      title: "DA FORMA DE ENTREGA",
      body: `Todos os documentos técnicos, pranchas, memoriais e especificações serão disponibilizados em formato digital (PDF de alta resolução e/ou relatórios executivos) através do Portal do Cliente ArqVértice OS, armazenamento em nuvem corporativa e e-mail cadastrado pela CONTRATANTE.`,
    },
    {
      number: 5,
      title: "DOS HONORÁRIOS, CONDIÇÕES DE PAGAMENTO E DADOS PIX",
      body: `Pelos serviços descritos neste instrumento, a CONTRATANTE pagará à CONTRATADA o valor global de ${formatCurrencyBRL(totalValue)} (${totalInWords}), distribuído conforme o quadro abaixo:\n${installmentsLines}${artBlock}\n\nDados oficiais para pagamento via PIX (${input.contractor.pixKeyType}: ${input.contractor.pixKey}): ${input.contractor.bankInstructions}`,
    },
    {
      number: 6,
      title: "DAS OBRIGAÇÕES E RESPONSABILIDADES DAS PARTES",
      body: `Compete à CONTRATADA elaborar os projetos dentro da melhor técnica construtiva e normas vigentes da ABNT, mantendo sigilo sobre dados da obra. Compete à CONTRATANTE fornecer documentação legal do imóvel, informações preliminares verídicas, validar formalmente cada etapa e efetuar os pagamentos nas datas pactuadas. A execução física da obra não integra este contrato salvo contratação específica de acompanhamento.`,
    },
    {
      number: 7,
      title: "DA PROPRIEDADE INTELECTUAL E DIREITO DE USO DE IMAGEM",
      body: `Os projetos, modelagens 3D, detalhamentos e especificações integram a propriedade intelectual da CONTRATADA nos termos da Lei nº 9.610/1998, sendo sua utilização restrita ao imóvel objeto deste contrato. Fica autorizada a captação e divulgação institucional de imagens do projeto e obra concluída no portfólio do estúdio, preservada a privacidade de dados pessoais.`,
    },
    {
      number: 8,
      title: "DO FORO DE ELEIÇÃO",
      body: `Para dirimir quaisquer controvérsias oriundas do presente contrato que não possam ser resolvidas amigavelmente, as partes elegem o Foro da Comarca de ${forumCity}, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`,
    },
  ];

  const optionalClauses: ContractOptionalClause[] = [
    {
      id: "revisoes",
      title: "CLÁUSULA ADICIONAL — REVISÕES INCLUSAS",
      body: "Estão contempladas até 2 (duas) rodadas de ajustes conceituais por etapa antes de sua aprovação formal. Alterações estruturais ou de layout após etapa aprovada serão objeto de Termo Aditivo.",
      enabled: true,
    },
    {
      id: "rescisao",
      title: "CLÁUSULA ADICIONAL — RESCISÃO E DESISTÊNCIA",
      body: "Em caso de rescisão imotivada após o início dos trabalhos, serão devidos os honorários proporcionais às etapas efetivamente iniciadas ou concluídas, não sendo reembolsável o valor da entrada referente ao mobilização e estudo inicial.",
      enabled: false,
    },
  ];

  return {
    title: input.title || `Contrato de Prestação de Serviços — ${projectData.name}`,
    contractor: input.contractor,
    includeStructuralPartner: Boolean(input.includeStructuralPartner),
    structuralPartner: {
      name: input.structuralPartner?.name || "Emanoel Luan Almeida da Rocha",
      role: input.structuralPartner?.role || "Engenheiro Civil / Parceiro Estrutural",
      cnpj: input.structuralPartner?.cnpj || "51.510.575/0001-95",
    },
    client: clientData,
    project: projectData,
    artFee,
    clauses,
    optionalClauses,
    installments,
    totalValue,
    totalInWords,
    forumCity,
    contractDate: dateStr,
  };
}

function valorPorExtensoNumeroSimples(n: number): string {
  const words = valorPorExtensoBRL(n)
    .replace(/\s+reais?$/, "")
    .replace(/\s+de reais$/, "");
  return words;
}

export function renderContractDocumentText(data: ContractDocumentData): string {
  const contractorLine = `${data.contractor.studioName.toUpperCase()}, inscrita no CNPJ sob o nº ${data.contractor.cnpj}, representada por ${data.contractor.technicalLeadName}${
    data.contractor.commercialAddress ? `, com sede em ${data.contractor.commercialAddress}` : ""
  } (${data.contractor.cityState}), e-mail ${data.contractor.email}.`;

  const partnerLine = data.includeStructuralPartner
    ? `\nCO-CONTRATADA (PARCEIRO ESTRUTURAL): ${data.structuralPartner.name} (${data.structuralPartner.role}), CNPJ ${data.structuralPartner.cnpj}.`
    : "";

  const clientLine = `CONTRATANTE: ${data.client.name}, nacionalidade ${data.client.nationality}, estado civil ${data.client.maritalStatus}, profissão ${data.client.profession}, portador(a) do RG nº ${data.client.rg} e CPF/CNPJ nº ${data.client.cpfOrCnpj}, residente/sediado(a) em ${data.client.address} — ${data.client.city}.`;

  const clausesBlock = data.clauses
    .map((c) => `CLÁUSULA ${c.number}ª — ${c.title}\n${c.body}`)
    .join("\n\n");

  const optionalBlock = data.optionalClauses
    .filter((c) => c.enabled)
    .map((c) => `${c.title}\n${c.body}`)
    .join("\n\n");

  const signatures = [
    "____________________________________________\n" + `${data.client.name}\nCONTRATANTE`,
    "____________________________________________\n" + `${data.contractor.studioName} — ${data.contractor.technicalLeadName}\nCNPJ ${data.contractor.cnpj} | CONTRATADA`,
  ];
  if (data.includeStructuralPartner) {
    signatures.push(
      "____________________________________________\n" +
        `${data.structuralPartner.name}\nCNPJ ${data.structuralPartner.cnpj} | PARCEIRO ESTRUTURAL`,
    );
  }

  return [
    data.title.toUpperCase(),
    "",
    `CONTRATADA: ${contractorLine}${partnerLine}`,
    "",
    clientLine,
    "",
    clausesBlock,
    optionalBlock ? `\n${optionalBlock}` : "",
    "",
    `${data.forumCity}, ${data.contractDate}.`,
    "",
    signatures.join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n");
}

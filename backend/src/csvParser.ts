import type { TenderCard } from "./types.js";

export interface ParsedCsvRow {
  source: Record<string, string>;
  card: TenderCard;
}

type FieldKey = keyof TenderCard;

const initialCard: TenderCard = {
  seldonId: "",
  etpId: "",
  purchaseType: "",
  tenderUrl: "",
  dateCreated: "",
  submissionDeadlineDate: "",
  submissionDeadlineTime: "",
  tenderUrlSource: "",
  federalLaw: "",
  stateDefenseOrder: "",
  tenderStatus: "",
  tenderStatusReason: "",
  tenderStatusNote: "",
  tenderGroup: "",
  initialPrice: "",
  finalPrice: "",
  resultDate: "",
  contractDate: "",
  deliveryType: "",
  deliveryBatchDays: "",
  deliveryDays: "",
  deliveryDate: "",
  paymentDelayDays: "",
  lotDivisible: "",
  deliveryNote: "",
  counterpartyCode: "",
  counterpartyName: "",
  counterpartyInn: "",
  counterpartyKpp: "",
  counterpartyCkg: "",
  counterpartyPotential: "",
  deal: "",
  contract: "",
  counterpartyNote: "",
  op: "",
  legalEntity: "",
  tenderSubmittedDate: "",
  tenderWonDate: "",
  applicationSecurity: "",
  contractSecurity: "",
  warrantySecurity: "",
  warrantyMonths: "",
  nationalRegime: "",
  specialAccount: "",
  productDirections: [],
  discrepancyNotes: ""
};

const headerMap: Record<string, FieldKey> = {
  seldonid: "seldonId",
  seldon: "seldonId",
  etpid: "etpId",
  etp: "etpId",
  purchasetype: "purchaseType",
  purchasekind: "purchaseType",
  типзакупки: "purchaseType",
  tenderurl: "tenderUrl",
  tenderlink: "tenderUrl",
  datecreated: "dateCreated",
  датазаведения: "dateCreated",
  submissiondeadlinedate: "submissionDeadlineDate",
  окончаниеподачи: "submissionDeadlineDate",
  окончаниеподачидата: "submissionDeadlineDate",
  submissiondeadlinetime: "submissionDeadlineTime",
  окончаниеподачивремя: "submissionDeadlineTime",
  tenderurlsource: "tenderUrlSource",
  url: "tenderUrl",
  ссылка: "tenderUrl",
  ссылканатендер: "tenderUrl",
  federallaw: "federalLaw",
  федеральныйзакон: "federalLaw",
  statedefenseorder: "stateDefenseOrder",
  гособоронзаказ: "stateDefenseOrder",
  tenderstatus: "tenderStatus",
  статустендера: "tenderStatus",
  tenderstatusreason: "tenderStatusReason",
  причинастатуса: "tenderStatusReason",
  tenderstatusnote: "tenderStatusNote",
  примечаниекстатусу: "tenderStatusNote",
  tendergroup: "tenderGroup",
  тендернаягруппа: "tenderGroup",
  resultdate: "resultDate",
  датаподведенияитогов: "resultDate",
  initialprice: "initialPrice",
  начальнаяцена: "initialPrice",
  finalprice: "finalPrice",
  конечнаяцена: "finalPrice",
  contractdate: "contractDate",
  датазаключениядоговора: "contractDate",
  deliverytype: "deliveryType",
  условияотгрузки: "deliveryType",
  deliverybatchdays: "deliveryBatchDays",
  срокпоставкипартидней: "deliveryBatchDays",
  deliverydays: "deliveryDays",
  срокпоставки: "deliveryDays",
  deliverydate: "deliveryDate",
  срокпоставкивремя: "deliveryDate",
  paymentdelaydays: "paymentDelayDays",
  отсрочкаоплатыдней: "paymentDelayDays",
  lotdivisible: "lotDivisible",
  лотделимый: "lotDivisible",
  deliverynote: "deliveryNote",
  примечаниекпостановке: "deliveryNote",
  примечаниекпоставке: "deliveryNote",
  counterpartycode: "counterpartyCode",
  кодконтрагента: "counterpartyCode",
  counterpartyname: "counterpartyName",
  названиеконтрагента: "counterpartyName",
  counterpartyinn: "counterpartyInn",
  иннконтрагента: "counterpartyInn",
  counterpartykpp: "counterpartyKpp",
  кппконтрагента: "counterpartyKpp",
  counterpartyckg: "counterpartyCkg",
  цкг: "counterpartyCkg",
  counterpartypotential: "counterpartyPotential",
  потенциал: "counterpartyPotential",
  deal: "deal",
  сделка: "deal",
  contract: "contract",
  договор: "contract",
  counterpartynote: "counterpartyNote",
  примечаниекконтрагенту: "counterpartyNote",
  op: "op",
  оп: "op",
  legalentity: "legalEntity",
  юридическоелицоэтм: "legalEntity",
  tendersubmitteddate: "tenderSubmittedDate",
  тендерподан: "tenderSubmittedDate",
  tenderwondate: "tenderWonDate",
  тендервыигран: "tenderWonDate",
  applicationsecurity: "applicationSecurity",
  обеспечениезаявки: "applicationSecurity",
  contractsecurity: "contractSecurity",
  обеспечениеконтракта: "contractSecurity",
  warrantysecurity: "warrantySecurity",
  обеспечениегарантийныхобязательств: "warrantySecurity",
  warrantymonths: "warrantyMonths",
  гарантийныйсрокмес: "warrantyMonths",
  nationalregime: "nationalRegime",
  национальныйрежим: "nationalRegime",
  specialaccount: "specialAccount",
  спецсчет: "specialAccount",
  productdirections: "productDirections",
  товарныенаправления: "productDirections",
  discrepancynotes: "discrepancyNotes",
  примечаниякрасхождениямпоколонкамтендера: "discrepancyNotes"
};

export function parseTenderCsv(text: string): { rows: ParsedCsvRow[]; headers: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], headers: [] };
  const headers = table[0].map((header) => header.trim());
  const rows = table.slice(1)
    .filter((row) => row.some((value) => value.trim()))
    .map((row) => {
      const source: Record<string, string> = {};
      const card: TenderCard = { ...initialCard, productDirections: [] };
      headers.forEach((header, index) => {
        const value = row[index]?.trim() ?? "";
        source[header || `column_${index + 1}`] = value;
        if (!value) return;
        const key = headerMap[normalizeHeader(header)];
        if (!key) return;
        Object.assign(card, { [key]: normalizeValue(key, value) });
      });
      if (card.tenderUrl && !card.tenderUrlSource) {
        card.tenderUrlSource = card.tenderUrl;
      }
      if (card.tenderUrlSource && !card.tenderUrl) {
        card.tenderUrl = card.tenderUrlSource;
      }
      return { source, card };
    });
  return { rows, headers };
}

function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && char === delimiter) {
      row.push(value);
      value = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += char;
  }
  row.push(value);
  rows.push(row);
  return rows;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return [",", ";", "\t"]
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((left, right) => right.count - left.count)[0].delimiter;
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[\s._-]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizeValue(key: FieldKey, value: string): TenderCard[FieldKey] {
  if (["deliveryBatchDays", "deliveryDays", "paymentDelayDays", "warrantyMonths"].includes(key)) {
    const normalizedNumber = Number(
      value.replace(/\s/g, "").replace(/[^\d,.-]/g, "").replace(",", ".")
    );
    return (Number.isFinite(normalizedNumber) ? normalizedNumber : "") as TenderCard[FieldKey];
  }
  if (key === "productDirections") {
    return value
      .split(/[;|,\n]/)
      .map((item) => item.trim())
      .filter((item) => item && item.toLowerCase() !== "null") as TenderCard[FieldKey];
  }
  return value as TenderCard[FieldKey];
}

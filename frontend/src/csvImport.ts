import { fieldsConfig, initialCard } from "./fieldsConfig";
import type { AutofillFields, TenderCard } from "./types";

export interface CsvTenderRow {
  id: string;
  source: Record<string, string>;
  card: TenderCard;
}

type FieldKey = keyof AutofillFields;

const extraAliases: Partial<Record<FieldKey, string[]>> = {
  seldonId: ["seldon", "seldon_id", "Seldon ID", "seldon id"],
  etpId: ["etp", "etp_id", "ETP ID", "etp id"],
  purchaseType: ["purchase_type", "purchase kind", "Тип закупки"],
  tenderUrl: ["tender_url", "tenderUrl", "url", "link", "Ссылка", "Ссылка на тендер"],
  dateCreated: ["date_created", "created_at", "Дата заведения"],
  submissionDeadlineDate: ["submission_deadline_date", "Окончание подачи", "Окончание подачи дата", "Дата окончания подачи"],
  submissionDeadlineTime: ["submission_deadline_time", "Окончание подачи время", "Время окончания подачи"],
  tenderUrlSource: ["tender_url", "tenderUrl", "url", "link", "Ссылка", "Ссылка на тендер"],
  federalLaw: ["law", "purchase_law", "Тип закупки", "ФЗ", "Закон", "Федеральный закон"],
  stateDefenseOrder: ["ГосОборонЗаказ", "Гособоронзаказ"],
  tenderStatus: ["status", "tender_status", "Статус", "Статус тендера"],
  tenderStatusReason: ["status_reason", "tender_status_reason", "Причина статуса"],
  tenderStatusNote: ["Примечание к статусу"],
  tenderGroup: ["Тендерная группа"],
  resultDate: ["Дата подведения итогов"],
  initialPrice: ["price", "nmck", "НМЦК", "Начальная цена"],
  finalPrice: ["final_price", "Конечная цена"],
  contractDate: ["contract_date", "Дата договора", "Дата заключения договора"],
  deliveryType: ["Условия отгрузки"],
  deliveryBatchDays: ["Срок поставки партии дней"],
  deliveryDays: ["Срок поставки"],
  deliveryDate: ["Срок поставки время"],
  paymentDelayDays: ["Отсрочка оплаты дней"],
  lotDivisible: ["Лот делимый"],
  deliveryNote: ["Примечание к постановке", "Примечание к поставке"],
  counterpartyCode: ["Код контрагента"],
  counterpartyName: ["counterparty", "customer", "Название контрагента", "Контрагент"],
  counterpartyInn: ["inn", "ИНН", "ИНН контрагента"],
  counterpartyKpp: ["kpp", "КПП", "КПП контрагента"],
  counterpartyCkg: ["ЦКГ"],
  counterpartyPotential: ["Потенциал"],
  deal: ["Сделка"],
  contract: ["Договор"],
  counterpartyNote: ["Примечание к контрагенту"],
  op: ["office", "ОП"],
  legalEntity: ["legal_entity", "Юр лицо", "Юридическое лицо", "Юридическое лицо ЭТМ"],
  tenderSubmittedDate: ["Тендер подан"],
  tenderWonDate: ["Тендер выигран"],
  applicationSecurity: ["Обеспечение заявки"],
  contractSecurity: ["Обеспечение контракта"],
  warrantySecurity: ["Обеспечение гарантийных обязательств"],
  warrantyMonths: ["Гарантийный срок мес"],
  nationalRegime: ["Национальный режим"],
  specialAccount: ["Спецсчёт", "Спецсчет"],
  productDirections: ["directions", "product_directions", "Товарные направления"]
};

const fieldAliases = new Map<string, FieldKey>();

for (const field of fieldsConfig) {
  fieldAliases.set(normalizeHeader(String(field.key)), field.key);
  fieldAliases.set(normalizeHeader(field.label), field.key);
  for (const alias of extraAliases[field.key] ?? []) {
    fieldAliases.set(normalizeHeader(alias), field.key);
  }
}

export function parseTenderCsv(text: string): { rows: CsvTenderRow[]; headers: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], headers: [] };

  const headers = table[0].map((header) => header.trim());
  const rows = table.slice(1)
    .filter((row) => row.some((value) => value.trim()))
    .map((row, index) => {
      const source: Record<string, string> = {};
      const card: TenderCard = { ...initialCard };

      headers.forEach((header, columnIndex) => {
        const value = row[columnIndex]?.trim() ?? "";
        source[header || `column_${columnIndex + 1}`] = value;
        if (!value) return;

        const fieldKey = fieldAliases.get(normalizeHeader(header));
        if (!fieldKey) return;
        Object.assign(card, { [fieldKey]: normalizeFieldValue(fieldKey, value) });
      });

      return {
        id: `csv_${index + 1}`,
        source,
        card
      };
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
  const delimiters = [",", ";", "\t"];
  return delimiters
    .map((delimiter) => ({
      delimiter,
      count: firstLine.split(delimiter).length
    }))
    .sort((left, right) => right.count - left.count)[0].delimiter;
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[\s._-]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizeFieldValue(key: FieldKey, value: string): TenderCard[FieldKey] {
  const field = fieldsConfig.find((item) => item.key === key);

  if (field?.type === "number") {
    const normalizedNumber = Number(
      value
        .replace(/\s/g, "")
        .replace(/[^\d,.-]/g, "")
        .replace(",", ".")
    );
    return Number.isFinite(normalizedNumber) ? normalizedNumber : "";
  }

  if (field?.type === "checkboxes") {
    const selected = value
      .split(/[;|,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const option = field.options?.find(
          (candidate) =>
            normalizeHeader(candidate.value) === normalizeHeader(item) ||
            normalizeHeader(candidate.label) === normalizeHeader(item)
        );
        return option?.value ?? item;
      });
    return selected as TenderCard[FieldKey];
  }

  if (field?.type === "select") {
    const option = field.options?.find(
      (candidate) =>
        normalizeHeader(candidate.value) === normalizeHeader(value) ||
        normalizeHeader(candidate.label) === normalizeHeader(value)
    );
    return (option?.value ?? value) as TenderCard[FieldKey];
  }

  return value as TenderCard[FieldKey];
}

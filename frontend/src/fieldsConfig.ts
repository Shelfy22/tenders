import type { AutofillFields } from "./types";

export interface FieldConfig {
  key: keyof AutofillFields;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  important?: boolean;
  options?: { value: string; label: string }[];
}

const empty = { value: "", label: "Не выбрано" };

export const fieldsConfig: FieldConfig[] = [
  { key: "counterparty", label: "Контрагент", important: true },
  { key: "inn", label: "ИНН", important: true },
  { key: "kpp", label: "КПП" },
  { key: "legalEntity", label: "Юридическое лицо ЭТМ", type: "select", options: [empty, { value: "149", label: "149 фирма" }, { value: "202", label: "202 фирма" }] },
  { key: "federalLaw", label: "Федеральный закон", type: "select", important: true, options: [empty, { value: "44", label: "44-ФЗ" }, { value: "223", label: "223-ФЗ" }, { value: "commercial", label: "Коммерческая закупка" }] },
  { key: "resultDate", label: "Дата подведения итогов", type: "date", important: true },
  { key: "contractDate", label: "Дата заключения договора", type: "date", important: true },
  { key: "deliveryType", label: "Условия отгрузки", type: "select", options: [empty, { value: "by_date", label: "Единовременно к дате" }, { value: "by_requests", label: "Партиями по заявкам" }, { value: "during_period", label: "Единовременно в течение срока" }] },
  { key: "deliveryDate", label: "Срок поставки, дата", type: "date" },
  { key: "deliveryBatchDays", label: "Срок поставки партии, дней", type: "number" },
  { key: "deliveryDays", label: "Срок поставки, дней", type: "number" },
  { key: "paymentDelayDays", label: "Отсрочка оплаты, дней", type: "number", important: true },
  { key: "nationalRegime", label: "Национальный режим", type: "select", options: [empty, { value: "none", label: "Нет" }, { value: "ban", label: "Запрет" }, { value: "restriction", label: "Ограничение" }, { value: "advantage", label: "Преимущество" }] },
  { key: "lotDivisible", label: "Лот делимый", type: "select", options: [empty, { value: "yes", label: "Да" }, { value: "no", label: "Нет" }] },
  { key: "contractSecurity", label: "Обеспечение контракта" },
  { key: "applicationSecurity", label: "Обеспечение заявки" },
  { key: "warrantySecurity", label: "Обеспечение гарантийных обязательств" },
  { key: "warrantyMonths", label: "Гарантийный срок, мес.", type: "number" },
  { key: "specialAccount", label: "Спецсчёт", type: "select", options: [empty, { value: "yes", label: "Да" }, { value: "no", label: "Нет" }] },
  { key: "deliveryNote", label: "Примечание к поставке", type: "textarea" }
];

export const initialCard: TenderCard = {
  counterparty: "", inn: "", kpp: "", legalEntity: "", federalLaw: "",
  resultDate: "", contractDate: "", deliveryType: "", deliveryDate: "",
  deliveryBatchDays: "", deliveryDays: "", paymentDelayDays: "",
  nationalRegime: "", lotDivisible: "", contractSecurity: "",
  applicationSecurity: "", warrantySecurity: "", warrantyMonths: "",
  specialAccount: "", deliveryNote: ""
};

import type { TenderCard } from "./types";

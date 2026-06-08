import type { AutofillFields, TenderCard } from "./types";

export interface FieldConfig {
  key: keyof AutofillFields;
  label: string;
  section: string;
  type?: "text" | "number" | "date" | "time" | "url" | "textarea" | "select" | "checkboxes";
  important?: boolean;
  options?: { value: string; label: string }[];
}

const empty = { value: "", label: "Не выбрано" };
const yesNo = [empty, { value: "yes", label: "Да" }, { value: "no", label: "Нет" }];

export const productDirections = [
  "Отдел КПП",
  "Отдел Отопления",
  "Отдел АиКИП",
  "Отдел Спецодежда и СИЗ",
  "Подшипники смазки и тех.жидкости",
  "Отдел ЭТСИиО",
  "Отдел СО",
  "Отдел СТ",
  "Отдел УЭО",
  "Отдел ИБПиСКС",
  "Водоснабжение и водоотведение",
  "Отдел Крепеж",
  "Вентиляция и климат",
  "Товары программы лояльность",
  "Отдел КиАСО",
  "Отдел ОПС и пожаротушения",
  "Отдел РИИиСО",
  "СХТКОМ",
  "Отдел ВНиКД"
];

export const fieldsConfig: FieldConfig[] = [
  { key: "dateCreated", label: "Дата заведения", section: "Основные данные", type: "date" },
  { key: "submissionDeadlineDate", label: "Окончание подачи, дата", section: "Основные данные", type: "date", important: true },
  { key: "submissionDeadlineTime", label: "Окончание подачи, время", section: "Основные данные", type: "time" },
  { key: "tenderUrlSource", label: "Ссылка на тендер", section: "Основные данные", type: "url", important: true },
  { key: "federalLaw", label: "Федеральный закон", section: "Основные данные", type: "select", important: true, options: [empty, { value: "44", label: "44-ФЗ" }, { value: "223", label: "223-ФЗ" }, { value: "commercial", label: "Коммерческая закупка" }] },
  { key: "stateDefenseOrder", label: "ГосОборонЗаказ", section: "Основные данные", type: "select", important: true, options: yesNo },
  { key: "tenderStatus", label: "Статус тендера", section: "Основные данные", type: "select", options: [empty, { value: "participation_application", label: "Заявка на участие в тендере" }, { value: "submitted", label: "Тендер подан" }, { value: "won", label: "Тендер выигран" }, { value: "lost", label: "Проигран" }, { value: "cancelled", label: "Отменён" }] },
  { key: "tenderStatusNote", label: "Примечание к статусу", section: "Основные данные", type: "textarea" },
  { key: "tenderGroup", label: "Тендерная группа", section: "Основные данные" },
  { key: "resultDate", label: "Дата подведения итогов", section: "Основные данные", type: "date" },

  { key: "initialPrice", label: "Начальная цена", section: "Коммерческие условия", important: true },
  { key: "finalPrice", label: "Конечная цена", section: "Коммерческие условия" },
  { key: "contractDate", label: "Дата заключения договора", section: "Коммерческие условия", type: "date", important: true },
  { key: "deliveryType", label: "Условия отгрузки", section: "Коммерческие условия", type: "select", important: true, options: [empty, { value: "single_date", label: "Единовременно к дате" }, { value: "by_requests", label: "Партиями / по заявкам / по графику" }, { value: "during_period", label: "Единовременно в течение срока" }] },
  { key: "deliveryBatchDays", label: "Срок поставки партии, дней", section: "Коммерческие условия", type: "number" },
  { key: "deliveryDays", label: "Срок поставки, дней", section: "Коммерческие условия", type: "number" },
  { key: "deliveryDate", label: "Срок поставки, дата", section: "Коммерческие условия", type: "date" },
  { key: "paymentDelayDays", label: "Отсрочка оплаты, дней", section: "Коммерческие условия", type: "number", important: true },
  { key: "lotDivisible", label: "Лот делимый", section: "Коммерческие условия", type: "select", important: true, options: yesNo },
  { key: "deliveryNote", label: "Примечание к поставке", section: "Коммерческие условия", type: "textarea" },

  { key: "counterpartyCode", label: "Код контрагента", section: "Контрагент" },
  { key: "counterpartyName", label: "Название контрагента", section: "Контрагент", important: true },
  { key: "counterpartyInn", label: "ИНН контрагента", section: "Контрагент", important: true },
  { key: "counterpartyKpp", label: "КПП контрагента", section: "Контрагент" },
  { key: "counterpartyCkg", label: "ЦКГ", section: "Контрагент" },
  { key: "counterpartyPotential", label: "Потенциал", section: "Контрагент" },
  { key: "deal", label: "Сделка", section: "Контрагент" },
  { key: "contract", label: "Договор", section: "Контрагент" },
  { key: "counterpartyNote", label: "Примечание к контрагенту", section: "Контрагент", type: "textarea" },
  { key: "op", label: "ОП", section: "Контрагент", important: true },

  { key: "legalEntity", label: "Юридическое лицо ЭТМ", section: "ЭТМ и статусы", type: "select", important: true, options: [empty, { value: "149", label: "149 фирма" }, { value: "202", label: "202 ТД Электротехмонтаж" }] },
  { key: "tenderSubmittedDate", label: "Тендер подан", section: "ЭТМ и статусы", type: "date" },
  { key: "tenderWonDate", label: "Тендер выигран", section: "ЭТМ и статусы", type: "date" },

  { key: "applicationSecurity", label: "Обеспечение заявки", section: "Обеспечения и режимы" },
  { key: "contractSecurity", label: "Обеспечение контракта", section: "Обеспечения и режимы" },
  { key: "warrantySecurity", label: "Обеспечение гарантийных обязательств", section: "Обеспечения и режимы" },
  { key: "warrantyMonths", label: "Гарантийный срок, мес.", section: "Обеспечения и режимы", type: "number" },
  { key: "nationalRegime", label: "Национальный режим", section: "Обеспечения и режимы", type: "select", options: [empty, { value: "none", label: "Нет" }, { value: "ban", label: "Запрет" }, { value: "restriction", label: "Ограничение" }, { value: "preference", label: "Преимущество" }] },
  { key: "specialAccount", label: "Спецсчёт", section: "Обеспечения и режимы", type: "select", options: yesNo },

  { key: "productDirections", label: "Товарные направления", section: "Товарные направления", type: "checkboxes", options: productDirections.map((value) => ({ value, label: value })) }
];

export const initialCard: TenderCard = {
  dateCreated: "",
  submissionDeadlineDate: "",
  submissionDeadlineTime: "",
  tenderUrlSource: "",
  federalLaw: "",
  stateDefenseOrder: "",
  tenderStatus: "",
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
  productDirections: []
};

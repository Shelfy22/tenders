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
  { key: "seldonId", label: "seldonId", section: "Основные данные" },
  { key: "etpId", label: "etpId", section: "Основные данные" },
  { key: "purchaseType", label: "Тип закупки", section: "Основные данные", type: "select", options: [empty, { value: "223-ФЗ", label: "223-ФЗ" }, { value: "44/94-ФЗ", label: "44/94-ФЗ" }, { value: "Коммерческие закупки", label: "Коммерческие закупки" }, { value: "Международные закупки", label: "Международные закупки" }] },
  { key: "tenderUrl", label: "Ссылка на тендер", section: "Основные данные", type: "url" },
  { key: "dateCreated", label: "Дата заведения", section: "Основные данные", type: "date" },
  { key: "submissionDeadlineDate", label: "Окончание подачи, дата", section: "Основные данные", type: "date", important: true },
  { key: "submissionDeadlineTime", label: "Окончание подачи, время", section: "Основные данные", type: "time" },
  { key: "tenderUrlSource", label: "Ссылка на тендер", section: "Основные данные", type: "url", important: true },
  { key: "federalLaw", label: "Федеральный закон", section: "Основные данные", type: "select", important: true, options: [empty, { value: "44", label: "44-ФЗ" }, { value: "223", label: "223-ФЗ" }, { value: "commercial", label: "Коммерческая закупка" }] },
  { key: "stateDefenseOrder", label: "ГосОборонЗаказ", section: "Основные данные", type: "select", important: true, options: yesNo },
  { key: "tenderStatus", label: "Статус тендера", section: "Основные данные", type: "select", options: [empty, { value: "loaded_seldon", label: "Загружен seldon" }, { value: "approved_ku_cp", label: "Согласовано КУ ЦП" }, { value: "rejected_ku_cp", label: "Отказано КУ ЦП" }, { value: "participation_application", label: "Заявка на участие в тендере" }, { value: "counterparty_review", label: "Проработка контрагента" }] },
  { key: "tenderStatusReason", label: "Причина статуса", section: "Основные данные", type: "select", options: [
    empty,
    { value: "Дубль", label: "Дубль" },
    { value: "Коммерческие условия. НМЦК менее 300 тыс. руб.", label: "Коммерческие условия. НМЦК менее 300 тыс. руб." },
    { value: "Коммерческие условия. НМЦК менее фактической стоимости", label: "Коммерческие условия. НМЦК менее фактической стоимости" },
    { value: "Коммерческие условия. Не проходим по сроку поставки", label: "Коммерческие условия. Не проходим по сроку поставки" },
    { value: "Коммерческие условия. Оплата Покупателем после оплаты Генподрядчиком / Госзаказчиком", label: "Коммерческие условия. Оплата Покупателем после оплаты Генподрядчиком / Госзаказчиком" },
    { value: "Коммерческие условия. Отсрочка платежа более 120 рабочих (180 календарных) дней", label: "Коммерческие условия. Отсрочка платежа более 120 рабочих (180 календарных) дней" },
    { value: "Коммерческие условия. Поставка в удаленные территории", label: "Коммерческие условия. Поставка в удаленные территории" },
    { value: "Коммерческие условия. Консигнация / Хранение у Покупателя за счет Поставщика", label: "Коммерческие условия. Консигнация / Хранение у Покупателя за счет Поставщика" },
    { value: "Номенклатура. Лот неделимый. Не можем скомплектовать более 20% номенклатуры", label: "Номенклатура. Лот неделимый. Не можем скомплектовать более 20% номенклатуры" },
    { value: "Номенклатура. Оборудование 35 кВ и выше", label: "Номенклатура. Оборудование 35 кВ и выше" },
    { value: "Номенклатура. Частотный привод 6–10 кВ", label: "Номенклатура. Частотный привод 6–10 кВ" },
    { value: "Номенклатура. Ремкомплект / ЗИП / Продукция по чертежу", label: "Номенклатура. Ремкомплект / ЗИП / Продукция по чертежу" },
    { value: "Номенклатура. Военная приемка", label: "Номенклатура. Военная приемка" },
    { value: "Номенклатура. Атомная приемка", label: "Номенклатура. Атомная приемка" },
    { value: "Номенклатура. Поставка с работами", label: "Номенклатура. Поставка с работами" },
    { value: "Оргвопросы. На момент согласования менее 3 рабочих дней до подачи заявки", label: "Оргвопросы. На момент согласования менее 3 рабочих дней до подачи заявки" },
    { value: "Оргвопросы. МОПП подается самостоятельно (подача без ЭЦП)", label: "Оргвопросы. МОПП подается самостоятельно (подача без ЭЦП)" },
    { value: "Оргвопросы. Тендер ХК. Нет УРКК. Договоры с филиалами. Отгрузка по всей стране.", label: "Оргвопросы. Тендер ХК. Нет УРКК. Договоры с филиалами. Отгрузка по всей стране." },
    { value: "Оргвопросы. Отсутствует ТЗ / Нет документации / Некорректная ссылка", label: "Оргвопросы. Отсутствует ТЗ / Нет документации / Некорректная ссылка" },
    { value: "Оргвопросы. Закрытый тендер / Не прошли квалификацию", label: "Оргвопросы. Закрытый тендер / Не прошли квалификацию" },
    { value: "Оргвопросы. Отказ организатора от проведения тендера", label: "Оргвопросы. Отказ организатора от проведения тендера" },
    { value: "Оргвопросы. Отпуск или Болезнь МОПП", label: "Оргвопросы. Отпуск или Болезнь МОПП" },
    { value: "Оргвопросы. Опрос рынка / Мониторинг / Анализ рынка / Анонс / КИМ", label: "Оргвопросы. Опрос рынка / Мониторинг / Анализ рынка / Анонс / КИМ" },
    { value: "Прочее", label: "Прочее" }
  ] },
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

  { key: "legalEntity", label: "Юридическое лицо ЭТМ", section: "ЭТМ и статусы", important: true },
  { key: "tenderSubmittedDate", label: "Тендер подан", section: "ЭТМ и статусы", type: "date" },
  { key: "tenderWonDate", label: "Тендер выигран", section: "ЭТМ и статусы", type: "date" },

  { key: "applicationSecurity", label: "Обеспечение заявки", section: "Обеспечения и режимы" },
  { key: "contractSecurity", label: "Обеспечение контракта", section: "Обеспечения и режимы" },
  { key: "warrantySecurity", label: "Обеспечение гарантийных обязательств", section: "Обеспечения и режимы" },
  { key: "warrantyMonths", label: "Гарантийный срок, мес.", section: "Обеспечения и режимы", type: "number" },
  { key: "nationalRegime", label: "Национальный режим", section: "Обеспечения и режимы", type: "select", options: [empty, { value: "none", label: "Нет" }, { value: "ban", label: "Запрет" }, { value: "restriction", label: "Ограничение" }, { value: "preference", label: "Преимущество" }] },
  { key: "specialAccount", label: "Спецсчёт", section: "Обеспечения и режимы", type: "select", options: yesNo },

  { key: "productDirections", label: "Товарные направления", section: "Товарные направления", type: "checkboxes", options: productDirections.map((value) => ({ value, label: value })) },
  { key: "discrepancyNotes", label: "Примечания к расхождениям по колонкам тендера", section: "Контроль качества", type: "textarea" }
];

export const initialCard: TenderCard = {
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

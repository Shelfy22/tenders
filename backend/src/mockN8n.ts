import type { AutofillResult } from "./types.js";

export function createMockN8nResult(): AutofillResult {
  const fields = {
    counterparty: "ООО «Ромашка»",
    inn: "7701234567",
    kpp: "770101001",
    legalEntity: "149",
    federalLaw: "223",
    resultDate: "2026-12-10",
    contractDate: "2026-12-30",
    deliveryType: "by_requests",
    deliveryDate: "",
    deliveryBatchDays: 5,
    deliveryDays: "",
    paymentDelayDays: 30,
    nationalRegime: "restriction",
    lotDivisible: "no",
    contractSecurity: "5% от НМЦК",
    applicationSecurity: "1% от НМЦК",
    warrantySecurity: "",
    warrantyMonths: 12,
    specialAccount: "no",
    deliveryNote: ""
  } as const;

  return {
    fields: { ...fields },
    meta: {
      counterparty: { source: "Проект договора", confidence: "high" },
      inn: { source: "Проект договора", confidence: "high" },
      kpp: { source: "Проект договора", confidence: "high" },
      legalEntity: { source: "Извещение, найдено ограничение СМСП", confidence: "high" },
      federalLaw: { source: "Страница ЭТП", confidence: "high" },
      resultDate: { source: "Страница ЭТП, раздел «Общая информация»", confidence: "medium" },
      contractDate: { source: "Расчёт: дата итогов + 20 календарных дней", confidence: "high" },
      deliveryType: { source: "Техническое задание", confidence: "medium" },
      deliveryBatchDays: { source: "Техническое задание", confidence: "medium" },
      paymentDelayDays: { source: "Проект договора", confidence: "high" },
      nationalRegime: { source: "Извещение, найдено ПП 1875", confidence: "medium" },
      lotDivisible: { source: "Информационная карта", confidence: "medium" },
      contractSecurity: { source: "Извещение", confidence: "medium" },
      applicationSecurity: { source: "Извещение", confidence: "medium" },
      warrantyMonths: { source: "Техническое задание", confidence: "low" },
      specialAccount: { source: "Признаки спецсчёта не найдены", confidence: "medium" }
    },
    warnings: [
      "Гарантийный срок найден с низкой уверенностью",
      "Проверьте делимость лота вручную"
    ]
  };
}

export async function callN8nWebhook(
  webhookUrl: string,
  tenderCardId: number,
  tenderUrl: string
): Promise<AutofillResult> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenderCardId, tenderUrl })
  });
  if (!response.ok) {
    throw new Error(`n8n webhook returned ${response.status}`);
  }
  return (await response.json()) as AutofillResult;
}

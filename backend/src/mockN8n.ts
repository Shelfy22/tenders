import type { AutofillResult } from "./types.js";

export interface AutofillDocument {
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export function createEmptyAutofillFields(): AutofillResult["fields"] {
  return {
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
}

export function createMockN8nResult(): AutofillResult {
  const fields: AutofillResult["fields"] = {
    ...createEmptyAutofillFields(),
    dateCreated: "2026-06-08",
    submissionDeadlineDate: "2026-12-01",
    submissionDeadlineTime: "10:00",
    tenderUrlSource: "https://zakupki.kontur.ru/example",
    federalLaw: "223",
    stateDefenseOrder: "no",
    tenderStatus: "participation_application",
    initialPrice: "1 251 000,00 рублей",
    resultDate: "2026-12-10",
    contractDate: "2026-12-30",
    deliveryType: "by_requests",
    deliveryBatchDays: 5,
    paymentDelayDays: 30,
    lotDivisible: "no",
    counterpartyName: "ООО «Ромашка»",
    counterpartyInn: "7701234567",
    counterpartyKpp: "770101001",
    legalEntity: "149",
    applicationSecurity: "1% от НМЦК",
    contractSecurity: "5% от НМЦК",
    warrantyMonths: 12,
    nationalRegime: "restriction",
    specialAccount: "no",
    productDirections: ["Отдел ЭТСИиО"]
  };

  return {
    fields,
    meta: {
      submissionDeadlineDate: { source: "Страница ЭТП", confidence: "high" },
      federalLaw: { source: "Страница ЭТП", confidence: "high" },
      initialPrice: { source: "Извещение", confidence: "high" },
      counterpartyName: { source: "Проект договора", confidence: "high" },
      counterpartyInn: { source: "Проект договора", confidence: "high" },
      counterpartyKpp: { source: "Проект договора", confidence: "high" },
      legalEntity: {
        source: "Извещение, найдено ограничение СМСП",
        confidence: "high"
      },
      resultDate: {
        source: "Страница ЭТП, раздел «Общая информация»",
        confidence: "medium"
      },
      contractDate: {
        source: "Расчёт: дата итогов + 20 календарных дней",
        confidence: "high"
      },
      deliveryType: { source: "Техническое задание", confidence: "medium" },
      deliveryBatchDays: { source: "Техническое задание", confidence: "medium" },
      paymentDelayDays: { source: "Проект договора", confidence: "high" },
      nationalRegime: { source: "Извещение, найдено ПП 1875", confidence: "medium" },
      lotDivisible: { source: "Информационная карта", confidence: "medium" },
      contractSecurity: { source: "Извещение", confidence: "medium" },
      applicationSecurity: { source: "Извещение", confidence: "medium" },
      warrantyMonths: { source: "Техническое задание", confidence: "low" },
      specialAccount: {
        source: "Признаки спецсчёта не найдены",
        confidence: "medium"
      },
      productDirections: {
        source: "Спецификация: кабель и автоматические выключатели",
        confidence: "high",
        evidence: "кабель силовой, выключатель автоматический"
      }
    },
    warnings: [
      "Гарантийный срок найден с низкой уверенностью",
      "Проверьте делимость лота вручную"
    ]
  };
}

export async function callN8nWebhook(
  webhookUrl: string,
  requestId: string,
  tenderCardId: number,
  input: {
    seldonId: string;
    etpId: string;
    purchaseType: string;
  },
  callbackUrl: string
): Promise<AutofillResult | undefined> {
  const payload = { requestId, tenderCardId, ...input, callbackUrl };
  console.log("[autofill/start] calling n8n:", webhookUrl);
  console.log("[autofill/start] payload:", payload);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const responseText = await response.text();
  console.log("[autofill/start] n8n status:", response.status);
  console.log("[autofill/start] n8n response preview:", responseText.slice(0, 300));

  if (!response.ok) {
    throw new Error(
      `n8n webhook returned ${response.status}: ${responseText.slice(0, 500)}`
    );
  }
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
    return undefined;
  }
  try {
    return JSON.parse(responseText) as AutofillResult;
  } catch {
    console.warn("[autofill/start] n8n returned invalid JSON; waiting for callback");
    return undefined;
  }
}

export async function callN8nWebhookWithDocuments(
  webhookUrl: string,
  requestId: string,
  tenderCardId: number,
  tenderUrl: string,
  callbackUrl: string,
  documents: AutofillDocument[]
): Promise<AutofillResult | undefined> {
  const form = new FormData();
  form.append("requestId", requestId);
  form.append("tenderCardId", String(tenderCardId));
  form.append("tenderUrl", tenderUrl);
  form.append("callbackUrl", callbackUrl);
  form.append("documentCount", String(documents.length));
  form.append(
    "documentManifest",
    JSON.stringify(
      documents.map(({ originalName, mimeType, size }, index) => ({
        field: `document_${index + 1}`,
        originalName,
        mimeType,
        size
      }))
    )
  );
  documents.forEach((document, index) => {
    form.append(
      `document_${index + 1}`,
      new Blob([new Uint8Array(document.buffer)], { type: document.mimeType }),
      document.originalName
    );
  });

  console.log("[autofill/documents] calling n8n:", webhookUrl);
  console.log("[autofill/documents] payload:", {
    requestId,
    tenderCardId,
    tenderUrl,
    callbackUrl,
    documents: documents.map(({ originalName, mimeType, size }) => ({
      originalName,
      mimeType,
      size
    }))
  });

  const response = await fetch(webhookUrl, { method: "POST", body: form });
  const responseText = await response.text();
  console.log("[autofill/documents] n8n status:", response.status);
  console.log("[autofill/documents] n8n response preview:", responseText.slice(0, 300));

  if (!response.ok) {
    throw new Error(
      `n8n documents webhook returned ${response.status}: ${responseText.slice(0, 500)}`
    );
  }
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
    return undefined;
  }
  try {
    return JSON.parse(responseText) as AutofillResult;
  } catch {
    console.warn("[autofill/documents] n8n returned invalid JSON; waiting for callback");
    return undefined;
  }
}

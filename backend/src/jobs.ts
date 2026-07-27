import { randomUUID } from "node:crypto";
import {
  callN8nWebhook,
  callN8nWebhookWithDocuments,
  createEmptyAutofillFields,
  createMockN8nResult
} from "./mockN8n.js";
import type { AutofillDocument } from "./mockN8n.js";
import type { AutofillJob, AutofillResult } from "./types.js";

export interface AutofillStartData {
  tenderUrl?: string;
  seldonId?: string;
  etpId?: string;
  purchaseType?: string;
}

const jobs = new Map<string, AutofillJob>();
const DEFAULT_AUTOFILL_WEBHOOK_URL =
  "https://halonkjurusun.beget.app/webhook/tender-autofill1";
const DEFAULT_DOCUMENTS_WEBHOOK_URL =
  "https://halonkjurusun.beget.app/webhook/tender-autofill";
const stages = [
  "Определяем ЭТП",
  "Скачиваем документацию",
  "Классифицируем документы",
  "Парсим проект договора",
  "Извлекаем поля",
  "Проверяем правила заполнения"
];

export function getJob(id: string): AutofillJob | undefined {
  return jobs.get(id);
}

export function startJob(
  tenderCardId: number,
  startData: AutofillStartData,
  documents: AutofillDocument[] = []
): AutofillJob {
  const job: AutofillJob = {
    id: `af_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    tenderCardId,
    ...startData,
    status: "processing",
    progress: stages[0]
  };
  jobs.set(job.id, job);
  scheduleJobTimeout(job);
  void processJob(job, documents);
  return job;
}

export function completeJobFromCallback(
  requestId: string | undefined,
  tenderCardId: number,
  tenderUrl: string | undefined,
  result: {
    fields?: Partial<AutofillResult["fields"]>;
    meta?: AutofillResult["meta"];
    warnings?: string[];
  }
): AutofillJob | undefined {
  const jobByRequestId = requestId ? jobs.get(requestId) : undefined;
  const job =
    jobByRequestId?.status === "processing"
      ? jobByRequestId
      : [...jobs.values()]
          .reverse()
          .find(
            (candidate) =>
              candidate.status === "processing" &&
              candidate.tenderCardId === tenderCardId &&
              (!tenderUrl || candidate.tenderUrl === tenderUrl)
          );
  if (!job) return undefined;

  job.result = {
    fields: {
      ...createEmptyAutofillFields(),
      ...result.fields,
      seldonId: result.fields?.seldonId ?? job.seldonId ?? "",
      etpId: result.fields?.etpId ?? job.etpId ?? "",
      purchaseType: result.fields?.purchaseType ?? job.purchaseType ?? "",
      tenderUrl: result.fields?.tenderUrl ?? tenderUrl ?? job.tenderUrl ?? "",
      tenderUrlSource: result.fields?.tenderUrlSource ?? result.fields?.tenderUrl ?? tenderUrl ?? job.tenderUrl ?? ""
    },
    meta: result.meta ?? {},
    warnings: result.warnings ?? []
  };
  job.progress = "Готово";
  job.status = "done";
  console.log("[autofill/result] completed job:", job.id);
  return job;
}

async function processJob(
  job: AutofillJob,
  documents: AutofillDocument[]
): Promise<void> {
  try {
    const webhookUrl = documents.length
      ? process.env.N8N_DOCUMENTS_WEBHOOK_URL?.trim() ||
        DEFAULT_DOCUMENTS_WEBHOOK_URL
      : process.env.N8N_AUTOFILL_ONLY_WEBHOOK_URL?.trim() ||
        DEFAULT_AUTOFILL_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn("[autofill/start] n8n webhook URL is empty; using mock result");
      await advanceProgress(job);
      job.result = createMockN8nResult();
      job.progress = "Готово";
      job.status = "done";
      return;
    }

    void advanceProgress(job);
    const callbackUrl =
      process.env.CALLBACK_URL?.trim() ||
      buildCallbackUrl(process.env.PUBLIC_BASE_URL);
    if (!callbackUrl) {
      throw new Error("PUBLIC_BASE_URL or CALLBACK_URL is not configured");
    }

    const result = documents.length
      ? await callN8nWebhookWithDocuments(
          webhookUrl,
          job.id,
          job.tenderCardId,
          job.tenderUrl ?? "",
          callbackUrl,
          documents
        )
      : await callN8nWebhook(
          webhookUrl,
          job.id,
          job.tenderCardId,
          {
            seldonId: job.seldonId ?? "",
            etpId: job.etpId ?? "",
            purchaseType: job.purchaseType ?? ""
          },
          callbackUrl
        );

    // Callback normally completes the job first; JSON webhook output is a fallback.
    if (job.status === "processing" && result?.fields) {
      completeJobFromCallback(job.id, job.tenderCardId, job.tenderUrl, result);
    }
  } catch (error) {
    if (job.status === "processing") {
      job.status = "error";
      job.error = error instanceof Error ? error.message : "Неизвестная ошибка";
      console.error("[autofill/start] n8n request failed:", job.error);
    }
  }
}

function buildCallbackUrl(publicBaseUrl: string | undefined): string {
  const baseUrl = publicBaseUrl?.trim().replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}/api/tender-autofill/result` : "";
}

function scheduleJobTimeout(job: AutofillJob): void {
  const configuredTimeout = Number(process.env.N8N_JOB_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 20 * 60 * 1000;
  const timer = setTimeout(() => {
    if (job.status !== "processing") return;
    job.status = "error";
    job.error = "Превышено время ожидания результата n8n";
    console.error("[autofill/start] job timed out:", job.id);
  }, timeoutMs);
  timer.unref();
}

async function advanceProgress(job: AutofillJob): Promise<void> {
  for (const stage of stages.slice(1)) {
    await wait(900);
    if (job.status !== "processing") return;
    job.progress = stage;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

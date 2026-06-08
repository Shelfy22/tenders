import { randomUUID } from "node:crypto";
import {
  callN8nWebhook,
  createEmptyAutofillFields,
  createMockN8nResult
} from "./mockN8n.js";
import type { AutofillJob, AutofillResult } from "./types.js";

const jobs = new Map<string, AutofillJob>();
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

export function startJob(tenderCardId: number, tenderUrl: string): AutofillJob {
  const job: AutofillJob = {
    id: `af_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    tenderCardId,
    tenderUrl,
    status: "processing",
    progress: stages[0]
  };
  jobs.set(job.id, job);
  void processJob(job);
  return job;
}

export function completeJobFromCallback(
  tenderCardId: number,
  tenderUrl: string | undefined,
  result: {
    fields?: Partial<AutofillResult["fields"]>;
    meta?: AutofillResult["meta"];
    warnings?: string[];
  }
): AutofillJob | undefined {
  const job = [...jobs.values()]
    .reverse()
    .find(
      (candidate) =>
        candidate.status === "processing" &&
        candidate.tenderCardId === tenderCardId &&
        (!tenderUrl || candidate.tenderUrl === tenderUrl)
    );
  if (!job) return undefined;

  job.result = {
    fields: { ...createEmptyAutofillFields(), ...result.fields },
    meta: result.meta ?? {},
    warnings: result.warnings ?? []
  };
  job.progress = "Готово";
  job.status = "done";
  console.log("[autofill/result] completed job:", job.id);
  return job;
}

async function processJob(job: AutofillJob): Promise<void> {
  try {
    const webhookUrl =
      process.env.N8N_AUTOFILL_WEBHOOK_URL?.trim() ||
      process.env.N8N_WEBHOOK_URL?.trim();

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

    const result = await callN8nWebhook(
      webhookUrl,
      job.tenderCardId,
      job.tenderUrl,
      callbackUrl
    );

    // Callback normally completes the job first; JSON webhook output is a fallback.
    if (job.status === "processing" && result?.fields) {
      completeJobFromCallback(job.tenderCardId, job.tenderUrl, result);
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

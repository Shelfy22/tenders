import { randomUUID } from "node:crypto";
import { callN8nWebhook, createMockN8nResult } from "./mockN8n.js";
import type { AutofillJob } from "./types.js";

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

async function processJob(job: AutofillJob): Promise<void> {
  try {
    for (const stage of stages.slice(1)) {
      await wait(900);
      job.progress = stage;
    }
    await wait(900);
    const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim();
    job.result = webhookUrl
      ? await callN8nWebhook(webhookUrl, job.tenderCardId, job.tenderUrl)
      : createMockN8nResult();
    job.progress = "Готово";
    job.status = "done";
  } catch (error) {
    job.status = "error";
    job.error = error instanceof Error ? error.message : "Неизвестная ошибка";
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

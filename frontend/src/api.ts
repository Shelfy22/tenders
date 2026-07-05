import type {
  ActiveCsvBatchResponse,
  AutofillJob,
  AutofillStatusResponse,
  MonthlyStats,
  SavedTender,
  TenderCard
} from "./types";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000" : "");

export interface AutofillStartInput {
  seldonId: string;
  etpId: string;
  purchaseType: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Ошибка запроса");
  return body as T;
}

export function startAutofill(input: AutofillStartInput): Promise<AutofillJob> {
  return request("/api/tender-autofill/start", {
    method: "POST",
    body: JSON.stringify({ tenderCardId: 123, ...input })
  });
}

export async function startAutofillWithDocuments(
  tenderUrl: string,
  documents: File[]
): Promise<AutofillJob> {
  const form = new FormData();
  form.append("tenderCardId", "123");
  form.append("tenderUrl", tenderUrl);
  documents.forEach((document) => form.append("documents", document));

  const response = await fetch(`${API_URL}/api/tender-autofill/start-with-documents`, {
    method: "POST",
    body: form
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Ошибка загрузки документов");
  return body as AutofillJob;
}

export function getAutofillStatus(jobId: string): Promise<AutofillStatusResponse> {
  return request(`/api/tender-autofill/status/${jobId}`);
}

export function saveTenderCard(
  card: TenderCard,
  importedTenderId?: number | null
): Promise<{ success: boolean; message: string; savedTender: SavedTender }> {
  return request("/api/tender-card/123", {
    method: "PATCH",
    body: JSON.stringify({ card, importedTenderId })
  });
}

export function getActiveCsvBatch(): Promise<ActiveCsvBatchResponse> {
  return request("/api/csv-batches/active");
}

export async function uploadCsvBatch(files: File[]): Promise<{
  success: boolean;
  batchId: number;
  tenderCount: number;
  fileCount: number;
}> {
  const form = new FormData();
  files.slice(0, 3).forEach((file) => form.append("files", file));
  const response = await fetch(`${API_URL}/api/csv-batches/upload`, {
    method: "POST",
    body: form
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Не удалось загрузить CSV файлы");
  return body;
}

export function getSavedTenders(): Promise<{ tenders: SavedTender[] }> {
  return request("/api/saved-tenders");
}

export function getMonthlyStats(): Promise<{ months: MonthlyStats[] }> {
  return request("/api/stats/monthly");
}

import type { AutofillJob, AutofillStatusResponse, TenderCard } from "./types";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000" : "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Ошибка запроса");
  return body as T;
}

export function startAutofill(tenderUrl: string): Promise<AutofillJob> {
  return request("/api/tender-autofill/start", {
    method: "POST",
    body: JSON.stringify({ tenderCardId: 123, tenderUrl })
  });
}

export function getAutofillStatus(jobId: string): Promise<AutofillStatusResponse> {
  return request(`/api/tender-autofill/status/${jobId}`);
}

export function saveTenderCard(card: TenderCard): Promise<{ success: boolean; message: string }> {
  return request("/api/tender-card/123", {
    method: "PATCH",
    body: JSON.stringify(card)
  });
}

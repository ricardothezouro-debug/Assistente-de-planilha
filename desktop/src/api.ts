import type { DeleteScope, FinanceState } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8766";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });
  const text = await response.text();
  let data: { detail?: string; error?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }
  if (!response.ok) {
    throw new Error(data.detail ?? data.error ?? "Erro inesperado.");
  }
  return data as T;
}

export function loadState(year: number, month: number): Promise<FinanceState> {
  return request<FinanceState>(`/api/state?year=${year}&month=${month}`);
}

export function createEntry(payload: {
  type: string;
  name: string;
  amount: string;
  category: string;
  date: string;
  installments: number;
  status: string;
}): Promise<{ ok: boolean }> {
  return request("/api/entries", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createCategory(name: string): Promise<{ category: string }> {
  return request("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export function updateInitialInvested(amount: string): Promise<{ ok: boolean }> {
  return request("/api/settings/initial-invested", {
    method: "POST",
    body: JSON.stringify({ amount })
  });
}

export function toggleOccurrence(id: number): Promise<{ status: string }> {
  return request(`/api/occurrences/${id}/toggle`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function deleteOccurrence(occurrenceId: number, scope: DeleteScope): Promise<{ ok: boolean }> {
  return request("/api/delete", {
    method: "POST",
    body: JSON.stringify({ occurrence_id: occurrenceId, scope })
  });
}

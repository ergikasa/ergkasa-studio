import { VoiceCatalog } from "@erkasa/contracts";

/** Shapes returned by the Spring backend (RunQueries.java). */
export type RunStatus = "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type StepStatus = "PENDING" | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface RunSummary {
  id: string;
  title: string | null;
  topic: string;
  theme: string;
  voice: string;
  seconds: number;
  silent: boolean;
  status: RunStatus;
  error: string | null;
  progress: number;
  currentStep: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface StepView {
  id: string;
  taskType: string;
  status: StepStatus;
  attempt: number;
  maxAttempts: number;
  progress: number;
  message: string | null;
  errorCode: string | null;
  error: string | null;
  outputs: Array<{ role: string; ref: string }>;
  metrics: Record<string, number>;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunDetail {
  run: RunSummary;
  steps: StepView[];
  files: string[];
}

export interface NewRun {
  topic: string;
  theme: string;
  voice: string;
  seconds: number;
  notes?: string;
  silent: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(
      "The backend is not reachable. Start it with: cd backend; .\\mvnw.cmd spring-boot:run",
      0,
    );
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string; message?: string; detail?: string };
      message = body.error ?? body.detail ?? body.message ?? message;
    } catch {
      // keep the status line
    }
    if (res.status === 502 || res.status === 504 || res.status === 500) {
      if (message.startsWith("5"))
        message = "The backend is not running (start it with .\\mvnw.cmd spring-boot:run)";
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  voices: async () => VoiceCatalog.parse(await call<unknown>("/api/voices")),
  runs: () => call<RunSummary[]>("/api/runs"),
  run: (id: string) => call<RunDetail>(`/api/runs/${encodeURIComponent(id)}`),
  create: (body: NewRun) =>
    call<RunDetail>("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  cancel: (id: string) => call<RunDetail>(`/api/runs/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  retry: (id: string) => call<RunDetail>(`/api/runs/${encodeURIComponent(id)}/retry`, { method: "POST" }),
  fileUrl: (id: string, file: string) => `/api/runs/${encodeURIComponent(id)}/files/${file}`,
};

export const THEMES = ["psychology", "money", "growth", "philosophy", "science", "decisions"] as const;

/** Shared between the Voices page and the New video form. */
export const VOICE_KEY = "erkasa.voice";
/** A plan handed from a run to Plan Preview. */
export const PREVIEW_PLAN_KEY = "erkasa.preview-plan";

export function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function store(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode): the value only lives for this page
  }
}

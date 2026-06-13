import cors from "cors";
import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { completeJobFromCallback, getJob, startJob } from "./jobs.js";
import { createMockN8nResult } from "./mockN8n.js";
import type {
  AutofillFields,
  AutofillMeta,
  AutofillStatusResponse,
  TenderCard
} from "./types.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(currentDirectory, "../../frontend/dist");
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 15, fileSize: 25 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/tender-autofill/start", (req, res) => {
  const { tenderCardId, tenderUrl } = req.body as {
    tenderCardId?: number;
    tenderUrl?: string;
  };
  if (typeof tenderCardId !== "number" || !Number.isInteger(tenderCardId) || !tenderUrl?.trim()) {
    res.status(400).json({ status: "error", error: "tenderCardId и tenderUrl обязательны" });
    return;
  }
  try {
    new URL(tenderUrl);
  } catch {
    res.status(400).json({ status: "error", error: "Некорректная ссылка на тендер" });
    return;
  }
  const job = startJob(tenderCardId, tenderUrl);
  const n8nConfigured = Boolean(
    process.env.N8N_AUTOFILL_WEBHOOK_URL?.trim() ||
    process.env.N8N_WEBHOOK_URL?.trim()
  );
  console.log("[autofill/start] accepted job:", {
    jobId: job.id,
    tenderCardId,
    tenderUrl,
    n8nConfigured
  });
  res.status(202).json({ jobId: job.id, status: job.status, n8nConfigured });
});

app.post(
  "/api/tender-autofill/start-with-documents",
  documentUpload.array("documents", 15),
  (req, res) => {
    const tenderCardId = Number(req.body.tenderCardId);
    const tenderUrl = String(req.body.tenderUrl ?? "").trim();
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (!Number.isInteger(tenderCardId) || !tenderUrl || files.length === 0) {
      res.status(400).json({
        status: "error",
        error: "tenderCardId, tenderUrl и хотя бы один документ обязательны"
      });
      return;
    }
    if (totalSize > 75 * 1024 * 1024) {
      res.status(413).json({
        status: "error",
        error: "Общий размер документов не должен превышать 75 МБ"
      });
      return;
    }
    try {
      new URL(tenderUrl);
    } catch {
      res.status(400).json({ status: "error", error: "Некорректная ссылка на тендер" });
      return;
    }

    const job = startJob(
      tenderCardId,
      tenderUrl,
      files.map((file) => ({
        originalName: file.originalname,
        mimeType: file.mimetype || "application/octet-stream",
        size: file.size,
        buffer: file.buffer
      }))
    );
    const n8nConfigured = Boolean(
      process.env.N8N_DOCUMENTS_WEBHOOK_URL?.trim() ||
      process.env.N8N_AUTOFILL_WEBHOOK_URL?.trim() ||
      process.env.N8N_WEBHOOK_URL?.trim()
    );
    console.log("[autofill/documents] accepted job:", {
      jobId: job.id,
      tenderCardId,
      tenderUrl,
      documentCount: files.length,
      n8nConfigured
    });
    res.status(202).json({
      jobId: job.id,
      status: job.status,
      n8nConfigured,
      documentCount: files.length
    });
  }
);

app.get("/api/tender-autofill/status/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    const response: AutofillStatusResponse = { status: "error", error: "Job not found" };
    res.status(404).json(response);
    return;
  }
  if (job.status === "done" && job.result) {
    res.json({ status: "done", progress: job.progress, ...job.result });
    return;
  }
  if (job.status === "error") {
    res.status(502).json({ status: "error", progress: job.progress, error: job.error });
    return;
  }
  res.json({ status: "processing", progress: job.progress });
});

app.post("/api/tender-autofill/result", (req, res) => {
  const { requestId, tenderCardId, tenderUrl, status, fields, meta, warnings } = req.body as {
    requestId?: string;
    tenderCardId?: number | string;
    tenderUrl?: string;
    status?: string;
    fields?: Partial<AutofillFields>;
    meta?: AutofillMeta;
    warnings?: string[];
  };
  const normalizedTenderCardId =
    typeof tenderCardId === "number" ? tenderCardId : Number(tenderCardId);
  if (!Number.isInteger(normalizedTenderCardId) || status !== "done" || !fields) {
    console.warn("[autofill/result] rejected callback:", {
      requestId,
      tenderCardId,
      status,
      hasFields: Boolean(fields)
    });
    res.status(400).json({
      success: false,
      error: "Ожидаются tenderCardId, status=done и fields"
    });
    return;
  }

  const job = completeJobFromCallback(requestId, normalizedTenderCardId, tenderUrl, {
    fields,
    meta,
    warnings
  });
  if (!job) {
    console.warn("[autofill/result] active job not found:", {
      requestId,
      tenderCardId: normalizedTenderCardId,
      tenderUrl
    });
    res.status(404).json({ success: false, error: "Active job not found" });
    return;
  }
  res.json({ success: true, jobId: job.id, status: job.status });
});

app.patch("/api/tender-card/:id", (req, res) => {
  const card = req.body as TenderCard;
  console.log(`Сохранена карточка тендера ${req.params.id}:`, card);
  res.json({ success: true, message: "Карточка сохранена" });
});

app.post("/api/n8n-webhook-mock/tender-autofill", (req, res) => {
  if (!req.body?.tenderUrl) {
    res.status(400).json({ error: "tenderUrl обязателен" });
    return;
  }
  // В реальном проекте backend вызывает POST https://n8n.example.com/webhook/tender-autofill.
  res.json(createMockN8nResult());
});

app.post(
  "/api/n8n-webhook-mock/tender-autofill-documents",
  documentUpload.any(),
  (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    console.log("[n8n-mock/documents] received:", {
      requestId: req.body.requestId,
      tenderCardId: req.body.tenderCardId,
      tenderUrl: req.body.tenderUrl,
      callbackUrl: req.body.callbackUrl,
      documentCount: files.length,
      fields: files.map((file) => file.fieldname)
    });
    if (!req.body.tenderUrl || files.length === 0) {
      res.status(400).json({ error: "tenderUrl и документы обязательны" });
      return;
    }
    res.json(createMockN8nResult());
  }
);

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    res.status(413).json({
      status: "error",
      error:
        error.code === "LIMIT_FILE_SIZE"
          ? "Размер одного документа не должен превышать 25 МБ"
          : `Ошибка загрузки документов: ${error.message}`
    });
    return;
  }
  next(error);
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(frontendDirectory));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(frontendDirectory, "index.html"));
  });
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Tender API: http://localhost:${port}`);
  const autofillWebhookConfigured = Boolean(
    process.env.N8N_AUTOFILL_WEBHOOK_URL?.trim() ||
    process.env.N8N_WEBHOOK_URL?.trim()
  );
  console.log("[startup] n8n autofill configured:", autofillWebhookConfigured);
  console.log(
    "[startup] n8n documents configured:",
    Boolean(process.env.N8N_DOCUMENTS_WEBHOOK_URL?.trim()) ||
      autofillWebhookConfigured
  );
  console.log("[startup] public base URL:", process.env.PUBLIC_BASE_URL || "(empty)");
});

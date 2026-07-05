import cors from "cors";
import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseTenderCsv } from "./csvParser.js";
import {
  getActiveCsvBatch,
  getMonthlyStats,
  initDatabase,
  isDatabaseConfigured,
  listSavedTenders,
  replaceActiveCsvBatch,
  saveTenderReview
} from "./database.js";
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
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 3, fileSize: 20 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/csv-batches/upload", csvUpload.any(), async (req, res, next) => {
  try {
    ensureDatabase(res);
    if (res.headersSent) return;

    const files = ((req.files as Express.Multer.File[] | undefined) ?? [])
      .filter((file) => file.size > 0)
      .slice(0, 3);
    if (files.length === 0) {
      res.status(400).json({ success: false, error: "Нужно передать CSV файлы" });
      return;
    }

    const parsedFiles = files.map((file) => {
      const content = file.buffer.toString("utf8");
      const parsed = parseTenderCsv(content);
      return {
        fileName: file.originalname,
        content,
        rows: parsed.rows
      };
    });
    const result = await replaceActiveCsvBatch(parsedFiles);
    res.status(201).json({ success: true, ...result, fileCount: parsedFiles.length });
  } catch (error) {
    next(error);
  }
});

app.get("/api/csv-batches/active", async (_req, res, next) => {
  try {
    ensureDatabase(res);
    if (res.headersSent) return;
    res.json(await getActiveCsvBatch());
  } catch (error) {
    next(error);
  }
});

app.post("/api/tender-autofill/start", (req, res) => {
  const { tenderCardId, seldonId, etpId, purchaseType } = req.body as {
    tenderCardId?: number;
    seldonId?: string;
    etpId?: string;
    purchaseType?: string;
  };
  const normalizedSeldonId = String(seldonId ?? "").trim();
  const normalizedEtpId = String(etpId ?? "").trim();
  const normalizedPurchaseType = String(purchaseType ?? "").trim();
  if (
    typeof tenderCardId !== "number" ||
    !Number.isInteger(tenderCardId) ||
    (!normalizedSeldonId && !normalizedEtpId) ||
    !normalizedPurchaseType
  ) {
    res.status(400).json({ status: "error", error: "tenderCardId, один из seldonId/etpId и purchaseType обязательны" });
    return;
  }
  const job = startJob(tenderCardId, {
    seldonId: normalizedSeldonId,
    etpId: normalizedEtpId,
    purchaseType: normalizedPurchaseType
  });
  const n8nConfigured = true;
  console.log("[autofill/start] accepted job:", {
    jobId: job.id,
    tenderCardId,
    seldonId: normalizedSeldonId,
    etpId: normalizedEtpId,
    purchaseType: normalizedPurchaseType,
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
      { tenderUrl },
      files.map((file) => ({
        originalName: file.originalname,
        mimeType: file.mimetype || "application/octet-stream",
        size: file.size,
        buffer: file.buffer
      }))
    );
    const n8nConfigured = Boolean(
      process.env.N8N_DOCUMENTS_WEBHOOK_URL?.trim() ||
      "https://halonkjurusun.beget.app/webhook/tender-autofill"
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

app.patch("/api/tender-card/:id", async (req, res, next) => {
  try {
    ensureDatabase(res);
    if (res.headersSent) return;
    const { card, importedTenderId } = req.body as {
      card?: TenderCard;
      importedTenderId?: number | null;
    };
    if (!card) {
      res.status(400).json({ success: false, error: "card обязателен" });
      return;
    }
    const discrepancyNotes = String(card.discrepancyNotes ?? "").trim();
    const savedTender = await saveTenderReview({
      importedTenderId,
      card,
      discrepancyNotes
    });
    res.json({ success: true, message: "Карточка сохранена", savedTender });
  } catch (error) {
    next(error);
  }
});

app.get("/api/saved-tenders", async (_req, res, next) => {
  try {
    ensureDatabase(res);
    if (res.headersSent) return;
    res.json({ tenders: await listSavedTenders() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/stats/monthly", async (_req, res, next) => {
  try {
    ensureDatabase(res);
    if (res.headersSent) return;
    res.json({ months: await getMonthlyStats() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/n8n-webhook-mock/tender-autofill", (req, res) => {
  if ((!req.body?.seldonId && !req.body?.etpId) || !req.body?.purchaseType) {
    res.status(400).json({ error: "один из seldonId/etpId и purchaseType обязательны" });
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

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api] request failed:", error);
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : "Internal server error"
  });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(frontendDirectory));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(frontendDirectory, "index.html"));
  });
}

await initDatabase();

app.listen(port, "0.0.0.0", () => {
  console.log(`Tender API: http://localhost:${port}`);
  console.log(
    "[startup] n8n autofill URL:",
    process.env.N8N_AUTOFILL_ONLY_WEBHOOK_URL ||
      "https://halonkjurusun.beget.app/webhook/tender-autofill1"
  );
  console.log(
    "[startup] n8n documents URL:",
    process.env.N8N_DOCUMENTS_WEBHOOK_URL ||
      "https://halonkjurusun.beget.app/webhook/tender-autofill"
  );
  console.log("[startup] public base URL:", process.env.PUBLIC_BASE_URL || "(empty)");
  console.log("[startup] database configured:", isDatabaseConfigured());
});

function ensureDatabase(res: express.Response): void {
  if (isDatabaseConfigured()) return;
  res.status(503).json({
    success: false,
    error: "DATABASE_URL is not configured"
  });
}

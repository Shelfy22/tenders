import pg from "pg";
import type { ParsedCsvRow } from "./csvParser.js";
import type { TenderCard } from "./types.js";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL?.trim();
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined;

export interface ActiveTenderRow {
  id: number;
  batchId: number;
  fileId: number;
  rowIndex: number;
  source: Record<string, string>;
  card: TenderCard;
  discrepancyNotes: string;
  reviewedAt: string | null;
  createdAt: string;
}

export interface SavedTenderRow {
  id: number;
  importedTenderId: number | null;
  card: TenderCard;
  discrepancyNotes: string;
  savedAt: string;
}

export interface MonthlyStats {
  month: string;
  savedCount: number;
  withDiscrepancies: number;
}

export interface TestingRecord {
  id: number;
  seldonId: string;
  kkt: string;
  tenderStatus: string;
  tenderStatusReason: string;
  employeeNote: string;
  winner: "employee" | "ai";
  modelVersion: number;
  createdAt: string;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(pool);
}

export async function initDatabase(): Promise<void> {
  if (!pool) {
    console.warn("[startup] DATABASE_URL is empty; persistence endpoints are disabled");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS csv_batches (
      id SERIAL PRIMARY KEY,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      active BOOLEAN NOT NULL DEFAULT true,
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS csv_files (
      id SERIAL PRIMARY KEY,
      batch_id INTEGER NOT NULL REFERENCES csv_batches(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS imported_tenders (
      id SERIAL PRIMARY KEY,
      batch_id INTEGER NOT NULL REFERENCES csv_batches(id) ON DELETE CASCADE,
      file_id INTEGER NOT NULL REFERENCES csv_files(id) ON DELETE CASCADE,
      row_index INTEGER NOT NULL,
      source JSONB NOT NULL,
      card JSONB NOT NULL,
      discrepancy_notes TEXT NOT NULL DEFAULT '',
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_csv_batches_active ON csv_batches(active);
    CREATE INDEX IF NOT EXISTS idx_imported_tenders_batch ON imported_tenders(batch_id);
    CREATE INDEX IF NOT EXISTS idx_imported_tenders_created_at ON imported_tenders(created_at);

    CREATE TABLE IF NOT EXISTS saved_tenders (
      id SERIAL PRIMARY KEY,
      imported_tender_id INTEGER REFERENCES imported_tenders(id) ON DELETE SET NULL,
      card JSONB NOT NULL,
      discrepancy_notes TEXT NOT NULL DEFAULT '',
      saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_saved_tenders_saved_at ON saved_tenders(saved_at);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT INTO app_settings(key, value)
    VALUES('model_version', '1')
    ON CONFLICT (key) DO NOTHING;

    CREATE TABLE IF NOT EXISTS testing_records (
      id SERIAL PRIMARY KEY,
      seldon_id TEXT NOT NULL,
      kkt TEXT NOT NULL DEFAULT '',
      tender_status TEXT NOT NULL DEFAULT '',
      tender_status_reason TEXT NOT NULL DEFAULT '',
      employee_note TEXT NOT NULL DEFAULT '',
      winner TEXT NOT NULL CHECK (winner IN ('employee', 'ai')),
      model_version INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_testing_records_created_at ON testing_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_testing_records_seldon_id ON testing_records(seldon_id);
  `);

  await pool.query(`
    ALTER TABLE imported_tenders
      ADD COLUMN IF NOT EXISTS discrepancy_notes TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

    ALTER TABLE testing_records
      ADD COLUMN IF NOT EXISTS kkt TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS tender_status TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS tender_status_reason TEXT NOT NULL DEFAULT '';
  `);
}

export async function replaceActiveCsvBatch(files: Array<{
  fileName: string;
  content: string;
  rows: ParsedCsvRow[];
}>): Promise<{ batchId: number; tenderCount: number }> {
  const client = await requirePool().connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE csv_batches SET active = false WHERE active = true");
    const batchResult = await client.query<{ id: number }>(
      "INSERT INTO csv_batches(active, source) VALUES(true, $1) RETURNING id",
      ["n8n"]
    );
    const batchId = batchResult.rows[0].id;
    let tenderCount = 0;

    for (const [fileIndex, file] of files.entries()) {
      const fileResult = await client.query<{ id: number }>(
        `INSERT INTO csv_files(batch_id, file_name, file_index, content)
         VALUES($1, $2, $3, $4)
         RETURNING id`,
        [batchId, file.fileName, fileIndex + 1, file.content]
      );
      const fileId = fileResult.rows[0].id;
      for (const [rowIndex, row] of file.rows.entries()) {
        await client.query(
          `INSERT INTO imported_tenders(batch_id, file_id, row_index, source, card)
           VALUES($1, $2, $3, $4, $5)`,
          [batchId, fileId, rowIndex + 1, row.source, row.card]
        );
        tenderCount += 1;
      }
    }

    await client.query("COMMIT");
    return { batchId, tenderCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getActiveCsvBatch(): Promise<{
  batch: { id: number; uploadedAt: string } | null;
  files: Array<{ id: number; fileName: string; fileIndex: number }>;
  tenders: ActiveTenderRow[];
}> {
  const batchResult = await requirePool().query<{ id: number; uploaded_at: Date }>(
    "SELECT id, uploaded_at FROM csv_batches WHERE active = true ORDER BY uploaded_at DESC LIMIT 1"
  );
  const batch = batchResult.rows[0];
  if (!batch) return { batch: null, files: [], tenders: [] };

  const filesResult = await requirePool().query<{ id: number; file_name: string; file_index: number }>(
    "SELECT id, file_name, file_index FROM csv_files WHERE batch_id = $1 ORDER BY file_index",
    [batch.id]
  );
  const tendersResult = await requirePool().query<{
    id: number;
    batch_id: number;
    file_id: number;
    row_index: number;
    source: Record<string, string>;
    card: TenderCard;
    discrepancy_notes: string;
    reviewed_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, batch_id, file_id, row_index, source, card, discrepancy_notes, reviewed_at, created_at
     FROM imported_tenders
     WHERE batch_id = $1
     ORDER BY file_id, row_index`,
    [batch.id]
  );

  return {
    batch: { id: batch.id, uploadedAt: batch.uploaded_at.toISOString() },
    files: filesResult.rows.map((file) => ({
      id: file.id,
      fileName: file.file_name,
      fileIndex: file.file_index
    })),
    tenders: tendersResult.rows.map((row) => ({
      id: row.id,
      batchId: row.batch_id,
      fileId: row.file_id,
      rowIndex: row.row_index,
      source: row.source,
      card: normalizeStoredCard(row.card, row.source, row.discrepancy_notes),
      discrepancyNotes: row.discrepancy_notes,
      reviewedAt: row.reviewed_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString()
    }))
  };
}

export async function listImportedTenders(): Promise<ActiveTenderRow[]> {
  const result = await requirePool().query<{
    id: number;
    batch_id: number;
    file_id: number;
    row_index: number;
    source: Record<string, string>;
    card: TenderCard;
    discrepancy_notes: string;
    reviewed_at: Date | null;
    created_at: Date;
  }>(`
    SELECT id, batch_id, file_id, row_index, source, card, discrepancy_notes, reviewed_at, created_at
    FROM imported_tenders
    ORDER BY created_at DESC, id DESC
    LIMIT 5000
  `);

  return result.rows.map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    fileId: row.file_id,
    rowIndex: row.row_index,
    source: row.source,
    card: normalizeStoredCard(row.card, row.source, row.discrepancy_notes),
    discrepancyNotes: row.discrepancy_notes,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString()
  }));
}

export async function saveTenderReview(input: {
  importedTenderId?: number | null;
  card: TenderCard;
  discrepancyNotes: string;
}): Promise<SavedTenderRow> {
  if (input.importedTenderId) {
    await requirePool().query(
      `UPDATE imported_tenders
       SET card = $1,
           discrepancy_notes = $2,
           reviewed_at = now()
       WHERE id = $3`,
      [input.card, input.discrepancyNotes, input.importedTenderId]
    );
  }

  const result = await requirePool().query<{
    id: number;
    imported_tender_id: number | null;
    card: TenderCard;
    discrepancy_notes: string;
    saved_at: Date;
  }>(
    `INSERT INTO saved_tenders(imported_tender_id, card, discrepancy_notes)
     VALUES($1, $2, $3)
     RETURNING id, imported_tender_id, card, discrepancy_notes, saved_at`,
    [input.importedTenderId ?? null, input.card, input.discrepancyNotes]
  );
  return mapSavedTender(result.rows[0]);
}

export async function listSavedTenders(): Promise<SavedTenderRow[]> {
  const result = await requirePool().query<{
    id: number;
    imported_tender_id: number | null;
    card: TenderCard;
    discrepancy_notes: string;
    saved_at: Date;
  }>("SELECT id, imported_tender_id, card, discrepancy_notes, saved_at FROM saved_tenders ORDER BY saved_at DESC LIMIT 500");
  return result.rows.map(mapSavedTender);
}

export async function getMonthlyStats(): Promise<MonthlyStats[]> {
  const result = await requirePool().query<{
    month: string;
    saved_count: string;
    with_discrepancies: string;
  }>(`
    SELECT
      to_char(date_trunc('month', saved_at), 'YYYY-MM') AS month,
      count(*)::text AS saved_count,
      count(*) FILTER (WHERE btrim(discrepancy_notes) <> '')::text AS with_discrepancies
    FROM saved_tenders
    GROUP BY date_trunc('month', saved_at)
    ORDER BY month DESC
  `);
  return result.rows.map((row) => ({
    month: row.month,
    savedCount: Number(row.saved_count),
    withDiscrepancies: Number(row.with_discrepancies)
  }));
}

export async function listImportedTendersByDeadline(date: string): Promise<ActiveTenderRow[]> {
  const result = await requirePool().query<{
    id: number;
    batch_id: number;
    file_id: number;
    row_index: number;
    source: Record<string, string>;
    card: TenderCard;
    discrepancy_notes: string;
    reviewed_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, batch_id, file_id, row_index, source, card, discrepancy_notes, reviewed_at, created_at
     FROM imported_tenders
     WHERE
       card->>'submissionDeadlineDate' = $1
       OR left(card->>'submissionDeadline', 10) = $1
       OR left(source->>'Окончание подачи', 10) = $1
       OR left(source->>'Дата окончания подачи', 10) = $1
     ORDER BY created_at DESC, id DESC`,
    [date]
  );

  return result.rows.map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    fileId: row.file_id,
    rowIndex: row.row_index,
    source: row.source,
    card: normalizeStoredCard(row.card, row.source, row.discrepancy_notes),
    discrepancyNotes: row.discrepancy_notes,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString()
  }));
}

export async function getModelVersion(): Promise<number> {
  const result = await requirePool().query<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'model_version'"
  );
  return Number(result.rows[0]?.value ?? "1") || 1;
}

export async function setModelVersion(version: number): Promise<number> {
  const normalizedVersion = Math.max(1, Math.floor(version));
  await requirePool().query(
    `INSERT INTO app_settings(key, value)
     VALUES('model_version', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(normalizedVersion)]
  );
  return normalizedVersion;
}

export async function incrementModelVersion(): Promise<number> {
  const nextVersion = (await getModelVersion()) + 1;
  return setModelVersion(nextVersion);
}

export async function listTestingRecords(): Promise<TestingRecord[]> {
  const result = await requirePool().query<{
    id: number;
    seldon_id: string;
    kkt: string;
    tender_status: string;
    tender_status_reason: string;
    employee_note: string;
    winner: "employee" | "ai";
    model_version: number;
    created_at: Date;
  }>(`
    SELECT id, seldon_id, kkt, tender_status, tender_status_reason, employee_note, winner, model_version, created_at
    FROM testing_records
    ORDER BY created_at DESC, id DESC
    LIMIT 5000
  `);

  return result.rows.map(mapTestingRecord);
}

export async function createTestingRecord(input: {
  seldonId: string;
  kkt: string;
  tenderStatus: string;
  tenderStatusReason: string;
  employeeNote: string;
  winner: "employee" | "ai";
}): Promise<TestingRecord> {
  const modelVersion = await getModelVersion();
  const result = await requirePool().query<{
    id: number;
    seldon_id: string;
    kkt: string;
    tender_status: string;
    tender_status_reason: string;
    employee_note: string;
    winner: "employee" | "ai";
    model_version: number;
    created_at: Date;
  }>(
    `INSERT INTO testing_records(seldon_id, kkt, tender_status, tender_status_reason, employee_note, winner, model_version)
     VALUES($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, seldon_id, kkt, tender_status, tender_status_reason, employee_note, winner, model_version, created_at`,
    [input.seldonId, input.kkt, input.tenderStatus, input.tenderStatusReason, input.employeeNote, input.winner, modelVersion]
  );

  return mapTestingRecord(result.rows[0]);
}

function mapSavedTender(row: {
  id: number;
  imported_tender_id: number | null;
  card: TenderCard;
  discrepancy_notes: string;
  saved_at: Date;
}): SavedTenderRow {
  return {
    id: row.id,
    importedTenderId: row.imported_tender_id,
    card: row.card,
    discrepancyNotes: row.discrepancy_notes,
    savedAt: row.saved_at.toISOString()
  };
}

function mapTestingRecord(row: {
  id: number;
  seldon_id: string;
  kkt: string;
  tender_status: string;
  tender_status_reason: string;
  employee_note: string;
  winner: "employee" | "ai";
  model_version: number;
  created_at: Date;
}): TestingRecord {
  return {
    id: row.id,
    seldonId: row.seldon_id,
    kkt: row.kkt,
    tenderStatus: row.tender_status,
    tenderStatusReason: row.tender_status_reason,
    employeeNote: row.employee_note,
    winner: row.winner,
    modelVersion: row.model_version,
    createdAt: row.created_at.toISOString()
  };
}

function normalizeStoredCard(
  card: TenderCard,
  source: Record<string, string> | undefined,
  discrepancyNotes: string
): TenderCard {
  const tenderUrl = card.tenderUrl || card.tenderUrlSource || sourceValue(source, [
    "tenderUrl",
    "tender_url",
    "url",
    "link",
    "Ссылка",
    "Ссылка на тендер"
  ]);

  return {
    ...card,
    seldonId: card.seldonId || sourceValue(source, ["ID", "id", "seldonId", "seldon id", "seldon_id", "Seldon ID"]),
    etpId: card.etpId || sourceValue(source, ["etpId", "etp id", "etp_id", "ETP ID"]),
    purchaseType: card.purchaseType || sourceValue(source, ["purchaseType", "purchase_type", "Тип закупки"]) || card.federalLaw,
    tenderStatus: normalizeTenderStatus(card.tenderStatus || sourceValue(source, ["tenderStatus", "tender_status", "status", "Статус", "Статус тендера"])),
    tenderStatusReason: card.tenderStatusReason || sourceValue(source, [
      "tenderStatusReason",
      "tender_status_reason",
      "status_reason",
      "Причина",
      "Причина статуса",
      "Причина статуса тендера",
      "Причина отказа"
    ]),
    tenderUrl,
    tenderUrlSource: card.tenderUrlSource || tenderUrl,
    productDirections: normalizeProductDirections(card.productDirections),
    discrepancyNotes: discrepancyNotes ?? card.discrepancyNotes ?? ""
  };
}

function normalizeProductDirections(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item && item.toLowerCase() !== "null");
}

function normalizeTenderStatus(value: string): string {
  const normalized = normalizeSourceKey(value);
  if (["loadedseldon", "загруженseldon", "загруженселдон"].includes(normalized)) return "loaded_seldon";
  if (["approvedkucp", "approvedksotp", "согласованокуцп", "согласованоксотп"].includes(normalized)) return "approved_ku_cp";
  if (["rejectedkucp", "rejectedksotp", "отказанокуцп", "отказаноксотп"].includes(normalized)) return "rejected_ku_cp";
  if (["participationapplication", "заявканаучастиевтендере"].includes(normalized)) return "participation_application";
  if (["counterpartyreview", "проработкаконтрагента"].includes(normalized)) return "counterparty_review";
  return value;
}

function sourceValue(source: Record<string, string> | undefined, aliases: string[]): string {
  if (!source) return "";
  const normalizedAliases = aliases.map(normalizeSourceKey);
  const entry = Object.entries(source).find(([key]) => normalizedAliases.includes(normalizeSourceKey(key)));
  return entry?.[1] ?? "";
}

function normalizeSourceKey(value: string): string {
  return value.toLowerCase().replace(/[\s._-]+/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

function requirePool(): pg.Pool {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool;
}

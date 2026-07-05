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
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_csv_batches_active ON csv_batches(active);
    CREATE INDEX IF NOT EXISTS idx_imported_tenders_batch ON imported_tenders(batch_id);

    CREATE TABLE IF NOT EXISTS saved_tenders (
      id SERIAL PRIMARY KEY,
      imported_tender_id INTEGER REFERENCES imported_tenders(id) ON DELETE SET NULL,
      card JSONB NOT NULL,
      discrepancy_notes TEXT NOT NULL DEFAULT '',
      saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_saved_tenders_saved_at ON saved_tenders(saved_at);
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
  }>(
    "SELECT id, batch_id, file_id, row_index, source, card FROM imported_tenders WHERE batch_id = $1 ORDER BY file_id, row_index",
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
      card: row.card
    }))
  };
}

export async function saveTenderReview(input: {
  importedTenderId?: number | null;
  card: TenderCard;
  discrepancyNotes: string;
}): Promise<SavedTenderRow> {
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

function requirePool(): pg.Pool {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool;
}

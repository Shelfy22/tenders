import { Fragment, useEffect, useMemo, useState } from "react";
import {
  createTestingRecord,
  exportImportedTendersByDeadline,
  getActiveCsvBatch,
  getAutofillStatus,
  getImportedTenders,
  getMonthlyStats,
  getSavedTenders,
  getTestingData,
  saveTenderCard,
  saveModelVersion,
  startAutofill,
  startAutofillWithDocuments,
  uploadCsvBatch
} from "./api";
import { fieldsConfig, initialCard } from "./fieldsConfig";
import type { ActiveCsvTender, AutofillStatusResponse, MonthlyStats, SavedTender, TenderCard, TestingRecord } from "./types";

const confidenceLabels = { high: "Высокая", medium: "Средняя", low: "Низкая" };
const purchaseTypeOptions = [
  "223-ФЗ",
  "44/94-ФЗ",
  "Коммерческие закупки",
  "Международные закупки"
];

function hasValue(value: TenderCard[keyof TenderCard] | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : value !== "" && value !== undefined && value !== null;
}

function displayValue(value: TenderCard[keyof TenderCard] | undefined): string {
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

function fieldDisplayValue(key: keyof TenderCard, value: TenderCard[keyof TenderCard] | undefined): string {
  if (!hasValue(value)) return "";
  const field = fieldsConfig.find((item) => item.key === key);
  if (field?.options) {
    const option = field.options.find((item) => item.value === value || item.label === value);
    return option?.label ?? displayValue(value);
  }
  return displayValue(value);
}

function sourceValue(row: ActiveCsvTender, aliases: string[]): string {
  const normalizedAliases = aliases.map(normalizeSourceKey);
  const entry = Object.entries(row.source).find(([key]) =>
    normalizedAliases.includes(normalizeSourceKey(key))
  );
  return entry?.[1] ?? "";
}

function productDirectionsValue(card: TenderCard): string[] {
  return Array.isArray(card.productDirections) ? card.productDirections : [];
}

function normalizeSourceKey(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[\s._-]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function formatDateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
}

export default function App() {
  const [page, setPage] = useState<"card" | "tenders" | "database" | "saved" | "testing" | "instructions">("card");
  const [card, setCard] = useState<TenderCard>(initialCard);
  const [selectedImportedTenderId, setSelectedImportedTenderId] = useState<number | null>(null);
  const [csvRows, setCsvRows] = useState<ActiveCsvTender[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvSearch, setCsvSearch] = useState("");
  const [csvError, setCsvError] = useState("");
  const [databaseRows, setDatabaseRows] = useState<ActiveCsvTender[]>([]);
  const [databaseSearch, setDatabaseSearch] = useState("");
  const [databaseError, setDatabaseError] = useState("");
  const [savedTenders, setSavedTenders] = useState<SavedTender[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [testingRecords, setTestingRecords] = useState<TestingRecord[]>([]);
  const [testingError, setTestingError] = useState("");
  const [testingNotice, setTestingNotice] = useState("");
  const [testingSeldonId, setTestingSeldonId] = useState("");
  const [testingKkt, setTestingKkt] = useState("");
  const [testingEmployeeNote, setTestingEmployeeNote] = useState("");
  const [testingWinner, setTestingWinner] = useState<"employee" | "ai">("employee");
  const [modelVersion, setModelVersionState] = useState(1);
  const [modelVersionDraft, setModelVersionDraft] = useState("1");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportDeadlineDate, setExportDeadlineDate] = useState("");
  const [exportDownloadUrl, setExportDownloadUrl] = useState("");
  const [exportFileName, setExportFileName] = useState("");
  const [exportError, setExportError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [autofillMode, setAutofillMode] = useState<"url" | "documents">("url");
  const [tenderUrl, setTenderUrl] = useState("");
  const [seldonId, setSeldonId] = useState("");
  const [etpId, setEtpId] = useState("");
  const [purchaseType, setPurchaseType] = useState("");
  const [documents, setDocuments] = useState<File[]>([]);
  const [jobId, setJobId] = useState("");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<Extract<AutofillStatusResponse, { status: "done" }> | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [changedFields, setChangedFields] = useState<Set<keyof TenderCard>>(new Set());
  const processing = Boolean(jobId) && !result && !error;

  useEffect(() => {
    if (!jobId || result || error) return;
    const poll = async () => {
      try {
        const status = await getAutofillStatus(jobId);
        if (status.status === "processing") setProgress(status.progress);
        if (status.status === "done") {
          setProgress(status.progress);
          setResult(status);
          setJobId("");
        }
        if (status.status === "error") {
          setError(status.error);
          setJobId("");
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Ошибка проверки статуса");
        setJobId("");
      }
    };
    void poll();
    const timer = window.setInterval(poll, 2000);
    return () => window.clearInterval(timer);
  }, [jobId, result, error]);

  useEffect(() => {
    if (page !== "tenders") return;
    void loadActiveCsvBatch();
  }, [page]);

  useEffect(() => {
    if (page !== "saved") return;
    void loadSavedTenders();
  }, [page]);

  useEffect(() => {
    if (page !== "database") return;
    void loadDatabaseTenders();
  }, [page]);

  useEffect(() => {
    if (page !== "testing") return;
    void loadTestingData();
  }, [page]);

  const previewFields = useMemo(
    () => fieldsConfig.filter(({ key }) => result?.meta[key] || hasValue(result?.fields[key])),
    [result]
  );

  const filteredCsvRows = useMemo(() => {
    const query = csvSearch.trim().toLowerCase();
    if (!query) return csvRows;
    return csvRows.filter((row) =>
      Object.values(row.source).some((value) => value.toLowerCase().includes(query)) ||
      Object.values(row.card).some((value) => displayValue(value).toLowerCase().includes(query))
    );
  }, [csvRows, csvSearch]);

  const filteredDatabaseRows = useMemo(() => {
    const query = databaseSearch.trim().toLowerCase();
    if (!query) return databaseRows;
    return databaseRows.filter((row) =>
      Object.values(row.source).some((value) => value.toLowerCase().includes(query)) ||
      Object.values(row.card).some((value) => displayValue(value).toLowerCase().includes(query)) ||
      String(row.id).includes(query)
    );
  }, [databaseRows, databaseSearch]);

  const updateField = (key: keyof TenderCard, value: string) => {
    const field = fieldsConfig.find((item) => item.key === key);
    const normalized = field?.type === "number" ? (value === "" ? "" : Number(value)) : value;
    setCard((current) => ({ ...current, [key]: normalized }));
    setChangedFields((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  const toggleDirection = (direction: string) => {
    setCard((current) => ({
      ...current,
      productDirections: productDirectionsValue(current).includes(direction)
        ? productDirectionsValue(current).filter((item) => item !== direction)
        : [...productDirectionsValue(current), direction]
    }));
    setChangedFields((current) => {
      const next = new Set(current);
      next.delete("productDirections");
      return next;
    });
  };

  const openModal = (mode: "url" | "documents") => {
    setError("");
    setProgress("");
    setResult(null);
    setJobId("");
    setAutofillMode(mode);
    setDocuments([]);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setJobId("");
  };

  const loadActiveCsvBatch = async () => {
    setCsvError("");
    try {
      const response = await getActiveCsvBatch();
      setCsvRows(response.tenders);
      setCsvFileName(response.files.map((file) => file.fileName).join(", "));
    } catch (requestError) {
      setCsvError(requestError instanceof Error ? requestError.message : "Не удалось загрузить CSV тендеры");
    }
  };

  const loadSavedTenders = async () => {
    setError("");
    try {
      const [savedResponse, statsResponse] = await Promise.all([
        getSavedTenders(),
        getMonthlyStats()
      ]);
      setSavedTenders(savedResponse.tenders);
      setMonthlyStats(statsResponse.months);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить сохранённые тендеры");
    }
  };

  const loadDatabaseTenders = async () => {
    setDatabaseError("");
    try {
      const response = await getImportedTenders();
      setDatabaseRows(response.tenders);
    } catch (requestError) {
      setDatabaseError(requestError instanceof Error ? requestError.message : "Не удалось загрузить тендеры из базы");
    }
  };

  const loadTestingData = async () => {
    setTestingError("");
    try {
      const response = await getTestingData();
      setTestingRecords(response.records);
      setModelVersionState(response.modelVersion);
      setModelVersionDraft(String(response.modelVersion));
    } catch (requestError) {
      setTestingError(requestError instanceof Error ? requestError.message : "Не удалось загрузить данные тестирования");
    }
  };

  const exportTendersByDeadline = async () => {
    setExportError("");
    if (!exportDeadlineDate) {
      setExportError("Укажите дату окончания подачи");
      return;
    }
    try {
      if (exportDownloadUrl) URL.revokeObjectURL(exportDownloadUrl);
      const blob = await exportImportedTendersByDeadline(exportDeadlineDate);
      const url = URL.createObjectURL(blob);
      const fileName = `tenders-deadline-${exportDeadlineDate}.csv`;
      setExportDownloadUrl(url);
      setExportFileName(fileName);
    } catch (requestError) {
      setExportError(requestError instanceof Error ? requestError.message : "Не удалось выгрузить CSV");
    }
  };

  const saveTesting = async () => {
    setTestingError("");
    setTestingNotice("");
    try {
      const response = await createTestingRecord({
        seldonId: testingSeldonId.trim(),
        kkt: testingKkt.trim(),
        employeeNote: testingEmployeeNote.trim(),
        winner: testingWinner
      });
      setTestingRecords((current) => [response.record, ...current]);
      setTestingSeldonId("");
      setTestingKkt("");
      setTestingEmployeeNote("");
      setTestingWinner("employee");
      setTestingNotice("Запись тестирования сохранена");
    } catch (requestError) {
      setTestingError(requestError instanceof Error ? requestError.message : "Не удалось сохранить запись тестирования");
    }
  };

  const saveTestingModelVersion = async (increment = false) => {
    setTestingError("");
    setTestingNotice("");
    try {
      const response = await saveModelVersion(increment ? undefined : Number(modelVersionDraft));
      setModelVersionState(response.modelVersion);
      setModelVersionDraft(String(response.modelVersion));
      setTestingNotice("Версия модели обновлена");
    } catch (requestError) {
      setTestingError(requestError instanceof Error ? requestError.message : "Не удалось обновить версию модели");
    }
  };

  const uploadCsv = async (files: FileList | null) => {
    if (!files?.length) return;
    setCsvError("");
    try {
      await uploadCsvBatch(Array.from(files).slice(0, 3));
      await loadActiveCsvBatch();
      setCsvSearch("");
    } catch (uploadError) {
      setCsvError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить CSV файлы");
    }
  };

  const openTenderFromCsv = (row: ActiveCsvTender) => {
    setCard(row.card);
    setSelectedImportedTenderId(row.id);
    setChangedFields(
      new Set(
        fieldsConfig
          .filter(({ key }) => hasValue(row.card[key]))
          .map(({ key }) => key)
      )
    );
    setNotice("Карточка заполнена данными из CSV");
    setError("");
    setPage("card");
  };

  const runAutofill = async () => {
    setError("");
    setResult(null);
    try {
      const job =
        autofillMode === "documents"
          ? await startAutofillWithDocuments(tenderUrl.trim(), documents)
          : await startAutofill({
              seldonId: seldonId.trim(),
              etpId: etpId.trim(),
              purchaseType
            });
      setProgress("Определяем ЭТП");
      setJobId(job.jobId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось запустить обработку");
    }
  };

  const applyResult = () => {
    if (!result) return;
    const changedFieldsToApply = new Set<keyof TenderCard>();
    const next = { ...card };
    for (const key of Object.keys(result.fields) as (keyof TenderCard)[]) {
      const value = result.fields[key];
      const valueChanged = Array.isArray(value)
        ? JSON.stringify(value) !== JSON.stringify(card[key])
        : value !== card[key];
      if (hasValue(value) && valueChanged) {
        Object.assign(next, { [key]: value });
        changedFieldsToApply.add(key);
      }
    }
    setCard(next);
    setChangedFields(changedFieldsToApply);
    closeModal();
  };

  const save = async () => {
    setNotice("");
    setError("");
    try {
      const response = await saveTenderCard(card, selectedImportedTenderId);
      setNotice(response.message);
      setChangedFields(new Set());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить карточку");
    }
  };

  if (page === "instructions") {
    return (
      <main className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Помощь</p>
            <h1>Инструкция для сотрудников</h1>
            <p className="subtitle">Коротко о том, где искать тендеры, как открывать карточку и когда использовать автозаполнение.</p>
          </div>
          <div className="header-actions">
            <button className="button button-secondary" onClick={() => setPage("tenders")}>Список тендеров</button>
            <button className="button button-secondary" onClick={() => setPage("database")}>Тендеры в базе</button>
            <button className="button button-secondary" onClick={() => setPage("testing")}>Тестирование</button>
            <button className="button button-primary" onClick={() => setPage("card")}>К карточке</button>
          </div>
        </header>

        <section className="card instruction-card">
          <div className="instruction-grid">
            <article>
              <h2>Список тендеров</h2>
              <p>Сюда автоматически будут приходить 3 CSV файла от n8n. Все тендеры из этих файлов отображаются в одной таблице. Если в одном из файлов нет какой-то колонки, на её месте будет прочерк.</p>
              <p>Нажмите на строку тендера, чтобы открыть карточку автозаполнения с уже подставленными полями из CSV.</p>
            </article>
            <article>
              <h2>Тендеры в базе</h2>
              <p>Здесь хранятся все тендеры, которые когда-либо пришли из CSV. Эта страница нужна, если сотрудник пропустил день и хочет найти тендер позже.</p>
              <p>В начале таблицы добавлены важные колонки: `seldon id`, `ИНН`, `Дата добавления`, `Проверен`. По ним проще ориентироваться и искать нужную закупку.</p>
            </article>
            <article>
              <h2>Тестирование</h2>
              <p>Сюда нужно вносить тендеры, которые сотрудник заполнил вручную. Укажите `SeldonId`, `ККТ`, примечание сотрудника и выберите, кто прав: сотрудник или ИИ.</p>
              <p>Версия модели подставляется автоматически. Её можно увеличить на странице тестирования перед новой проверкой качества.</p>
            </article>
            <article>
              <h2>Автозаполнение</h2>
              <p>Используется как альтернативный запуск workflow. Основной вариант: указать `seldonId` и тип закупки. Если `seldonId` нет, используйте `etpId` и тип закупки.</p>
              <p>После проверки заполните поле `Примечания к расхождениям по колонкам тендера`, если workflow ошибся или заполнил что-то неточно, и нажмите `Сохранить`.</p>
            </article>
          </div>
        </section>
      </main>
    );
  }

  if (page === "tenders") {
    return (
      <main className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Закупки / Импорт</p>
            <h1>Тендеры из CSV</h1>
            <p className="subtitle">Загрузите CSV файл, найдите нужный тендер и откройте его карточку.</p>
          </div>
          <div className="header-actions">
            <button className="button button-secondary" onClick={() => setPage("instructions")}>Инструкция</button>
            <button className="button button-secondary" onClick={() => setPage("card")}>К карточке</button>
            <button className="button button-secondary" onClick={() => setPage("database")}>Тендеры в базе</button>
            <button className="button button-secondary" onClick={() => setPage("saved")}>Сохранённые</button>
            <button className="button button-secondary" onClick={() => setPage("testing")}>Тестирование</button>
            <label className="button button-primary upload-button">
              Загрузить тендеры
              <input
                type="file"
                multiple
                accept=".csv,text/csv"
                onChange={(event) => void uploadCsv(event.target.files)}
              />
            </label>
          </div>
        </header>

        {csvError && <div className="alert alert-error">{csvError}</div>}

        <section className="card">
          <div className="card-heading tenders-toolbar">
            <div>
              <h2>Список тендеров</h2>
              <span>
                {csvFileName
                  ? `${csvFileName}: ${filteredCsvRows.length} из ${csvRows.length}`
                  : "CSV файл пока не загружен"}
              </span>
            </div>
            <label className="field tenders-search">
              <span className="field-label">Поиск по тендерам</span>
              <input
                type="search"
                placeholder="ИНН, номер, контрагент, цена..."
                value={csvSearch}
                onChange={(event) => setCsvSearch(event.target.value)}
                disabled={csvRows.length === 0}
              />
            </label>
          </div>

          {csvRows.length === 0 ? (
            <div className="empty-state">
              <h3>Загрузите CSV файл</h3>
              <p>После загрузки здесь появится интерактивная таблица. Клик по строке откроет карточку тендера и заполнит поля из CSV.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="tenders-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>seldon id</th>
                    <th>ИНН</th>
                    <th>Дата добавления</th>
                    <th>Проверен</th>
                    <th>Ссылка</th>
                    <th>Контрагент</th>
                    <th>Статус</th>
                    <th>Причина статуса</th>
                    <th>ОП</th>
                    <th>НМЦК</th>
                    <th>Окончание подачи</th>
                    <th>Примечания</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCsvRows.map((row) => (
                    <tr key={row.id} onClick={() => openTenderFromCsv(row)}>
                      <td>{row.id}</td>
                      <td>{row.card.seldonId || sourceValue(row, ["ID", "id", "seldonId", "seldon id", "seldon_id", "Seldon ID"]) || "—"}</td>
                      <td>{row.card.counterpartyInn || "—"}</td>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{row.reviewedAt ? "Да" : "Нет"}</td>
                      <td>{row.card.tenderUrl || row.card.tenderUrlSource || "—"}</td>
                      <td>{row.card.counterpartyName || "—"}</td>
                      <td>{fieldDisplayValue("tenderStatus", row.card.tenderStatus) || "—"}</td>
                      <td>{row.card.tenderStatusReason || "—"}</td>
                      <td>{row.card.op || "—"}</td>
                      <td>{row.card.initialPrice || "—"}</td>
                      <td>{[row.card.submissionDeadlineDate, row.card.submissionDeadlineTime].filter(Boolean).join(" ") || "—"}</td>
                      <td>{row.discrepancyNotes || row.card.discrepancyNotes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {exportModalOpen && (
          <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setExportModalOpen(false)}>
            <section className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Экспорт</p>
                  <h2 id="export-title">Выгрузка тендеров по дате окончания</h2>
                </div>
                <button className="icon-button" onClick={() => setExportModalOpen(false)} aria-label="Закрыть">×</button>
              </div>
              <label className="field">
                <span className="field-label">Дата окончания подачи</span>
                <input
                  type="date"
                  value={exportDeadlineDate}
                  onChange={(event) => {
                    setExportDeadlineDate(event.target.value);
                    setExportDownloadUrl("");
                    setExportFileName("");
                    setExportError("");
                  }}
                />
              </label>
              {exportError && <div className="alert alert-error">{exportError}</div>}
              {exportDownloadUrl && (
                <div className="alert alert-success">
                  <span>Файл сформирован.</span>
                  <a href={exportDownloadUrl} download={exportFileName}>Скачать файл</a>
                </div>
              )}
              <div className="modal-footer">
                <button className="button button-ghost" onClick={() => setExportModalOpen(false)}>Отмена</button>
                <button className="button button-primary" onClick={() => void exportTendersByDeadline()}>Сформировать CSV</button>
              </div>
            </section>
          </div>
        )}
      </main>
    );
  }

  if (page === "database") {
    return (
      <main className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Закупки / База</p>
            <h1>Все тендеры в базе</h1>
            <p className="subtitle">Здесь хранятся все тендеры из загруженных CSV. Найдите тендер и откройте карточку для проверки.</p>
          </div>
          <div className="header-actions">
            <button className="button button-secondary" onClick={() => setPage("instructions")}>Инструкция</button>
            <button className="button button-secondary" onClick={() => setPage("tenders")}>Текущие CSV</button>
            <button className="button button-secondary" onClick={() => setPage("saved")}>Сохранённые</button>
            <button className="button button-secondary" onClick={() => setPage("testing")}>Тестирование</button>
            <button className="button button-secondary" onClick={() => setExportModalOpen(true)}>Выгрузить по дате</button>
            <button className="button button-primary" onClick={() => setPage("card")}>К карточке</button>
          </div>
        </header>

        {databaseError && <div className="alert alert-error">{databaseError}</div>}

        <section className="card">
          <div className="card-heading tenders-toolbar">
            <div>
              <h2>База тендеров</h2>
              <span>{filteredDatabaseRows.length} из {databaseRows.length}</span>
            </div>
            <label className="field tenders-search">
              <span className="field-label">Поиск по базе</span>
              <input
                type="search"
                placeholder="seldonId, ИНН, ссылка, контрагент..."
                value={databaseSearch}
                onChange={(event) => setDatabaseSearch(event.target.value)}
                disabled={databaseRows.length === 0}
              />
            </label>
          </div>

          {databaseRows.length === 0 ? (
            <div className="empty-state">
              <h3>В базе пока нет тендеров</h3>
              <p>После загрузки CSV каждый тендер будет сохраняться здесь и останется доступен после смены активных файлов.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="tenders-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>seldon id</th>
                    <th>ИНН</th>
                    <th>Дата добавления</th>
                    <th>Проверен</th>
                    <th>Ссылка</th>
                    <th>Контрагент</th>
                    <th>Статус</th>
                    <th>Причина статуса</th>
                    <th>ОП</th>
                    <th>НМЦК</th>
                    <th>Окончание подачи</th>
                    <th>Примечания</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDatabaseRows.map((row) => (
                    <tr key={row.id} onClick={() => openTenderFromCsv(row)}>
                      <td>{row.id}</td>
                      <td>{row.card.seldonId || sourceValue(row, ["ID", "id", "seldonId", "seldon id", "seldon_id", "Seldon ID"]) || "—"}</td>
                      <td>{row.card.counterpartyInn || "—"}</td>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{row.reviewedAt ? "Да" : "Нет"}</td>
                      <td>{row.card.tenderUrl || row.card.tenderUrlSource || "—"}</td>
                      <td>{row.card.counterpartyName || "—"}</td>
                      <td>{fieldDisplayValue("tenderStatus", row.card.tenderStatus) || "—"}</td>
                      <td>{row.card.tenderStatusReason || "—"}</td>
                      <td>{row.card.op || "—"}</td>
                      <td>{row.card.initialPrice || "—"}</td>
                      <td>{[row.card.submissionDeadlineDate, row.card.submissionDeadlineTime].filter(Boolean).join(" ") || "—"}</td>
                      <td>{row.discrepancyNotes || row.card.discrepancyNotes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (page === "testing") {
    return (
      <main className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Закупки / Проверка качества</p>
            <h1>Тестирование</h1>
            <p className="subtitle">Здесь сотрудники фиксируют, кто оказался прав по спорному тендеру: сотрудник или ИИ. Версия модели сохраняется вместе с каждой записью.</p>
          </div>
          <div className="header-actions">
            <button className="button button-secondary" onClick={() => setPage("instructions")}>Инструкция</button>
            <button className="button button-secondary" onClick={() => setPage("tenders")}>Список тендеров</button>
            <button className="button button-secondary" onClick={() => setPage("database")}>Тендеры в базе</button>
            <button className="button button-secondary" onClick={() => setPage("saved")}>Сохранённые</button>
            <button className="button button-secondary" onClick={() => setPage("testing")}>Тестирование</button>
            <button className="button button-primary" onClick={() => setPage("card")}>К карточке</button>
          </div>
        </header>

        {testingNotice && <div className="alert alert-success">{testingNotice}</div>}
        {testingError && <div className="alert alert-error">{testingError}</div>}

        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Версия модели</h2>
              <span>Это значение будет записано в новые строки тестирования</span>
            </div>
          </div>
          <div className="modal-field-grid">
            <label className="field">
              <span className="field-label">Текущая версия</span>
              <input value={modelVersion} readOnly />
            </label>
            <label className="field">
              <span className="field-label">Новая версия</span>
              <input
                type="number"
                min={1}
                value={modelVersionDraft}
                onChange={(event) => setModelVersionDraft(event.target.value)}
              />
            </label>
            <div className="field">
              <span className="field-label">Действия</span>
              <div className="header-actions">
                <button className="button button-secondary" onClick={() => void saveTestingModelVersion(false)}>Сохранить версию</button>
                <button className="button button-primary" onClick={() => void saveTestingModelVersion(true)}>Увеличить на 1</button>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Добавить обработанный тендер</h2>
              <span>Версия модели заполнится автоматически и не редактируется сотрудником</span>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">SeldonId</span>
              <input
                value={testingSeldonId}
                onChange={(event) => setTestingSeldonId(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">ККТ</span>
              <input
                value={testingKkt}
                onChange={(event) => setTestingKkt(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Кто прав</span>
              <select value={testingWinner} onChange={(event) => setTestingWinner(event.target.value === "ai" ? "ai" : "employee")}>
                <option value="employee">Сотрудник</option>
                <option value="ai">ИИ</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Версия модели</span>
              <input value={modelVersion} readOnly />
            </label>
            <label className="field field-wide">
              <span className="field-label">Примечание сотрудника</span>
              <textarea
                rows={4}
                value={testingEmployeeNote}
                onChange={(event) => setTestingEmployeeNote(event.target.value)}
              />
            </label>
          </div>
          <div className="card-footer">
            <button
              className="button button-primary"
              disabled={!testingSeldonId.trim()}
              onClick={() => void saveTesting()}
            >
              Сохранить в тестирование
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Записи тестирования</h2>
              <span>{testingRecords.length} записей</span>
            </div>
          </div>
          {testingRecords.length === 0 ? (
            <div className="empty-state">
              <h3>Пока нет записей тестирования</h3>
              <p>После сохранения обработанного тендера он появится в этой таблице.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="tenders-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>SeldonId</th>
                    <th>ККТ</th>
                    <th>Примечание сотрудника</th>
                    <th>Кто прав</th>
                    <th>Версия модели</th>
                  </tr>
                </thead>
                <tbody>
                  {testingRecords.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{item.seldonId}</td>
                      <td>{item.kkt || "—"}</td>
                      <td>{item.employeeNote || "—"}</td>
                      <td>{item.winner === "employee" ? "Сотрудник" : "ИИ"}</td>
                      <td>{item.modelVersion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (page === "saved") {
    return (
      <main className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Закупки / Контроль качества</p>
            <h1>Сохранённые тендеры</h1>
            <p className="subtitle">Здесь хранится история проверенных карточек и замечаний сотрудников.</p>
          </div>
          <div className="header-actions">
            <button className="button button-secondary" onClick={() => setPage("instructions")}>Инструкция</button>
            <button className="button button-secondary" onClick={() => setPage("tenders")}>Список тендеров</button>
            <button className="button button-secondary" onClick={() => setPage("database")}>Тендеры в базе</button>
            <button className="button button-secondary" onClick={() => setPage("testing")}>Тестирование</button>
            <button className="button button-primary" onClick={() => setPage("card")}>К карточке</button>
          </div>
        </header>

        {error && <div className="alert alert-error">{error}</div>}

        <section className="stats-grid">
          {monthlyStats.length === 0 ? (
            <article className="stat-card">
              <span>Статистика</span>
              <strong>Пока нет данных</strong>
            </article>
          ) : monthlyStats.map((item) => (
            <article className="stat-card" key={item.month}>
              <span>{item.month}</span>
              <strong>{item.savedCount}</strong>
              <small>с замечаниями: {item.withDiscrepancies}</small>
            </article>
          ))}
        </section>

        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Проверенные карточки</h2>
              <span>{savedTenders.length} последних записей</span>
            </div>
          </div>
          {savedTenders.length === 0 ? (
            <div className="empty-state">
              <h3>Пока ничего не сохранено</h3>
              <p>После проверки карточки и нажатия «Сохранить» тендер появится здесь.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="tenders-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Ссылка</th>
                    <th>Контрагент</th>
                    <th>ИНН</th>
                    <th>Статус</th>
                    <th>Причина статуса</th>
                    <th>Замечания</th>
                  </tr>
                </thead>
                <tbody>
                  {savedTenders.map((item) => (
                    <tr key={item.id} onClick={() => {
                      setCard(item.card);
                      setSelectedImportedTenderId(item.importedTenderId);
                      setChangedFields(new Set());
                      setPage("card");
                    }}>
                      <td>{new Date(item.savedAt).toLocaleString("ru-RU")}</td>
                      <td>{item.card.tenderUrlSource || "—"}</td>
                      <td>{item.card.counterpartyName || "—"}</td>
                      <td>{item.card.counterpartyInn || "—"}</td>
                      <td>{fieldDisplayValue("tenderStatus", item.card.tenderStatus) || "—"}</td>
                      <td>{item.card.tenderStatusReason || "—"}</td>
                      <td>{item.discrepancyNotes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Закупки / Тендер №123</p>
          <h1>Карточка тендера</h1>
          <p className="subtitle">Заполните данные вручную или загрузите их из документации ЭТП.</p>
        </div>
        <div className="header-actions">
          <button className="button button-secondary" onClick={() => setPage("instructions")}>Инструкция</button>
          <button className="button button-secondary" onClick={() => setPage("tenders")}>Список тендеров</button>
          <button className="button button-secondary" onClick={() => setPage("database")}>Тендеры в базе</button>
          <button className="button button-secondary" onClick={() => setPage("saved")}>Сохранённые</button>
          <button className="button button-secondary" onClick={() => setPage("testing")}>Тестирование</button>
          <button className="button button-secondary" onClick={() => openModal("url")}>Автозаполнение</button>
          <button className="button button-primary" onClick={() => openModal("documents")}>Автозаполнение + документы</button>
        </div>
      </header>

      {notice && <div className="alert alert-success">{notice}</div>}
      {!modalOpen && error && <div className="alert alert-error">{error}</div>}

      <section className="card">
        <div className="card-heading">
          <h2>Основные данные</h2>
          <span>Поля со звёздочкой важны для обработки</span>
        </div>
        <div className="form-grid">
          {fieldsConfig.map((field, index) => (
            <Fragment key={field.key}>
              {(index === 0 || fieldsConfig[index - 1].section !== field.section) && (
                <div className="form-section-title">
                  <h3>{field.section}</h3>
                </div>
              )}
              {field.type === "checkboxes" ? (
                <div className={`field field-wide directions-field ${changedFields.has(field.key) ? "changed-panel" : ""}`}>
                  <span className="field-label">{field.label}</span>
                  <div className="directions-grid">
                    {field.options?.map((option) => (
                      <label className="direction-option" key={option.value}>
                        <input
                          type="checkbox"
                          checked={productDirectionsValue(card).includes(option.value)}
                          onChange={() => toggleDirection(option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <label className={`field ${field.type === "textarea" ? "field-wide" : ""}`}>
                  <span className="field-label">
                    {field.label}
                    {field.important && <span className="badge badge-important">важно</span>}
                  </span>
                  {field.type === "select" ? (
                    <select
                      className={changedFields.has(field.key) ? "changed" : ""}
                      value={String(card[field.key])}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    >
                      {field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      className={changedFields.has(field.key) ? "changed" : ""}
                      rows={field.key === "discrepancyNotes" ? 7 : 3}
                      value={String(card[field.key])}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    />
                  ) : (
                    <input
                      className={changedFields.has(field.key) ? "changed" : ""}
                      type={field.type || "text"}
                      min={field.type === "number" ? 0 : undefined}
                      value={String(card[field.key])}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    />
                  )}
                </label>
              )}
            </Fragment>
          ))}
        </div>
        <div className="card-footer">
          <button className="button button-primary" onClick={save}>Сохранить</button>
        </div>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Помощник</p>
                <h2 id="modal-title">
                  {autofillMode === "documents"
                    ? "Автозаполнение + документы"
                    : "Автозаполнение карточки"}
                </h2>
              </div>
              <button className="icon-button" onClick={closeModal} aria-label="Закрыть">×</button>
            </div>

            {!result && (
              <>
                {autofillMode === "documents" ? (
                  <label className="field">
                    <span className="field-label">Ссылка на тендер</span>
                    <input
                      type="url"
                      placeholder="https://zakupki.gov.ru/..."
                      value={tenderUrl}
                      disabled={processing}
                      onChange={(event) => setTenderUrl(event.target.value)}
                    />
                  </label>
                ) : (
                  <div className="modal-field-grid">
                    <label className="field">
                      <span className="field-label">seldonId</span>
                      <input
                        type="text"
                        value={seldonId}
                        disabled={processing}
                        onChange={(event) => setSeldonId(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">etpId</span>
                      <input
                        type="text"
                        value={etpId}
                        disabled={processing}
                        onChange={(event) => setEtpId(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Тип закупки</span>
                      <select
                        value={purchaseType}
                        disabled={processing}
                        onChange={(event) => setPurchaseType(event.target.value)}
                      >
                        <option value="">Выбрать...</option>
                        {purchaseTypeOptions.map((option) => (
                          <option value={option} key={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {autofillMode === "documents" && (
                  <div className="field upload-field">
                    <span className="field-label">Документы тендера</span>
                    <label className={`file-picker ${processing ? "file-picker-disabled" : ""}`}>
                      <input
                        type="file"
                        multiple
                        disabled={processing}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.zip,.7z,.rar,application/zip,application/x-7z-compressed,application/vnd.rar,application/x-rar-compressed"
                        onChange={(event) => setDocuments(Array.from(event.target.files ?? []))}
                      />
                      <strong>Выбрать документы</strong>
                      <span>До 15 файлов, каждый не более 25 МБ</span>
                    </label>
                    {documents.length > 0 && (
                      <div className="file-list">
                        {documents.map((document, index) => (
                          <div className="file-item" key={`${document.name}-${document.lastModified}`}>
                            <span>{document.name}</span>
                            <small>{(document.size / 1024 / 1024).toFixed(2)} МБ</small>
                            <button
                              type="button"
                              disabled={processing}
                              onClick={() =>
                                setDocuments((current) =>
                                  current.filter((_, itemIndex) => itemIndex !== index)
                                )
                              }
                              aria-label={`Удалить ${document.name}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {processing && (
                  <div className="progress-box">
                    <span className="spinner" />
                    <div><strong>Идёт обработка</strong><p>{progress}</p></div>
                  </div>
                )}
                {error && <div className="alert alert-error">{error}</div>}
              </>
            )}

            {result && (
              <div className="result">
                <div className="result-title"><div><h3>Найденные данные</h3><p>Проверьте значения перед применением.</p></div><span className="badge badge-done">Готово</span></div>
                <div className="preview-list">
                  {previewFields.map(({ key, label }) => {
                    const meta = result.meta[key];
                    return (
                      <article className="preview-item" key={key}>
                        <div><span className="preview-label">{label}</span><strong>{displayValue(result.fields[key]) || "Не найдено"}</strong></div>
                        {meta && <div className="source"><span>{meta.source}</span><span className={`confidence confidence-${meta.confidence}`}>{confidenceLabels[meta.confidence]}</span></div>}
                      </article>
                    );
                  })}
                </div>
                {result.warnings.length > 0 && <div className="alert alert-warning"><strong>Требует внимания</strong>{result.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}
              </div>
            )}

            <div className="modal-footer">
              <button className="button button-ghost" onClick={closeModal}>Отмена</button>
              {result
                ? <button className="button button-primary" onClick={applyResult}>Применить в карточку</button>
                : <button
                    className="button button-primary"
                    disabled={
                      processing ||
                      (autofillMode === "documents"
                        ? !tenderUrl.trim() || documents.length === 0
                        : (!seldonId.trim() && !etpId.trim()) || !purchaseType)
                    }
                    onClick={runAutofill}
                  >
                    Запустить
                  </button>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

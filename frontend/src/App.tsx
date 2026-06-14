import { Fragment, useEffect, useMemo, useState } from "react";
import {
  getAutofillStatus,
  saveTenderCard,
  startAutofill,
  startAutofillWithDocuments
} from "./api";
import { fieldsConfig, initialCard } from "./fieldsConfig";
import type { AutofillStatusResponse, TenderCard } from "./types";

const confidenceLabels = { high: "Высокая", medium: "Средняя", low: "Низкая" };

function hasValue(value: TenderCard[keyof TenderCard] | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : value !== "" && value !== undefined;
}

function displayValue(value: TenderCard[keyof TenderCard] | undefined): string {
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

export default function App() {
  const [card, setCard] = useState<TenderCard>(initialCard);
  const [modalOpen, setModalOpen] = useState(false);
  const [autofillMode, setAutofillMode] = useState<"url" | "documents">("url");
  const [tenderUrl, setTenderUrl] = useState("");
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

  const previewFields = useMemo(
    () => fieldsConfig.filter(({ key }) => result?.meta[key] || hasValue(result?.fields[key])),
    [result]
  );

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
      productDirections: current.productDirections.includes(direction)
        ? current.productDirections.filter((item) => item !== direction)
        : [...current.productDirections, direction]
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

  const runAutofill = async () => {
    setError("");
    setResult(null);
    try {
      const job =
        autofillMode === "documents"
          ? await startAutofillWithDocuments(tenderUrl.trim(), documents)
          : await startAutofill(tenderUrl.trim());
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
      const response = await saveTenderCard(card);
      setNotice(response.message);
      setChangedFields(new Set());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить карточку");
    }
  };

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Закупки / Тендер №123</p>
          <h1>Карточка тендера</h1>
          <p className="subtitle">Заполните данные вручную или загрузите их из документации ЭТП.</p>
        </div>
        <div className="header-actions">
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
                          checked={card.productDirections.includes(option.value)}
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
                      rows={3}
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
                      !tenderUrl.trim() ||
                      (autofillMode === "documents" && documents.length === 0)
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

import { useEffect, useMemo, useState } from "react";
import { getAutofillStatus, saveTenderCard, startAutofill } from "./api";
import { fieldsConfig, initialCard } from "./fieldsConfig";
import type { AutofillStatusResponse, TenderCard } from "./types";

const confidenceLabels = { high: "Высокая", medium: "Средняя", low: "Низкая" };

export default function App() {
  const [card, setCard] = useState<TenderCard>(initialCard);
  const [modalOpen, setModalOpen] = useState(false);
  const [tenderUrl, setTenderUrl] = useState("");
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
    () => fieldsConfig.filter(({ key }) => result?.meta[key] || result?.fields[key] !== ""),
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

  const openModal = () => {
    setError("");
    setProgress("");
    setResult(null);
    setJobId("");
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
      const job = await startAutofill(tenderUrl.trim());
      setProgress("Определяем ЭТП");
      setJobId(job.jobId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось запустить обработку");
    }
  };

  const applyResult = () => {
    if (!result) return;
    const changed = new Set<keyof TenderCard>();
    const next = { ...card };
    for (const key of Object.keys(result.fields) as (keyof TenderCard)[]) {
      const value = result.fields[key];
      if (value !== "" && value !== card[key]) {
        Object.assign(next, { [key]: value });
        changed.add(key);
      }
    }
    setCard(next);
    setChangedFields(changed);
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
        <button className="button button-secondary" onClick={openModal}>Автозаполнение</button>
      </header>

      {notice && <div className="alert alert-success">{notice}</div>}
      {!modalOpen && error && <div className="alert alert-error">{error}</div>}

      <section className="card">
        <div className="card-heading">
          <h2>Основные данные</h2>
          <span>Поля со звёздочкой важны для обработки</span>
        </div>
        <div className="form-grid">
          {fieldsConfig.map((field) => (
            <label className={`field ${field.type === "textarea" ? "field-wide" : ""}`} key={field.key}>
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
              <div><p className="eyebrow">Помощник</p><h2 id="modal-title">Автозаполнение карточки</h2></div>
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
                        <div><span className="preview-label">{label}</span><strong>{String(result.fields[key]) || "Не найдено"}</strong></div>
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
                : <button className="button button-primary" disabled={processing || !tenderUrl.trim()} onClick={runAutofill}>Запустить</button>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

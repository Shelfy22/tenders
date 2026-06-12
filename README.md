# Tender Autofill Demo

Тестовый fullstack-проект карточки тендера с асинхронным автозаполнением,
предпросмотром найденных данных и mock-интеграцией n8n.

## Требования

- Node.js 20+
- npm 10+

## Запуск одной командой

Из каталога `D:\tenders`:

```powershell
npm install
npm run install:all
npm run dev
```

Frontend откроется на `http://localhost:5173`, backend работает на
`http://localhost:4000`.

## Запуск отдельно

```powershell
cd backend
npm install
npm run dev
```

В другом терминале:

```powershell
cd frontend
npm install
npm run dev
```

## Настройка окружения

Скопируйте `.env.example` в `.env`. При пустом `N8N_AUTOFILL_WEBHOOK_URL` backend
использует mock-результат. Если URL задан, backend отправляет туда
`POST` с `tenderCardId`, `tenderUrl` и `callbackUrl`.

Для frontend переменная `VITE_API_URL` должна быть доступна Vite. Её можно
поместить в `frontend/.env`, если адрес backend отличается от стандартного.

## API

- `POST /api/tender-autofill/start`
- `GET /api/tender-autofill/status/:jobId`
- `POST /api/tender-autofill/result`
- `PATCH /api/tender-card/:id`
- `POST /api/n8n-webhook-mock/tender-autofill`

Данные и задачи хранятся только в памяти и очищаются при перезапуске backend.

## Docker

Скопируйте `.env.example` в `.env` и проверьте адреса n8n и публичного сайта.

Запуск через Docker Compose:

```powershell
docker compose up --build -d
```

Сайт и API будут доступны на `http://localhost:4000`. Проверка состояния:

```powershell
docker compose ps
curl http://localhost:4000/api/health
```

Просмотр логов:

```powershell
docker compose logs -f tender-autofill
```

Остановка:

```powershell
docker compose down
```

Сборка и запуск без Compose:

```powershell
docker build -t tender-autofill:latest .
docker run --rm -p 4000:4000 `
  -e N8N_AUTOFILL_WEBHOOK_URL=https://n8n.example.com/webhook/tender-autofill `
  -e PUBLIC_BASE_URL=https://tenders.example.com `
  tender-autofill:latest
```

Контейнер запускается от непривилегированного пользователя, содержит healthcheck
и не включает исходники frontend, dev-зависимости или локальные секреты.

## Развёртывание на Render

Репозиторий содержит `render.yaml` для одного Web Service. Express обслуживает
API и production-сборку React с одного домена.

1. В Render выберите **New → Blueprint** и подключите GitHub-репозиторий.
2. Проверьте значения `N8N_AUTOFILL_WEBHOOK_URL` и `PUBLIC_BASE_URL`.
3. Создайте сервис и дождитесь завершения сборки.

В `render.yaml` указан production webhook `/webhook/tender-autofill`. Workflow
n8n должен быть активирован. Переменная `VITE_API_URL` на Render не нужна:
frontend обращается к API на том же домене.

Backend отправляет в n8n:

```json
{
  "tenderCardId": 123,
  "tenderUrl": "https://zakupki.kontur.ru/...",
  "callbackUrl": "https://tenders-6pb1.onrender.com/api/tender-autofill/result"
}
```

n8n отправляет найденные `fields`, `meta` и `warnings` обратно на callback.

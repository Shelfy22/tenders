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

Скопируйте `.env.example` в `.env`. При пустом `N8N_WEBHOOK_URL` backend
использует mock-результат. Если URL задан, backend отправляет туда
`POST` с `tenderCardId` и `tenderUrl`.

Для frontend переменная `VITE_API_URL` должна быть доступна Vite. Её можно
поместить в `frontend/.env`, если адрес backend отличается от стандартного.

## API

- `POST /api/tender-autofill/start`
- `GET /api/tender-autofill/status/:jobId`
- `PATCH /api/tender-card/:id`
- `POST /api/n8n-webhook-mock/tender-autofill`

Данные и задачи хранятся только в памяти и очищаются при перезапуске backend.

## Развёртывание на Render

Репозиторий содержит `render.yaml` для одного Web Service. Express обслуживает
API и production-сборку React с одного домена.

1. В Render выберите **New → Blueprint** и подключите GitHub-репозиторий.
2. Укажите значение `N8N_WEBHOOK_URL`:
   `https://ваш-n8n-домен/webhook/tender-autofill`.
3. Создайте сервис и дождитесь завершения сборки.

Workflow n8n должен быть активирован, а URL должен быть production webhook,
не `/webhook-test/`. Переменная `VITE_API_URL` на Render не нужна: frontend
обращается к API на том же домене.

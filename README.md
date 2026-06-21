# Media Processing Platform

API-first платформа для загрузки, обработки и распространения видео-контента: извлечение
метаданных, генерация превью и клипов, транскодирование в несколько разрешений, упаковка в HLS
и извлечение аудио. Обработка асинхронная, с прогрессом в реальном времени, публичным REST API и
webhooks.

> Статус: **MVP в разработке.**

## Возможности

- Загрузка видео напрямую в объектное хранилище по presigned-URL (MP4, MOV, MKV, WEBM, AVI)
- Извлечение метаданных (длительность, разрешение, FPS, кодеки, битрейт)
- Превью (постер), кадры по интервалу, короткий демо-клип
- Транскодирование в лесенку 360p / 480p / 720p / 1080p (без апскейла выше исходника)
- HLS (адаптивный стриминг) и извлечение аудио (MP3)
- Асинхронная обработка (BullMQ Flow), прогресс задач по WebSocket + поллинг-фоллбэк
- Управление видео: отмена обработки и удаление (вместе с артефактами и объектами в хранилище)
- Публичный REST API с OpenAPI (`/openapi.json`, Swagger UI на `/docs`), API-ключи, rate limiting
- Webhooks с HMAC-подписью, ретраями и историей доставок
- Личный кабинет (Next.js): загрузка, живой прогресс, артефакты/плеер, ключи, webhooks, docs + sandbox

## Технологии

| Слой | Стек |
|---|---|
| Backend | Node.js, TypeScript, Fastify, Pino, Zod |
| Данные | PostgreSQL (Drizzle ORM), Redis + BullMQ |
| Медиа | FFmpeg |
| Хранилище | MinIO (dev) / S3 (prod) |
| Frontend | Next.js (App Router), TanStack Query, Zustand, PrimeReact + Tailwind |
| Инфраструктура | Docker, Docker Compose, Turborepo, pnpm workspaces |

## Архитектура

Монорепозиторий на pnpm workspaces + Turborepo. Внутренние пакеты — под скоупом `@mpp/*`,
подключаются «just-in-time» (`exports` указывают на исходники, запуск через `tsx`, ESM).

Сервисы разделены по профилю нагрузки:

- **api** — REST API, presigned-загрузка, OpenAPI, WebSocket-прогресс, auth, rate limit, webhooks.
- **worker** — медиа-конвейер на FFmpeg: `probe` (gate) → веер `finalize ⟵ { thumbnail, frames,
  clip, audio, hls ⟵ rendition_* }`.
- **webhook-dispatcher** — доставка webhooks (per-endpoint HMAC, ретраи, dead-letter).
- **web** — дашборд (личный кабинет, документация, sandbox).

В dev `api` / `web` / `webhook-dispatcher` запускаются на хосте через `tsx`/`next`. Медиа-воркер —
исключение: из-за FFmpeg он работает в Docker вместе с инфраструктурой. Прочее в Docker — только
инфраструктура (PostgreSQL / Redis / MinIO).

## Требования

- **Node.js** ≥ 20
- **pnpm** 9 — включается через corepack (`corepack enable`)
- **Docker** + **Docker Compose**

## Быстрый старт

```bash
# 1. Зависимости
corepack enable
pnpm install

# 2. Переменные окружения
cp .env.example .env                  # backend + docker-compose
cp apps/web/.env.example apps/web/.env.local   # frontend (dev-прокси и WS)

# 3. Инфраструктура + медиа-воркер (PostgreSQL + Redis + MinIO + worker)
pnpm infra:up        # образ воркера собирается автоматически при первом запуске

# 4. Схема базы данных
pnpm db:migrate

# 5. Сервисы на хосте: api (:3000) + web (:3001) + webhook-dispatcher
pnpm dev
```

Проверка:

```bash
curl localhost:3000/health    # {"status":"ok"}
curl localhost:3000/ready     # 200 + проверка PostgreSQL и Redis
```

Затем откройте дашборд: <http://localhost:3001> (регистрация создаёт аккаунт и первого пользователя).

> При изменении кода воркера или его зависимостей пересоберите образ:
> `docker compose --env-file .env -f infra/docker-compose.yml build worker`.

## Структура проекта

```
apps/
  api/                 # Fastify — REST API, presigned upload, OpenAPI, WS, auth, rate limit
  worker/              # медиа-воркер (FFmpeg): probe + thumbnail/frames/clip/audio/renditions/HLS
  webhook-dispatcher/  # доставка webhooks (HMAC, ретраи, dead-letter)
  web/                 # Next.js — дашборд, документация, sandbox
packages/
  config/              # конфигурация из окружения (Zod-валидация, без дефолтов)
  core/                # общие типы и перечисления домена, агрегатор прогресса
  db/                  # схема и миграции (Drizzle ORM)
  storage/             # S3/MinIO: presigned URL, ключи объектов, удаление префикса
  queue/               # BullMQ: очереди, Flow, события задач, webhooks
  media/               # обёртки FFmpeg/ffprobe (probe, transcode, thumbnail, clip, audio, HLS)
infra/
  docker-compose.yml   # PostgreSQL + Redis + MinIO (+ инициализация бакета) + worker
architecture/          # ТЗ и схема архитектуры (источники правды)
```

## Скрипты

| Команда | Описание |
|---|---|
| `pnpm dev` | dev-режим сервисов на хосте: api + web + webhook-dispatcher (воркер исключён — он в Docker) |
| `pnpm build` | сборка всех пакетов и приложений (Turborepo) |
| `pnpm typecheck` | проверка типов по всему монорепо |
| `pnpm infra:up` / `infra:down` | поднять / остановить инфраструктуру и воркер |
| `pnpm infra:logs` / `infra:reset` | логи / остановка со сбросом томов |
| `pnpm db:generate` | сгенерировать SQL-миграцию из схемы |
| `pnpm db:migrate` | применить миграции |
| `pnpm db:seed` | посеять dev-аккаунт (легаси из stage 2; обычные аккаунты создаёт регистрация) |
| `pnpm db:studio` | открыть Drizzle Studio |

## Сервисы и порты

| Сервис | Адрес |
|---|---|
| Web (дашборд) | <http://localhost:3001> |
| API | <http://localhost:3000> |
| API — OpenAPI / Swagger UI | <http://localhost:3000/openapi.json> · <http://localhost:3000/docs> |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MinIO (S3 API) | <http://localhost:9000> |
| MinIO (консоль) | <http://localhost:9001> |

## Документация

- [Функциональные требования (ТЗ)](./architecture/functional_requirements.md)
- [Архитектура](./architecture/architecture_schema.md)

## Лицензия

Проприетарный внутренний проект. Все права защищены.

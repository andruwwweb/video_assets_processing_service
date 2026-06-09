# Media Processing Platform

API-first платформа для загрузки, обработки и распространения видео-контента: извлечение
метаданных, генерация превью и клипов, транскодирование в несколько разрешений, упаковка в HLS
и извлечение аудио. Обработка асинхронная, с прогрессом в реальном времени, публичным REST API и
webhooks.

> Статус: **MVP в разработке.**

## Возможности

- Загрузка видео (MP4, MOV, MKV, WEBM, AVI)
- Извлечение метаданных (длительность, разрешение, FPS, кодеки, битрейт)
- Превью, кадры, короткие клипы
- Транскодирование: 360p / 480p / 720p / 1080p
- HLS (адаптивный стриминг) и извлечение аудио (MP3/AAC/WAV/OGG)
- Асинхронные задачи (очередь), прогресс по WebSocket
- Публичный REST API, API-ключи, webhooks, rate limiting

## Технологии

| Слой | Стек |
|---|---|
| Backend | Node.js, TypeScript, Fastify, Pino, Zod |
| Данные | PostgreSQL (Drizzle ORM), Redis (BullMQ) |
| Медиа | FFmpeg |
| Хранилище | MinIO (dev) / S3 (prod) |
| Frontend | Next.js, TanStack Query, Zustand |
| Инфраструктура | Docker, Docker Compose, Turborepo, pnpm |

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
cp .env.example .env

# 3. Инфраструктура (PostgreSQL + Redis + MinIO)
pnpm infra:up

# 4. Схема базы данных
pnpm db:migrate

# 5. API
pnpm --filter @mpp/api dev
```

Проверка:

```bash
curl localhost:3000/health    # {"status":"ok"}
curl localhost:3000/ready     # 200 + проверка PostgreSQL и Redis
```

## Структура проекта

```
apps/
  api/          # Fastify — REST API и health-check
packages/
  config/       # конфигурация из окружения (Zod-валидация)
  core/         # общие типы и перечисления домена
  db/           # схема и миграции (Drizzle ORM)
infra/
  docker-compose.yml   # PostgreSQL + Redis + MinIO
```

Монорепозиторий на pnpm workspaces + Turborepo. Внутренние пакеты — под скоупом `@mpp/*`.

## Скрипты

| Команда | Описание |
|---|---|
| `pnpm dev` | запустить dev-режим всех приложений (Turborepo) |
| `pnpm --filter @mpp/api dev` | запустить только API |
| `pnpm typecheck` | проверка типов по всему монорепо |
| `pnpm infra:up` / `infra:down` | поднять / остановить инфраструктуру |
| `pnpm infra:logs` / `infra:reset` | логи инфраструктуры / сброс вместе с томами |
| `pnpm db:generate` | сгенерировать SQL-миграцию из схемы |
| `pnpm db:migrate` | применить миграции |
| `pnpm db:studio` | открыть Drizzle Studio |

## Сервисы и порты

| Сервис | Адрес |
|---|---|
| API | http://localhost:3000 |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MinIO (S3 API) | http://localhost:9000 |
| MinIO (консоль) | http://localhost:9001 |

## Документация

- [Функциональные требования (ТЗ)](./functional_requirements.md)
- [Архитектура](./architecture_schema.md)

## Лицензия

Проприетарный внутренний проект. Все права защищены.

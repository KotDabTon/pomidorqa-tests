# PomidorQA Autotests

Автотесты веб-приложения **PomidorQA** на Playwright + TypeScript.

PomidorQA — сервис для поиска участников по профессиональным навыкам, создания свободных слотов и бронирования встреч.

Репозиторий содержит тесты трёх уровней:

* **Unit** — проверка чистой логики без браузера;
* **API** — проверка бизнес-логики через локальный mock API;
* **E2E** — проверка пользовательских сценариев на реальном PomidorQA.

## Ключевые результаты

Источник требований — [`requirements.md`](requirements.md).
Связь требований с автоматизированными проверками находится в [`docs/coverage-matrix.md`](docs/coverage-matrix.md).

| Метрика        |       Значение |
| -------------- | -------------: |
| Полнота аудита | 50 / 50 (100%) |
| `automated`    |  39 / 50 (78%) |
| `partial`      |   8 / 50 (16%) |
| `known defect` |    1 / 50 (2%) |
| `out of scope` |    2 / 50 (4%) |
| Unit           |             10 |
| API            |              8 |
| E2E            |             38 |
| Всего тестов   |             56 |

**Автоматизированное покрытие требований — 39 из 50 (78%).**

Покрытие требований и количество тестов — разные метрики. Статус каждого из 50 требований определён в coverage matrix.

## Что покрывается

* регистрация и авторизация;
* сессии и logout;
* профиль пользователя;
* часовой пояс;
* навыки `can_help` / `want_to_learn`;
* создание и удаление слотов;
* ограничения для прошедших слотов;
* каталог участников и поиск;
* исключение собственного профиля из каталога;
* бронирование свободного слота;
* повторное бронирование занятого слота;
* отмена встречи пользователем и владельцем слота;
* ограничения для гостя;
* сохранение данных после перезагрузки;
* негативные сценарии;
* проверка конкурентного бронирования.

## Стек

* TypeScript
* Playwright Test
* Node.js
* ESLint
* Page Object Model
* API Arrange
* Unit / API / E2E testing
* GitHub Actions

## Установка

```bash
npm ci
npx playwright install chromium
```

## Запуск

Все тесты:

```bash
npm test
```

Unit:

```bash
npm run test:unit
```

API:

```bash
npm run test:api
```

E2E:

```bash
npm run test:e2e
```

Lint:

```bash
npm run lint
```

Playwright report:

```bash
npm run report
```

## Base URL

E2E-тесты используют переменную `POMIDORQA_BASE_URL`.

Для запуска против другого стенда:

```bash
POMIDORQA_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Структура

```text
.github/
└── workflows/
    ├── ai-review.yml
    └── playwright.yml

src/
└── pyramid/
    ├── mock-booking-api.ts
    └── slots.ts

tests/
├── api/
│   └── booking-api.spec.ts
├── e2e/
├── helpers/
│   ├── booking.ts
│   └── user.ts
├── pages/
│   ├── booking-page.ts
│   ├── profile-page.ts
│   └── slots-page.ts
└── unit/
    └── slots.spec.ts

docs/
├── ai-reviewer.md
└── coverage-matrix.md

requirements.md
CODEX.md
CONTRIBUTING.md
REVIEW.md
```

E2E-сценарии разделены по функциональным областям, Page Object'ы инкапсулируют работу со страницами, а helpers отвечают за подготовку тестовых данных и повторяемые операции.

## Тестовая стратегия

**Unit** используются для проверки изолированной детерминированной логики.

**API** проверяют отдельные правила через локальный mock API и не являются проверкой production API.

**E2E** проверяют пользовательские сценарии на реальном `aiqa.su/pomidorqa`, включая работу нескольких пользователей в независимых BrowserContext.

Для тестовых данных используются уникальные значения. Сценарии с несколькими пользователями изолируются через отдельные BrowserContext.

## Ограничения

Некоторые требования невозможно полностью подтвердить через доступный black-box интерфейс или они покрыты только частично.

Актуальные ограничения и доказательства по каждому требованию указаны в [`docs/coverage-matrix.md`](docs/coverage-matrix.md).

В текущем срезе также зафиксирован известный дефект **R8.3**: поиск каталога учитывает совпадения в `want_to_learn`, хотя требование ограничивает поиск навыками `can_help`.

## Документация

* [`requirements.md`](requirements.md) — функциональные требования MVP;
* [`docs/coverage-matrix.md`](docs/coverage-matrix.md) — матрица покрытия требований;
* [`docs/ai-reviewer.md`](docs/ai-reviewer.md) — AI Review;
* [`CODEX.md`](CODEX.md) — правила разработки автотестов;
* [`CONTRIBUTING.md`](CONTRIBUTING.md) — правила работы с репозиторием;
* [`REVIEW.md`](REVIEW.md) — правила code review.

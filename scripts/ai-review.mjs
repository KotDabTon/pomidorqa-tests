// AI Reviewer: анализирует diff Pull Request на соответствие CODEX.md и REVIEW.md
// и публикует замечания как GitHub review.
//
// Провайдер не захардкожен: запрос идёт на любой OpenAI-совместимый endpoint
// вида POST {AI_REVIEW_API_BASE_URL}/chat/completions (этот формат поддерживают
// большинство шлюзов — OpenRouter, Polza AI и т.п.). Чтобы подключить провайдера,
// код менять не нужно — достаточно задать в репозитории:
//   secrets.AI_REVIEW_API_KEY       — ключ провайдера;
//   vars.AI_REVIEW_API_BASE_URL     — базовый URL API (без /chat/completions);
//   vars.AI_REVIEW_MODEL            — идентификатор модели у этого провайдера.
// Если у выбранного провайдера другой формат запроса/ответа — правится только
// функция requestReview() ниже, остальной скрипт не зависит от провайдера.

import { readFileSync } from "node:fs";

const {
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
  AI_REVIEW_HEAD_SHA,
  AI_REVIEW_PR_NUMBER,
  AI_REVIEW_ALLOW_PUBLISH,
  AI_REVIEW_API_KEY,
  AI_REVIEW_API_BASE_URL,
  AI_REVIEW_MODEL,
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    console.error(`Переменная окружения ${name} не задана.`);
    process.exit(1);
  }

  return value;
}

requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
requireEnv("GITHUB_REPOSITORY", GITHUB_REPOSITORY);
requireEnv("AI_REVIEW_HEAD_SHA", AI_REVIEW_HEAD_SHA);
requireEnv("AI_REVIEW_PR_NUMBER", AI_REVIEW_PR_NUMBER);

const [owner, repo] = GITHUB_REPOSITORY.split("/");
const prNumber = Number(AI_REVIEW_PR_NUMBER);

const GITHUB_API = "https://api.github.com";

async function githubRequest(path, init = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API ${path} вернул ${response.status}: ${await response.text()}`,
    );
  }

  return response;
}

async function fetchPullRequestDiff() {
  const response = await githubRequest(
    `/repos/${owner}/${repo}/pulls/${prNumber}`,
    { headers: { Accept: "application/vnd.github.v3.diff" } },
  );

  return response.text();
}

function readRulesContext() {
  const files = ["CODEX.md", "REVIEW.md"];

  return files
    .map((path) => {
      try {
        return `--- ${path} ---\n${readFileSync(path, "utf-8")}`;
      } catch {
        console.warn(`${path} не найден — ревью пройдёт без этого файла в контексте.`);
        return null;
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildPrompt(diff, rulesContext) {
  return [
    "Ты проверяешь Pull Request с автотестами Playwright по правилам ниже.",
    "Оцени только реальные проблемы, соответствующие правилам. Не придирайся к стилю,",
    "если правила явно не запрещают конкретную конструкцию. При сомнении — не сообщай замечание.",
    "",
    rulesContext,
    "",
    "--- Diff Pull Request ---",
    diff,
    "",
    "Верни ТОЛЬКО JSON (без markdown-обрамления) следующей формы:",
    '{"summary": "краткий вывод по PR",',
    ' "comments": [{"path": "относительный путь файла", "line": номер_строки_в_новом_файле, "body": "замечание"}]}',
    "Если проблем нет — верни пустой массив comments.",
  ].join("\n");
}

// Единственное место, зависящее от формата API конкретного провайдера.
// Возвращает строку — сырой ответ модели (ожидается JSON, см. buildPrompt).
async function requestReview(prompt) {
  requireEnv("AI_REVIEW_API_KEY", AI_REVIEW_API_KEY);
  requireEnv("AI_REVIEW_API_BASE_URL", AI_REVIEW_API_BASE_URL);
  requireEnv("AI_REVIEW_MODEL", AI_REVIEW_MODEL);

  const baseUrl = AI_REVIEW_API_BASE_URL.replace(/\/+$/, "");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_REVIEW_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_REVIEW_MODEL,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `AI-провайдер вернул ${response.status}: ${await response.text()}`,
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      `Ответ провайдера не содержит choices[0].message.content: ${JSON.stringify(data)}`,
    );
  }

  return content;
}

function parseReviewResponse(raw) {
  const cleaned = raw.trim().replace(/^```json\s*|```$/g, "");

  try {
    const parsed = JSON.parse(cleaned);

    return {
      summary: parsed.summary ?? "",
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
    };
  } catch (error) {
    console.error("Не удалось разобрать ответ модели как JSON:", error);
    return { summary: raw, comments: [] };
  }
}

async function publishReview({ summary, comments }) {
  if (AI_REVIEW_ALLOW_PUBLISH !== "true") {
    console.log("AI_REVIEW_ALLOW_PUBLISH не включён — публикация пропущена.");
    console.log(JSON.stringify({ summary, comments }, null, 2));
    return;
  }

  await githubRequest(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
    method: "POST",
    body: JSON.stringify({
      commit_id: AI_REVIEW_HEAD_SHA,
      body: summary || "AI Review завершён без общих замечаний.",
      event: "COMMENT",
      comments: comments.map(({ path, line, body }) => ({
        path,
        line,
        body,
      })),
    }),
  });

  console.log(`Review опубликован для PR #${prNumber}.`);
}

async function main() {
  const [diff, rulesContext] = [
    await fetchPullRequestDiff(),
    readRulesContext(),
  ];

  const prompt = buildPrompt(diff, rulesContext);
  const raw = await requestReview(prompt);
  const review = parseReviewResponse(raw);

  await publishReview(review);
}

main().catch((error) => {
  console.error("AI Review завершился с ошибкой:", error);
  process.exit(1);
});

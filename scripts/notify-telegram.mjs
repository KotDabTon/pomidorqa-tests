import { readFileSync, existsSync } from "node:fs";

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  GITHUB_REPOSITORY,
  GITHUB_SERVER_URL,
  GITHUB_RUN_ID,
  GITHUB_SHA,
  GITHUB_ACTOR,
  GITHUB_EVENT_NAME,
  GITHUB_REF_NAME,
  GITHUB_HEAD_REF,
  COMMIT_MESSAGE,
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.warn("TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы — уведомление пропущено.");
  process.exit(0);
}

function readReport() {
  const path = "test-results.json";

  if (!existsSync(path)) {
    return null;
  }

  return JSON.parse(readFileSync(path, "utf-8"));
}

function collectFailedTitles(suites, acc = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const status = test.results?.at(-1)?.status;

        if (status === "failed" || status === "timedOut") {
          acc.push(spec.title);
        }
      }
    }

    collectFailedTitles(suite.suites, acc);
  }

  return acc;
}

function formatDuration(ms) {
  if (!ms) return "—";

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const report = readReport();

const stats = report?.stats ?? {};
const passed = stats.expected ?? 0;
const failed = stats.unexpected ?? 0;
const flaky = stats.flaky ?? 0;
const skipped = stats.skipped ?? 0;
const total = passed + failed + flaky + skipped;

const failedTitles = failed > 0 ? collectFailedTitles(report?.suites) : [];

const branch = GITHUB_HEAD_REF || GITHUB_REF_NAME || "unknown";
const eventLabel = GITHUB_EVENT_NAME === "pull_request" ? "pull request" : GITHUB_EVENT_NAME;
const runUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
const commitUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/commit/${GITHUB_SHA}`;
const shortSha = (GITHUB_SHA ?? "").slice(0, 7);

const statusIcon = report === null ? "⚠️" : failed > 0 ? "❌" : "✅";
const statusText = report === null ? "Прогон не завершился (нет отчёта)" : failed > 0 ? "Тесты упали" : "Тесты прошли";

const lines = [
  `${statusIcon} <b>${escapeHtml(statusText)}</b> (${formatDuration(stats.duration)})`,
  `📦 ${escapeHtml(GITHUB_REPOSITORY)}`,
  `🌿 ${escapeHtml(branch)} (${escapeHtml(eventLabel)})`,
  `👤 ${escapeHtml(GITHUB_ACTOR)}`,
];

if (report !== null) {
  lines.push(
    `📊 Всего: ${total} | ✅ ${passed} | ❌ ${failed} | 🔁 ${flaky} | ⏭️ ${skipped}`,
  );
}

if (failedTitles.length > 0) {
  const shown = failedTitles.slice(0, 5);
  const rest = failedTitles.length - shown.length;

  lines.push("");
  lines.push("<b>Упавшие тесты:</b>");
  lines.push(...shown.map((title) => `• ${escapeHtml(title)}`));

  if (rest > 0) {
    lines.push(`…и ещё ${rest}`);
  }
}

lines.push("");
lines.push(`🔗 <a href="${runUrl}">Прогон в GitHub</a>`);
lines.push(`💬 <a href="${commitUrl}">${shortSha}</a> ${escapeHtml(COMMIT_MESSAGE ?? "")}`);

const text = lines.join("\n");

const response = await fetch(
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  },
);

if (!response.ok) {
  console.error(`Telegram API вернул ${response.status}: ${await response.text()}`);
  process.exit(1);
}

console.log("Уведомление в Telegram отправлено.");

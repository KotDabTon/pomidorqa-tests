import { readFileSync, existsSync } from "node:fs";

const PROJECT_ORDER = ["unit", "api", "e2e"];

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
  PR_URL,
  REPORT_URL,
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

// Обходит дерево suites/specs один раз и для каждого запуска теста (по одному
// на project — unit/api/e2e видят разные файлы, но общий спек может попасть
// в несколько project'ов) вызывает visit(project, spec.title, test).
function walkTests(suites, visit) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        visit(test.projectName ?? "unknown", spec.title, test);
      }
    }

    walkTests(suite.suites, visit);
  }
}

function emptyBucket() {
  return { passed: 0, failed: 0, flaky: 0, skipped: 0 };
}

function formatDuration(ms) {
  if (!ms) return "—";

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function progressBar(rate, segments = 10) {
  const filled = Math.max(0, Math.min(segments, Math.round((rate / 100) * segments)));

  return "▰".repeat(filled) + "▱".repeat(segments - filled);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const report = readReport();

const projectStats = {};
const failedEntries = [];

if (report !== null) {
  walkTests(report.suites, (project, title, test) => {
    const bucket = (projectStats[project] ??= emptyBucket());

    if (test.status === "expected") bucket.passed++;
    else if (test.status === "flaky") bucket.flaky++;
    else if (test.status === "skipped") bucket.skipped++;
    else {
      bucket.failed++;
      failedEntries.push({ project, title });
    }
  });
}

const stats = report?.stats ?? {};
const passed = stats.expected ?? 0;
const failed = stats.unexpected ?? 0;
const flaky = stats.flaky ?? 0;
const skipped = stats.skipped ?? 0;
const executed = passed + failed + flaky;
const passRate = executed > 0 ? Math.round(((passed + flaky) / executed) * 100) : 100;

const branch = GITHUB_HEAD_REF || GITHUB_REF_NAME || "unknown";
const eventLabel = GITHUB_EVENT_NAME === "pull_request" ? "pull request" : GITHUB_EVENT_NAME;
const runUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
const commitUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/commit/${GITHUB_SHA}`;
const shortSha = (GITHUB_SHA ?? "").slice(0, 7);

const statusIcon = report === null ? "⚠️" : failed > 0 ? "❌" : "✅";
const statusText = report === null ? "Прогон не завершился (нет отчёта)" : failed > 0 ? "Тесты упали" : "Тесты прошли";

const lines = [
  `${statusIcon} <b>${escapeHtml(statusText)}</b> (${formatDuration(stats.duration)})`,
  `📦 Репозиторий: ${escapeHtml(GITHUB_REPOSITORY)}`,
  `🌿 Ветка: ${escapeHtml(branch)} (${escapeHtml(eventLabel)})`,
  `👤 Автор: ${escapeHtml(GITHUB_ACTOR)}`,
];

if (report !== null) {
  lines.push(`📊 Всего: ${passed + failed + flaky + skipped} | ✅ ${passed} | ❌ ${failed} | 🔁 ${flaky} | ⏭️ ${skipped}`);

  const orderedProjects = [
    ...PROJECT_ORDER.filter((name) => projectStats[name]),
    ...Object.keys(projectStats).filter((name) => !PROJECT_ORDER.includes(name)),
  ];

  for (const name of orderedProjects) {
    const bucket = projectStats[name];
    const bucketTotal = bucket.passed + bucket.failed + bucket.flaky + bucket.skipped;
    const bucketIcon = bucket.failed > 0 ? "❌" : "✅";

    lines.push(`   ${bucketIcon} ${escapeHtml(name)}: ${bucket.passed + bucket.flaky}/${bucketTotal}`);
  }

  lines.push(`${progressBar(passRate)} ${passRate}%`);
}

if (failedEntries.length > 0) {
  const shown = failedEntries.slice(0, 5);
  const rest = failedEntries.length - shown.length;

  lines.push("");
  lines.push("<b>Упавшие тесты:</b>");
  lines.push(...shown.map(({ project, title }) => `• [${escapeHtml(project)}] ${escapeHtml(title)}`));

  if (rest > 0) {
    lines.push(`…и ещё ${rest}`);
  }
}

lines.push("");
lines.push(`🔗 <a href="${runUrl}">Прогон в GitHub</a>`);
lines.push(`💬 Коммит: <a href="${commitUrl}">${shortSha}</a> — ${escapeHtml(COMMIT_MESSAGE ?? "")}`);

if (PR_URL) {
  lines.push(`🔀 <a href="${PR_URL}">Pull Request</a>`);
}

if (REPORT_URL) {
  lines.push(`📄 <a href="${REPORT_URL}">Playwright HTML report</a>`);
}

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

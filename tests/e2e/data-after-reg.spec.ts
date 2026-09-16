import { test, expect } from "@playwright/test";
import { createApp } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

function dateInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

test.describe("Профиль после регистрации", () => {
  test("смена имени в профиле сохраняется", async ({ browser }) => {
    const app = await createApp(browser);

    try {
      const user = makeUser("hw7-name");
      const newName = `Тестовое Имя ${Date.now()}`;

      await test.step("Arrange: регистрируем участника через API", async () => {
        await registerUserViaApi(app.context.request, user);
      });

      await test.step("Открываем профиль и меняем имя", async () => {
        await app.profilePage.goto();
        await app.profilePage.saveProfile({ name: newName });
      });

      await test.step("После перезагрузки имя пришло с сервера", async () => {
        await app.page.reload();
        await expect(app.profilePage.nameInput).toHaveValue(newName);
      });
    } finally {
      await cleanupUsersViaApi([app.context]);
    }
  });

  test("добавление навыка «могу помочь»", async ({ browser }) => {
    const app = await createApp(browser);

    try {
      const user = makeUser("hw7-skill");
      const skillTag = `Playwright-demo-${Date.now()}`;

      await test.step("Arrange: регистрируем участника через API", async () => {
        await registerUserViaApi(app.context.request, user);
      });

      await test.step("Добавляем навык «могу помочь»", async () => {
        await app.profilePage.goto();
        await app.profilePage.addSkill(skillTag, "can_help");
      });

      await test.step("Навык виден в блоке «могу помочь»", async () => {
        await expect(app.profilePage.skillItem(skillTag, "can_help")).toBeVisible();
      });
    } finally {
      await cleanupUsersViaApi([app.context]);
    }
  });

  test("добавление свободного слота", async ({ browser }) => {
    const app = await createApp(browser);

    try {
      const user = makeUser("hw7-slot");

      await test.step("Arrange: регистрируем участника через API", async () => {
        await registerUserViaApi(app.context.request, user);
      });

      await test.step("Заводим слот на завтра", async () => {
        await app.slotsPage.goto();
        await app.slotsPage.addSlot("12:00", dateInDays(1));
      });

      await test.step("Слот появился со статусом «свободен»", async () => {
        await expect(app.page.locator('[data-slot-status="free"]').first()).toBeVisible();
      });
    } finally {
      await cleanupUsersViaApi([app.context]);
    }
  });
});

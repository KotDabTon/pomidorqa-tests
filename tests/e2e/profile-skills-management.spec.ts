import { test, expect } from "@playwright/test";
import { createApp, type AppContext } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

test.describe("Профиль: правила работы с навыками", () => {
  let app: AppContext;

  test.beforeEach(async ({ browser }) => {
    app = await createApp(browser);
    const user = makeUser("skills-rules");
    await registerUserViaApi(app.context.request, user);
    await app.profilePage.goto();
  });

  test.afterEach(async () => {
    await cleanupUsersViaApi([app.context]);
  });

  test("Повторное добавление того же навыка не создаёт дубликат", async () => {
    const tag = `Duplicate-${Date.now()}`;

    await test.step("Добавляем навык первый раз", async () => {
      await app.profilePage.addSkill(tag, "can_help");
    });

    await test.step("Пытаемся добавить тот же навык повторно", async () => {
      await app.profilePage.submitSkill(tag, "can_help");
    });

    await test.step("В блоке «могу помочь» остаётся одна запись", async () => {
      await expect(app.profilePage.skillItem(tag, "can_help")).toHaveCount(1);
    });
  });

  test("Тот же навык другого типа добавляется как отдельная запись", async () => {
    const tag = `SameName-${Date.now()}`;

    await test.step("Добавляем навык «могу помочь»", async () => {
      await app.profilePage.addSkill(tag, "can_help");
    });

    await test.step("Добавляем тот же навык как «хочу разобрать»", async () => {
      await app.profilePage.addSkill(tag, "want_to_learn");
    });

    await test.step("Обе записи видны каждая в своём блоке", async () => {
      await expect(app.profilePage.skillItem(tag, "can_help")).toBeVisible();
      await expect(app.profilePage.skillItem(tag, "want_to_learn")).toBeVisible();
    });
  });

  test("Удаление навыка убирает только его, остальные остаются", async () => {
    test.setTimeout(90_000);

    const runId = Date.now();
    const toDelete = `ToDelete-${runId}`;
    const toKeep = `ToKeep-${runId}`;

    await test.step("Добавляем два навыка «могу помочь»", async () => {
      await app.profilePage.addSkill(toDelete, "can_help");
      await app.profilePage.addSkill(toKeep, "can_help");
    });

    await test.step("Удаляем первый навык", async () => {
      await app.profilePage.deleteSkill(toDelete, "can_help");
    });

    await test.step("Удалённого навыка нет, второй остался на месте", async () => {
      await expect(app.profilePage.skillItem(toDelete, "can_help")).toHaveCount(0);
      await expect(app.profilePage.skillItem(toKeep, "can_help")).toBeVisible();
    });
  });
});

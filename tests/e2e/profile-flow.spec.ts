import { test, expect } from "@playwright/test";
import { createApp, type AppContext } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

test.describe("Профиль: действия с полями", () => {
  let app: AppContext;

  test.beforeEach(async ({ browser }) => {
    app = await createApp(browser);
    const user = makeUser("hw8");
    await registerUserViaApi(app.context.request, user);
    await app.profilePage.goto();
  });

  test.afterEach(async () => {
    await cleanupUsersViaApi([app.context]);
  });

  test("имя: вводим новое и сохраняем", async () => {
    const newName = `Тимур Тестович ${Date.now()}`;

    await test.step("Заполняем поле и сохраняем", async () => {
      await app.profilePage.saveProfile({ name: newName });
    });

    await test.step("После перезагрузки имя пришло с сервера", async () => {
      await app.page.reload();
      await expect(app.profilePage.nameInput).toHaveValue(newName);
    });
  });

  test("часовой пояс: выбираем из списка", async () => {
    const timezone = "Asia/Yekaterinburg";

    await test.step("Выбираем часовой пояс и сохраняем", async () => {
      await expect(app.profilePage.timezoneSelect).toHaveValue("Europe/Moscow");
      await app.profilePage.saveProfile({ timezone });
    });

    await test.step("После перезагрузки выбран новый пояс", async () => {
      await app.page.reload();
      await expect(app.profilePage.timezoneSelect).toHaveValue(timezone);
    });
  });

  test("telegram: заполняем пустое поле", async () => {
    const telegram = `@qa_timur_cat${Date.now()}`;

    await test.step("Заполняем Telegram и сохраняем", async () => {
      await expect(app.profilePage.telegramInput).toHaveValue("");
      await app.profilePage.saveProfile({ telegram });
    });

    await test.step("После перезагрузки Telegram пришёл с сервера", async () => {
      await app.page.reload();
      await expect(app.profilePage.telegramInput).toHaveValue(telegram);
    });
  });

  test("о себе: заполняем многострочное поле", async () => {
    const bio = `QA-инженер, прогон ${Date.now()}. Пытаюсь разобраться в Playwright.`;

    await test.step("Заполняем «О себе» и сохраняем", async () => {
      await app.profilePage.saveProfile({ bio });
    });

    await test.step("После перезагрузки текст пришёл с сервера", async () => {
      await app.page.reload();
      await expect(app.profilePage.bioInput).toHaveValue(bio);
    });
  });

  test("навык: заполняем, выбираем тип и добавляем", async () => {
    const skillTag = `Playwright-demo-${Date.now()}`;

    await test.step("Добавляем навык «могу помочь»", async () => {
      await app.profilePage.addSkill(skillTag, "can_help");
    });

    await test.step("Навык появился в блоке «могу помочь»", async () => {
      await expect(app.profilePage.skillItem(skillTag, "can_help")).toBeVisible();
    });
  });

  test("негатив: пустой навык не добавляется", async () => {
    await test.step("Жмём «Добавить», не заполнив поле", async () => {
      await expect(app.profilePage.skillInput).toHaveValue("");
      await app.profilePage.submitEmptySkill();
    });

    await test.step("Ни одного навыка не появилось", async () => {
      await expect(app.page.locator("[data-skill-tag]")).toHaveCount(0);
      await expect(app.page.getByTestId("can-help-skills")).not.toBeVisible();
    });
  });

  test("негатив: навык «хочу разобрать» не попадает в блок «могу помочь»", async () => {
    const runId = Date.now();
    const canHelpTag = `CanHelp-${runId}`;
    const wantToLearnTag = `WantToLearn-${runId}`;

    await test.step("Добавляем навык «могу помочь»", async () => {
      await app.profilePage.addSkill(canHelpTag, "can_help");
      await expect(app.profilePage.skillItem(canHelpTag, "can_help")).toBeVisible();
    });

    await test.step("Добавляем навык «хочу разобрать»", async () => {
      await app.profilePage.addSkill(wantToLearnTag, "want_to_learn");
      await expect(app.profilePage.skillItem(wantToLearnTag, "want_to_learn")).toBeVisible();
    });

    await test.step("Навыки разошлись по своим блокам", async () => {
      await expect(app.page.locator("[data-skill-tag]")).toHaveCount(2);
      await expect(app.page.getByTestId("can-help-skills")).toContainText(canHelpTag);
      await expect(app.page.getByTestId("can-help-skills")).not.toContainText(wantToLearnTag);
    });
  });

  test("негатив: незасохранённое изменение имени не остаётся после перезагрузки", async () => {
    const originalName = await app.profilePage.nameInput.inputValue();
    const notSavedName = `Не сохранено ${Date.now()}`;

    await test.step("Меняем имя, но не жмём «Сохранить»", async () => {
      await app.profilePage.nameInput.fill(notSavedName);
      await expect(app.profilePage.nameInput).toHaveValue(notSavedName);
    });

    await test.step("После перезагрузки старое значение вернулось с сервера", async () => {
      await app.page.reload();
      await expect(app.profilePage.nameInput).not.toHaveValue(notSavedName);
      await expect(app.profilePage.nameInput).toHaveValue(originalName);
    });
  });

  test("форма профиля: три поля сохраняются за один раз", async () => {
    const runId = Date.now();
    const name = `Тимур Тестовый ${runId}`;
    const telegram = `@qa_timur_${runId}`;
    const bio = `QA-инженер, прогон ${runId}. Проверяю форму профиля целиком.`;

    await test.step("Заполняем Имя, Telegram и «О себе», сохраняем разом", async () => {
      await app.profilePage.saveProfile({ name, telegram, bio });
    });

    await test.step("После перезагрузки все три значения пришли с сервера", async () => {
      await app.page.reload();
      await expect.soft(app.profilePage.nameInput).toHaveValue(name);
      await expect.soft(app.profilePage.telegramInput).toHaveValue(telegram);
      await expect.soft(app.profilePage.bioInput).toHaveValue(bio);
    });
  });
});

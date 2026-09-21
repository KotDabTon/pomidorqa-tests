import { test, expect } from "@playwright/test";
import { createApp } from "../helpers/booking";
import {
  makeUser,
  registerUserViaApi,
  cleanupUsersViaApi,
  deleteCurrentTestUser,
} from "../helpers/user";

test("После регистрации у участника имя из формы и часовой пояс Europe/Moscow", async ({
  browser,
}) => {
  const app = await createApp(browser);
  const user = makeUser("default-timezone");

  try {
    await test.step("Arrange: регистрируем участника через API", async () => {
      await registerUserViaApi(app.context.request, user);
    });

    await test.step("Открываем профиль", async () => {
      await app.profilePage.goto();
    });

    await test.step("Имя пришло из формы регистрации, пояс — Europe/Moscow", async () => {
      await expect(app.profilePage.nameInput).toHaveValue(user.name);
      await expect(app.profilePage.timezoneSelect).toHaveValue("Europe/Moscow");
    });
  } finally {
    await cleanupUsersViaApi([app.context]);
  }
});

test("Выход закрывает сессию: приватная страница снова требует входа", async ({ browser }) => {
  const app = await createApp(browser);
  const user = makeUser("logout-check");

  try {
    await test.step("Arrange: регистрируем участника через API", async () => {
      await registerUserViaApi(app.context.request, user);
    });

    await test.step("Открываем профиль — сессия активна", async () => {
      await app.profilePage.goto();
      await expect(app.profilePage.nameInput).toBeVisible();
    });

    await test.step("Удаляем тестовый аккаунт, пока сессия ещё активна", async () => {
      await deleteCurrentTestUser(app.context);
    });

    await test.step("Нажимаем «Выйти»", async () => {
      await app.profilePage.logout();
    });

    await test.step("Повторный переход на профиль требует входа", async () => {
      await app.profilePage.goto();
      await expect(app.page).toHaveURL(/\/pomidorqa\/auth\/login/);
    });
  } finally {
    await app.context.close();
  }
});

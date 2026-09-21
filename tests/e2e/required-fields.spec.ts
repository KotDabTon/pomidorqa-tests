import { test, expect } from "@playwright/test";
import { createApp } from "../helpers/booking";
import {
  makeUser,
  registerUserViaApi,
  cleanupUsersViaApi,
  submitEmptyRegistrationForm,
} from "../helpers/user";

test("Регистрация с пустыми полями не создаёт аккаунт", async ({ page }) => {
  await test.step("Отправляем форму регистрации без заполнения", async () => {
    await submitEmptyRegistrationForm(page);
  });

  await test.step("Остаёмся на странице регистрации — аккаунт не создан", async () => {
    await expect(page).toHaveURL(/\/pomidorqa\/auth\/register/);
  });
});

test("Пустое имя не сохраняется в профиле", async ({ browser }) => {
  const app = await createApp(browser);
  const user = makeUser("empty-name");

  try {
    await test.step("Arrange: регистрируем участника и открываем профиль", async () => {
      await registerUserViaApi(app.context.request, user);
      await app.profilePage.goto();
    });

    await test.step("Пытаемся сохранить профиль с пустым именем", async () => {
      await app.profilePage.saveProfile({ name: "" }).catch(() => undefined);
    });

    await test.step("После перезагрузки имя осталось прежним, не пустым", async () => {
      await app.profilePage.goto();
      await expect(app.profilePage.nameInput).toHaveValue(user.name);
    });
  } finally {
    await cleanupUsersViaApi([app.context]);
  }
});

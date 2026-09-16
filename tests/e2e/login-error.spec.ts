import { test, expect } from "@playwright/test";
import { createApp } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

test("вход с неверными данными — одинаковая ошибка в обоих случаях, без уточнения причины", async ({
  browser,
}) => {
  const app = await createApp(browser);

  try {
    const runId = Date.now();
    const user = makeUser("login-check");
    const wrongPassword = "wrong-password";

    await test.step("Arrange: заводим реальный аккаунт через API", async () => {
      await registerUserViaApi(app.context.request, user);
    });

    let wrongPasswordError = "";
    await test.step("Пробуем войти с верным email, но неверным паролем", async () => {
      await app.page.goto("/pomidorqa/auth/login");
      await app.page.getByLabel("Email").fill(user.email);
      await app.page.getByLabel("Пароль").fill(wrongPassword);
      await app.page.getByRole("button", { name: "Войти" }).click();
      const error = app.page.getByText(/Неверный/);
      await expect(error).toBeVisible();
      wrongPasswordError = (await error.textContent())?.trim() ?? "";
    });

    let unknownEmailError = "";
    await test.step("Пробуем войти с несуществующим email", async () => {
      await app.page.goto("/pomidorqa/auth/login");
      await app.page.getByLabel("Email").fill(`no-such-user-${runId}@example.com`);
      await app.page.getByLabel("Пароль").fill("any-password-123");
      await app.page.getByRole("button", { name: "Войти" }).click();
      const error = app.page.getByText(/Неверный/);
      await expect(error).toBeVisible();
      unknownEmailError = (await error.textContent())?.trim() ?? "";
    });

    await test.step("Проверяем: текст ошибки одинаковый в обоих случаях — не раскрывает, что именно неверно", async () => {
      expect(wrongPasswordError).toBe(unknownEmailError);
      expect(wrongPasswordError).toContain("Неверный");
    });
  } finally {
    await cleanupUsersViaApi([app.context]);
  }
});

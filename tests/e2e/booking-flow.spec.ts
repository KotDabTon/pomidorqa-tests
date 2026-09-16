import { test, expect } from "@playwright/test";
import { createApp, prepareHostParticipant, type AppContext } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

test("основной путь + гонка за слот: регистрация → навык → слот → поиск в каталоге → бронирование → «Мои встречи» у обоих → второй гость видит ошибку", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const skillTag = `Playwright-demo-${Date.now()}`;
  const guest = makeUser("guest");
  const guest2 = makeUser("guest2");

  const hostApp = await createApp(browser);
  const guestApp = await createApp(browser);
  const guest2App = await createApp(browser);
  const apps: AppContext[] = [hostApp, guestApp, guest2App];

  try {
    const host = await test.step(
      "Arrange: хост зарегистрирован через API, добавляет навык и слот",
      () => prepareHostParticipant(hostApp, "host", skillTag, "12:00"),
    );

    await test.step("Arrange: гость и гость2 зарегистрированы через API", async () => {
      await registerUserViaApi(guestApp.context.request, guest);
      await registerUserViaApi(guest2App.context.request, guest2);
    });

    await test.step("Гость: ищет хоста в каталоге по навыку (сценарий 9)", async () => {
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skillTag);
      await expect(guestApp.bookingPage.personCard(host.name)).toBeVisible();
    });

    await test.step("Гость: открывает карточку хоста и выбирает слот", async () => {
      await guestApp.bookingPage.openHostCard(host.name);
      await expect(guestApp.bookingPage.personName).toHaveText(host.name);
      await guestApp.bookingPage.selectFirstSlot();
    });

    await test.step("Гость2: тоже открывает окно бронирования на тот же слот", async () => {
      await guest2App.bookingPage.goToCatalog();
      await guest2App.bookingPage.searchCatalog(skillTag);
      await guest2App.bookingPage.openHostCard(host.name);
      await expect(guest2App.bookingPage.personName).toHaveText(host.name);
      await guest2App.bookingPage.selectFirstSlot();
    });

    await test.step("Гость: подтверждает бронирование первым — успех", async () => {
      await guestApp.bookingPage.confirmBooking();
      const success = guestApp.bookingPage.bookingConfirmSuccess;
      const error = guestApp.bookingPage.bookingConfirmError;
      await expect(success.or(error)).toBeVisible({ timeout: 15_000 });
      if (await error.isVisible().catch(() => false)) {
        throw new Error(`Бронирование не удалось: ${await error.textContent()}`);
      }
    });

    await test.step("Гость2: пытается забронировать тот же слот вторым — видит ошибку", async () => {
      await guest2App.bookingPage.confirmOpenedBooking();
      const success2 = guest2App.bookingPage.bookingConfirmSuccess;
      const error2 = guest2App.bookingPage.bookingConfirmError;
      await expect(success2.or(error2)).toBeVisible({ timeout: 15_000 });

      if (await success2.isVisible().catch(() => false)) {
        throw new Error("Слот должен был быть занят, но бронирование прошло успешно");
      }
      await expect(error2).toBeVisible();
    });

    await test.step("Гость: видит бронирование в разделе «Мои встречи»", async () => {
      await expect(async () => {
        await guestApp.bookingPage.gotoBookings();
        await expect(guestApp.bookingPage.bookingCardByName(host.name)).toBeVisible();
      }).toPass({ timeout: 10_000 });
    });

    await test.step("Хост: тоже видит это бронирование в своих «Мои встречи»", async () => {
      await expect(async () => {
        await hostApp.bookingPage.gotoBookings();
        await expect(hostApp.bookingPage.bookingCardByName(guest.name)).toBeVisible();
      }).toPass({ timeout: 10_000 });
    });
  } finally {
    await cleanupUsersViaApi(apps.map((app) => app.context));
  }
});

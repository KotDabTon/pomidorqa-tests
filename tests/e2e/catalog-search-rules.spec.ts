import { test, expect } from "@playwright/test";
import { createApp } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";
import { BookingPage } from "../pages/booking-page";

test.describe("Каталог: область поиска по навыку", () => {
  test("Поиск не находит участника по навыку из раздела «хочу разобрать»", async ({ browser }) => {
    test.setTimeout(60_000);

    test.fail(
      true,
      "Каталог ищет по обоим типам навыков вместо только «могу помочь» — известный дефект продукта",
    );

    const hostApp = await createApp(browser);
    const guestApp = await createApp(browser);

    try {
      const skill = `WantOnly-${Date.now()}`;
      const host = makeUser("want-only-host");

      await test.step("Хост регистрируется, добавляет навык «хочу разобрать» и слот", async () => {
        await registerUserViaApi(hostApp.context.request, host);
        await hostApp.profilePage.goto();
        await hostApp.profilePage.addSkill(skill, "want_to_learn");
        await hostApp.slotsPage.goto();
        await hostApp.slotsPage.addSlot("12:00");
      });

      await test.step("Гость ищет этот навык в каталоге", async () => {
        await guestApp.bookingPage.goToCatalog();
        await guestApp.bookingPage.searchCatalog(skill);
      });

      await test.step("Хост не найден — навык относится к «хочу разобрать», а не к «могу помочь»", async () => {
        await expect(guestApp.bookingPage.personCard(host.name)).toHaveCount(0);
      });
    } finally {
      await cleanupUsersViaApi([hostApp.context, guestApp.context]);
    }
  });

  test("Неизвестный навык — пустая выдача", async ({ page }) => {
    const bookingPage = new BookingPage(page);

    await test.step("Открываем каталог", async () => {
      await bookingPage.goToCatalog();
    });

    await test.step("Ищем заведомо несуществующий навык", async () => {
      await bookingPage.searchCatalog(`NoSuchSkill-${Date.now()}`);
    });

    await test.step("Список участников пуст", async () => {
      await expect(bookingPage.personCards).toHaveCount(0);
    });
  });
});

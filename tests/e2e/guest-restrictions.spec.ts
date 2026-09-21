import { test, expect } from "@playwright/test";
import { createApp, prepareHostParticipant } from "../helpers/booking";
import { cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { BookingPage } from "../pages/booking-page";

test.describe("Гость: доступ к приватным страницам", () => {
  test("прямой переход на профиль, слоты и «Мои встречи» требует входа", async ({ page }) => {
    for (const route of [ROUTES.profile, ROUTES.slots, ROUTES.bookings]) {
      await test.step(`Переход на ${route} перенаправляет неавторизованного гостя на вход`, async () => {
        await page.goto(route);
        await expect(page).toHaveURL(/\/pomidorqa\/auth\/login/);
      });
    }
  });
});

test("Гость не может забронировать слот без входа в аккаунт", async ({ browser }) => {
  test.setTimeout(60_000);
  const skillTag = `GuestBook-${Date.now()}`;
  const hostApp = await createApp(browser);
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  const guestBooking = new BookingPage(guestPage);

  try {
    const host = await test.step(
      "Arrange: хост зарегистрирован через API, добавляет навык и слот",
      () => prepareHostParticipant(hostApp, "guest-book-host", skillTag, "18:00"),
    );

    await test.step("Гость (без регистрации) находит хоста в каталоге и открывает его карточку", async () => {
      await guestBooking.goToCatalog();
      await guestBooking.searchCatalog(skillTag);
      await guestBooking.openHostCard(host.name);
    });

    let redirectedToLogin = false;
    let bookingBlocked = false;
    let bookingSucceeded = false;

    await test.step("Гость пытается выбрать слот и подтвердить бронь", async () => {
      await guestBooking.selectFirstSlot().catch(() => undefined);
      await guestBooking.confirmBooking().catch(() => undefined);
    });

    await test.step("Ждём, пока запрос на бронирование завершится", async () => {
      await Promise.race([
        guestBooking.bookingConfirmError
          .waitFor({ state: "visible", timeout: 10_000 })
          .catch(() => undefined),
        guestBooking.bookingConfirmSuccess
          .waitFor({ state: "visible", timeout: 10_000 })
          .catch(() => undefined),
        guestPage
          .waitForURL(/\/pomidorqa\/auth\/login/, { timeout: 10_000 })
          .catch(() => undefined),
      ]);
    });

    await test.step("Бронь не создаётся: либо блокировка, либо редирект на вход", async () => {
      redirectedToLogin = /\/pomidorqa\/auth\/login/.test(guestPage.url());
      bookingBlocked = await guestBooking.bookingConfirmError.isVisible().catch(() => false);
      bookingSucceeded = await guestBooking.bookingConfirmSuccess
        .isVisible()
        .catch(() => false);

      expect(bookingSucceeded).toBe(false);
      expect(redirectedToLogin || bookingBlocked).toBe(true);
    });
  } finally {
    await cleanupUsersViaApi([hostApp.context]);
    await guestContext.close();
  }
});

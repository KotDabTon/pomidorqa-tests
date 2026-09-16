import { test, expect } from "@playwright/test";
import { createApp, prepareHostParticipant } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

test("гость отменяет бронирование: карточка переходит в прошедшие, отмену видят оба после reload", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const skillTag = `Playwright-cancel-${Date.now()}`;
  const guest = makeUser("guest-cancel");

  const hostApp = await createApp(browser);
  const guestApp = await createApp(browser);

  try {
    const host = await test.step(
      "Arrange: хост зарегистрирован через API, добавляет навык и слот",
      () => prepareHostParticipant(hostApp, "host-cancel", skillTag, "15:00"),
    );

    await test.step("Arrange: гость зарегистрирован через API", async () => {
      await registerUserViaApi(guestApp.context.request, guest);
    });

    await test.step("Гость: находит хоста в каталоге по навыку", async () => {
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skillTag);
      await expect(guestApp.bookingPage.personCard(host.name)).toBeVisible();
    });

    await test.step("Гость: бронирует слот у хоста", async () => {
      await guestApp.bookingPage.openHostCard(host.name);
      await guestApp.bookingPage.selectFirstSlot();
      await guestApp.bookingPage.confirmBooking();
      const success = guestApp.bookingPage.bookingConfirmSuccess;
      const error = guestApp.bookingPage.bookingConfirmError;
      await expect(success.or(error)).toBeVisible({ timeout: 15_000 });
      if (await error.isVisible().catch(() => false)) {
        throw new Error(`Бронирование не удалось: ${await error.textContent()}`);
      }
    });

    await test.step("Гость: видит бронирование среди предстоящих встреч", async () => {
      await expect(async () => {
        await guestApp.bookingPage.gotoBookings();
        await expect(guestApp.bookingPage.bookingCardByName(host.name)).toBeVisible();
      }).toPass({ timeout: 15_000 });
    });

    await test.step("Гость: отменяет встречу", async () => {
      await guestApp.bookingPage.cancelBooking(host.name);
    });

    await test.step("У гостя карточка появилась в прошедших с пометкой «отменено»", async () => {
      const pastCard = guestApp.bookingPage.pastCardByName(host.name);
      await expect(pastCard).toBeVisible();
      await expect(pastCard).toContainText("отменено");
    });

    await test.step("После перезагрузки гость по-прежнему видит отмену", async () => {
      await guestApp.page.reload();
      const pastCardAfterReload = guestApp.bookingPage.pastCardByName(host.name);
      await expect(pastCardAfterReload).toBeVisible();
      await expect(pastCardAfterReload).toContainText("отменено");
    });

    await test.step("Хост: открывает свои встречи и видит отменённую встречу именно с этим гостем", async () => {
      await hostApp.bookingPage.gotoBookings();
      const hostPastCard = hostApp.bookingPage.pastCardByName(guest.name);
      await expect(hostPastCard).toBeVisible();
      await expect(hostPastCard).toContainText("отменено");
    });
  } finally {
    await cleanupUsersViaApi([hostApp.context, guestApp.context]);
  }
});

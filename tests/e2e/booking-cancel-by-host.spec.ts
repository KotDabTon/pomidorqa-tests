import { test, expect } from "@playwright/test";
import { createApp, prepareHostParticipant, type AppContext } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

test("Хост отменяет встречу: слот освобождается и его бронирует другой участник", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const skillTag = `HostCancel-${Date.now()}`;
  const guest = makeUser("host-cancel-guest");
  const secondGuest = makeUser("host-cancel-guest-2");

  const hostApp = await createApp(browser);
  const guestApp = await createApp(browser);
  const secondGuestApp = await createApp(browser);
  const apps: AppContext[] = [hostApp, guestApp, secondGuestApp];

  try {
    const host = await test.step(
      "Arrange: хост зарегистрирован через API, добавляет навык и слот",
      () => prepareHostParticipant(hostApp, "host-cancel-by-host", skillTag, "17:00"),
    );

    await test.step("Arrange: гость регистрируется и бронирует слот хоста", async () => {
      await registerUserViaApi(guestApp.context.request, guest);
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skillTag);
      await guestApp.bookingPage.openHostCard(host.name);
      await guestApp.bookingPage.selectFirstSlot();
      await guestApp.bookingPage.confirmBooking();
      await expect(guestApp.bookingPage.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Хост (не гость) отменяет встречу", async () => {
      await hostApp.bookingPage.gotoBookings();
      await hostApp.bookingPage.cancelBooking(guest.name);
    });

    await test.step("У гостя встреча тоже перешла в прошедшие с пометкой «отменено»", async () => {
      await guestApp.bookingPage.gotoBookings();
      const pastCard = guestApp.bookingPage.pastCardByName(host.name);

      await expect(pastCard).toBeVisible();
      await expect(pastCard).toContainText("отменено");
    });

    await test.step("В «Прошедших» у отменённой встречи нет кнопки «Отменить»", async () => {
      const pastCard = guestApp.bookingPage.pastCardByName(host.name);

      await expect(guestApp.bookingPage.cancelButtonIn(pastCard)).toHaveCount(0);
    });

    await test.step("Слот снова свободен: второй гость успешно его бронирует", async () => {
      await registerUserViaApi(secondGuestApp.context.request, secondGuest);
      await secondGuestApp.bookingPage.goToCatalog();
      await secondGuestApp.bookingPage.searchCatalog(skillTag);
      await secondGuestApp.bookingPage.openHostCard(host.name);
      await secondGuestApp.bookingPage.selectFirstSlot();
      await secondGuestApp.bookingPage.confirmBooking();
      await expect(secondGuestApp.bookingPage.bookingConfirmSuccess).toBeVisible({
        timeout: 15_000,
      });
    });
  } finally {
    await cleanupUsersViaApi(apps.map((app) => app.context));
  }
});

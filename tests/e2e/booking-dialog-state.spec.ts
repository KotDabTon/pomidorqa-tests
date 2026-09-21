import { test, expect } from "@playwright/test";
import { createApp, prepareHostParticipant, type AppContext } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

test("Забронированный слот не предлагается для новой брони", async ({ browser }) => {
  test.setTimeout(90_000);
  const skillTag = `BookedHidden-${Date.now()}`;
  const guest = makeUser("booked-hidden-guest");
  const viewer = makeUser("booked-hidden-viewer");

  const hostApp = await createApp(browser);
  const guestApp = await createApp(browser);
  const viewerApp = await createApp(browser);
  const apps: AppContext[] = [hostApp, guestApp, viewerApp];

  try {
    const host = makeUser("booked-hidden-host");

    await test.step("Arrange: хост регистрируется, добавляет навык и два свободных слота", async () => {
      await registerUserViaApi(hostApp.context.request, host);
      await hostApp.profilePage.goto();
      await hostApp.profilePage.addSkill(skillTag, "can_help");
      await hostApp.slotsPage.goto();
      await hostApp.slotsPage.addSlot("19:00");
      await hostApp.slotsPage.addSlot("20:00");
    });

    await test.step("Гость регистрируется и бронирует первый слот", async () => {
      await registerUserViaApi(guestApp.context.request, guest);
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skillTag);
      await guestApp.bookingPage.openHostCard(host.name);
      await guestApp.bookingPage.selectFirstSlot();
      await guestApp.bookingPage.confirmBooking();
      await expect(guestApp.bookingPage.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Третий участник открывает страницу хоста и видит только один доступный слот", async () => {
      await registerUserViaApi(viewerApp.context.request, viewer);
      await viewerApp.bookingPage.goToCatalog();
      await viewerApp.bookingPage.searchCatalog(skillTag);
      await viewerApp.bookingPage.openHostCard(host.name);

      const availableCount = await viewerApp.bookingPage.availableSlotTimesCount();

      expect(availableCount).toBe(1);
    });
  } finally {
    await cleanupUsersViaApi(apps.map((app) => app.context));
  }
});

test("Закрытие окна подтверждения не создаёт бронь", async ({ browser }) => {
  test.setTimeout(60_000);
  const skillTag = `CloseDialog-${Date.now()}`;
  const guest = makeUser("close-dialog-guest");

  const hostApp = await createApp(browser);
  const guestApp = await createApp(browser);

  try {
    const host = await test.step(
      "Arrange: хост зарегистрирован через API, добавляет навык и слот",
      () => prepareHostParticipant(hostApp, "close-dialog-host", skillTag, "21:00"),
    );

    await test.step("Гость регистрируется, открывает диалог бронирования и закрывает его без подтверждения", async () => {
      await registerUserViaApi(guestApp.context.request, guest);
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skillTag);
      await guestApp.bookingPage.openHostCard(host.name);
      await guestApp.bookingPage.selectFirstSlot();
      await guestApp.bookingPage.closeBookingDialog();
    });

    await test.step("У гостя нет ни одной встречи с этим хостом", async () => {
      await guestApp.bookingPage.gotoBookings();
      await expect(guestApp.bookingPage.bookingCardByName(host.name)).toHaveCount(0);
    });
  } finally {
    await cleanupUsersViaApi([hostApp.context, guestApp.context]);
  }
});

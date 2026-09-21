import { test, expect } from "@playwright/test";
import { createApp } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

function nearFutureMoscowSlot(minutesFromNow: number): { date: string; time: string } {
  const target = new Date(Date.now() + minutesFromNow * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(target);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
}

test("Отменить встречу позже чем за 2 часа до начала нельзя", async ({ browser }) => {
  test.setTimeout(120_000);
  const skillTag = `CancelWindow-${Date.now()}`;
  const host = makeUser("cancel-window-host");
  const guest = makeUser("cancel-window-guest");
  const { date, time } = nearFutureMoscowSlot(90);

  const hostApp = await createApp(browser);
  const guestApp = await createApp(browser);

  try {
    await test.step("Arrange: хост регистрируется, добавляет навык и слот менее чем через 2 часа", async () => {
      await registerUserViaApi(hostApp.context.request, host);
      await hostApp.profilePage.goto();
      await hostApp.profilePage.addSkill(skillTag, "can_help");
      await hostApp.slotsPage.goto();
      await hostApp.slotsPage.addSlot(time, date);
    });

    await test.step("Arrange: гость регистрируется и бронирует этот слот", async () => {
      await registerUserViaApi(guestApp.context.request, guest);
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skillTag);
      await guestApp.bookingPage.openHostCard(host.name);
      await guestApp.bookingPage.selectFirstSlot();
      await guestApp.bookingPage.confirmBooking();
      await expect(guestApp.bookingPage.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Гость пытается отменить встречу", async () => {
      await guestApp.bookingPage.gotoBookings();
      await guestApp.bookingPage.clickCancel(host.name);
    });

    await test.step("Встреча остаётся среди предстоящих — отмена не прошла", async () => {
      await expect(guestApp.bookingPage.bookingCardByName(host.name)).toBeVisible();
    });
  } finally {
    await cleanupUsersViaApi([hostApp.context, guestApp.context]);
  }
});

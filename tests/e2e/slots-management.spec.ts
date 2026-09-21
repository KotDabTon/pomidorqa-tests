import { test, expect } from "@playwright/test";
import { createApp, prepareHostParticipant, type AppContext } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

test.describe("Слоты: удаление", () => {
  let app: AppContext;

  test.beforeEach(async ({ browser }) => {
    app = await createApp(browser);
    const user = makeUser("slot-delete");
    await registerUserViaApi(app.context.request, user);
    await app.slotsPage.goto();
  });

  test.afterEach(async () => {
    await cleanupUsersViaApi([app.context]);
  });

  test("Свободный слот удаляется и не остаётся в списке", async () => {
    let slotId = "";

    await test.step("Создаём свободный слот", async () => {
      slotId = await app.slotsPage.addSlot("11:00");
    });

    await test.step("Удаляем слот", async () => {
      await app.slotsPage.removeSlot(slotId);
    });

    await test.step("Карточки слота больше нет на странице", async () => {
      await expect(app.slotsPage.slotCard(slotId)).toHaveCount(0);
    });
  });
});

test("У забронированного слота нет кнопки «Удалить»", async ({ browser }) => {
  test.setTimeout(60_000);
  const skillTag = `NoDelete-${Date.now()}`;
  const guest = makeUser("no-delete-guest");

  const hostApp = await createApp(browser);
  const guestApp = await createApp(browser);

  try {
    const host = await test.step(
      "Arrange: хост зарегистрирован через API, добавляет навык и слот",
      () => prepareHostParticipant(hostApp, "no-delete-host", skillTag, "16:00"),
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

    await test.step("У хоста на странице слотов нет кнопки «Удалить» для этого слота", async () => {
      await hostApp.slotsPage.goto();
      const bookedSlot = hostApp.slotsPage.bookedSlots;

      await expect(bookedSlot).toBeVisible();
      await expect(hostApp.slotsPage.deleteButtonIn(bookedSlot)).toHaveCount(0);
    });
  } finally {
    await cleanupUsersViaApi([hostApp.context, guestApp.context]);
  }
});

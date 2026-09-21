import { test, expect } from "@playwright/test";
import { createApp } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);

  return date.toISOString().slice(0, 10);
}

test("Нельзя создать слот с датой в прошлом", async ({ browser }) => {
  const app = await createApp(browser);
  const user = makeUser("slot-in-past");

  try {
    let before = 0;

    await test.step("Arrange: регистрируем участника", async () => {
      await registerUserViaApi(app.context.request, user);
      await app.slotsPage.goto();
      before = await app.slotsPage.slotCount();
    });

    await test.step("Пытаемся создать слот на вчерашний день", async () => {
      await app.slotsPage.attemptAddSlot("10:00", yesterday());
    });

    await test.step("Число слотов не увеличилось — слот в прошлом не создан", async () => {
      await expect.poll(() => app.slotsPage.slotCount()).toBe(before);
    });
  } finally {
    await cleanupUsersViaApi([app.context]);
  }
});

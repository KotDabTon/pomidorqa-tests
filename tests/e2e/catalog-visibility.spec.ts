import { test, expect } from "@playwright/test";
import { createApp } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

test("Участник без свободных слотов не отображается в каталоге", async ({ browser }) => {
  const skillTag = `NoSlots-${Date.now()}`;
  const host = makeUser("no-slots-host");

  const hostApp = await createApp(browser);
  const guestApp = await createApp(browser);

  try {
    await test.step("Arrange: хост регистрируется и добавляет навык, но не добавляет ни одного слота", async () => {
      await registerUserViaApi(hostApp.context.request, host);
      await hostApp.profilePage.goto();
      await hostApp.profilePage.addSkill(skillTag, "can_help");
    });

    await test.step("Гость ищет этот навык в каталоге", async () => {
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skillTag);
    });

    await test.step("Хост без свободных слотов не найден в выдаче", async () => {
      await expect(guestApp.bookingPage.personCard(host.name)).toHaveCount(0);
    });
  } finally {
    await cleanupUsersViaApi([hostApp.context, guestApp.context]);
  }
});

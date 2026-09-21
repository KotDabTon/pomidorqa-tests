import { test, expect } from "@playwright/test";
import { createApp, type AppContext } from "../helpers/booking";
import { makeUser, registerUserViaApi, cleanupUsersViaApi } from "../helpers/user";

test("Время слота одинаково для хоста и для гостя с другим часовым поясом", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const skillTag = `Timezone-${Date.now()}`;
  const slotTime = "14:00";
  const host = makeUser("timezone-host");
  const guest = makeUser("timezone-guest");

  const hostApp = await createApp(browser);
  const guestApp = await createApp(browser);
  const apps: AppContext[] = [hostApp, guestApp];

  try {
    let slotId = "";

    await test.step("Arrange: хост регистрируется (пояс по умолчанию Europe/Moscow), добавляет навык и слот на 14:00", async () => {
        await registerUserViaApi(hostApp.context.request, host);
        await hostApp.profilePage.goto();
        await hostApp.profilePage.addSkill(skillTag, "can_help");
        await hostApp.slotsPage.goto();
        slotId = await hostApp.slotsPage.addSlot(slotTime);
      },
    );

    await test.step("Хост у себя видит слот на 14:00 — как ввёл", async () => {
      await expect(hostApp.slotsPage.slotCard(slotId)).toContainText(slotTime);
    });

    await test.step("Arrange: гость регистрируется и явно меняет себе часовой пояс на другой (Asia/Vladivostok)", async () => {
        await registerUserViaApi(guestApp.context.request, guest);
        await guestApp.profilePage.goto();
        await guestApp.profilePage.saveProfile({ timezone: "Asia/Vladivostok" });
      },
    );

    await test.step("Гость находит хоста в каталоге и открывает его карточку", async () => {
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skillTag);
      await guestApp.bookingPage.openHostCard(host.name);
    });

    await test.step("Гость видит тот же слот 14:00 — время хоста, а не пересчитанное в свой пояс", async () => {
        const time = await guestApp.bookingPage.firstAvailableSlotTime();

        expect(time).toContain(slotTime);
      },
    );
  } finally {
    await cleanupUsersViaApi(apps.map((app) => app.context));
  }
});

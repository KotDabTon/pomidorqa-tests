import { test, expect } from "@playwright/test";
import { createApp, prepareHostParticipant } from "../helpers/booking";
import { cleanupUsersViaApi } from "../helpers/user";

test.describe("PomidorQA: поиск участников", () => {
  test("Гость находит участника по уникальному навыку", async ({ browser }) => {
    const hostApp = await createApp(browser);
    const guestApp = await createApp(browser);

    try {
      const skill = `Search-${Date.now()}`;
      const host = await prepareHostParticipant(hostApp, "host", skill);

      await test.step("Гость: открывает каталог PomidorQA", async () => {
        await guestApp.bookingPage.goToCatalog();
      });

      await test.step(`Гость: ищет участника по навыку «${skill}»`, async () => {
        await guestApp.bookingPage.searchCatalog(skill);
      });

      await test.step("В выдаче отображается подходящий участник", async () => {
        const card = guestApp.bookingPage.personCard(host.name);

        await expect(card).toHaveCount(1);
        await expect(card).toBeVisible();
      });
    } finally {
      await cleanupUsersViaApi([hostApp.context, guestApp.context]);
    }
  });

  test("Поиск показывает подходящего участника и исключает неподходящего", async ({
    browser,
  }) => {
    test.setTimeout(60_000);

    const firstHostApp = await createApp(browser);
    const secondHostApp = await createApp(browser);
    const guestApp = await createApp(browser);

    try {
      const firstSkill = `Skill-A-${Date.now()}`;
      const secondSkill = `Skill-B-${Date.now()}`;

      const [firstHost, secondHost] = await test.step(
        "Arrange: два независимых хоста регистрируются и добавляют навык со слотом параллельно",
        () =>
          Promise.all([
            prepareHostParticipant(firstHostApp, "host-a", firstSkill, "12:00"),
            prepareHostParticipant(secondHostApp, "host-b", secondSkill, "13:00"),
          ]),
      );

      await test.step("Гость: открывает каталог PomidorQA", async () => {
        await guestApp.bookingPage.goToCatalog();
      });

      await test.step(`Гость: ищет участников по навыку «${firstSkill}»`, async () => {
        await guestApp.bookingPage.searchCatalog(firstSkill);
      });

      await test.step("Подходящий участник присутствует в выдаче", async () => {
        const firstCard = guestApp.bookingPage.personCard(firstHost.name);

        await expect(firstCard).toHaveCount(1);
        await expect(firstCard).toBeVisible();
      });

      await test.step("Участник с другим навыком отсутствует в выдаче", async () => {
        const secondCard = guestApp.bookingPage.personCard(secondHost.name);

        await expect(secondCard).toHaveCount(0);
      });
    } finally {
      await cleanupUsersViaApi([
        firstHostApp.context,
        secondHostApp.context,
        guestApp.context,
      ]);
    }
  });

  test("Авторизованный пользователь не видит собственную карточку, а гость видит", async ({
    browser,
  }) => {
    const hostApp = await createApp(browser);
    const guestApp = await createApp(browser);

    try {
      const skill = `Own-Card-${Date.now()}`;
      const host = await prepareHostParticipant(hostApp, "host", skill);

      await test.step("Авторизованный пользователь: открывает каталог", async () => {
        await hostApp.bookingPage.goToCatalog();
      });

      await test.step(
        `Авторизованный пользователь: ищет свой навык «${skill}»`,
        async () => {
          await hostApp.bookingPage.searchCatalog(skill);
        },
      );

      await test.step("Собственная карточка отсутствует в выдаче", async () => {
        await expect(hostApp.bookingPage.personCard(host.name)).toHaveCount(0);
      });

      await test.step("Гость: открывает каталог", async () => {
        await guestApp.bookingPage.goToCatalog();
      });

      await test.step(`Гость: ищет навык «${skill}»`, async () => {
        await guestApp.bookingPage.searchCatalog(skill);
      });

      await test.step("Гость видит карточку участника", async () => {
        const card = guestApp.bookingPage.personCard(host.name);

        await expect(card).toHaveCount(1);
        await expect(card).toBeVisible();
      });
    } finally {
      await cleanupUsersViaApi([hostApp.context, guestApp.context]);
    }
  });
});
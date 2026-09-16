import {type Browser,type BrowserContext,type Page,} from "@playwright/test";
import { BookingPage } from "../pages/booking-page";
import { ProfilePage } from "../pages/profile-page";
import { SlotsPage } from "../pages/slots-page";
import { makeUser, registerUserViaApi, type TestUser } from "./user";

export type AppContext = {
  context: BrowserContext;
  page: Page;
  bookingPage: BookingPage;
  profilePage: ProfilePage;
  slotsPage: SlotsPage;
};

export async function createApp(browser: Browser): Promise<AppContext> {
  const context = await browser.newContext();
  const page = await context.newPage();

  return {
    context,
    page,
    bookingPage: new BookingPage(page),
    profilePage: new ProfilePage(page),
    slotsPage: new SlotsPage(page),
  };
}

export async function closeApps(apps: readonly AppContext[]): Promise<void> {
  await Promise.all(
    apps.map(async (app) => {
      try {
        await app.context.close();
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`Не удалось закрыть browser context: ${reason}`);
      }
    }),
  );
}

export async function prepareHostParticipant(
  app: AppContext,
  role: string,
  skill: string,
  time = "12:00",
): Promise<TestUser> {
  const user = makeUser(role);

  await registerUserViaApi(app.context.request, user);

  await app.profilePage.goto();
  await app.profilePage.addSkill(skill, "can_help");

  await app.slotsPage.goto();
  await app.slotsPage.addSlot(time);

  return user;
}
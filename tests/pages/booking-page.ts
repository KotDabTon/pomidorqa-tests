import { type Locator, type Page } from "@playwright/test";
import { ROUTES } from "../helpers/user";

export class BookingPage {
  private readonly catalogFilterInput: Locator;
  private readonly catalogFilterButton: Locator;

  readonly personCards: Locator;

  readonly personName: Locator;
  private readonly bookingCalendarDay: Locator;
  private readonly bookingCalendarTime: Locator;
  private readonly bookingConfirmDialog: Locator;
  private readonly bookingConfirmButton: Locator;
  readonly bookingConfirmSuccess: Locator;
  readonly bookingConfirmError: Locator;
  private readonly bookingsUpcomingSection: Locator;
  private readonly bookingsPastSection: Locator;

  constructor(readonly page: Page) {
    this.catalogFilterInput = page.locator("#pomidorqa-catalog-skill-filter");
    this.catalogFilterButton = page.getByRole("button", { name: "Найти" });
    this.personCards = page.getByTestId("person-card");

    this.personName = page.getByRole("heading", { level: 1 });

    this.bookingCalendarDay = page
      .getByRole("group", { name: "Дни со слотами" })
      .getByRole("button");

    this.bookingCalendarTime = page
      .getByRole("group", { name: "Время слотов" })
      .getByRole("button");

    this.bookingConfirmDialog = page.getByRole("dialog");

    this.bookingConfirmButton = page
      .getByRole("dialog")
      .getByRole("button", { name: "Подтвердить" });

    this.bookingConfirmSuccess = page
      .getByRole("dialog")
      .getByRole("status");

    this.bookingConfirmError = page
      .getByRole("dialog")
      .getByRole("alert");

    this.bookingsUpcomingSection = page.getByTestId("upcoming-meetings");

    this.bookingsPastSection = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: "Прошедшие и отменённые",
        }),
      });
  }

  async goToCatalog(): Promise<void> {
    await this.page.goto(ROUTES.catalog);
  }

  async searchCatalog(skillTag: string): Promise<void> {
    await this.catalogFilterInput.fill(skillTag);
    await this.catalogFilterButton.click();
  }

  personCard(name: string): Locator {
    return this.personCards.filter({ hasText: name });
  }

  async openHostCard(hostName: string): Promise<void> {
    await this.personCard(hostName).click();
  }

  async selectFirstSlot(retryTimeoutMs = 15_000): Promise<void> {
    const deadline = Date.now() + retryTimeoutMs;

    for (;;) {
      try {
        await this.bookingCalendarDay.first().click({
          timeout: 5_000,
        });

        await this.bookingCalendarTime.first().click({
          timeout: 5_000,
        });

        await this.bookingConfirmDialog.waitFor({
          state: "visible",
          timeout: 3_000,
        });

        return;
      } catch (error) {
        if (Date.now() > deadline) {
          throw error;
        }
      }
    }
  }

  async confirmBooking(): Promise<void> {
    await this.bookingConfirmButton.click({
      timeout: 10_000,
    });
  }

  async confirmOpenedBooking(): Promise<void> {
    await this.bookingConfirmButton.click({
      timeout: 10_000,
    });
  }

  async gotoBookings(): Promise<void> {
    await this.page.goto(ROUTES.bookings);
  }

  bookingCardByName(participantName: string): Locator {
    return this.bookingsUpcomingSection
      .locator("[data-booking-id]")
      .filter({ hasText: participantName });
  }

  pastCardByName(participantName: string): Locator {
    return this.bookingsPastSection
      .locator("[data-booking-id]")
      .filter({ hasText: participantName });
  }

  async cancelBooking(participantName: string): Promise<void> {
    await this.clickCancel(participantName);

    await this.bookingCardByName(participantName).waitFor({
      state: "hidden",
      timeout: 15_000,
    });
  }

  async clickCancel(participantName: string): Promise<void> {
    const card = this.bookingCardByName(participantName);

    await this.cancelButtonIn(card).click();
  }

  cancelButtonIn(card: Locator): Locator {
    return card.getByRole("button", { name: "Отменить" });
  }

  async firstAvailableSlotTime(): Promise<string> {
    await this.bookingCalendarDay.first().click();
    const text = await this.bookingCalendarTime.first().textContent();

    return (text ?? "").trim();
  }

  async availableSlotTimesCount(): Promise<number> {
    await this.bookingCalendarDay.first().click();

    return this.bookingCalendarTime.count();
  }

  async closeBookingDialog(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }
}
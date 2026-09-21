import { type Locator, type Page } from "@playwright/test";
import { ROUTES } from "../helpers/user";

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  return date.toISOString().slice(0, 10);
}

export class SlotsPage {
  private readonly dateInput: Locator;
  private readonly timeInput: Locator;
  private readonly addSubmitButton: Locator;
  private readonly slotCards: Locator;

  constructor(readonly page: Page) {
    this.dateInput = page.getByTestId("AddSlotForm-date");
    this.timeInput = page.getByTestId("AddSlotForm-time");
    this.addSubmitButton = page.getByTestId("AddSlotForm-submit");
    this.slotCards = page.locator("[data-slot-id]");
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.slots);
  }

  slotCard(slotId: string): Locator {
    return this.page.locator(`[data-slot-id="${slotId}"]`);
  }

  async addSlot(time: string, dateStr?: string): Promise<string> {
    const targetDate = dateStr ?? tomorrow();
    const slotsBefore = await this.slotCards.count();

    await this.dateInput.fill(targetDate);
    await this.timeInput.fill(time);

    const responsePromise = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === ROUTES.slots &&
        response.request().method() === "POST",
      { timeout: 15_000 },
    );

    const [response] = await Promise.all([
      responsePromise,
      this.addSubmitButton.click(),
    ]);

    if (response.status() >= 400) {
      throw new Error(
        `Создание слота завершилось с HTTP ${response.status()} ${response.statusText()}`,
      );
    }

    const newCard = this.slotCards.nth(slotsBefore);
    await newCard.waitFor({ state: "visible", timeout: 10_000 });

    const slotId = await newCard.getAttribute("data-slot-id");
    if (!slotId) {
      throw new Error("У созданной карточки слота нет атрибута data-slot-id");
    }

    return slotId;
  }

  async removeSlot(slotId: string): Promise<void> {
    const card = this.slotCard(slotId);
    await card.getByRole("button", { name: "Удалить" }).click();
    await card.waitFor({ state: "hidden", timeout: 15_000 });
  }

  deleteButton(slotId: string): Locator {
    return this.slotCard(slotId).getByRole("button", { name: "Удалить" });
  }

  get bookedSlots(): Locator {
    return this.page.locator('[data-slot-status="booked"]');
  }

  deleteButtonIn(card: Locator): Locator {
    return card.getByRole("button", { name: "Удалить" });
  }

  async slotCount(): Promise<number> {
    return this.slotCards.count();
  }
  async attemptAddSlot(time: string, dateStr: string): Promise<void> {
    await this.dateInput.fill(dateStr);
    await this.timeInput.fill(time);
    await this.addSubmitButton.click();
  }
}
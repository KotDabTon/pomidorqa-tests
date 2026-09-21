import { type Locator, type Page } from "@playwright/test";
import { ROUTES } from "../helpers/user";

export type SkillType = "can_help" | "want_to_learn";

export class ProfilePage {
  readonly nameInput: Locator;
  readonly telegramInput: Locator;
  readonly timezoneSelect: Locator;
  readonly bioInput: Locator;
  private readonly saveButton: Locator;

  readonly skillInput: Locator;
  private readonly canHelpSkills: Locator;
  private readonly wantToLearnSkills: Locator;
  private readonly skillTypeSelect: Locator;
  private readonly addSkillButton: Locator;

  constructor(readonly page: Page) {
    this.nameInput = page.getByLabel("Имя");
    this.telegramInput = page.getByLabel("Telegram");
    this.timezoneSelect = page.getByLabel("Часовой пояс");
    this.bioInput = page.getByLabel("О себе");
    this.saveButton = page.getByRole("button", { name: "Сохранить" });

    this.skillInput = page.getByLabel("Навык");
    this.canHelpSkills = page.getByTestId("can-help-skills");
    this.wantToLearnSkills = page.locator('[data-skills="want_to_learn"]');
    this.skillTypeSelect = page.getByRole("combobox", { name: "Тип" });
    this.addSkillButton = page.getByRole("button", { name: "Добавить" });
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.profile);
  }

  private async mutation(
    actionName: string,
    action: () => Promise<void>,
  ): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === ROUTES.profile &&
        response.request().method() === "POST",
      { timeout: 15_000 },
    );

    const [response] = await Promise.all([
      responsePromise,
      action(),
    ]);

    if (response.status() >= 400) {
      throw new Error(
        `${actionName} завершилось с HTTP ${response.status()} ${response.statusText()}`,
      );
    }
  }

  async saveProfile(fields: {
    name?: string;
    telegram?: string;
    timezone?: string;
    bio?: string;
  }): Promise<void> {
    if (fields.name !== undefined) {
      await this.nameInput.fill(fields.name);
    }
    if (fields.telegram !== undefined) {
      await this.telegramInput.fill(fields.telegram);
    }
    if (fields.timezone !== undefined) {
      await this.timezoneSelect.selectOption(fields.timezone);
    }
    if (fields.bio !== undefined) {
      await this.bioInput.fill(fields.bio);
    }

    await this.mutation("Сохранение профиля", async () => {
      await this.saveButton.click();
    });
  }

  async logout(): Promise<void> {
    const logoutButton = this.page.getByRole("button", { name: "Выйти" });

    await logoutButton.click();
    await logoutButton.waitFor({ state: "hidden", timeout: 10_000 });
  }

  async addSkill(name: string, type: SkillType): Promise<void> {
    await this.submitSkill(name, type);

    await this.skillItem(name, type).waitFor({
      state: "visible",
      timeout: 10_000,
    });
  }

  async submitSkill(name: string, type: SkillType): Promise<void> {
    await this.skillInput.fill(name);
    await this.skillTypeSelect.selectOption(type);
    await this.addSkillButton.click();
  }

  async submitEmptySkill(): Promise<void> {
    await this.addSkillButton.click();
  }

  async deleteSkill(tag: string, type: SkillType): Promise<void> {
    const item = this.skillItem(tag, type);

    await item.getByRole("button", { name: `Убрать ${tag}` }).click();
    await item.waitFor({ state: "hidden", timeout: 10_000 });
  }

  skillItem(tag: string, type: SkillType): Locator {
    const container =
      type === "can_help"
        ? this.canHelpSkills
        : this.wantToLearnSkills;

    return container.locator(`[data-skill-tag="${tag}"]`);
  }
}
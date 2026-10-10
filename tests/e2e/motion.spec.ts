import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  const demo = page.getByRole("button", { name: "Explore the demo" });
  await demo
    .or(page.getByRole("heading", { name: "Your commitments" }))
    .waitFor();
  if (await demo.isVisible()) await demo.click();
  await expect(
    page.getByRole("heading", { name: "Your commitments" }),
  ).toBeVisible();
});
test("check-in, reload, undo and manual limit zero", async ({ page }) => {
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Read or journal", exact: true }),
  });
  await card
    .getByRole("button", { name: "Log Read or journal", exact: true })
    .click();
  await page.getByLabel("Total minutes on this day").fill("18");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(card).toContainText("18");
  await page.reload();
  const demoAfterReload = page.getByRole("button", {
    name: "Explore the demo",
  });
  await demoAfterReload
    .or(page.getByRole("heading", { name: "Your commitments" }))
    .waitFor();
  if (await demoAfterReload.isVisible()) await demoAfterReload.click();
  await expect(card).toContainText("18");
  await card
    .getByRole("button", { name: "Log Read or journal", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove manual entry" }).click();
  await expect(card).toContainText("Not logged");
  const limit = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Doomscrolling", exact: true }),
  });
  await limit
    .getByRole("button", { name: "Log Doomscrolling", exact: true })
    .click();
  await page.getByLabel("Total minutes on this day").fill("0");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(limit).toContainText("Within your limit");
});
test("create a custom habit, complete routine, inspect shared circle", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add habit", exact: true }).click();
  await page.getByLabel("Habit name").fill("Stretch");
  await page.getByLabel("Target", { exact: true }).fill("10");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add habit", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Stretch", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log daily essentials" }).click();
  await page.getByRole("checkbox", { name: "Skincare", exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Together", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Your circle", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send a quick cheer" }).click();
  await expect(
    page.getByText("Cheering you on. You’ve got this!", { exact: true }),
  ).toBeVisible();
});
test("create a goal, milestone and change colour", async ({ page }) => {
  await page.getByRole("button", { name: "Goals", exact: true }).last().click();
  await page.getByRole("button", { name: "New goal", exact: true }).click();
  await page
    .getByLabel("Goal", { exact: true })
    .fill("Finish the budgeting app");
  await page.getByLabel("New milestone").fill("Ship a working budget");
  await page
    .getByRole("button", { name: "Add milestone", exact: true })
    .click();
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Finish the budgeting app",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "You", exact: true }).last().click();
  await page.getByRole("radio", { name: "Aqua & indigo" }).check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator(".motion-shell")).toHaveAttribute(
    "data-palette",
    "tide",
  );
  await expect(page.getByText("Not connected", { exact: true })).toBeVisible();
});
test("fits viewport and has no page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.reload();
  const demoAfterReload = page.getByRole("button", {
    name: "Explore the demo",
  });
  await demoAfterReload
    .or(page.getByRole("heading", { name: "Your commitments" }))
    .waitFor();
  if (await demoAfterReload.isVisible()) await demoAfterReload.click();
  await expect(
    page.getByRole("heading", { name: "Your commitments" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path:
      "motion-" +
      (page.viewportSize()!.width < 500 ? "mobile" : "desktop") +
      ".png",
    fullPage: true,
  });
});

import { expect, test } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hjem" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Logg inn" })).toBeVisible();
});

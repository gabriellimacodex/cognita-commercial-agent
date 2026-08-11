import { expect, test } from "@playwright/test";

test("runs and reloads the complete synchronous commercial vertical slice", async ({
  page,
}) => {
  await page.goto("/commercial");
  await expect(
    page.getByRole("heading", { name: "Commercial foundation proof" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Create commercial proof" }).click();

  await expect(page).toHaveURL(
    /\/commercial\?organizationId=[0-9a-f-]+&leadId=[0-9a-f-]+$/,
  );
  await expect(page.getByTestId("commercial-state")).toHaveText("discovery");
  await expect(page.getByTestId("commercial-context")).toContainText(
    "Synthetic local commercial inquiry",
  );
  await expect(
    page.getByTestId("commercial-timeline").locator("li"),
  ).toHaveCount(10);

  const persistedUrl = page.url();
  await page.reload();

  await expect(page).toHaveURL(persistedUrl);
  await expect(page.getByTestId("commercial-state")).toHaveText("discovery");
  await expect(page.getByTestId("commercial-timeline")).toContainText(
    "state_changed",
  );
});

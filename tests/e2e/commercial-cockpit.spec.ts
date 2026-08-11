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
  ).toHaveCount(27);
  await expect(page.getByTestId("commercial-decision-outcome")).toHaveText(
    "allow",
  );
  await expect(page.getByTestId("commercial-active-facts")).toHaveText("13");
  await expect(page.getByTestId("commercial-human-review")).toHaveText("no");

  const persistedUrl = page.url();
  await page.reload();

  await expect(page).toHaveURL(persistedUrl);
  await expect(page.getByTestId("commercial-state")).toHaveText("discovery");
  await expect(page.getByTestId("commercial-timeline")).toContainText(
    "state_changed",
  );
});

test("persists an explicit human review without treating it as a policy bypass", async ({
  page,
}) => {
  await page.goto("/commercial");
  await page.getByLabel("Conversion measurement").selectOption("false");
  await page.getByRole("button", { name: "Create commercial proof" }).click();

  await expect(page).toHaveURL(
    /\/commercial\?organizationId=[0-9a-f-]+&leadId=[0-9a-f-]+$/,
  );
  await expect(page.getByTestId("commercial-state")).toHaveText("discovery");
  await expect(page.getByTestId("commercial-human-review")).toHaveText("yes");
  await expect(page.getByTestId("commercial-decision-outcome")).toHaveText(
    "allow",
  );
  await expect(page.getByTestId("commercial-active-facts")).toHaveText("13");
  await expect(page.getByTestId("commercial-timeline")).toContainText(
    "commercial_decision_escalated",
  );
  await expect(
    page.getByTestId("commercial-timeline").locator("li"),
  ).toHaveCount(28);

  const persistedUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(persistedUrl);
  await expect(page.getByTestId("commercial-human-review")).toHaveText("yes");
});

import { expect, test } from "@playwright/test";

test("runs and reviews the synthetic intelligence slice with backend persistence", async ({
  page,
}) => {
  await page.goto("/commercial");
  await page.getByRole("button", { name: "Create synthetic Message" }).click();
  await expect(page.getByTestId("selected-commercial-message")).toBeVisible();
  await page
    .getByRole("button", { name: "Interpret selected Message" })
    .click();

  await expect(page).toHaveURL(/runId=/, { timeout: 15_000 });
  await expect(page.getByTestId("interpretation-status")).toHaveText(
    "completed",
  );
  await expect(page.getByTestId("fact-candidate")).toHaveCount(4);
  await expect(page.getByTestId("evidence-highlight")).toHaveCount(4);
  const leadVolumeCandidate = page
    .getByTestId("fact-candidate")
    .filter({ hasText: "monthly_lead_volume: 800" });
  await expect(
    leadVolumeCandidate.getByTestId("evidence-highlight"),
  ).toHaveText("Hoje entram uns 800 leads por mês");
  await expect(leadVolumeCandidate.getByLabel("Confirmation mode")).toHaveValue(
    "assert",
  );
  await expect(
    page.getByText("monthly_lead_volume: 800", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("measures_conversion: false", { exact: true }),
  ).toBeVisible();

  await leadVolumeCandidate
    .getByRole("button", { name: "Confirm as Fact" })
    .click();
  await expect(leadVolumeCandidate).toContainText("confirmed");
  await page.reload();
  await expect(
    page
      .getByTestId("fact-candidate")
      .filter({ hasText: "monthly_lead_volume: 800" }),
  ).toContainText("confirmed");

  const sellerCandidate = page
    .getByTestId("fact-candidate")
    .filter({ hasText: "seller_count: 4" });
  await sellerCandidate.getByRole("button", { name: "Reject" }).click();
  await expect(sellerCandidate).toContainText("rejected");

  await page
    .getByRole("button", { name: "Evaluate reviewed Decision context" })
    .click();
  await expect(page.getByTestId("missing-before")).toContainText(
    "lead_volume_known",
  );
  await expect(page.getByTestId("missing-after")).not.toContainText(
    "lead_volume_known",
  );
  await expect(page.getByTestId("commercial-active-facts")).toHaveText("1");
  await expect(page.getByTestId("commercial-decision-outcome")).toHaveText(
    "require_information",
  );
});

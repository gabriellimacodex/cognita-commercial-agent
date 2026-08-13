import { expect, test } from "@playwright/test";

test("persists and explicitly controls an Action Plan through Decision and application", async ({
  page,
}) => {
  await page.goto("/commercial");
  await page.getByLabel("Synthetic scenario").selectOption("material");
  await page.getByRole("button", { name: "Create Action Plan" }).click();

  await expect(page).toHaveURL(/actionPlanId=/);
  await expect(page.getByTestId("action-plan-objective")).toHaveText(
    "progress_commercial_case@1.0.0",
  );
  await expect(page.getByTestId("action-plan-currentness")).toHaveText(
    "current",
  );
  await expect(page.getByTestId("commercial-action-candidate")).toContainText(
    "submit_material_action · create_opportunity",
  );

  await page.reload();
  await expect(page.getByTestId("commercial-action-plan")).toBeVisible();
  await page
    .getByRole("button", { name: "Submit Candidate to Decision Engine" })
    .click();
  await expect(page.getByTestId("action-decision-outcome")).toHaveText(
    "Decision: allow",
  );
  await expect(page.getByTestId("action-plan-currentness")).toHaveText(
    "historical",
  );

  await page.reload();
  await page.getByRole("button", { name: "Apply allowed Decision" }).click();
  await expect(page.getByTestId("action-application-receipt")).toContainText(
    "Applied target:",
  );
  await page.reload();
  await expect(page.getByTestId("action-application-receipt")).toBeVisible();
});

test("derives a deterministic Question Candidate without exposing Decision submission", async ({
  page,
}) => {
  await page.goto("/commercial");
  await page.getByLabel("Synthetic scenario").selectOption("missing");
  await page.getByRole("button", { name: "Create Action Plan" }).click();

  await expect(page.getByTestId("action-question-candidate")).toContainText(
    "company_ownership_type_known",
  );
  await expect(
    page.getByRole("button", { name: "Submit Candidate to Decision Engine" }),
  ).toHaveCount(0);
});

test("records declared human review separately from deterministic planning", async ({
  page,
}) => {
  await page.goto("/commercial");
  await page.getByLabel("Synthetic scenario").selectOption("review");
  await page.getByRole("button", { name: "Create Action Plan" }).click();

  await expect(page.getByTestId("commercial-action-candidate")).toContainText(
    "request_human_review · create_opportunity",
  );
  await page
    .getByRole("button", { name: "Submit Candidate to Decision Engine" })
    .click();
  await expect(page.getByTestId("action-decision-outcome")).toHaveText(
    "Decision: allow",
  );
  await expect(page.getByTestId("commercial-human-review")).toHaveText("yes");
});

import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

test("creates, processes, displays and reloads a durable technical job", async ({
  page,
}) => {
  const input = "cockpit vertical slice";
  const expectedDigest = createHash("sha256").update(input).digest("hex");

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Foundation Cockpit" }),
  ).toBeVisible();
  await expect(page.locator(".status-card")).toHaveCount(3);
  await expect(page.locator(".status-card")).toContainText([
    "apiok",
    "workerok",
    "n8nok",
  ]);

  await page.getByLabel("Technical input").fill(input);
  await page.getByRole("button", { name: "Create foundation job" }).click();

  await expect(page).toHaveURL(/\?jobId=[0-9a-f-]+$/);
  await expect(page.getByTestId("job-status")).toHaveText("completed", {
    timeout: 15_000,
  });
  await expect(page.getByTestId("job-digest")).toHaveText(expectedDigest);

  const persistedUrl = page.url();
  await page.reload();

  await expect(page).toHaveURL(persistedUrl);
  await expect(page.getByTestId("job-status")).toHaveText("completed");
  await expect(page.getByTestId("job-digest")).toHaveText(expectedDigest);
});

"use server";

import { redirect } from "next/navigation";

import { createFoundationJob } from "../lib/foundation-api";

export async function submitFoundationJob(formData: FormData): Promise<never> {
  const input = formData.get("input");
  if (typeof input !== "string" || input.length < 1 || input.length > 10_000) {
    redirect("/?error=Input%20must%20contain%201%20to%2010000%20characters");
  }

  let job;
  try {
    job = await createFoundationJob(input);
  } catch {
    redirect("/?error=Foundation%20job%20could%20not%20be%20created");
  }
  redirect(`/?jobId=${encodeURIComponent(job.id)}`);
}

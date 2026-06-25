import { chromium, type Browser, type Page } from "playwright";
import { maskPan, maskSecret } from "@itr/shared";
import { config } from "./config.js";
import { emitEvent, sendResult, sleep, waitForOtp } from "./webhook-client.js";

export async function runAutomation() {
  let browser: Browser | undefined;
  try {
    await emitEvent({ phase: "launching", step: "browser.launch", message: "Launching Chromium" });

    if (config.AUTOMATION_DEMO_MODE) {
      await runDemoFlow();
      return;
    }

    browser = await chromium.launch({ headless: !config.RUN_HEADED });
    const page = await browser.newPage();
    await runPortalFlow(page);
  } catch (error) {
    await emitEvent({
      level: "error",
      phase: "failed",
      step: "automation.failed",
      message: error instanceof Error ? error.message : "Automation failed"
    });
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}

async function runPortalFlow(page: Page) {
  await emitEvent({ phase: "identity", step: "portal.open", message: "Opening Income Tax portal" });
  await page.goto(config.INCOME_TAX_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  await emitEvent({ phase: "identity", step: "identity.enter_pan", message: `Entering PAN ${maskPan(config.PAN)}` });
  await page.getByRole("link", { name: /login/i }).click({ timeout: 30000 });
  await page.getByLabel(/user id|pan/i).fill(config.PAN);
  await page.getByRole("button", { name: /continue/i }).click();

  await emitEvent({ phase: "captcha", step: "captcha.required", message: "CAPTCHA gate reached; waiting for operator to solve in headed browser" });
  await page.waitForLoadState("networkidle", { timeout: 120000 }).catch(() => undefined);

  await emitEvent({ phase: "otp_waiting", step: "otp.waiting", message: "Waiting for operator supplied OTP" });
  const otp = await waitForOtp();
  await emitEvent({ phase: "otp_submitted", step: "otp.received", message: "OTP received from operations UI" });
  await page.getByLabel(/otp/i).fill(otp);
  await page.getByRole("button", { name: /continue|verify|submit/i }).click();

  await emitEvent({ phase: "password", step: "password.generate", message: "Generating portal password" });
  const password = generatePassword();

  await emitEvent({ phase: "confirmation", step: "credentials.persist", message: "Submitting generated credentials result" });
  await sendResult({ userId: config.PAN, password, generatedAt: new Date().toISOString() });
  await emitEvent({ phase: "succeeded", step: "automation.complete", message: `Credential generated for ${maskPan(config.PAN)}` });
}

async function runDemoFlow() {
  await sleep(500);
  await emitEvent({ phase: "identity", step: "identity.enter_pan", message: `Accepted PAN ${maskPan(config.PAN)}` });
  await sleep(500);
  await emitEvent({ phase: "captcha", step: "captcha.solved", message: "CAPTCHA solved by operator" });
  await sleep(500);
  await emitEvent({ phase: "otp_waiting", step: "otp.waiting", message: "Waiting for operator supplied OTP" });
  await waitForOtp();
  await emitEvent({ phase: "otp_submitted", step: "otp.received", message: "OTP received from operations UI" });
  await sleep(500);
  const password = generatePassword();
  await emitEvent({ phase: "password", step: "password.generate", message: `Generated password ${maskSecret(password)}` });
  await sendResult({ userId: config.PAN, password, generatedAt: new Date().toISOString() });
  await emitEvent({ phase: "confirmation", step: "credentials.saved", message: "Encrypted credential result saved" });
  await emitEvent({ phase: "succeeded", step: "automation.complete", message: `Credential generated for ${maskPan(config.PAN)}` });
}

function generatePassword() {
  const random = Math.random().toString(36).slice(2, 10);
  return `Rk@${random}9Z`;
}

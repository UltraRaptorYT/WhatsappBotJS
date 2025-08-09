import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as fssync from "fs";
import * as path from "path";
import crypto from "crypto";
import os from "os";
import { read, utils } from "xlsx";
import { chromium } from "playwright";
import fetch from "node-fetch";

type LogFn = (msg: string) => void;

// very basic in-memory log store for demo
const logStreams = new Map<
  string,
  { logs: string[]; listeners: Set<(line: string) => void> }
>();

function getLogger(jobId: string): LogFn {
  if (!logStreams.has(jobId)) {
    logStreams.set(jobId, { logs: [], listeners: new Set() });
  }
  return (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    const store = logStreams.get(jobId)!;
    store.logs.push(line);
    for (const fn of store.listeners) fn(line);
    // also print to server stdout
    console.log(line);
  };
}

const TMP_BASE =
  (os.tmpdir && os.tmpdir()) || path.join(process.cwd(), "uploads", "tmp");

async function ensureDir(dir: string) {
  if (!fssync.existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function saveFileToTmp(f: File, base = TMP_BASE) {
  await ensureDir(base); // <-- important
  const buf = Buffer.from(await f.arrayBuffer());
  const outPath = path.join(base, `${crypto.randomUUID()}-${f.name}`);
  await fs.writeFile(outPath, buf);
  return outPath;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();

  const namelist = form.get("namelist") as File | null;
  const message = form.get("message") as File | null;
  const images = form.getAll("images") as File[];
  const document = (form.get("document") as File | null) || null;

  if (!namelist || !message) {
    return NextResponse.json({ error: "Missing files" }, { status: 400 });
  }

  const jobId = crypto.randomUUID();
  const log = getLogger(jobId);
  log(`Job received`);

  // persist uploads
  const namelistPath = await saveFileToTmp(namelist);
  const messagePath = await saveFileToTmp(message);
  const imagePaths: string[] = [];
  for (const img of images) imagePaths.push(await saveFileToTmp(img));
  const documentPath = document ? await saveFileToTmp(document) : null;

  // fire-and-forget the worker
  runPlaywrightJob({
    jobId,
    log,
    namelistPath,
    messagePath,
    imagePaths,
    documentPath,
  }).catch((e) => log(`Fatal error: ${e?.stack || e}`));

  return NextResponse.json({ jobId });
}

async function runPlaywrightJob(args: {
  jobId: string;
  log: LogFn;
  namelistPath: string;
  messagePath: string;
  imagePaths: string[];
  documentPath: string | null;
}) {
  const { jobId, log, namelistPath, messagePath, imagePaths, documentPath } =
    args;
  const failedNumbers: string[] = [];

  // read Excel
  const wb = read(await fs.readFile(namelistPath));
  const ws = wb.Sheets[wb.SheetNames[0]];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = utils.sheet_to_json<Record<string, any>>(ws, {
    defval: "",
  });

  if (!rows.length || !("Mobile Number" in rows[0])) {
    log(`Missing 'Mobile Number' column`);
    return;
  }

  // read template
  const baseMessage = (await fs.readFile(messagePath, "utf8")).toString();

  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const loginPage = await context.newPage();
  await loginPage.goto("https://web.whatsapp.com", {
    waitUntil: "domcontentloaded",
    timeout: 0,
  });
  log("Please scan QR and wait for WhatsApp Web to load...");
  await loginPage.waitForSelector("header", { timeout: 0 });

  // optional “Continue” click if present
  const continueBtn = await loginPage
    .locator("button:has-text('Continue')")
    .first();
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    log("Clicked Continue");
  }

  for (const row of rows) {
    let phoneNumber = String(row["Mobile Number"]).trim();
    if (!phoneNumber) continue;
    if (!phoneNumber.startsWith("+")) phoneNumber = `+65${phoneNumber}`;

    // build message
    let msg = baseMessage;
    for (const [k, v] of Object.entries(row)) {
      msg = msg.replaceAll(`{${k}}`, String(v ?? ""));
    }

    // per-row custom image support via "ImageURL"
    const perRowImages: string[] = [];
    const imgUrl = String(row["ImageURL"] || "").trim();
    if (imgUrl) {
      try {
        if (imgUrl.startsWith("http://") || imgUrl.startsWith("https://")) {
          const r = await fetch(imgUrl);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const buf = Buffer.from(await r.arrayBuffer());
          const p = `/tmp/${crypto.randomUUID()}.png`;
          await fs.writeFile(p, buf);
          perRowImages.push(p);
          log(`Downloaded image for ${phoneNumber}`);
        } else {
          // trust local path if you mount it
          perRowImages.push(imgUrl);
        }
      } catch (e) {
        log(`Failed to load per-row image for ${phoneNumber}: ${e}`);
      }
    }

    const page = await context.newPage();
    await page.goto(
      `https://web.whatsapp.com/send?phone=${encodeURIComponent(
        phoneNumber
      )}&text=${encodeURIComponent(msg)}`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForSelector("header", { timeout: 0 });
    await page.waitForTimeout(1000);

    // invalid number check
    const invalid = await page
      .locator('[aria-label="Phone number shared via url is invalid."]')
      .first();
    if (await invalid.isVisible().catch(() => false)) {
      failedNumbers.push(phoneNumber);
      log(`${phoneNumber} invalid. Skipping.`);
      await page.close();
      continue;
    }

    // // open attachment menu
    // const attachBtn = page.locator(
    //   '[data-tab="6"] [data-animate-media], [data-tab="6"] div[role="button"][title]'
    // );
    // // WhatsApp updates frequently. Fallback selector below:
    // await attachBtn
    //   .first()
    //   .click({ trial: true })
    //   .catch(() => {});
    // await attachBtn
    //   .first()
    //   .click()
    //   .catch(() => {});

    // // send document if provided
    // if (documentPath !== "" && documentPath) {
    //   log(`Uploading document for ${phoneNumber}`);
    //   // Click "Attach" then choose "Document" input
    //   // There is a hidden <input type="file"> rendered. Use setInputFiles on it.
    //   const docInput = page
    //     .locator(
    //       'input[type="file"][accept*=".pdf"], input[type="file"][accept*="document"]'
    //     )
    //     .first();
    //   // If the above does not match, broader fallback:
    //   const anyInput = docInput.or(page.locator('input[type="file"]')).first();
    //   await anyInput.setInputFiles(documentPath);
    //   // wait for preview and send
    //   // WhatsApp shows a send button after file chosen
    //   await page.waitForTimeout(1000);
    //   const sendBtn = page
    //     .locator('span[data-icon="send"], [aria-label="Send"]')
    //     .last();
    //   await sendBtn.click().catch(() => {});
    //   log(`Sent document to ${phoneNumber}`);
    // }

    // // send images (row + global)
    // const allImages = [...perRowImages, ...imagePaths];
    // if (allImages.length) {
    //   // open attach menu again
    //   await attachBtn
    //     .first()
    //     .click()
    //     .catch(() => {});
    //   // photo/video input
    //   const imgInput = page
    //     .locator(
    //       'input[type="file"][accept*="image"], input[type="file"][accept*="video"]'
    //     )
    //     .first();
    //   const files = allImages.map((p) => p);
    //   await imgInput.setInputFiles(files);
    //   await page.waitForTimeout(1000);
    //   const sendBtn = page
    //     .locator('span[data-icon="send"], [aria-label="Send"]')
    //     .last();
    //   await sendBtn.click().catch(() => {});
    //   log(`Sent ${files.length} image(s) to ${phoneNumber}`);
    // }

    // finally send text if not already sent by Enter
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);

    // delivery check: look for check marks on last outgoing message
    try {
      const lastOutgoing = page
        .locator('[data-tab="8"] div.message-out')
        .last();
      await lastOutgoing.waitFor({ timeout: 20000 });
      const hasCheck = await lastOutgoing
        .locator('[data-icon="msg-check"], [data-icon="msg-dblcheck"]')
        .count();
      if (hasCheck > 0)
        log(`${phoneNumber} message sent (check mark detected)`);
      else log(`${phoneNumber} sent but no checkmark found`);
    } catch {
      log(`${phoneNumber} may not be delivered (timeout)`);
    }

    await page.close();
  }

  // logout sequence
  try {
    await loginPage.bringToFront();
    // Use-here button if session conflict
    const useHere = loginPage.locator(':text("Use here")').first();
    if (await useHere.isVisible().catch(() => false)) await useHere.click();

    await loginPage.locator('[title="Menu"]').click();
    await loginPage.locator(':text("Log out")').first().click();
    await loginPage.locator(':text("Log out")').first().click();
    await loginPage.waitForSelector('[aria-label*="Scan this QR code"]', {
      timeout: 15000,
    });
    log("Logged out");
  } catch (e) {
    log(`Logout step skipped or failed: ${e}`);
  }

  await browser.close();
  log(`Failed numbers: ${JSON.stringify(failedNumbers)}`);
  log("Process COMPLETED.");
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import * as XLSX from "xlsx";
import { appendLog } from "@/lib/demoStore";
import { launchPuppeteer, preparePage } from "@/lib/puppeteerLauncher";
import { sleep, toE164, fillTemplate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const jobId = crypto.randomUUID();
  appendLog(jobId, "Processing Data...");
  // DO CHECKS

  const form = await req.formData();

  const xlsxFile = form.get("namelist");
  const tmplFile = form.get("message");
  const imageFiles = form.getAll("images").filter(Boolean);
  const documentFile = form.get("document");

  if (!(xlsxFile instanceof File) || !(tmplFile instanceof File)) {
    appendLog(jobId, "Missing required files (xlsx / txt).", "ERROR");
    return NextResponse.json(
      { jobId, error: "Missing files" },
      { status: 400 }
    );
  }

  const messageTemplate = await tmplFile.text();

  // read excel
  const ab = await xlsxFile.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(ab), { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: "",
    raw: false,
  });

  const requiredCol = "Mobile Number";
  if (
    !rows.length ||
    !Object.keys(rows[0]).some(
      (k) => k.trim().toLowerCase() === requiredCol.toLowerCase()
    )
  ) {
    appendLog(jobId, `Excel must have a '${requiredCol}' column.`, "ERROR");
    return NextResponse.json(
      { jobId, error: `Missing '${requiredCol}' column` },
      { status: 400 }
    );
  }

  const badRows: Array<{ row: number; value: string }> = [];
  const entries = rows
    .map((r, idx) => {
      const raw = String(r[requiredCol] ?? "").trim();
      const phone_number = toE164(raw);
      return { rowIndex: idx + 2, row: r, phoneRaw: raw, phone_number };
    })
    .filter((e) => {
      if (!e.phone_number) {
        badRows.push({ row: e.rowIndex, value: e.phoneRaw });
        return false;
      }
      return true;
    });

  const numbers = entries.map((e) => e.phone_number);

  if (!numbers.length) {
    appendLog(jobId, "No valid phone numbers after normalization.", "ERROR");
    return NextResponse.json(
      { jobId, error: "No valid phone numbers" },
      { status: 400 }
    );
  }

  appendLog(
    jobId,
    `Parsed ${numbers.length} valid numbers from '${requiredCol}'.`
  );
  if (badRows.length) {
    appendLog(
      jobId,
      `Skipped ${badRows.length} invalid numbers (e.g. row ${badRows[0].row}: "${badRows[0].value}")`
    );
  }

  // ! TEST
  // (Optional) collect file metadata; implement media sending later
  const images: Array<{ name: string; mime: string; size: number }> = imageFiles
    .filter((f): f is File => f instanceof File)
    .map((f) => ({ name: f.name, mime: f.type, size: f.size }));

  const docMeta =
    documentFile instanceof File
      ? {
          name: documentFile.name,
          mime: documentFile.type,
          size: documentFile.size,
        }
      : null;

  if (images.length) appendLog(jobId, `Images attached: ${images.length}`);
  if (docMeta) appendLog(jobId, `Document attached: ${docMeta.name}`);

  appendLog(jobId, "Launching browser...");

  const url =
    new URL(req.url).searchParams.get("url") || "https://web.whatsapp.com/";

  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browser: any = null;

    try {
      const { browser: b } = await launchPuppeteer();
      browser = b;

      const page = await browser.newPage();

      await page.setDefaultTimeout(0);
      await page.setDefaultNavigationTimeout(0);

      await preparePage(page);

      appendLog(jobId, "Opened new page");
      appendLog(jobId, `Navigating to ${url}`);

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 0 });
      await page.waitForSelector(
        '[aria-label="Scan this QR code to link a device!"]'
      );

      const QR_PAGE_BUF = await page.screenshot({ type: "png" });
      appendLog(
        jobId,
        `__IMAGE_PNG_BASE64__:${QR_PAGE_BUF.toString("base64")}`
      );
      appendLog(jobId, "Please Scan QR Code");

      await page.waitForSelector("header", { timeout: 0 });
      await page.waitForFunction(() => {
        const el = document.querySelector("header");
        if (!el) return false;
        const s = getComputedStyle(el);
        return s && s.display !== "none" && s.visibility !== "hidden";
      });

      const afterLogin = await page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_PNG_BASE64__:${afterLogin.toString("base64")}`);
      appendLog(jobId, "QR Code scanned. Starting sends…");

      const failed_numbers = [];
      for (const entry of entries) {
        const { phone_number, row, rowIndex } = entry;

        // Fill {ColumnName} placeholders from this row
        const text = fillTemplate(messageTemplate, row).trim();
        const sendUrl = `https://web.whatsapp.com/send?phone=${encodeURIComponent(
          phone_number || ""
        )}&text=${encodeURIComponent(text)}`;
        appendLog(jobId, `Opening chat: ${phone_number}`);
        await page.goto(sendUrl, { waitUntil: "domcontentloaded", timeout: 0 });
        await page.waitForSelector("header", { timeout: 0, visible: true });

        await page.waitForFunction(() => {
          const el = document.querySelector("header");
          if (!el) return false;
          const s = getComputedStyle(el);
          return s && s.display !== "none" && s.visibility !== "hidden";
        });

        await sleep(3000);
        const sendBtn = await page.$('button[data-tab="11"] > span');
        if (!sendBtn) {
          failed_numbers.push(phone_number);
          appendLog(jobId, `${phone_number} Failed!`, "ERROR");
          continue;
        }
        await sleep(1000);
        await sendBtn.click();
        await sleep(1000);

        const sendMessageBuf = await page.screenshot({ type: "png" });
        appendLog(
          jobId,
          `__IMAGE_PNG_BASE64__:${sendMessageBuf.toString("base64")}`
        );
        appendLog(jobId, "Screenshot captured");

        const maxWait = 20;
        let i = 0;
        for (i = 0; i < maxWait; i++) {
          // Grab the last outgoing message element
          const lastMessage = await page.$(
            '[data-tab="8"] div.message-out:last-of-type'
          );

          if (lastMessage) {
            const check = await lastMessage.$('[data-icon="msg-check"]');
            const dblCheck = await lastMessage.$('[data-icon="msg-dblcheck"]');

            const checkExists = !!check;
            const dblCheckExists = !!dblCheck;

            if (dblCheckExists || checkExists) {
              appendLog(
                jobId,
                `${phone_number} Message sent and delivery confirmed`
              );
              break;
            }
          }

          await sleep(1000);
        }

        if (i === maxWait) {
          appendLog(
            jobId,
            `${phone_number} Message may not be delivered (no msg-check icon found).`,
            "ERROR"
          );
        }
      }

      await sleep(1000);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 0 });
      appendLog(jobId, "LOGGING OUT NOW");
      // Open the Menu Dropdown
      await page.waitForSelector('[title="Menu"]', {
        visible: true,
      });
      await page.click('[title="Menu"]');
      await sleep(1000);

      // Click on "Log out" in menu
      await page.waitForFunction(() =>
        [...document.querySelectorAll("*")].some(
          (el) => el.textContent?.trim() === "Log out"
        )
      );
      const logOutMenuItem = await page.evaluateHandle(() =>
        [...document.querySelectorAll("*")].find(
          (el) => el.textContent?.trim() === "Log out"
        )
      );
      await logOutMenuItem.click();
      await sleep(1000);

      // Confirm "Log out" button
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".x1v8p93f")].some((el) =>
          el.textContent?.includes("Log out")
        )
      );
      const confirmLogOutBtn = await page.evaluateHandle(() =>
        [...document.querySelectorAll(".x1v8p93f")].find((el) =>
          el.textContent?.includes("Log out")
        )
      );
      await confirmLogOutBtn.click();
      await sleep(1000);
      const buf6 = await page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_PNG_BASE64__:${buf6.toString("base64")}`);
      appendLog(jobId, "Screenshot captured");

      // Check logout confirmed (QR code visible)
      await page.waitForSelector(
        '[aria-label="Scan this QR code to link a device!"]'
      );
      const buf7 = await page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_PNG_BASE64__:${buf7.toString("base64")}`);
      appendLog(jobId, "Screenshot captured");
      appendLog(
        jobId,
        `The following numbers has failed to send ${JSON.stringify(
          failed_numbers
        )}`,
        "ERROR"
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      appendLog(jobId, `ERROR: ${e?.message || String(e)}`);
    } finally {
      try {
        await browser?.close();
      } catch {}
      appendLog(jobId, "Browser closed");
      appendLog(jobId, "Done.", "SUCESS");
    }
  })();

  return NextResponse.json({ jobId });
}

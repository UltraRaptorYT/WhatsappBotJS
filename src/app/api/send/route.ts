import { NextResponse } from "next/server";
import crypto from "crypto";
import { appendLog } from "@/lib/demoStore";
import { launchPuppeteer, preparePage } from "@/lib/puppeteerLauncher";
import { sleep } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const jobId = crypto.randomUUID();
  appendLog(jobId, "Processing Data...");
  // DO CHECKS

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

      const buf = await page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_PNG_BASE64__:${buf.toString("base64")}`);
      appendLog(jobId, "Please Scan QR Code");

      await page.waitForSelector("header", { timeout: 0 });
      await page.waitForFunction(() => {
        const el = document.querySelector("header");
        if (!el) return false;
        const s = getComputedStyle(el);
        return s && s.display !== "none" && s.visibility !== "hidden";
      });

      const buf2 = await page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_PNG_BASE64__:${buf2.toString("base64")}`);
      appendLog(jobId, "QR Code has been scanned");

      const failed_numbers = [];

      for (const phone_number of ["+6583442098", "+6512345678"]) {
        await page.goto(
          `https://web.whatsapp.com/send?phone=${phone_number}&text=${encodeURIComponent(
            "hello world"
          )}`,
          { waitUntil: "domcontentloaded", timeout: 0 }
        );
        appendLog(
          jobId,
          `https://web.whatsapp.com/send?phone=${phone_number}&text=${encodeURIComponent(
            "hello world"
          )}`
        );
        await page.waitForSelector("header", { timeout: 0 });
        await page.waitForFunction(() => {
          const el = document.querySelector("header");
          if (!el) return false;
          const s = getComputedStyle(el);
          return s && s.display !== "none" && s.visibility !== "hidden";
        });
        await sleep(3000);
        const sendElement = await page.$('button[data-tab="11"] > span');
        if (!sendElement) {
          failed_numbers.push(phone_number);
          appendLog(jobId, `${phone_number} Failed!`, "ERROR");
          continue;
        }
        await sleep(1000);
        await sendElement.click();
        await sleep(1000);

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
        `The following numbers has failed to send ${failed_numbers}`,
        "ERROR"
      );
      appendLog(jobId, "Done.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      appendLog(jobId, `ERROR: ${e?.message || String(e)}`);
    } finally {
      try {
        await browser?.close();
      } catch {}
      appendLog(jobId, "Browser closed");
    }
  })();

  return NextResponse.json({ jobId });
}

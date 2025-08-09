import { NextResponse } from "next/server";
import crypto from "crypto";
import { appendLog } from "@/lib/demoStore";
import { launchPuppeteer, preparePage } from "@/lib/puppeteerLauncher";
import { sleep } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const jobId = crypto.randomUUID();
  appendLog(jobId, "Job received");
  appendLog(jobId, "Launching browser...");

  // let clients optionally pass a target URL (defaults to example.com)
  const url = new URL(req.url).searchParams.get("url") || "http://example.com/";

  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browser: any = null;

    try {
      const { browser: b } = await launchPuppeteer();
      browser = b;

      const login_page = await browser.newPage();

      await login_page.setDefaultTimeout(0);
      await login_page.setDefaultNavigationTimeout(0);
      await preparePage(login_page);

      appendLog(jobId, "Opened new page");
      appendLog(jobId, `Navigating to ${url}`);

      await login_page.goto(url, { waitUntil: "domcontentloaded", timeout: 0 });
      await login_page.waitForSelector(
        '[aria-label="Scan this QR code to link a device!"]'
      );

      const buf = await login_page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_JPEG_BASE64__:${buf.toString("base64")}`);
      appendLog(jobId, "Screenshot captured");

      await login_page.waitForSelector("header", {
        timeout: 0,
        visible: true,
      });

      appendLog(jobId, "QR Code Scanned");
      const buf2 = await login_page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_JPEG_BASE64__:${buf2.toString("base64")}`);
      appendLog(jobId, "Screenshot captured");

      const failed_numbers = [];

      for (const phone_number of ["83442098"]) {
        const page = await browser.newPage();
        await preparePage(page);
        await page.goto(
          `https://web.whatsapp.com/send?phone=${phone_number}&text=${encodeURIComponent(
            "hello world"
          )}`,
          { waitUntil: "domcontentloaded", timeout: 0 }
        );
        const buf7 = await page.screenshot({ type: "png" });
        appendLog(jobId, `__IMAGE_JPEG_BASE64__:${buf7.toString("base64")}`);
        appendLog(jobId, "Screenshot captured");
        await page.waitForSelector("header", { visible: true, timeout: 0 });
        const buf1 = await page.screenshot({ type: "png" });
        appendLog(jobId, `__IMAGE_JPEG_BASE64__:${buf1.toString("base64")}`);
        appendLog(jobId, "Screenshot captured");
        const element = await page.$(
          '[aria-label="Phone number shared via url is invalid."]'
        );
        if (element) {
          failed_numbers.push(phone_number);
          appendLog(`${phone_number} Failed!`, "ERROR");
          await page.close();
          continue; // if inside a loop
        }
        const buf12 = await page.screenshot({ type: "png" });
        appendLog(jobId, `__IMAGE_JPEG_BASE64__:${buf12.toString("base64")}`);
        appendLog(jobId, "Screenshot captured");
        sleep(1000);
        await page.click('button[data-tab="11"] > span');
        sleep(5000);
      }

      await login_page.waitForFunction(() =>
        [...document.querySelectorAll(".x1v8p93f")].some((el) =>
          el.textContent?.includes("Use here")
        )
      );
      const useHereBtn = await login_page.evaluateHandle(() =>
        [...document.querySelectorAll(".x1v8p93f")].find((el) =>
          el.textContent?.includes("Use here")
        )
      );
      await useHereBtn.click();
      const buf3 = await login_page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_JPEG_BASE64__:${buf3.toString("base64")}`);
      appendLog(jobId, "Screenshot captured");
      await sleep(1000);

      // Open the Menu Dropdown
      await login_page.waitForSelector('[title="Menu"]');
      await login_page.click('[title="Menu"]');
      await sleep(1000);
      const buf4 = await login_page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_JPEG_BASE64__:${buf4.toString("base64")}`);
      appendLog(jobId, "Screenshot captured");

      // Click on "Log out" in menu
      await login_page.waitForFunction(() =>
        [...document.querySelectorAll("*")].some(
          (el) => el.textContent?.trim() === "Log out"
        )
      );
      const logOutMenuItem = await login_page.evaluateHandle(() =>
        [...document.querySelectorAll("*")].find(
          (el) => el.textContent?.trim() === "Log out"
        )
      );
      await logOutMenuItem.click();
      await sleep(1000);
      const buf5 = await login_page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_JPEG_BASE64__:${buf5.toString("base64")}`);
      appendLog(jobId, "Screenshot captured");

      // Confirm "Log out" button
      await login_page.waitForFunction(() =>
        [...document.querySelectorAll(".x1v8p93f")].some((el) =>
          el.textContent?.includes("Log out")
        )
      );
      const confirmLogOutBtn = await login_page.evaluateHandle(() =>
        [...document.querySelectorAll(".x1v8p93f")].find((el) =>
          el.textContent?.includes("Log out")
        )
      );
      await confirmLogOutBtn.click();
      await sleep(1000);
      const buf6 = await login_page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_JPEG_BASE64__:${buf6.toString("base64")}`);
      appendLog(jobId, "Screenshot captured");

      // Check logout confirmed (QR code visible)
      await login_page.waitForSelector(
        '[aria-label="Scan this QR code to link a device!"]'
      );
      const buf7 = await login_page.screenshot({ type: "png" });
      appendLog(jobId, `__IMAGE_JPEG_BASE64__:${buf7.toString("base64")}`);
      appendLog(jobId, "Screenshot captured");

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

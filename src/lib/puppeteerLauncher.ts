import chromium from "@sparticuz/chromium";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let puppeteer: any;

export type LaunchResult = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser: any;
  isDev: boolean;
};

export async function launchPuppeteer(): Promise<LaunchResult> {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    const { default: p } = await import("puppeteer");
    puppeteer = p;

    const browser = await puppeteer.launch({
      headless: "new",
      defaultViewport: { width: 1280, height: 720 },
    });

    return { browser, isDev };
  }

  // Production (Vercel): puppeteer-core + Sparticuz Chromium
  const { default: p } = await import("puppeteer-core");
  puppeteer = p;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      ...chromium.args,
      // small stability + evasion improvements
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
    ],
    executablePath: await chromium.executablePath(),
    defaultViewport: { width: 1280, height: 720 },
    protocolTimeout: 0,
  });

  return { browser, isDev };
}

/** Apply lightweight stealth: UA, webdriver, languages, plugins */
export async function preparePage(page: any) {
  // Pretend not automated
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
    // @ts-ignore
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
  });

  // Use a recent Chrome UA; remove "Headless"
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/123.0.0.0 Safari/537.36"
  );

  // Optional: set locale/timezone like a real desktop
  try {
    await page.emulateTimezone("Asia/Singapore");
  } catch {}
}

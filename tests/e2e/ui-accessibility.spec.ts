import { test, expect, type Page } from "@playwright/test";

async function enterDemo(page: Page) {
  await page.goto("/");
  const demo = page.getByRole("button", { name: "Explore the demo" });
  await demo
    .or(page.getByRole("heading", { name: "Your commitments" }))
    .waitFor();
  if (await demo.isVisible()) await demo.click();
  await expect(
    page.getByRole("heading", { name: "Your commitments" }),
  ).toBeVisible();
}

async function checkScreen(page: Page) {
  const issues = await page.evaluate(() => {
    const visible = (e: Element) =>
      e.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
    const elements = [
      ...document.querySelectorAll("main *, nav *, dialog *"),
    ].filter(visible);
    const smallTargets = elements
      .filter(
        (e) =>
          e.matches("button,summary") && !(e as HTMLButtonElement).disabled,
      )
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width < 43.9 || r.height < 43.9;
      })
      .map((e) => e.getAttribute("aria-label") || e.textContent?.trim());
    const smallText = elements
      .filter((e) =>
        [...e.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent?.trim(),
        ),
      )
      .filter(
        (e) =>
          parseFloat(getComputedStyle(e).fontSize) < 12 &&
          !e.closest(".sr-only"),
      )
      .map((e) => e.textContent?.trim());
    const smallInputs = elements
      .filter(
        (e) =>
          e.matches("input,select,textarea") &&
          !e.matches('[type="checkbox"],[type="radio"]'),
      )
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16)
      .map((e) => e.getAttribute("name"));
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      smallTargets,
      smallText,
      smallInputs,
    };
  });
  expect(issues).toEqual({
    overflow: false,
    smallTargets: [],
    smallText: [],
    smallInputs: [],
  });
}

for (const width of [320, 390, 768, 1440]) {
  test(`readable controls and reflow at ${width}px`, async ({ page }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Responsive sizes covered once in desktop Chromium",
    );
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const demo = page.getByRole("button", { name: "Explore the demo" });
    await demo
      .or(page.getByRole("heading", { name: "Your commitments" }))
      .waitFor();
    await checkScreen(page);
    if (await demo.isVisible()) await demo.click();
    const nav = page.getByRole("navigation", {
      name: width <= 600 ? "Mobile navigation" : "Main navigation",
    });
    for (const name of ["Today", "Together", "Goals", "You"]) {
      await nav.getByRole("button", { name, exact: true }).click();
      await checkScreen(page);
      await expect(nav.getByRole("button")).toHaveCount(5);
      if (name === "Today" || name === "Together") {
        await expect(page.locator(".hero-art")).toBeVisible();
        await expect(page.locator(".hero-art img")).toBeVisible();
      }
      if (width <= 600) {
        await expect(page.locator(".mobile-wordmark .logo-dot")).toBeVisible();
      }
      if (name === "Together") {
        await expect(
          page.getByText("What my friend sees", { exact: true }),
        ).toBeVisible();
        await expect(page.locator(".own-sharing")).not.toHaveAttribute("open");
        await expect(page.locator(".people-grid")).toContainText("Your friend");
      }
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: info.outputPath(`${name}-${width}.png`),
          fullPage: true,
        });
    }
    await nav.getByRole("button", { name: "Goals", exact: true }).click();
    await page.getByRole("button", { name: /A moment to reflect/ }).click();
    await checkScreen(page);
    if (width === 768) {
      await expect(nav.getByRole("button")).toHaveCount(5);
      await expect(
        nav.getByRole("button", { name: "Review", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
    await nav.getByRole("button", { name: "Today", exact: true }).click();
    await page.getByRole("button", { name: "Add habit", exact: true }).click();
    await checkScreen(page);
    await page.getByRole("button", { name: "Close dialog" }).press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add habit", exact: true }),
    ).toBeFocused();
  });
}

test("large text, text spacing and reduced motion survive key screens", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Covered once");
  await page.setViewportSize({ width: 640, height: 900 });
  await enterDemo(page);
  // 200% text enlargement plus WCAG text-spacing overrides. 640 CSS px also
  // exercises the reflow width of a 1280px browser at 200% page zoom.
  await page.addStyleTag({
    content: `html {font-size:200%!important} * {line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p {margin-bottom:2em!important}`,
  });
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const name of ["Today", "Together", "Goals", "Review", "You"]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await checkScreen(page);
  }
  await nav.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Log Read or journal" }).click();
  await expect(
    page.getByRole("button", { name: "Save check-in" }),
  ).toBeVisible();
  await checkScreen(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".save-wave")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
});

test("secondary text and input borders retain contrast across palettes", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Covered once");
  await enterDemo(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "You", exact: true })
    .click();
  for (const palette of [
    "Apricot & violet",
    "Aqua & indigo",
    "Rose & butter",
  ]) {
    await page.getByRole("radio", { name: palette }).check();
    await page.getByRole("button", { name: "Save preferences" }).click();
    const ratios = await page.evaluate(() => {
      const rgb = (s: string) =>
        s
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number);
      const lum = (s: string) =>
        rgb(s)
          .map((n) => {
            n /= 255;
            return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
          })
          .reduce((v, n, i) => v + n * [0.2126, 0.7152, 0.0722][i], 0);
      const contrast = (a: string, b: string) => {
        let x = lum(a),
          y = lum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      };
      const input = getComputedStyle(
        document.querySelector('input[name="name"]')!,
      );
      const surface = getComputedStyle(document.querySelector(".surface")!);
      const copy = getComputedStyle(document.querySelector(".surface > p")!);
      return {
        text: contrast(copy.color, surface.backgroundColor),
        border: contrast(input.borderTopColor, input.backgroundColor),
      };
    });
    expect(ratios.text).toBeGreaterThanOrEqual(7);
    expect(ratios.border).toBeGreaterThanOrEqual(3);
  }
});

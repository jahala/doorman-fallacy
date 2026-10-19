import AxeBuilder from '@axe-core/playwright';
import { builtRoutes, expect, test } from './site.ts';

for (const route of builtRoutes()) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe finds no violations on ${route} in ${colorScheme} mode`, async ({ page, siteUrl }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(new URL(route, siteUrl).href);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}

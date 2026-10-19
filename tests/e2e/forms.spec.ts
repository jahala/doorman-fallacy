import { suggestionLimits } from '../../src/lib/suggestion.ts';
import { expect, test } from './site.ts';

const formRoutes = ['/', '/suggest/', '/suggest/error/dnb-2026/', '/subscribe/unsubscribe/'];

for (const route of formRoutes) {
  test(`${route}: every form posts to the Worker, and every visible field has a visible label`, async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const forms = await page.locator('form').evaluateAll((nodes) =>
      nodes.map((node) => ({ method: node.getAttribute('method'), action: node.getAttribute('action') })),
    );
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) {
      expect(form.method).toBe('post');
      expect([null, '/api/subscribe', '/api/suggest']).toContain(form.action);
    }
    const unlabelled = await page.locator('input:not([type=hidden]):not([tabindex="-1"]), textarea, select').evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const id = node.getAttribute('id');
          const label = id === null ? null : document.querySelector(`label[for="${id}"]`);
          return label === null || label.textContent.trim() === '';
        })
        .map((node) => node.getAttribute('name')),
    );
    expect(unlabelled).toEqual([]);
  });
}

test('the unsubscribe form has no action, so the browser posts it back to the address it was served at', async ({ page, siteUrl }) => {
  await page.goto(new URL('/subscribe/unsubscribe/', siteUrl).href);
  const form = page.locator('form');
  await expect(form).toHaveCount(1);
  expect(await form.getAttribute('action')).toBeNull();
  await expect(form.getByRole('button', { name: 'Unsubscribe' })).toBeVisible();
});

test('the home page sign-up form takes one required email and carries the honeypot', async ({ page, siteUrl }) => {
  await page.goto(siteUrl);
  const form = page.locator('form[action="/api/subscribe"]');
  await expect(form).toHaveCount(1);
  const email = form.locator('input[name=email]');
  await expect(email).toHaveAttribute('type', 'email');
  await expect(email).toHaveAttribute('required', '');
  await expect(form.locator('input[name=website]')).toHaveAttribute('tabindex', '-1');
  await expect(form.getByRole('button', { name: 'Subscribe' })).toBeVisible();
});

test('the suggestion form: five link fields with the first required, limits from the shared source, honeypot, credit box', async ({
  page,
  siteUrl,
}) => {
  await page.goto(new URL('/suggest/', siteUrl).href);
  const form = page.locator('form[action="/api/suggest"]');
  const links = form.locator('input[name=link]');
  await expect(links).toHaveCount(suggestionLimits.links);
  await expect(links.first()).toHaveAttribute('required', '');
  await expect(links.nth(1)).not.toHaveAttribute('required', '');
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('type', 'url');
    await expect(link).toHaveAttribute('pattern', 'https?://.+');
    await expect(link).toHaveAttribute('maxlength', String(suggestionLimits.linkLength));
  }
  await expect(form.getByLabel('Link to the report')).toHaveCount(1);
  await expect(form.locator('textarea[name=note]')).toHaveAttribute('maxlength', String(suggestionLimits.note));
  await expect(form.locator('input[name=name]')).toHaveAttribute('maxlength', String(suggestionLimits.name));
  await expect(form.locator('input[name=email]')).toHaveAttribute('maxlength', String(suggestionLimits.email));
  await expect(form.getByLabel('Name (optional)')).toHaveCount(1);
  await expect(form.getByLabel('Email (optional)')).toHaveCount(1);
  await expect(form.getByText('Only used to ask you about this suggestion. Deleted 90 days after we have looked into it.')).toBeVisible();
  await expect(form.getByLabel('Credit me by name if this becomes a case')).toHaveAttribute('type', 'checkbox');
  await expect(form.locator('input[name=website]')).toHaveAttribute('tabindex', '-1');
  await expect(form.getByRole('button', { name: 'Send suggestion' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'what counts as a case' })).toHaveAttribute('href', '/approach');
});

test('the error report form names its case and asks for a note, with links optional', async ({ page, siteUrl }) => {
  await page.goto(new URL('/suggest/error/dnb-2026/', siteUrl).href);
  const form = page.locator('form[action="/api/suggest"]');
  await expect(form.locator('input[name=kind]')).toHaveValue('error');
  await expect(form.locator('input[name=case]')).toHaveValue('dnb-2026');
  await expect(form.locator('textarea[name=note]')).toHaveAttribute('required', '');
  await expect(form.locator('input[name=link]')).not.toHaveAttribute('required', '');
});

test('the browser itself refuses a link that is missing or is not http or https', async ({ page, siteUrl }) => {
  await page.goto(new URL('/suggest/', siteUrl).href);
  const link = page.locator('#suggest-link');
  expect(await link.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await link.fill('ftp://example.com/file');
  expect(await link.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  await link.fill('javascript:alert(1)');
  expect(await link.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  await link.fill('https://example.com/report');
  expect(await link.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true);
});

test('keyboard focus is visible on a form field and on the button', async ({ page, siteUrl }) => {
  await page.goto(new URL('/suggest/', siteUrl).href);
  await page.locator('#suggest-link').focus();
  expect(await page.locator('#suggest-link').evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe('none');
  await page.getByRole('button', { name: 'Send suggestion' }).focus();
  const outline = await page.getByRole('button', { name: 'Send suggestion' }).evaluate((node) => {
    const style = getComputedStyle(node);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline).toEqual({ style: 'solid', width: '2px' });
});

test('the honeypot is out of sight and out of the tab order', async ({ page, siteUrl }) => {
  await page.goto(new URL('/suggest/', siteUrl).href);
  const box = await page.locator('input[name=website]').boundingBox();
  expect(box === null || box.x + box.width < 0).toBe(true);
  await page.locator('#suggest-credit').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Send suggestion' })).toBeFocused();
});

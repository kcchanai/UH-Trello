import {test, expect} from '@playwright/test';

test('critical local-first card workflow persists after reload', async ({page}) => {
  await page.goto('/UH-Trello/');
  await expect(page.getByRole('heading', {level: 1})).toContainText('Website Launch');
  const firstList = page.locator('.list').first();
  await firstList.getByRole('button', {name: /add a card/i}).click();
  const title = `Release smoke ${Date.now()}`;
  await firstList.getByLabel('New card title').fill(title);
  await firstList.getByRole('button', {name: 'Add card'}).click();
  const createdCard = page.locator('.card-open').filter({hasText: title});
  await expect(createdCard).toBeVisible();
  await page.reload();
  await expect(page.locator('.card-open').filter({hasText: title})).toBeVisible();
});

test('card detail dialog closes with Escape and returns focus', async ({page}) => {
  await page.goto('/UH-Trello/');
  const card = page.locator('.card-open').first();
  await card.focus();
  await card.click();
  const dialog = page.locator('#card-dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(card).toBeFocused();
});

test('viewer card dialog close button remains enabled and returns focus', async ({page}) => {
  await page.goto('/UH-Trello/');
  await page.waitForFunction(() => globalThis.FlowboardApp && globalThis.FlowboardState);
  await page.evaluate(() => FlowboardApp.openCloudPreview(FlowboardState.makeWorkspace(), {id:'viewer-test', name:'Viewer test', role:'viewer'}));
  const card = page.locator('.card-open').first();
  await card.click();
  const dialog = page.locator('#card-dialog'), close = dialog.getByRole('button', {name:'Close card details'});
  await expect(dialog).toBeVisible();
  await expect(close).toBeEnabled();
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(card).toBeFocused();
});

test('Google account dialog preserves an explicit local-only boundary', async ({page}) => {
  await page.goto('/UH-Trello/');
  const account = page.getByRole('button', {name: 'Sign in with Google'});
  await account.click();
  const dialog = page.getByRole('dialog', {name: 'Google sign-in'});
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Signing in does not upload, merge, replace, or delete this browser's workspace.");
  await expect(dialog.getByRole('button', {name: 'Continue with Google'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(account).toBeFocused();
});

test('compact cloud-copy status fits the responsive top bar', async ({page}) => {
  await page.setViewportSize({width: 573, height: 500});
  await page.goto('/UH-Trello/');
  const status = page.locator('#cloud-status');
  await status.evaluate(element => { element.textContent = 'Cloud copy · local'; });
  const dimensions = await status.evaluate(element => ({clientWidth:element.clientWidth, scrollWidth:element.scrollWidth}));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test('responsive widths confine horizontal scrolling to the board lane', async ({page}) => {
  await page.goto('/UH-Trello/');
  for (const width of [1280, 700, 440, 320]) {
    await page.setViewportSize({width, height:720});
    const layout = await page.evaluate(() => {
      const root = document.documentElement, board = document.querySelector('#board');
      return {
        pageFits:root.scrollWidth <= root.clientWidth,
        boardOverflow:getComputedStyle(board).overflowX,
        boardScrollable:board.scrollWidth > board.clientWidth
      };
    });
    expect(layout.pageFits, `page overflow at ${width}px`).toBe(true);
    expect(layout.boardOverflow).toBe('auto');
    if (width === 320) expect(layout.boardScrollable).toBe(true);
  }
});

test('forced colors and reduced motion retain borders, focus, and bounded motion', async ({page}) => {
  await page.emulateMedia({forcedColors:'active', reducedMotion:'reduce'});
  await page.goto('/UH-Trello/');
  await page.keyboard.press('Tab');
  const card = page.locator('.card').first();
  const evidence = await card.evaluate(element => {
    const cardStyle = getComputedStyle(element), focusStyle = getComputedStyle(document.activeElement);
    return {
      forcedColors:matchMedia('(forced-colors: active)').matches,
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
      borderStyle:cardStyle.borderStyle,
      transitionSeconds:Math.max(...cardStyle.transitionDuration.split(',').map(value => parseFloat(value) || 0)),
      focusVisible:focusStyle.outlineStyle !== 'none' && parseFloat(focusStyle.outlineWidth) > 0
    };
  });
  expect(evidence.forcedColors).toBe(true);
  expect(evidence.reducedMotion).toBe(true);
  expect(evidence.borderStyle).toBe('solid');
  expect(evidence.transitionSeconds).toBeLessThanOrEqual(0.001);
  expect(evidence.focusVisible).toBe(true);
});

import {test, expect} from '@playwright/test';

test('Mimo status is cached, a chip uses the launcher, and booking keeps airport and date', async ({page}) => {
  await page.addInitScript(() => sessionStorage.setItem('bosphorly.assistant_chat_session','hero-chip-test'));
  await page.route('**/v1/assistant', route => route.fulfill({json:{reply:'Welcome to Istanbul!',lang:'en'}}));
  let reads = 0;
  await page.route('**/v1/public/channels', route => {
    reads++;
    return route.fulfill({json:{channels:{mimo:true}}});
  });
  await page.goto('/?lang=en');
  await expect(page.locator('#ai-online')).toBeVisible();
  await expect(page.locator('.bc-fab')).toBeHidden();
  await page.reload();
  await expect(page.locator('#ai-online')).toBeVisible();
  expect(reads).toBe(1);
  const question = await page.locator('.ai-chips button').first().innerText();
  await page.locator('.ai-chips button').first().click();
  await expect(page.locator('.bc-panel')).toBeVisible();
  await expect(page.locator('.bc-log')).toContainText(question);
  await page.locator('.bc-close').click();
  if (page.viewportSize().width < 768) {
    await expect(page.locator('#ai-quick')).toBeHidden();
    await page.locator('[data-tab="transfer"]').click();
  }
  await page.selectOption('#ai-airport','SAW');
  await page.locator('#ai-date').fill('2030-06-18');
  await page.locator('.ai-next').click();
  await expect(page.locator('[data-airport="SAW"]')).toHaveClass(/selected/);
  await expect(page.locator('#arrivalDate')).toHaveValue('2030-06-18');
  await expect(page.locator('.bc-fab')).toBeVisible();
  await page.locator('.bc-fab').click();
  await expect(page.locator('.bc-log')).toContainText(question);
});

test('off uses inquiry; unknown keeps chat without claiming online', async ({page}) => {
  await page.route('**/v1/public/channels',r=>r.fulfill({json:{channels:{mimo:false}}}));
  await page.goto('/?lang=ar');
  await expect(page.locator('#ai-team')).toBeVisible();
  await expect(page.locator('#ai-online')).toBeHidden();
  await expect(page.locator('#ai-ask')).toBeHidden();
  await page.locator('#ai-team').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(()=>sessionStorage.clear());
  await page.route('**/v1/public/channels',r=>r.fulfill({status:404,body:''}));
  await page.reload();
  await expect(page.locator('#ai-online')).toBeHidden();
  await expect(page.locator('#ai-question')).toBeVisible();
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('#ai-box')).toHaveCSS('animation-name','none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
});

test('typed question uses chat quota response and offers guest registration without tracking consent', async ({page}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('bosphorly.assistant_chat_session','hero-test-session');
    localStorage.setItem('bosphorly.analytics.preference.v2','no');
  });
  await page.route('**/v1/public/channels',r=>r.fulfill({json:{channels:{mimo:true}}}));
  let requests = 0;
  await page.route('**/v1/assistant', async route => {
    requests++;
    expect(route.request().postDataJSON().message).toBe('When does the sunset cruise leave?');
    await route.fulfill({status:429,json:{error:'Daily limit',handoff:true}});
  });
  await page.goto('/?lang=en');
  await page.locator('#ai-question').fill('When does the sunset cruise leave?');
  await page.locator('.ai-go').click();
  await expect(page.locator('#ai-limit')).toContainText('Join for free');
  await expect(page.locator('#ai-limit a')).toHaveAttribute('href','account.html#signup');
  expect(requests).toBe(1);
  expect(await page.evaluate(()=>window.dataLayer)).toBeUndefined();
});

test('tour shortcut opens the selected service in the existing booking page', async ({page}) => {
  await page.goto('/?lang=ru');
  await page.locator('[data-tab="cruise"]').click();
  await page.selectOption('#ai-offer','bb-sunset');
  await page.locator('.ai-next').click();
  await expect(page).toHaveURL(/booking.html\?service=bb-sunset&lang=ru/);
  await expect(page.locator('#offer')).toHaveValue('bb-sunset');
});

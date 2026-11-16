import {test as base,expect} from '@playwright/test';
export const test=base.extend({page:async({page},use)=>{await page.route('https://api.met.no/**',route=>route.abort());await use(page);}});
export {expect};

import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/mobile'. use:{baseURL:'http://127.0.0.1:8765',...(process.env.CI?{trace:'retain-on-failure',screenshot:'only-on-failure'}:{})}
,webServer:{command:'python3 -m http.server 8765 --bind 127.0.0.1',port:8765},projects:[360,390,768].map(width=>({name:`mobile-${width}`,use:{viewport:{width,height:900}}}))});

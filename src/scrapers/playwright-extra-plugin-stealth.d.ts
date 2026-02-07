/**
 * Type declarations for playwright-extra-plugin-stealth
 */
declare module 'playwright-extra-plugin-stealth' {
  import { PuppeteerExtraPlugin } from 'puppeteer-extra-plugin';

  export default function StealthPlugin(): PuppeteerExtraPlugin;
}

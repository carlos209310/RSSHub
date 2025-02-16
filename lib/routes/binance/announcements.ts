import { Data, DataItem, Route } from '@/types';
import { getCurrentPath } from '@/utils/helpers';
import { parseDate } from '@/utils/parse-date';
import { art } from '@/utils/render';
import { load } from 'cheerio';
import { Context } from 'hono';
import path from 'node:path';
import puppeteer from 'puppeteer';

const __dirname = getCurrentPath(import.meta.url);

export const route: Route = {
    path: '/announcements',
    categories: ['finance'],
    example: '/binance/announcements',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'Binance API 公告更新',
    maintainers: ['carlos209310'],
    handler,
};


async function fetchWithPuppeteer(url) {
    const browser = await puppeteer.launch({headless: true, args:['--no-sandbox']});
    const page = await browser.newPage();

    // 模擬真實用戶行為
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2' });

    // 滾動以觸發懶加載 (如果需要)
    // await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // 確保選擇器可用
    await page.waitForSelector('div.bn-flex.w-full.flex-col.gap-4', { timeout: 10000 });

    const content = await page.content();
    await browser.close();
    return content;
}


async function handler(ctx: Context): Promise<Data> {
    const baseUrl = 'https://www.binance.com';
    const currentUrl = 'https://www.binance.com/zh-TC/support/announcement/%E5%B9%A3%E5%AE%89api%E6%9B%B4%E6%96%B0?c=51&navId=51';

    const response = await fetchWithPuppeteer(currentUrl);
    const $ = load(response);

    const items: DataItem[] = $('div.bn-flex.w-full.flex-col.gap-4')
        .toArray()
        .map((item) => {
            const $item = $(item);
            const title = $item.find('h3.typography-body1-1').text().trim();
            const link = baseUrl + $item.find('a').attr('href');
            // const pubDate = parseDate($item.find('div.typography-caption1.noH5\\:typography-body1-1.text-TertiaryText.mobile\\:text-SecondaryText').text().trim()); //此處的冒號需要轉義
            const pubDateText = $item.find('div.typography-caption1.noH5\\:typography-body1-1.text-TertiaryText.mobile\\:text-SecondaryText').text().trim();
            const pubDate = parseDate(pubDateText);

            return {
                title,
                link,
                pubDate,
                description: `幣安 API 更新：${title}  (發布日期：${pubDateText})`, // 簡化描述
            };
        });

    return {
        title: '幣安 API 更新公告',
        link: currentUrl,
        allowEmpty: false,
        item: items,
    };
}
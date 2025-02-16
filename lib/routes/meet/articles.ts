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
    path: '/articles',
    categories: ['blog'],
    example: '/meet/articles',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '創業小聚 - 最新文章',
    maintainers: ['你的GitHub帳號'],
    handler,
};

async function fetchWithPuppeteer(url) {
    const browser = await puppeteer.launch({headless: true, args:['--no-sandbox']});
    const page = await browser.newPage();

    // 模擬真實用戶行為
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2' });

    // 滾動以觸發懶加載
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // 確保選擇器可用
    await page.waitForSelector('div.flex.items-center.gap-x-3', { timeout: 10000 });

    const content = await page.content();
    await browser.close();
    return content;
}



async function handler(ctx: Context): Promise<Data> {
    const baseUrl = 'https://meet.bnext.com.tw';
    const currentUrl = `${baseUrl}/articles/list`;

    const response = await fetchWithPuppeteer(currentUrl);
    const $ = load(response);

    const items: DataItem[] = $('div.flex.items-center.gap-x-3')
        .toArray()
        .map((item) => {
            const $item = $(item);
            const title = $item.find('h2').text().trim();
            const link = baseUrl + $item.find('a').attr('href');
            const pubDate = parseDate($item.find('span:last-child').text().trim());
            const description = $item.find('p').text().trim();
            const cover = $item.find('img').attr('src')?.trim();

            // 檢查 title 是否為空，如果為空則直接返回 null
            if (!title) {
                return null;
            }
            return {
                title,
                link,
                pubDate,
                description: art(path.join(__dirname, 'templates/description.art'), {
                    cover,
                    title,
                    description,
                }),
            };
        }).filter((item) => item !== null) as DataItem[];

    return {
        title: '創業小聚 - 最新文章',
        link: currentUrl,
        allowEmpty: false,
        item: items,
    };
}

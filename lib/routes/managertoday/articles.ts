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
    categories: ['new-media'],
    example: '/managertoday/articles',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '經理人 - 最新文章',
    maintainers: ['carlos209310'], // Replace with your name
    handler,
};

async function fetchWithPuppeteer(url: string): Promise<string> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2' });
    // Scroll to bottom to load all content (if lazy loading is used)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForSelector('div.text-left.flex.my-3', { timeout: 10000 });
    const content = await page.content();
    await browser.close();
    return content;
}

async function handler(ctx: Context): Promise<Data> {
    const baseUrl = 'https://www.managertoday.com.tw';
    const currentUrl = `${baseUrl}/articles`;
    const response = await fetchWithPuppeteer(currentUrl);
    const $ = load(response);

    const items: DataItem[] = $('div.text-left.flex.my-3')
        .toArray()
        .map((item) => {
            const $item = $(item);
            const title = $item.find('h2.text-base').text().trim();
            const link = baseUrl + $item.find('a[href^="/articles/view"]').attr('href');
            const pubDateText = $item.find('div.text-sm.text-black span:last-child').text().trim();
            const pubDate = parseDate(pubDateText);
            const description = $item.find('p.hidden.xl\\:block').text().trim();
            const cover = $item.find('img').attr('src')?.trim();

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
        })
        .filter((item) => item !== null) as DataItem[];

    return {
        title: '經理人 - 最新文章',
        link: currentUrl,
        allowEmpty: false,
        item: items,
    };
}

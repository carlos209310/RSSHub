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
    example: '/hbrtaiwan/articles',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '哈佛商業評論 - 最新文章',
    maintainers: ['carlos209310'],
    handler,
};

async function fetchWithPuppeteer(url) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    // 設定使用者代理
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2' });

    // 等待內容載入
    await page.waitForSelector('.articleItem', { timeout: 10000 });

    const content = await page.content();
    await browser.close();
    return content;
}

async function handler(ctx: Context): Promise<Data> {
    const baseUrl = 'https://www.hbrtaiwan.com';
    const currentUrl = `${baseUrl}/latest?page=5`;

    const response = await fetchWithPuppeteer(currentUrl);
    const $ = load(response);

    const items: DataItem[] = $('.articleItem')
        .toArray()
        .map((item) => {
            const $item = $(item);
            const $title = $item.find('h3 a');
            const $topics = $item.find('.listItem li a');
            const $authors = $item.find('.listItem li:nth-child(3) a');
            const $date = $item.find('.clickItem li:last-child');
            
            const title = $title.text().trim();
            const link = baseUrl + $title.attr('href');
            const pubDate = parseDate($date.text().trim());
            const description = $item.find('.heighP p a').text().trim();
            const cover = $item.find('.imgBox img').attr('src')?.trim();
            
            // 獲取主題和作者
            const topics = $topics.map((_, el) => $(el).text().trim()).get();
            const authors = $authors.map((_, el) => $(el).text().trim()).get();

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
                    topics,
                    authors,
                }),
                category: topics,
                author: authors.join(', '),
            };
        })
        .filter((item) => item !== null) as DataItem[];

    return {
        title: '哈佛商業評論 - 最新文章',
        link: currentUrl,
        allowEmpty: false,
        item: items,
    };
}
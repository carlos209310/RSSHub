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
    example: '/brandinlabs/articles',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '品牌癮 - 最新文章',
    maintainers: ['carlos209310'],
    handler,
};

async function fetchWithPuppeteer(url) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // 等待文章內容載入
    await page.waitForSelector('#uid_837a14a div.p-wrap', { timeout: 10000 });
    
    const content = await page.content();
    await browser.close();
    
    return content;
}

async function handler(ctx: Context): Promise<Data> {
    const baseUrl = 'https://www.brandinlabs.com';
    const currentUrl = baseUrl;
    
    const response = await fetchWithPuppeteer(currentUrl);
    const $ = load(response);
    
    const items: DataItem[] = $('#uid_837a14a div.p-wrap')
        .toArray()
        .map((item) => {
            const $item = $(item);
            
            const title = $item.find('h4.entry-title a').text().trim();
            const link = $item.find('h4.entry-title a').attr('href')?.trim();
            const category = $item.find('.p-category').text().trim().split(',').map(cat => cat.trim());
            const cover = $item.find('.featured-img').attr('src')?.trim();
            
            // 如果標題為空則返回 null
            if (!title) {
                return null;
            }

            return {
                title,
                link,
                category,
                description: art(path.join(__dirname, 'templates/description.art'), {
                    cover,
                    title,
                    category,
                }),
            };
        })
        .filter((item) => item !== null) as DataItem[];

    return {
        title: '品牌癮 - 最新文章',
        link: currentUrl,
        allowEmpty: false,
        item: items,
    };
}
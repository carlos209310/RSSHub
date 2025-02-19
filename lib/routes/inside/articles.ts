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
    example: '/inside/articles',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'INSIDE - 最新文章',
    maintainers: ['carlos209310'],
    handler,
};

async function fetchWithPuppeteer(url: string) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.post_list_item', { timeout: 10000 });
    
    const content = await page.content();
    await browser.close();
    
    return content;
}

async function handler(ctx: Context): Promise<Data> {
    const baseUrl = 'https://www.inside.com.tw';
    const currentUrl = `${baseUrl}`;
    
    const response = await fetchWithPuppeteer(currentUrl);
    const $ = load(response);
    
    const items: DataItem[] = $('.post_list_item')
        .toArray()
        .map((item) => {
            const $item = $(item);
            
            const title = $item.find('.post_title a').text().trim();
            const link = $item.find('.post_title a').attr('href');
            const description = $item.find('.post_description').text().trim();
            const pubDate = parseDate($item.find('.post_date span').text().trim());
            const category = $item.find('.post_category').text().trim();
            const author = $item.find('.post_author a').text().trim();
            
            const coverStyle = $item.find('.post_cover_inner').attr('style');
            const coverMatch = coverStyle?.match(/url\('([^']+)'\)/);
            const cover = coverMatch ? coverMatch[1] : '';
            
            const tags = $item.find('.hero_slide_tag')
                .map((_, tag) => $(tag).text().trim())
                .get()
                .join('、');

            if (!title) {
                return null;
            }
            if (!category) {
                return null;
            }

            return {
                title,
                link,
                pubDate,
                author,
                description: art(path.join(__dirname, 'templates/description.art'), {
                    cover,
                    title,
                    description,
                    author,
                    tags,
                }),
            };
        })
        .filter((item) => item !== null) as DataItem[];

    return {
        title: 'INSIDE - 最新文章',
        link: currentUrl,
        allowEmpty: false,
        item: items,
    };
}
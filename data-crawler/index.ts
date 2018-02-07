import * as sqlite from 'sqlite';
import * as puppeteer from 'puppeteer';
import { color } from './color';
import { Database } from 'sqlite';

console.log(`${process.argv}`);

interface Entity {
    id: string,
    time: string,
    acct: string,
    type: string,
    out: number,
    in: number,
    bal: number,
    desc: string
}

interface PageData {
    entities: Entity[],
    candidates: string[]
}

sqlite
    .open('ulg168.db')
    .then(db => db.exec(`
        create table if not exists "trans_raw"
        (
            "id" text(16),
            "time" text(19),
            "acct" text(5),
            "type" text(20),
            "out" real,
            "in" real,
            "bal" real,
            "desc" text(255),
            unique ("id", "time", "acct", "type", "desc")
        );
        create table if not exists "trans_tmp"
        (
            "id" text(16),
            "time" text(19),
            "acct" text(5),
            "type" text(20),
            "out" real,
            "in" real,
            "bal" real,
            "desc" text(255),
            unique ("id", "time", "acct", "type", "desc")
        );`))
    .then(async db => {
        const candidates = await getCandidates(db);
        console.log(`從資料庫中取得 ${color.yellow(candidates.length.toLocaleString())} 筆名單。`);

        await puppeteer
            .launch({
                headless: false,
                userDataDir: 'chromium-data'
            })
            .then(async browser => {
                const page = (await browser.pages())[0];
                await page.goto('http://ulg168.com');
                await page.waitForSelector('div.container>marquee'); // 等待登入完成

                await getEntities(page, candidates)
                    .then(entities => writeData(db, entities))
                    .then(() => mergeData(db));

                return browser;
            })
            .then(browser => browser.close());

        return db;
    })
    .then(async db => {
        await db.close();
        console.log(color.yellow_bg(color.black('完成!')));
    });

async function getCandidates(db: Database): Promise<string[]> {
    let sql = 'select distinct [id] from [trans_raw]';
    if (process.argv.length > 2) {
        const argv = process.argv.slice(2);
        const cond = argv.map(s => `'${s}'`).join(', ');
        sql += ` where [id] in (${cond})`;
    }

    const candidates: string[] = [];
    await db.each(sql, (err, row) => {
        candidates.push(row.id);
    });

    return candidates;
}

async function getEntities(page: puppeteer.Page, candidates: string[]): Promise<Entity[]> {
    let all: Entity[] = [];
    const fetched: string[] = [];

    while (candidates.length) {
        const user_id = candidates.pop();
        if (!user_id)
            continue;

        console.log(`開始查 ${color.red(user_id)} [名單尚餘 ${color.yellow(candidates.length.toLocaleString())} 筆]`);
        fetched.push(user_id);
        const pageData = await getPageData(page, user_id);
        console.log(`=> 查出 ${color.green(pageData.entities.length.toLocaleString())} 筆資料`);
        all = all.concat(pageData.entities);

        for (const c of pageData.candidates) {
            if (candidates.indexOf(c) === -1 && fetched.indexOf(c) === -1) {
                candidates.push(c);
                console.log(`=> 帳號 ${color.red(c)} 列入待查`);
            }
        }
    }

    return all;
}

async function getPageData(page: puppeteer.Page, user_id: string): Promise<PageData> {
    await page.goto('http://ulg168.com/account');
    await page.select('select#user_type', 'sub');
    await page.type('input#username', user_id);
    await page.select('select#range', 'this_week');
    await page.select('select#type', 'all');
    await page.tap('button[type="submit"]');

    let entities: Entity[] = [];
    let candidates: string[] = [];
    while (true) {
        const pi = await getOnePageData(page, user_id);
        entities = entities.concat(pi.entities);
        candidates = candidates.concat(pi.candidates);
        
        const nextPage = await page.waitForSelector('li.paginate_button.next');
        if (await page.evaluate(e => e.classList.contains('disabled'), nextPage)) {
            break;
        } else {
            const a = await nextPage.$('a');
            if (a)
                await a.click();
            else
                break;
        }
    }

    return {
        entities,
        candidates
    };
}

async function getOnePageData(page: puppeteer.Page, user_id: string): Promise<PageData> {
    await page.waitForSelector('ul.pagination');
    const dataTable = await page.waitForSelector('table#data_list');
    const pageInfo = await page.evaluate((user_id, dataTable): PageData => {
        const entities: Entity[] = [];
        const candidates: string[] = [];

        for (const row of dataTable.querySelectorAll('tbody>tr')) {
            const cells = row.querySelectorAll('td');
            if (cells.length == 7) {
                var o = {
                    id: user_id,
                    time: cells[0].innerText,
                    acct: cells[1].innerText,
                    type: cells[5].innerText,
                    out: cells[2].innerText,
                    in: cells[3].innerText,
                    bal: cells[4].innerText,
                    desc: cells[6].innerText
                };
                
                if (o.out.length == 0)
                    o.out = null;
                    
                if (o.in.length == 0)
                    o.in = null;

                if (o.type == '使用紅包卡') {
                    o.desc.replace(/.*\((.+) -> (.+)\)/, function(a: string, b: string, c: string) {
                        if (candidates.indexOf(c) === -1)
                            candidates.push(c);
                    });
                }

                entities.push(o);
            }
        }

        return {
            entities,
            candidates
        };
    }, user_id, dataTable);

    return pageInfo;
}

async function writeData(db: Database, entities: Entity[]) {
    console.log(`正在將 ${color.cyan(entities.length.toLocaleString())} 筆資料寫入資料庫。`);
    await db
        .exec('delete from [trans_tmp]')
        .then(async db => {
            db
                .prepare('insert into [trans_tmp] values(?, ?, ?, ?, ?, ?, ?, ?)')
                .then(async s => {
                    for (const e of entities) {
                        await s.run(e.id, e.time, e.acct, e.type, e.out, e.in, e.bal, e.desc);
                    }

                    return s;
                })
                .then(s => s.finalize());

            return db;
        });
}

async function mergeData(db: Database) {
    console.log(`正在合併資料表。`);
    await db.exec(`
        insert into [trans_raw]
        select distinct
            a.*
        from
            [trans_tmp] a
            left join [trans_raw] b on a.id=b.id and a.time=b.time and a.acct=b.acct and a.type=b.type and a.desc=b.desc
        where
            b.[id] is null
    `);
}
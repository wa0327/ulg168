'use strict';

const util = require('util');
const puppeteer = require('puppeteer');
const sqlite = require('sqlite');
const color = require('./color');

Number.prototype.toHumanString = function() {
    return this.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
};

sqlite
    .open('ulg168.db')
    .then(async db => {
        await db.exec(`create table if not exists "trans_raw"
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
        )`).then(db => db.exec(`create table if not exists "trans_tmp"
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
        )`));

        return {
            db,
            candidates: null,
            browser: null,
            entities: null
        };
    })
    .then(async args => {
        const candidates = [];

        var sql = 'select distinct [id] from [trans_raw]';
        if (process.argv.length > 2) {
            const cond = process.argv.slice(2).map(s => `'${s}'`).join(', ');
            sql += ` where [id] in (${cond})`;
        }
        console.debug(`sql: ${sql}`);

        await args.db.each(sql, (err, row) => {
            candidates.push(row.id);
        });
        args.candidates = candidates;
        console.log(`從資料庫中取得 ${color.yellow(candidates.length.toHumanString())} 筆名單。`);
        return args;
    })
    .then(async args => {
        args.browser = await puppeteer.launch({
            // headless: false,
            userDataDir: 'chromium-data'
        });
        return args;
    })
    .then(async args => {
        const browser = args.browser;
        const candidates = args.candidates
        const page = (await browser.pages())[0];
        page.on('console', msg => console.log(`PAGE: ${msg.text()}`));

        await page.goto('http://ulg168.com');
        await page.waitForSelector('div.container>marquee');

        var all = [];
        const fetched_ids = [];
        while (candidates.length > 0) {
            const user_id = candidates.pop();
            console.log(`開始查 ${color.red(user_id)} [名單尚餘 ${color.yellow(candidates.length.toHumanString())} 筆]`);
            fetched_ids.push(user_id);
    
            // 進入帳戶明細頁面，輸入查詢條件後查詢。
            await page.goto('http://ulg168.com/account');
            await page.select('select#user_type', 'sub');
            await page.type('input#username', user_id);
            await page.select('select#range', 'this_week');
            await page.select('select#type', 'all');
            await page.tap('button[type="submit"]');
    
            var batch = [];
            while (true) {
                const dataTable = await page.waitForSelector('table#data_list');
                const nextPage = await page.waitForSelector('li.paginate_button.next');
    
                const result = await page.evaluate((userId, dataTable) => {
                    const rows = [];
                    const candidates = [];
                    for (const row of dataTable.querySelectorAll('tbody>tr')) {
                        const cells = row.querySelectorAll('td');
                        if (cells.length == 7) {
                            var o = {
                                id: userId,
                                time: cells[0].innerText,
                                acct: cells[1].innerText,
                                type: cells[5].innerText,
                                out: cells[2].innerText,
                                in: cells[3].innerText,
                                bal: cells[4].innerText,
                                desc: cells[6].innerText
                            };
                            
                            if (o.out.length == 0) o.out = null;
                            if (o.in.length == 0) o.in = null;
    
                            if (o.type == '使用紅包卡') {
                                o.desc.replace(/.*\((.+) -> (.+)\)/, function(a, b, c) {
                                    if (candidates.indexOf(c) === -1)
                                        candidates.push(c);
                                });
                            }
    
                            rows.push(o);
                        }
                    }
                    return {
                        rows,
                        candidates
                    };
                }, user_id, dataTable);
    
                batch = batch.concat(result.rows);
                for (const c of result.candidates) {
                    if (candidates.indexOf(c) === -1 && fetched_ids.indexOf(c) === -1) {
                        candidates.push(c);
                        console.log(`=> 帳號 ${color.red(c)} 列入待查`);
                    }
                }
    
                if (await page.evaluate(e => e.classList.contains('disabled'), nextPage))
                    break;
                else
                    await (await nextPage.$('a')).click();
            }

            console.log(`=> 查出 ${color.green(batch.length.toHumanString())} 筆資料`);
            all = all.concat(batch);
        }
    
        args.entities = all;

        return args;
    })
    .then(async args => {
        const db = args.db;
        const entities = args.entities;

        console.log(`正在將 ${color.cyan(entities.length.toHumanString())} 筆資料寫入資料庫。`);
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

        return args;
    })
    .then(async args => {
        console.log(`正在合併資料表。`);
        await args.db.exec(`
        insert into [trans_raw]
        select distinct
            a.*
        from
            [trans_tmp] a
            left join [trans_raw] b on a.id=b.id and a.time=b.time and a.acct=b.acct and a.type=b.type and a.desc=b.desc
        where
            b.[id] is null`);

        return args;
    })
    .then(async args => {
        await args.browser.close();
        await args.db.close();
        console.log(color.yellow_bg(color.black('完成!')));
    });

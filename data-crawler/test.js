#!/usr/local/bin/node
const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        // executablePath: '/Users/wa0327/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });

    const page = (await browser.pages())[0];
    // await page.setRequestInterception(true);
    // page.on('request', request => {
    //     if (request.resourceType() === 'image')
    //         request.abort();
    //     else
    //         request.continue();
    // });
    page.on('console', msg => console.log('PAGE: ' + msg.text()));
    page.evaluateOnNewDocument(() => {
        document.addEventListener('activate', e => {
            console.log(e);
        })
    })
    await page.goto('http://ulg168.com');
    await page.waitForSelector('div.container>marquee');
    
    // await page.emulate(devices['iPhone 6']);
    await page.evaluate(() => console.log(location.href));
    await page.screenshot({path: 'full.png', fullPage: true});

    try {
        const result = await page.evaluate(() => {
            let text1 = document.querySelector('input[name="btnK"]').value
            let text2 = document.querySelector('input[name="btnI"]').value

            return {
                text1,
                text2
            };
        });
        console.log(result);
    } catch (error) {
        console.error('failed to evaluate');
    }

    browser.close();
})()

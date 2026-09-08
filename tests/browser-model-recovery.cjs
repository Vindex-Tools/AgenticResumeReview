// Run with Node and a local Chrome installation. Override the executable with CHROME_PATH.
// Provider calls are mocked; no API keys or paid requests are used.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-recovery-'));
const server = http.createServer((req, res) => {
    const pathname = req.url.split('?')[0];
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'text/plain');
        res.end(data);
    });
});
let browser, socket;
async function main() {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const executable = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'chromium');
    browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    const endpoint = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Chrome did not start')), 15000);
        browser.on('error', error => { clearTimeout(timer); reject(error); });
        browser.stderr.on('data', data => {
            const match = data.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) { clearTimeout(timer); resolve(match[1]); }
        });
    });
    const pages = await (await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();
    socket = new WebSocket(pages.find(page => page.type === 'page' && page.url === 'about:blank').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let sequence = 0;
    const pending = new Map(), errors = [];
    socket.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data);
        if (message.id) {
            const promise = pending.get(message.id);
            pending.delete(message.id);
            message.error ? promise.reject(message.error) : promise.resolve(message.result);
        }
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const run = async expression => {
        const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const wait = async expression => {
        for (let i = 0; i < 150; i++) {
            if (await run(expression)) return;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw Error('Timed out: ' + expression);
    };
    await call('Runtime.enable');
    await call('Page.enable');
    await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    await wait("typeof selectProvider === 'function'");
    await run(`
        window.postCount = 0;
        const originalFetch = window.fetch;
        window.fetch = async (url, options = {}) => {
            if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) return originalFetch(url, options);
            const response = (body, status = 200) => ({ok: status < 400, status, json: async () => body});
            if (options.method === 'GET') return response({models: ['gemini-2.5-flash', 'gemini-3.6-flash'].map(id => ({name:'models/' + id, supportedGenerationMethods:['generateContent']}))});
            window.postCount++;
            if (String(url).includes('gemini-2.5-flash')) return response({error:{message:'This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash for the latest features and improvements. We recommend you to use the Interactions API.'}},404);
            return response({candidates:[{finishReason:'STOP',content:{parts:[{text:'# Review\\n\\nResume evidence preserved.'}]}}]});
        };
        selectProvider('gemini');
        apiKeyInput.value='fake-regression-key';
        apiKeyInput.dispatchEvent(new Event('input'));
        fetchModelsBtn.click();
    `);
    await wait("modelSelect.value === 'gemini-3.6-flash' && !fetchModelsBtn.disabled");
    await run("handleFiles([new File(['SOC analyst with Splunk experience.'],'resume.txt',{type:'text/plain'})])");
    await run("modelSelect.value='gemini-2.5-flash';modelSelect.dispatchEvent(new Event('change'));analyzeBtn.click()");
    await wait("!!document.getElementById('select-replacement-model') && !reviewBusy");
    assert.equal(await run('window.postCount'), 1);
    assert.equal(await run('modelSelect.value'), '');
    assert.equal(await run("modelSelect.querySelector('[value=\"gemini-2.5-flash\"]').disabled"), true);
    assert.equal(await run('resumeText'), 'SOC analyst with Splunk experience.');
    await run("document.getElementById('select-replacement-model').click()");
    assert.equal(await run('modelSelect.value'), 'gemini-3.6-flash');
    assert.equal(await run('window.postCount'), 1, 'Selecting a replacement must not send a paid request');
    await run('analyzeBtn.click()');
    await wait("reportStatusBadge.textContent === 'Complete'");
    assert.equal(await run('window.postCount'), 2);
    assert.equal(await run("resultsContent.querySelector('h1').textContent"), 'Review');
    await run('fetchModelsBtn.click()');
    await wait('!fetchModelsBtn.disabled');
    assert.equal(await run("modelSelect.querySelector('[value=\"gemini-2.5-flash\"]').disabled"), true);
    await run("apiKeyInput.value='different-fake-key';apiKeyInput.dispatchEvent(new Event('input'));fetchModelsBtn.click()");
    await wait('!fetchModelsBtn.disabled');
    assert.equal(await run("modelSelect.querySelector('[value=\"gemini-2.5-flash\"]').disabled"), false);
    assert.deepEqual(errors, []);
    console.log('PASS: newer default, reported error, disabled rejected model, explicit replacement selection, successful retry, same-key refresh, key-change reset.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
    socket?.close();
    browser?.kill();
    server.close();
});

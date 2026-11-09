/* Run with playwright-core on NODE_PATH and CHROME_PATH pointing to Chromium. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { readFile, mkdtemp, writeFile, utimes, rm } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname,'..');
const family = '芈氏飞刀';
const staleTitle = '星位点三三 · 长';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};
let browser;

test.before(async () => {
  browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
});
test.after(async () => { await browser?.close(); });

// Use actual HTTP caching. Playwright routing would disable the cache and make
// this regression pass without reproducing the user's old-script problem.
async function cacheFixture() {
  let phase = 1;
  const requests = [];
  const currentIndex = await readFile(path.join(root,'index.html'),'utf8');
  const oldIndex = currentIndex.replace(/((?:src|href)="[^"?]+)\?v=[^"\s]+/g,'$1');
  const server = http.createServer(async (request,response) => {
    const requested = new URL(request.url,'http://localhost');
    const pathname = requested.pathname === '/' ? '/index.html' : requested.pathname;
    const activePhase = phase;
    const record = {phase:activePhase,url:requested.pathname+requested.search,
      pathname,ifNoneMatch:request.headers['if-none-match'],status:null};
    requests.push(record);
    try {
      const filename = path.resolve(root,'.'+pathname);
      if (!filename.startsWith(root+path.sep)) throw new Error('outside fixture');
      let body = pathname === '/index.html' ? Buffer.from(activePhase===1?oldIndex:currentIndex) : await readFile(filename);
      if (pathname === '/joseki-knowledge.js' && activePhase === 1) {
        body = Buffer.concat([body,Buffer.from(`\n{
          const original = globalThis.JosekiKnowledge;
          globalThis.JosekiKnowledge = {...original,describe(input) {
            const result = original.describe(input);
            return result.title === ${JSON.stringify(family)} ? {...result,title:${JSON.stringify(staleTitle)}} : result;
          }};
        }\n`)]);
      }
      if (pathname === '/app.js') body = Buffer.concat([body,Buffer.from(`\nglobalThis.__cacheRefreshProbe = ${activePhase};\n`)]);
      const etag = '"'+createHash('sha256').update(body).digest('hex')+'"';
      const cacheControl = pathname === '/index.html' || activePhase > 1 ? 'no-cache' : 'public, max-age=31536000';
      response.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');
      response.setHeader('Cache-Control',cacheControl);
      response.setHeader('ETag',etag);
      if (request.headers['if-none-match'] === etag) {
        record.status = 304;
        response.writeHead(304);
        response.end();
      } else {
        record.status = 200;
        response.setHeader('Content-Length',body.length);
        response.writeHead(200);
        response.end(body);
      }
    } catch (error) {
      record.status = 404;
      response.writeHead(404);
      response.end(error.message);
    }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}/`,requests,currentIndex,
    setPhase(value) { phase=value; },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve,reject) => server.close(error => error?reject(error):resolve()));
    }};
}

async function checkReportedPosition(page,expected) {
  await page.waitForFunction(() => window.JosekiExplorer);
  const current = await page.evaluate(() => {
    JosekiExplorer.loadNode(10132);
    return JosekiExplorer.getState();
  });
  assert.equal(current.position.moveNumber,6,'the exact six-move position from the screenshot');
  assert.equal(await page.locator('#position-title').textContent(),expected);
  const index = current.candidates.findIndex(candidate => candidate.nodeIds.includes(10133));
  assert.ok(index>=0,'Black N18 is available');
  const candidate = current.candidates[index];
  assert.deepEqual(candidate.move,{color:'B',x:12,y:1});
  await page.locator(`[data-preview="${index}"]`).click();
  if (candidate.nodeIds.length>1) await page.selectOption('#preview-branch',String(candidate.nodeIds.indexOf(10133)));
  assert.equal(await page.locator('#preview-title').textContent(),expected,'N18 preview uses the same family name');
  await page.click('#preview-close');
}

test('ordinary reload replaces a genuinely cached old naming module and revalidates later edits',async t => {
  const fixture = await cacheFixture();
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  t.after(async () => {
    await context.close();
    await fixture.close();
    assert.deepEqual(errors,[]);
  });

  const currentApp = /<script\b[^>]*\bsrc="(app\.js\?v=[^"]+)"/.exec(fixture.currentIndex)?.[1];
  const currentKnowledge = /<script\b[^>]*\bsrc="(joseki-knowledge\.js\?v=[^"]+)"/.exec(fixture.currentIndex)?.[1];
  assert.ok(currentApp,'the real index versions app.js');
  assert.ok(currentKnowledge,'the real index versions the naming module');

  await page.goto(fixture.url);
  await checkReportedPosition(page,staleTitle);
  assert.equal(await page.evaluate(() => globalThis.__cacheRefreshProbe),1);
  const count = pathname => fixture.requests.filter(request => request.pathname===pathname).length;
  assert.equal(count('/joseki-knowledge.js'),1);
  assert.equal(count('/app.js'),1);

  // Navigate away and back without reload semantics: the second visit must
  // actually reuse fresh JS from this same context's HTTP cache.
  await page.goto('about:blank');
  await page.goto(fixture.url);
  await checkReportedPosition(page,staleTitle);
  assert.equal(count('/joseki-knowledge.js'),1,'the stale naming module was reused from cache');
  assert.equal(count('/app.js'),1,'the stale app was reused from cache');

  fixture.setPhase(2);
  await page.reload();
  await checkReportedPosition(page,family);
  assert.equal(await page.evaluate(() => globalThis.__cacheRefreshProbe),2);
  for (const asset of [currentApp,currentKnowledge]) {
    assert.ok(fixture.requests.some(request => request.phase===2&&request.url==='/'+asset&&request.status===200),
      `ordinary reload fetched the new version of ${asset}`);
  }
  assert.equal(fixture.requests.filter(request => request.phase>1&&request.url==='/joseki-knowledge.js').length,0,
    'updating the page bypassed the old unversioned naming cache');

  fixture.setPhase(3);
  await page.reload();
  await checkReportedPosition(page,family);
  assert.equal(await page.evaluate(() => globalThis.__cacheRefreshProbe),3,
    'no-cache permits later changes even when the resource URL stays identical');
  const refreshedApp = fixture.requests.find(request => request.phase===3&&request.url==='/'+currentApp);
  assert.ok(refreshedApp?.ifNoneMatch,'the browser revalidated the existing app cache');
  assert.equal(refreshedApp.status,200,'changed content replaced the cached app');
  const unchangedKnowledge = fixture.requests.find(request => request.phase===3&&request.url==='/'+currentKnowledge);
  assert.equal(unchangedKnowledge?.status,304,'unchanged content still benefits from conditional caching');
});

function request(url,options={}) {
  return new Promise((resolve,reject) => {
    const outgoing = http.request(url,options,response => {
      const chunks = [];
      response.on('data',chunk => chunks.push(chunk));
      response.on('end',() => resolve({status:response.statusCode,headers:response.headers,
        body:Buffer.concat(chunks).toString('utf8')}));
      response.on('error',reject);
    });
    outgoing.on('error',reject);
    outgoing.end();
  });
}

test('the actual Python server revalidates 200 and 304 responses and reloads changed files at the same URL',async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(),'joseki-cache-server-'));
  const files = {
    'index.html':'<!doctype html><link rel="stylesheet" href="styles.css?v=fixed"><script src="app.js?v=fixed"></script>',
    'styles.css':'body { color: black; }',
    'app.js':'globalThis.cacheServerVersion = 1;'
  };
  // SimpleHTTPRequestHandler uses whole-second Last-Modified timestamps.
  const originalTime = new Date(Math.floor(Date.now()/1000)*1000-5000);
  await Promise.all(Object.entries(files).map(async ([name,body]) => {
    const filename = path.join(directory,name);
    await writeFile(filename,body);
    await utimes(filename,originalTime,originalTime);
  }));
  const child = spawn('python3',['-u',path.join(root,'server.py'),'0','--bind','127.0.0.1','--directory',directory],
    {stdio:['ignore','pipe','pipe']});
  let context;
  let stderr = '';
  child.stderr.on('data',chunk => { stderr+=chunk; });
  t.after(async () => {
    await context?.close();
    if (child.exitCode===null&&child.signalCode===null) {
      const exited = new Promise(resolve => child.once('exit',resolve));
      child.kill('SIGTERM');
      await exited;
    }
    await rm(directory,{recursive:true,force:true});
  });
  const port = await new Promise((resolve,reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Python cache server did not start: '+stderr)),10000);
    const failed = error => { clearTimeout(timeout); reject(error); };
    child.once('error',failed);
    child.once('exit',code => failed(new Error(`Python cache server exited ${code}: ${stderr}`)));
    child.stdout.on('data',chunk => {
      output+=chunk;
      const match = /on 127\.0\.0\.1:(\d+)/.exec(output);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
    });
  });
  const base = `http://127.0.0.1:${port}`;
  for (const suffix of ['/','/index.html','/app.js?v=fixed','/styles.css?v=fixed']) {
    const initial = await request(base+suffix);
    assert.equal(initial.status,200,suffix);
    assert.equal(initial.headers['cache-control'],'no-cache',suffix+' 200 cache policy');
    assert.ok(initial.headers['last-modified']);
    assert.ok(initial.body.length);
    const unchanged = await request(base+suffix,{headers:{'If-Modified-Since':initial.headers['last-modified']}});
    assert.equal(unchanged.status,304,suffix);
    assert.equal(unchanged.headers['cache-control'],'no-cache',suffix+' 304 cache policy');
    assert.equal(unchanged.body,'');
    const head = await request(base+suffix,{method:'HEAD'});
    assert.equal(head.status,200);
    assert.equal(head.headers['cache-control'],'no-cache');
    assert.equal(head.body,'');
  }

  context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base+'/');
  assert.equal(await page.evaluate(() => globalThis.cacheServerVersion),1);
  const scriptURL = await page.locator('script').getAttribute('src');
  const prior = await request(base+'/'+scriptURL);
  await writeFile(path.join(directory,'app.js'),'globalThis.cacheServerVersion = 2;');
  const updatedTime = new Date(originalTime.getTime()+2000);
  await utimes(path.join(directory,'app.js'),updatedTime,updatedTime);
  const changed = await request(base+'/'+scriptURL,{headers:{'If-Modified-Since':prior.headers['last-modified']}});
  assert.equal(changed.status,200);
  assert.equal(changed.headers['cache-control'],'no-cache');
  assert.match(changed.body,/cacheServerVersion = 2/);
  await page.reload();
  assert.equal(await page.locator('script').getAttribute('src'),scriptURL,'the resource address did not change');
  assert.equal(await page.evaluate(() => globalThis.cacheServerVersion),2,'ordinary reload updates the cached script');
});

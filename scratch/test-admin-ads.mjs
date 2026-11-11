import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9227;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ]);

  try {
    for (let i = 0; i < 20; i++) {
      try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
      catch { await sleep(250); }
    }

    const listRes = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = listRes.find(p => p.type === 'page') || listRes[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let msgId = 1;
    const pending = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m.result);
        pending.delete(m.id);
      }
    };
    function send(method, params = {}) {
      return new Promise(r => {
        const id = msgId++;
        pending.set(id, r);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('DOM.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // First go to /auth
    await send('Page.navigate', { url: 'http://localhost:8080/auth?next=%2Fadmin%2Fmarketing%2Fads' });
    await sleep(1500);

    // Set dev_admin and log in
    await send('Runtime.evaluate', {
      expression: `(() => {
        localStorage.setItem('dev_admin', 'true');
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');
        if (emailInput && passInput) {
          emailInput.value = 'admin-test@apnalocal.in';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.value = 'Password@123';
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          submitBtn?.click();
          return 'SUBMITTED';
        }
        return 'INPUTS_NOT_FOUND';
      })()`,
      returnByValue: true,
    });

    await sleep(2500);

    // Now navigate to /admin/marketing/ads directly with dev_admin in place
    await send('Page.navigate', { url: 'http://localhost:8080/admin/marketing/ads' });
    await sleep(2000);

    // Inspect the page
    const pageInspection = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          currentUrl: window.location.href,
          title: document.title,
          h2: document.querySelector('h2')?.textContent,
          stats: Array.from(document.querySelectorAll('.grid > div')).map(d => d.textContent),
          banners: Array.from(document.querySelectorAll('section')).map(s => ({
            heading: s.querySelector('h3')?.textContent,
            items: Array.from(s.querySelectorAll('article, .space-y-2 > div')).map(el => el.textContent?.slice(0, 100))
          })),
          buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean)
        };
      })()`,
      returnByValue: true,
    });

    console.log('Page Inspection:', JSON.stringify(pageInspection.result.value, null, 2));

    // Capture screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync('scratch', { recursive: true });
    fs.writeFileSync('scratch/admin_marketing_ads.png', Buffer.from(shot.data, 'base64'));
    console.log('Screenshot saved to scratch/admin_marketing_ads.png');

    // Test clicking "New banner" button
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const newBtn = btns.find(b => b.textContent?.includes('New banner'));
        if (newBtn) {
          newBtn.click();
          return 'CLICKED_NEW_BANNER';
        }
        return 'BUTTON_NOT_FOUND';
      })()`,
      returnByValue: true,
    });

    await sleep(1000);

    // Inspect Modal
    const modalInspection = await send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.querySelector('.fixed.inset-0');
        if (!modal) return { open: false };
        return {
          open: true,
          modalTitle: modal.querySelector('h2')?.textContent,
          labels: Array.from(modal.querySelectorAll('label')).map(l => l.textContent?.trim()),
          inputs: Array.from(modal.querySelectorAll('input, select')).map(i => i.getAttribute('type') || i.tagName),
          buttons: Array.from(modal.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean)
        };
      })()`,
      returnByValue: true,
    });

    console.log('Modal Inspection:', JSON.stringify(modalInspection.result.value, null, 2));

    const modalShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/admin_banner_modal.png', Buffer.from(modalShot.data, 'base64'));
    console.log('Modal screenshot saved to scratch/admin_banner_modal.png');

    ws.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);

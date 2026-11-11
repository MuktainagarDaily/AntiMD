import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9228;
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
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 850, deviceScaleFactor: 1, mobile: false });

    // Seed dev admin in localStorage and navigate
    await send('Page.navigate', { url: 'http://localhost:8080/' });
    await sleep(500);
    await send('Runtime.evaluate', { expression: `localStorage.setItem('dev_admin', 'true')` });
    await send('Page.navigate', { url: 'http://localhost:8080/admin/marketing/ads' });
    await sleep(2000);

    // 1. Test "Hide ads for me" toggle
    const toggleBefore = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Hide ads for me') || b.textContent?.includes('Show ads for me'));
        const badge = document.querySelector('.bg-success\\\\/15, .bg-muted.text-muted-foreground')?.textContent;
        return { btnText: btn?.textContent?.trim(), badge };
      })()`,
      returnByValue: true
    });
    console.log('1. Ads visibility toggle (initial):', toggleBefore.result.value);

    // Click "Hide ads for me"
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Hide ads for me'));
        btn?.click();
      })()`
    });
    await sleep(500);

    const toggleAfter = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Hide ads for me') || b.textContent?.includes('Show ads for me'));
        const badge = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.includes('Ads ON') || s.textContent?.includes('Ads OFF'))?.textContent;
        return { btnText: btn?.textContent?.trim(), badge };
      })()`,
      returnByValue: true
    });
    console.log('1b. Ads visibility toggle (after click):', toggleAfter.result.value);

    // Click "Show ads for me" back to keep ads on
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Show ads for me'));
        btn?.click();
      })()`
    });
    await sleep(500);

    // 2. Test Filters
    const filterPopup = await send('Runtime.evaluate', {
      expression: `(() => {
        const popupFilter = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Popup0'));
        popupFilter?.click();
      })()`
    });
    await sleep(500);

    const popupView = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          sections: Array.from(document.querySelectorAll('section h3')).map(h => h.textContent),
          bannerRows: document.querySelectorAll('.space-y-2 > div').length
        };
      })()`,
      returnByValue: true
    });
    console.log('2. After clicking "Popup (0)" filter:', popupView.result.value);

    // Reset filter to All
    await send('Runtime.evaluate', {
      expression: `(() => {
        const allFilter = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('All groups'));
        allFilter?.click();
      })()`
    });
    await sleep(500);

    // 3. Test Clicking "Edit" on the existing banner
    await send('Runtime.evaluate', {
      expression: `(() => {
        const editBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Edit');
        editBtn?.click();
      })()`
    });
    await sleep(800);

    const editModalInspection = await send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.querySelector('.fixed.inset-0');
        if (!modal) return { open: false };
        const inputs = Array.from(modal.querySelectorAll('input, select'));
        const titleInput = inputs.find(i => i.placeholder?.includes('Festival'));
        const urlInput = inputs.find(i => i.getAttribute('type') === 'url');
        return {
          open: true,
          modalTitle: modal.querySelector('h2')?.textContent,
          titleValue: titleInput?.value,
          urlValue: urlInput?.value,
          previewVisible: !!modal.querySelector('.relative.w-full.overflow-hidden, img')
        };
      })()`,
      returnByValue: true
    });
    console.log('3. Edit Modal Inspection:', editModalInspection.result.value);

    // 4. Test Validation inside Modal: empty title & invalid URL
    const validationRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.querySelector('.fixed.inset-0');
        const titleInput = modal.querySelector('input[type="text"]');
        const urlInput = modal.querySelector('input[type="url"]');
        const saveBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent?.includes('Save changes'));
        
        // Clear title
        titleInput.value = '';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        saveBtn?.click();
        
        return { errorText: modal.querySelector('.text-destructive')?.textContent };
      })()`,
      returnByValue: true
    });
    console.log('4. Validation error on empty title:', validationRes.result.value);

    // Capture screenshot of edit modal
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/admin_edit_banner_modal.png', Buffer.from(shot.data, 'base64'));

    // Close modal
    await send('Runtime.evaluate', {
      expression: `(() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Cancel');
        cancelBtn?.click();
      })()`
    });

    console.log('All tests completed successfully!');
    ws.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);

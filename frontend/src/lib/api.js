const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4100/api';

export async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) },
    ...options,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function downloadApiFile(path, fallbackName) {
  if (path === '/students/qr-package.zip') {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(2,6,23,.72);padding:20px';
    overlay.innerHTML = '<div style="width:min(460px,100%);border-radius:20px;background:white;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.3)"><div style="font:700 18px system-ui;color:#0f172a">Preparing all gate passes</div><div data-detail style="margin-top:6px;font:14px system-ui;color:#64748b">Starting secure export…</div><div style="height:12px;margin-top:18px;overflow:hidden;border-radius:999px;background:#fae8ff"><div data-bar style="height:100%;width:0;border-radius:999px;background:#c026d3;transition:width .3s"></div></div><div data-percent style="margin-top:9px;text-align:right;font:700 14px system-ui;color:#a21caf">0%</div><div style="margin-top:12px;font:12px system-ui;color:#64748b">Keep this page open. Download starts automatically at 100%.</div></div>';
    document.body.appendChild(overlay);
    try {
      const { jobId } = await api('/students/qr-package/jobs', { method: 'POST', body: '{}' });
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        const job = await api(`/students/qr-package/jobs/${jobId}`);
        overlay.querySelector('[data-bar]').style.width = `${job.percent}%`;
        overlay.querySelector('[data-percent]').textContent = `${job.percent}%`;
        overlay.querySelector('[data-detail]').textContent = job.count ? `Generating ${job.count.toLocaleString()} compact JPG passes…` : 'Loading student records…';
        if (job.status === 'failed') throw new Error(job.error || 'QR package generation failed');
        if (job.status === 'ready') {
          await downloadApiFile(`/students/qr-package/jobs/${jobId}/download`, `gehu-gate-passes-${job.count}.zip`);
          return;
        }
      }
    } catch (error) {
      window.alert(error.message || 'QR package generation failed');
      return;
    } finally {
      overlay.remove();
    }
  }
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Download failed');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const name = disposition.match(/filename="?([^"]+)"?/)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

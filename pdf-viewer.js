(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const pdfUrl = params.get('src');
  const viewer = document.getElementById('viewer');
  const statusEl = document.getElementById('status');
  const zoomLabel = document.getElementById('zoomLabel');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const openOriginalBtn = document.getElementById('openOriginalBtn');

  let pdfDoc = null;
  let scale = 1.25;
  let renderToken = 0;
  const renderQuality = 2;
  const maxCanvasPixels = 12000000;

  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.js');

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', isError);
    statusEl.style.display = message ? 'block' : 'none';
  }

  function updateZoomLabel() {
    zoomLabel.textContent = `${Math.round(scale * 80)}%`;
  }

  function clearSelection() {
    const selection = window.getSelection();
    if (selection?.removeAllRanges) selection.removeAllRanges();
  }

  async function loadPdf() {
    if (!pdfUrl) {
      setStatus('没有找到 PDF 地址。', true);
      openOriginalBtn.disabled = true;
      return;
    }

    openOriginalBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openOriginalPdf', url: pdfUrl }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          window.location.href = pdfUrl;
        }
      });
    });

    try {
      setStatus('正在加载 PDF...');
      pdfDoc = await pdfjsLib.getDocument({ url: pdfUrl, withCredentials: true }).promise;
      document.title = `SmartTranslate PDF (${pdfDoc.numPages} 页)`;
      setStatus('');
      await renderAllPages();
    } catch (err) {
      setStatus(`PDF 加载失败：${err.message}`, true);
    }
  }

  async function renderAllPages() {
    if (!pdfDoc) return;

    const token = ++renderToken;
    clearSelection();
    viewer.textContent = '';
    updateZoomLabel();

    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
      if (token !== renderToken) return;
      await renderPage(pageNumber, token);
    }
  }

  async function renderPage(pageNumber, token) {
    const page = await pdfDoc.getPage(pageNumber);
    if (token !== renderToken) return;

    const viewport = page.getViewport({ scale });
    const pageEl = document.createElement('section');
    const canvas = document.createElement('canvas');
    const textLayer = document.createElement('div');
    const context = canvas.getContext('2d');
    const outputScale = getOutputScale(viewport.width, viewport.height);

    pageEl.className = 'pdf-page';
    pageEl.style.width = `${viewport.width}px`;
    pageEl.style.height = `${viewport.height}px`;
    pageEl.dataset.pageNumber = String(pageNumber);

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    textLayer.className = 'textLayer';
    textLayer.style.width = `${viewport.width}px`;
    textLayer.style.height = `${viewport.height}px`;
    textLayer.style.setProperty('--scale-factor', viewport.scale);

    pageEl.append(canvas, textLayer);
    viewer.appendChild(pageEl);

    await page.render({
      canvasContext: context,
      viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null
    }).promise;

    if (token !== renderToken) return;

    const textContent = await page.getTextContent();
    await pdfjsLib.renderTextLayer({
      textContentSource: textContent,
      container: textLayer,
      viewport,
      textDivs: []
    }).promise;
  }

  function getOutputScale(width, height) {
    const desiredScale = Math.max(window.devicePixelRatio || 1, renderQuality);
    const desiredPixels = width * height * desiredScale * desiredScale;

    if (desiredPixels <= maxCanvasPixels) {
      return desiredScale;
    }

    return Math.max(1, Math.sqrt(maxCanvasPixels / (width * height)));
  }

  zoomInBtn.addEventListener('click', () => {
    scale = Math.min(scale + 0.15, 2.5);
    renderAllPages();
  });

  zoomOutBtn.addEventListener('click', () => {
    scale = Math.max(scale - 0.15, 0.6);
    renderAllPages();
  });

  updateZoomLabel();
  loadPdf();
})();

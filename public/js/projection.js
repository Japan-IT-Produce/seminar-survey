(function () {
  'use strict';

  const waitingScreen = document.getElementById('waiting-screen');
  const resultsScreen = document.getElementById('results-screen');
  const params = new URLSearchParams(window.location.search);
  let sessionId = params.get('s');

  let socket = null;
  let sessionData = null;
  let charts = {};
  let currentCount = 0;
  let displayedCount = 0;

  const CHART_COLORS = ['#00D4AA', '#6C5CE7', '#3B82F6', '#F59E0B', '#EF4444', '#EC4899', '#22D3EE'];

  // Helpers (mirror server)
  const optValues = (q) => q.type === 'text' ? [] : q.options.map(o => typeof o === 'string' ? o : o.value);
  const withTextOptions = (q) => q.type === 'text' ? []
    : q.options.filter(o => typeof o === 'object' && o.withText);

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // --- Init ---
  async function init() {
    // If no session ID in URL, fetch the latest session
    if (!sessionId) {
      try {
        const latestRes = await fetch('/api/sessions/latest');
        if (!latestRes.ok) {
          waitingScreen.innerHTML = '<p style="color: rgba(255,255,255,0.7); font-size:1.2rem;">セッションがまだ作成されていません</p>';
          return;
        }
        const latestData = await latestRes.json();
        sessionId = latestData.id;
      } catch (e) {
        waitingScreen.innerHTML = '<p style="color: rgba(255,255,255,0.7); font-size:1.2rem;">接続に失敗しました</p>';
        return;
      }
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) {
        waitingScreen.innerHTML = '<p style="color: rgba(255,255,255,0.7); font-size:1.2rem;">セッションが見つかりません</p>';
        return;
      }
      sessionData = await res.json();

      const qrRes = await fetch(`/api/sessions/${sessionId}/qrcode`);
      const qrData = await qrRes.json();
      sessionData.qrCodeDataUrl = qrData.qrCodeDataUrl;

      setupSocket();
      renderWaitingScreen();
      renderResultsScreen();

      if (sessionData.status === 'active' || sessionData.status === 'closed') {
        showResults();
        loadResults();
      }
    } catch (err) {
      console.error('Projection init error:', err);
    }
  }

  // --- Socket ---
  function setupSocket() {
    socket = io();
    socket.emit('join-session', { sessionId });

    socket.on('new-response', (data) => {
      console.log('[Projection] new-response', data.responseCount);
      animateCount(data.responseCount);
      updateCharts(data.results);
    });

    socket.on('session-status', ({ status }) => {
      console.log('[Projection] session-status:', status);
      sessionData.status = status;
      if (status === 'active' || status === 'closed') {
        showResults();
        loadResults();
      } else if (status === 'waiting') {
        showWaiting();
      }
    });

    socket.on('session-reset', () => {
      console.log('[Projection] session-reset');
      currentCount = 0;
      displayedCount = 0;
      updateCountDisplay(0);
      clearCharts();
      showWaiting();
    });
  }

  // --- Waiting Screen ---
  function renderWaitingScreen() {
    waitingScreen.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'glass-card proj-waiting__card';

    const qrContainer = document.createElement('div');
    qrContainer.className = 'proj-waiting__qr';
    const qrImg = document.createElement('img');
    qrImg.src = sessionData.qrCodeDataUrl;
    qrImg.alt = 'QRコード';
    qrContainer.appendChild(qrImg);

    const url = document.createElement('p');
    url.className = 'proj-waiting__url';
    url.textContent = sessionData.participantUrl;

    const text = document.createElement('p');
    text.className = 'proj-waiting__text';
    text.textContent = 'スマートフォンでQRコードを読み取ってください';

    card.appendChild(qrContainer);
    card.appendChild(url);
    card.appendChild(text);
    waitingScreen.appendChild(card);
  }

  // --- Results Screen ---
  function renderResultsScreen() {
    resultsScreen.innerHTML = '';

    // Topbar
    const topbar = document.createElement('div');
    topbar.className = 'proj-topbar';

    const left = document.createElement('div');
    left.className = 'proj-topbar__left';

    const qrSmall = document.createElement('div');
    qrSmall.className = 'proj-topbar__qr';
    const qrImg = document.createElement('img');
    qrImg.src = sessionData.qrCodeDataUrl;
    qrImg.alt = 'QRコード';
    qrSmall.appendChild(qrImg);

    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'proj-topbar__title';
    title.textContent = 'SURVEY RESULTS';
    const sessionName = document.createElement('div');
    sessionName.className = 'proj-topbar__session';
    sessionName.textContent = sessionData.name;
    info.appendChild(title);
    info.appendChild(sessionName);

    left.appendChild(qrSmall);
    left.appendChild(info);

    const right = document.createElement('div');
    right.className = 'proj-topbar__right';
    const count = document.createElement('div');
    count.className = 'proj-topbar__count';
    count.id = 'proj-count';
    count.textContent = '0';
    const countLabel = document.createElement('div');
    countLabel.className = 'proj-topbar__count-label';
    countLabel.textContent = '回答数';
    right.appendChild(count);
    right.appendChild(countLabel);

    topbar.appendChild(left);
    topbar.appendChild(right);
    resultsScreen.appendChild(topbar);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'proj-grid';

    if (sessionData.questions) {
      sessionData.questions.forEach((q, idx) => {
        const item = document.createElement('div');
        item.className = 'proj-grid__item';

        const card = document.createElement('div');
        card.className = 'glass-card proj-chart-card';
        if (q.type === 'text') card.classList.add('proj-text-card');

        const num = document.createElement('div');
        num.className = 'proj-chart-card__number';
        num.textContent = `Q${idx + 1}`;

        const titleEl = document.createElement('div');
        titleEl.className = 'proj-chart-card__title';
        titleEl.textContent = q.text;

        card.appendChild(num);
        card.appendChild(titleEl);

        if (q.type === 'text') {
          const list = document.createElement('ul');
          list.className = 'proj-text-card__list';
          list.id = `proj-text-list-${q.id}`;

          const empty = document.createElement('div');
          empty.className = 'proj-text-card__empty';
          empty.id = `proj-text-empty-${q.id}`;
          empty.textContent = '回答をお待ちしています…';

          card.appendChild(empty);
          card.appendChild(list);
        } else {
          const canvasWrap = document.createElement('div');
          canvasWrap.className = 'proj-chart-card__canvas-wrapper';
          const canvas = document.createElement('canvas');
          canvas.id = `proj-chart-${q.id}`;
          canvasWrap.appendChild(canvas);
          card.appendChild(canvasWrap);

          // "Other (free text)" sub-list — shown beneath chart on projection
          if (withTextOptions(q).length > 0) {
            const otherWrap = document.createElement('div');
            otherWrap.className = 'proj-other-texts';
            otherWrap.id = `proj-other-texts-${q.id}`;
            otherWrap.style.display = 'none';

            const otherTitle = document.createElement('div');
            otherTitle.className = 'proj-other-texts__title';
            otherTitle.textContent = '「その他」';

            const otherList = document.createElement('ul');
            otherList.className = 'proj-other-texts__list';
            otherList.id = `proj-other-texts-list-${q.id}`;

            otherWrap.appendChild(otherTitle);
            otherWrap.appendChild(otherList);
            card.appendChild(otherWrap);
          }
        }

        item.appendChild(card);
        grid.appendChild(item);
      });
    }

    resultsScreen.appendChild(grid);
    initCharts();
  }

  // --- Charts ---
  function initCharts() {
    if (!sessionData.questions) return;

    // Destroy existing chart instances to avoid memory leaks on re-render
    Object.values(charts).forEach(c => c.destroy());
    charts = {};

    // Data label plugin
    const dataLabelPlugin = {
      id: 'projDataLabels',
      afterDraw(chart) {
        const ctx = chart.ctx;
        chart.data.datasets.forEach((dataset, i) => {
          const meta = chart.getDatasetMeta(i);
          meta.data.forEach((bar, index) => {
            const value = dataset.data[index];
            if (value > 0) {
              ctx.save();
              ctx.fillStyle = '#FFFFFF';
              ctx.font = '600 13px Inter';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              const x = bar.x + 8;
              const y = bar.y;
              ctx.fillText(value, x, y);
              ctx.restore();
            }
          });
        });
      }
    };

    sessionData.questions.forEach((q) => {
      if (q.type === 'text') return;
      const ctx = document.getElementById(`proj-chart-${q.id}`);
      if (!ctx) return;

      const opts = optValues(q);
      const colors = opts.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

      charts[q.id] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: opts,
          datasets: [{
            data: new Array(opts.length).fill(0),
            backgroundColor: colors,
            borderRadius: 6,
            barThickness: opts.length >= 7 ? 18 : opts.length >= 6 ? 22 : 26
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 800,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: {
                color: 'rgba(255, 255, 255, 0.08)'
              },
              ticks: {
                color: 'rgba(255, 255, 255, 0.85)',
                font: { family: 'Inter', size: 13 },
                stepSize: 1
              }
            },
            y: {
              grid: { display: false },
              ticks: {
                color: 'rgba(255, 255, 255, 0.88)',
                autoSkip: false,
                font: {
                  family: 'Noto Sans JP',
                  size: 12
                },
                callback: function (value) {
                  const label = this.getLabelForValue(value);
                  return label.length > 14 ? label.slice(0, 13) + '…' : label;
                }
              }
            }
          }
        },
        plugins: [dataLabelPlugin]
      });
    });
  }

  function updateCharts(results) {
    if (!results || !sessionData.questions) return;

    sessionData.questions.forEach((q) => {
      if (q.type === 'text') {
        renderProjText(q, results[q.id]);
        return;
      }
      const chart = charts[q.id];
      if (!chart) return;
      chart.data.datasets[0].data = optValues(q).map(opt => results[q.id]?.[opt]?.count || 0);
      chart.update();

      if (withTextOptions(q).length > 0) {
        renderProjOtherTexts(q, results[q.id]?.__other_texts__ || []);
      }
    });
  }

  function renderProjOtherTexts(q, entries) {
    const wrap = document.getElementById(`proj-other-texts-${q.id}`);
    const list = document.getElementById(`proj-other-texts-list-${q.id}`);
    if (!wrap || !list) return;

    if (entries.length === 0) {
      wrap.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    wrap.style.display = 'block';

    // Newest first, cap at 4 for projection card vertical room
    const sorted = entries.slice().sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    const capped = sorted.slice(0, 4);
    list.innerHTML = capped.map(e =>
      `<li class="proj-other-texts__item">${escapeHtml(e.text)}</li>`
    ).join('');
  }

  function renderProjText(q, result) {
    const listEl = document.getElementById(`proj-text-list-${q.id}`);
    const emptyEl = document.getElementById(`proj-text-empty-${q.id}`);
    if (!listEl || !emptyEl) return;

    const entries = (result && result.entries) || [];

    if (entries.length === 0) {
      emptyEl.style.display = 'block';
      listEl.style.display = 'none';
      listEl.innerHTML = '';
      return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display = 'block';

    // Newest first, cap at 8 for projection legibility
    const sorted = entries.slice().sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    const capped = sorted.slice(0, 8);
    listEl.innerHTML = capped.map(e =>
      `<li class="proj-text-card__item">${escapeHtml(e.text)}</li>`
    ).join('');
  }

  function clearCharts() {
    if (!sessionData.questions) return;
    sessionData.questions.forEach((q) => {
      if (q.type === 'text') {
        const listEl = document.getElementById(`proj-text-list-${q.id}`);
        const emptyEl = document.getElementById(`proj-text-empty-${q.id}`);
        if (listEl) { listEl.innerHTML = ''; listEl.style.display = 'none'; }
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }
      const chart = charts[q.id];
      if (!chart) return;
      chart.data.datasets[0].data = new Array(optValues(q).length).fill(0);
      chart.update();

      const otherWrap = document.getElementById(`proj-other-texts-${q.id}`);
      const otherList = document.getElementById(`proj-other-texts-list-${q.id}`);
      if (otherWrap) otherWrap.style.display = 'none';
      if (otherList) otherList.innerHTML = '';
    });
  }

  // --- Count Animation ---
  function animateCount(target) {
    currentCount = target;
    const countEl = document.getElementById('proj-count');
    if (!countEl) return;

    // Bounce
    countEl.classList.remove('bounce');
    void countEl.offsetWidth;
    countEl.classList.add('bounce');

    // Animate number
    const start = displayedCount;
    const diff = target - start;
    if (diff === 0) return;

    const duration = 300;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      countEl.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        displayedCount = target;
      }
    }

    requestAnimationFrame(step);
  }

  function updateCountDisplay(value) {
    const countEl = document.getElementById('proj-count');
    if (countEl) countEl.textContent = value;
    displayedCount = value;
  }

  // --- Screen Transitions ---
  function showResults() {
    waitingScreen.classList.add('hidden');
    resultsScreen.classList.remove('hidden');
  }

  function showWaiting() {
    resultsScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
  }

  // --- Load Results ---
  async function loadResults() {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/results`);
      if (!res.ok) return;
      const data = await res.json();
      currentCount = data.responseCount;
      displayedCount = data.responseCount;
      updateCountDisplay(data.responseCount);
      if (data.responseCount > 0) {
        updateCharts(data.results);
      }
    } catch (err) {
      console.error('Load results error:', err);
    }
  }

  // --- Start ---
  init();
})();

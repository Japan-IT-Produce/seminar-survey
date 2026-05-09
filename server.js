const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Questions ---
const QUESTIONS = [
  { id: "q1", text: "プライベートを含め、使ったことのあるAIツールはどれですか？", type: "multiple",
    options: ["Microsoft Copilot", "ChatGPT", "Gemini", "Claude", "NotebookLM", "Grok", "その他"] },
  { id: "q2", text: "仕事で生成AIをどのくらいの頻度で使っていますか？", type: "single",
    options: ["ほとんど使っていない", "月に数回程度", "週に数回程度", "ほぼ毎日使っている", "業務に欠かせない程度に使っている"] },
  { id: "q3", text: "仕事で生成AIをどの業務に使ってみたいですか？", type: "multiple",
    options: ["文章作成・資料作成", "情報収集・要約", "企画・アイデア出し", "会議メモ・議事録整理",
              { value: "まだイメージが湧かない", exclusive: true }] },
  { id: "q4", text: "生成AIを使うとき、どこでつまずくことが多いですか？", type: "multiple",
    options: ["何に使えばよいか分からない", "指示文の書き方が分からない", "回答が正しいか判断できない", "情報漏えいや著作権が不安",
              { value: "特に困っていない", exclusive: true }] },
  { id: "q5", text: "今日の研修で知りたいことや、AIについて気になっていることがあれば教えてください。",
    type: "text", required: false, placeholder: "自由にご記入ください（任意）", maxLength: 500 }
];

// Helpers to extract option values and exclusive values from a question
const optValues = (q) => q.type === 'text' ? [] : q.options.map(o => typeof o === 'string' ? o : o.value);
const exclusiveValues = (q) => q.type === 'text' ? []
  : q.options.filter(o => typeof o === 'object' && o.exclusive).map(o => o.value);

// --- Session Store ---
const sessions = new Map();

// --- Helper: compute results ---
function computeResults(session) {
  const results = {};
  for (const q of QUESTIONS) {
    if (q.type === 'text') {
      results[q.id] = { type: 'text', entries: [], count: 0 };
    } else {
      results[q.id] = {};
      for (const opt of optValues(q)) {
        results[q.id][opt] = { count: 0, percentage: 0 };
      }
    }
  }

  const total = session.responses.length;
  for (const response of session.responses) {
    for (const q of QUESTIONS) {
      const answer = response.answers[q.id];
      if (q.type === 'text') {
        if (typeof answer === 'string' && answer.trim()) {
          results[q.id].entries.push({ text: answer, submittedAt: response.submittedAt });
          results[q.id].count++;
        }
      } else if (q.type === 'multiple' && Array.isArray(answer)) {
        for (const a of answer) {
          if (results[q.id][a]) results[q.id][a].count++;
        }
      } else if (typeof answer === 'string') {
        if (results[q.id][answer]) results[q.id][answer].count++;
      }
    }
  }

  if (total > 0) {
    for (const q of QUESTIONS) {
      if (q.type === 'text') continue;
      for (const opt of optValues(q)) {
        results[q.id][opt].percentage = Math.round((results[q.id][opt].count / total) * 100);
      }
    }
  }

  return results;
}

// --- Helper: build participant URL ---
function buildParticipantUrl(req) {
  const host = req.headers.host || `localhost:${PORT}`;
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}/`;
}

// --- REST API ---

// Get latest session
app.get('/api/sessions/latest', (req, res) => {
  if (sessions.size === 0) {
    return res.status(404).json({ error: 'セッションがありません' });
  }
  // Return the most recently created session
  let latest = null;
  for (const session of sessions.values()) {
    if (!latest || session.createdAt > latest.createdAt) {
      latest = session;
    }
  }
  res.json({
    id: latest.id,
    name: latest.name,
    status: latest.status,
    questions: latest.questions,
    responseCount: latest.responses.length,
    createdAt: latest.createdAt,
    participantUrl: latest.participantUrl
  });
});

// Create session
app.post('/api/sessions', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'セッション名は必須です' });
    }

    const sessionId = uuidv4().slice(0, 8);
    const participantUrl = buildParticipantUrl(req);

    const qrCodeDataUrl = await QRCode.toDataURL(participantUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#0F4C81', light: '#FFFFFF' }
    });

    const session = {
      id: sessionId,
      name: name.trim(),
      status: 'waiting',
      questions: QUESTIONS,
      responses: [],
      createdAt: new Date().toISOString(),
      qrCodeDataUrl,
      participantUrl
    };

    sessions.set(sessionId, session);
    console.log(`[Session Created] id=${sessionId}, name=${session.name}`);

    res.json({
      sessionId: session.id,
      name: session.name,
      status: session.status,
      qrCodeDataUrl,
      participantUrl
    });
  } catch (err) {
    console.error('[Error] POST /api/sessions:', err);
    res.status(500).json({ error: 'セッション作成に失敗しました' });
  }
});

// Get session
app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'セッションが見つかりません' });

  res.json({
    id: session.id,
    name: session.name,
    status: session.status,
    questions: session.questions,
    responseCount: session.responses.length,
    createdAt: session.createdAt,
    participantUrl: session.participantUrl
  });
});

// Get QR code
app.get('/api/sessions/:id/qrcode', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'セッションが見つかりません' });

  res.json({ qrCodeDataUrl: session.qrCodeDataUrl });
});

// Submit response
app.post('/api/sessions/:id/responses', (req, res) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'セッションが見つかりません' });

    if (session.status !== 'active') {
      return res.status(403).json({ error: '現在回答を受け付けていません' });
    }

    const { answers } = req.body;
    if (!answers || typeof answers !== 'object') return res.status(400).json({ error: '回答データが必要です' });

    // Normalize and validate all questions
    const normalized = {};
    for (const q of QUESTIONS) {
      const answer = answers[q.id];

      if (q.type === 'text') {
        // Optional unless q.required is true
        if (answer === undefined || answer === null || answer === '') {
          if (q.required) {
            return res.status(400).json({ error: `質問 ${q.id} が未回答です` });
          }
          normalized[q.id] = '';
          continue;
        }
        if (typeof answer !== 'string') {
          return res.status(400).json({ error: `質問 ${q.id} の回答形式が無効です` });
        }
        const trimmed = answer.trim();
        if (q.required && !trimmed) {
          return res.status(400).json({ error: `質問 ${q.id} が未回答です` });
        }
        if (q.maxLength && trimmed.length > q.maxLength) {
          return res.status(400).json({ error: `質問 ${q.id} は${q.maxLength}文字以内で入力してください` });
        }
        normalized[q.id] = trimmed;
        continue;
      }

      if (answer === undefined || answer === null) {
        return res.status(400).json({ error: `質問 ${q.id} が未回答です` });
      }

      const validOptions = optValues(q);

      if (q.type === 'single') {
        if (typeof answer !== 'string' || !answer) {
          return res.status(400).json({ error: `質問 ${q.id} は1つ選択してください` });
        }
        if (!validOptions.includes(answer)) {
          return res.status(400).json({ error: `質問 ${q.id} の回答が無効です` });
        }
        normalized[q.id] = answer;
      }

      if (q.type === 'multiple') {
        if (!Array.isArray(answer) || answer.length === 0) {
          return res.status(400).json({ error: `質問 ${q.id} は1つ以上選択してください` });
        }
        for (const a of answer) {
          if (!validOptions.includes(a)) {
            return res.status(400).json({ error: `質問 ${q.id} の回答「${a}」が無効です` });
          }
        }
        // Exclusive options check (per-question)
        const exclusives = exclusiveValues(q);
        if (exclusives.length > 0) {
          const hasExclusive = answer.some(a => exclusives.includes(a));
          const hasOther = answer.some(a => !exclusives.includes(a));
          if (hasExclusive && hasOther) {
            return res.status(400).json({ error: `質問 ${q.id}: 「${exclusives.join('」「')}」は他と同時選択できません` });
          }
        }
        normalized[q.id] = answer;
      }
    }

    session.responses.push({ answers: normalized, submittedAt: new Date().toISOString() });

    const results = computeResults(session);
    const responseCount = session.responses.length;

    io.to(session.id).emit('new-response', { results, responseCount });
    console.log(`[Response] session=${session.id}, total=${responseCount}`);

    res.json({ success: true, responseCount });
  } catch (err) {
    console.error('[Error] POST /api/sessions/:id/responses:', err);
    res.status(500).json({ error: '回答の送信に失敗しました' });
  }
});

// Get results
app.get('/api/sessions/:id/results', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'セッションが見つかりません' });

  const results = computeResults(session);
  res.json({ responseCount: session.responses.length, results });
});

// Reset responses
app.post('/api/sessions/:id/reset', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'セッションが見つかりません' });

  session.responses = [];
  io.to(session.id).emit('session-reset');
  console.log(`[Reset] session=${session.id}`);

  res.json({ success: true });
});

// Update status
app.post('/api/sessions/:id/status', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'セッションが見つかりません' });

  const { status } = req.body;
  if (!['waiting', 'active', 'closed'].includes(status)) {
    return res.status(400).json({ error: '無効なステータスです' });
  }

  session.status = status;
  io.to(session.id).emit('session-status', { status });
  console.log(`[Status] session=${session.id}, status=${status}`);

  res.json({ success: true, status });
});

// --- Socket.IO ---
io.on('connection', (socket) => {
  console.log(`[Socket] connected: ${socket.id}`);

  socket.on('join-session', ({ sessionId }) => {
    if (sessionId) {
      socket.join(sessionId);
      console.log(`[Socket] ${socket.id} joined session ${sessionId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] disconnected: ${socket.id}`);
  });
});

// --- Start ---
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin.html`);
});

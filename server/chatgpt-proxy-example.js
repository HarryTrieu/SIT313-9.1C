
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error('Set OPENAI_API_KEY in server/.env');
  process.exit(1);
}

app.get('/api/chat', (req, res) => {
  res.send('ChatGPT proxy running. POST JSON to /api/chat with { messages: [...] }');
});

app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, conversation, messages } = req.body || {};
    if (conversation && process.env.NODE_ENV !== 'production') {
      console.debug('Conversation metadata:', conversation?.id || conversation?.participants || '(meta)');
    }

    const chatMessages = [];
    if (messages && Array.isArray(messages)) {
      messages.forEach(m => chatMessages.push({ role: m.role || 'user', content: m.content || '' }));
    } else if (prompt) {
      chatMessages.push({ role: 'user', content: prompt });
    }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: chatMessages,
        max_tokens: 400,
        temperature: 0.2
      })
    });

    if (!r.ok) {
      const text = await r.text();
      console.error('OpenAI error', r.status, text);
      if (r.status === 429 || text?.toLowerCase()?.includes('quota') || text?.toLowerCase()?.includes('insufficient_quota')) {
        return res.json({ reply: "AI temporarily unavailable (quota). Here's a quick fallback: try checking the order details in the Orders page or contact support." });
      }
      return res.status(r.status).send(text);
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    res.json({ reply });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.json({ reply: "AI temporarily unavailable. Please try again later." });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log('ChatGPT proxy listening on', port));

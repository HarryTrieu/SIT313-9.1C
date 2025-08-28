// Lightweight client helper to call ChatGPT proxy endpoint.

export async function sendToChatGPT(prompt, conversation = {}, messages = []) {
  const proxyUrl = process.env.REACT_APP_CHATGPT_PROXY_URL || '';
  if (!proxyUrl) {
    console.warn('ChatGPT proxy URL is not configured. Set REACT_APP_CHATGPT_PROXY_URL');
    return "AI not configured.";
  }

  const payload = { prompt, conversation, messages };
  try {
    console.debug('sendToChatGPT -> POST', proxyUrl, payload);
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('ChatGPT proxy error', res.status, text);
      // Return a user-friendly fallback so the UI shows an assistant message
      return "AI temporarily unavailable. Here's a helpful tip: check the conversation details or contact support.";
    }

    const data = await res.json();
    // Expecting { reply: string } from the proxy
    return data?.reply || data?.result || "AI returned empty response.";
  } catch (err) {
    console.error('sendToChatGPT network error', err);
    return "AI temporarily unavailable. Please try again later.";
  }
}

export default sendToChatGPT;




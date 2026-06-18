export async function onRequestPost(context) {
  const { model, max_tokens, temperature, messages } = await context.request.json();
  const key = context.env.GROQ_KEY;

  if (!key) {
    return new Response(JSON.stringify({ error: 'GROQ_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens, temperature, messages })
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    // Groq sometimes returns malformed JSON (literal newlines inside string values).
    // Try to salvage the content string via regex so the app still gets the response.
    const contentMatch = text.match(/"content"\s*:\s*"([\s\S]*?)(?<!\\)"/);
    if (contentMatch) {
      const content = contentMatch[1].replace(/\\n/g, '\n');
      data = {
        choices: [{ message: { role: 'assistant', content } }]
      };
    } else {
      return new Response(JSON.stringify({ error: 'Groq API returned invalid JSON: ' + e.message }), {
        status: 502, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' }
  });
}

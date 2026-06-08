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

  let data;
  try {
    data = await res.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Groq API returned invalid response: ' + e.message }), {
      status: 502, headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' }
  });
}

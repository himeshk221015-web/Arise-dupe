// This runs on the server (Vercel), never in the browser.
// Your Anthropic API key lives in an environment variable here, so it's
// never exposed to anyone visiting the site.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server' });
    return;
  }

  const answers = req.body || {};
  const prompt = buildPrompt(answers);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await r.json();
    if (data.error) throw new Error(data.error.message || 'Anthropic API error');

    const text = (data.content || []).map((b) => b.text || '').join('');
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function buildPrompt(a) {
  return `You are "The System" from a gamified fitness app. Output ONLY raw JSON, no markdown fences, no commentary. Be concise — keep the whole response under 1100 tokens.

Hunter profile: goal=${a.goal}, experience=${a.level}, trainingDaysPerWeek=${a.days}, equipment=${a.equipment}, dietRestriction=${a.diet}, age=${a.age}, weightKg=${a.weight}, heightCm=${a.height}.

Return exactly this JSON shape:
{
 "title": "<2-4 word epic hunter title for this person>",
 "days": [
  {"day":"Mon","focus":"<focus name or 'Rest'>","exercises":[{"n":"<exercise name>","s":<sets int>,"r":"<reps or duration like '12' or '30s'>","cat":"<STR|END|AGI|VIT>"}]}
 ],
 "diet": {
  "calories": <int>,
  "protein": <int grams>,
  "carbs": <int grams>,
  "fat": <int grams>,
  "meals": [{"n":"Breakfast","desc":"<short, under 12 words>","cal":<int>},{"n":"Lunch","desc":"...","cal":<int>},{"n":"Dinner","desc":"...","cal":<int>},{"n":"Snack","desc":"...","cal":<int>}]
 }
}

"days" must have exactly 7 entries, one per weekday Mon..Sun, distributing ${a.days} training days and marking the rest as "focus":"Rest" with "exercises":[]. Max 5 exercises per training day. Respect the diet restriction. Use "cat" to indicate which stat the exercise trains: STR=strength, END=endurance/cardio, AGI=mobility/agility, VIT=core/recovery.`;
}

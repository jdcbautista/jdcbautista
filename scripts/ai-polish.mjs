// Hybrid AI touch: turns a rough note into a crisp one-line feed blurb using a
// local Ollama server (localhost:11434). Prints the polished line to stdout.
// Fails soft — if Ollama is unreachable or slow, echoes the original note so
// the feed never blocks on the model.
const note = process.argv.slice(2).join(" ").trim();
if (!note) { console.error("ai-polish: need a note"); process.exit(1); }

const model = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";
const prompt =
  `Rewrite this developer status note as ONE punchy first-person line, ` +
  `max 90 characters, no hashtags, no quotes, present tense:\n"${note}"`;

const timeout = AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS || 60000));
try {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.4 } }),
    signal: timeout,
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  const line = (data.response || "").trim().replace(/^["']|["']$/g, "").split("\n")[0];
  process.stdout.write(line && line.length > 3 ? line : note);
} catch (err) {
  process.stderr.write(`ai-polish: falling back to raw note (${err.message})\n`);
  process.stdout.write(note);
}

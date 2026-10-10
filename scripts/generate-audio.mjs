#!/usr/bin/env node
/**
 * Genera los MP3 del mazo con una TTS neuronal y escribe public/audio/.
 *
 *   OPENAI_API_KEY=...     npm run audio
 *   ELEVENLABS_API_KEY=... npm run audio
 *
 * Se corre a mano cuando el mazo cambia, nunca en el deploy: los MP3 se comitean
 * al repo para que publicar no dependa de la API ni de la clave.
 *
 * Por palabra escribe cuatro pistas: en, es, xe (ejemplo en inglés) y xs.
 * El nombre sale de un hash del texto más la voz, así que volver a correrlo solo
 * genera lo que falta.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DECK = join(ROOT, 'data', 'deck.json');
const OUT = join(ROOT, 'public', 'audio');

const VOICES = {
  openai: { en: 'alloy', es: 'nova' },
  elevenlabs: { en: '21m00Tcm4TlvDq8ikWAM', es: 'XrExE9yKIg1WjnnlVkGX' }
};

function provider() {
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

async function synthOpenAI(text, lang) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.TTS_MODEL || 'gpt-4o-mini-tts',
      voice: VOICES.openai[lang],
      input: text,
      response_format: 'mp3',
      speed: 0.95
    })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function synthElevenLabs(text, lang) {
  const id = VOICES.elevenlabs[lang];
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: process.env.TTS_MODEL || 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

const exists = p => access(p).then(() => true, () => false);
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 16);

async function main() {
  const who = provider();
  if (!who) {
    console.error(`No hay clave de API.

Pon una de estas en .env.local (que ya está en .gitignore) y exportala:

  export OPENAI_API_KEY=sk-...          # integración más simple
  export ELEVENLABS_API_KEY=...         # la voz más natural

Luego:  npm run audio

Sin esto la app sigue funcionando: usa la voz del dispositivo.
Ver docs/audio.md.`);
    process.exit(1);
  }

  const synth = who === 'elevenlabs' ? synthElevenLabs : synthOpenAI;
  const deck = JSON.parse(await readFile(DECK, 'utf8'));
  await mkdir(OUT, { recursive: true });

  const index = {};
  let made = 0, kept = 0, chars = 0;

  for (const w of deck) {
    const tracks = [
      ['en', w.en, 'en'],
      ['es', w.es, 'es'],
      ['xe', w.xe, 'en'],
      ['xs', w.xs, 'es']
    ];
    for (const [part, text, lang] of tracks) {
      if (!text) continue;
      const file = `${hash(`${who}:${lang}:${text}`)}.mp3`;
      index[`${w.en}::${part}`] = file;
      const path = join(OUT, file);
      if (await exists(path)) { kept++; continue; }
      process.stdout.write(`  ${w.en} · ${part} … `);
      const buf = await synth(text, lang);
      await writeFile(path, buf);
      chars += text.length;
      made++;
      console.log(`${(buf.length / 1024).toFixed(0)} KB`);
      await new Promise(r => setTimeout(r, 120));   // no atropellar la API
    }
  }

  await writeFile(join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`\nProveedor: ${who}`);
  console.log(`Generados ${made}, ya existían ${kept}. ${chars} caracteres facturados.`);
  console.log('Comitea public/audio/ para que el deploy no dependa de la API.');
}

main().catch(err => { console.error(err.message); process.exit(1); });

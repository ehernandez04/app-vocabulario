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
 *
 * Trabaja **por voz**: `pnpm audio` usa la de por defecto y `pnpm audio eric`
 * genera ese juego completo sin tocar los anteriores. El índice guarda todas las
 * voces disponibles, que es lo que permite ofrecerlas a elegir dentro de la app.
 *
 * Ojo con el costo: cada voz es el mazo entero otra vez. Veinte palabras son
 * unos 2.100 caracteres, y el plan gratuito de ElevenLabs da 10.000 al mes.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DECK = join(ROOT, 'data', 'deck.json');
const OUT = join(ROOT, 'public', 'audio');

/**
 * Las voces que Erick escuchó y aprobó. Todas americanas: el mazo usa fonética
 * de inglés americano y ese es el acento que está aprendiendo.
 *
 * Una sola voz lee los dos idiomas. En español suena con acento inglés, porque
 * el plan gratuito de ElevenLabs no deja usar las voces latinoamericanas de la
 * biblioteca: devuelven 402 y piden cargar 5 dólares.
 */
const CATALOGO = {
  sarah:   { id: 'EXAVITQu4vr4xnSDxMaL', nombre: 'Sarah',   rasgo: 'joven, segura' },
  eric:    { id: 'cjVigY5qzO86Huf0OWal', nombre: 'Eric',    rasgo: 'hombre, suave' },
  matilda: { id: 'XrExE9yKIg1WjnnlVkGX', nombre: 'Matilda', rasgo: 'mujer, profesional' },
  bella:   { id: 'hpp4J3VqNfWAUOO0d1Us', nombre: 'Bella',   rasgo: 'mujer, cálida' },
  brian:   { id: 'nPczCjzI2devNBz1zQrb', nombre: 'Brian',   rasgo: 'hombre, grave y pausado' },
  river:   { id: 'SAz9YHcvj6GT2YYXdXww', nombre: 'River',   rasgo: 'neutra, informativa' }
};

const POR_DEFECTO = 'sarah';

/** Las de OpenAI, por si alguna vez se vuelve a ese proveedor. */
const VOCES_OPENAI = { en: 'alloy', es: 'nova' };

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
      voice: VOCES_OPENAI[lang],
      input: text,
      response_format: 'mp3',
      speed: 0.95
    })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function synthElevenLabs(text, lang, voz) {
  const id = CATALOGO[voz].id;
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

Pon una de estas en .env (que ya está en .gitignore):

  ELEVENLABS_API_KEY=...   # la voz más natural, es la que se usa
  OPENAI_API_KEY=sk-...    # alternativa

Luego:  pnpm audio [voz]

Sin esto la app sigue funcionando: usa la voz del dispositivo.
Ver docs/audio.md.`);
    process.exit(1);
  }

  const voz = process.argv[2] || POR_DEFECTO;
  if (who === 'elevenlabs' && !CATALOGO[voz]) {
    console.error(`No conozco la voz "${voz}". Las que hay:\n`);
    for (const [k, v] of Object.entries(CATALOGO)) {
      console.error(`  ${k.padEnd(9)} ${v.nombre} — ${v.rasgo}`);
    }
    process.exit(1);
  }

  const deck = JSON.parse(await readFile(DECK, 'utf8'));
  await mkdir(OUT, { recursive: true });

  // El índice se conserva entre corridas: generar una voz nueva no borra las
  // anteriores, que es lo que permite ofrecerlas a elegir dentro de la app.
  let indice = { porDefecto: POR_DEFECTO, voces: {} };
  try {
    indice = JSON.parse(await readFile(join(OUT, 'index.json'), 'utf8'));
    indice.voces ||= {};
  } catch { /* primera corrida */ }

  const etiqueta = who === 'elevenlabs' ? CATALOGO[voz].nombre : `OpenAI ${voz}`;
  const pistas = {};
  let hechas = 0, existian = 0, chars = 0;

  for (const w of deck) {
    const tracks = [
      ['en', w.en, 'en'],
      ['es', w.es, 'es'],
      ['xe', w.xe, 'en'],
      ['xs', w.xs, 'es']
    ];
    for (const [part, text, lang] of tracks) {
      if (!text) continue;
      const file = `${hash(`${who}:${voz}:${lang}:${text}`)}.mp3`;
      pistas[`${w.en}::${part}`] = file;
      const path = join(OUT, file);
      if (await exists(path)) { existian++; continue; }
      process.stdout.write(`  ${w.en} · ${part} … `);
      const buf = who === 'elevenlabs'
        ? await synthElevenLabs(text, lang, voz)
        : await synthOpenAI(text, lang);
      await writeFile(path, buf);
      chars += text.length;
      hechas++;
      console.log(`${(buf.length / 1024).toFixed(0)} KB`);
      await new Promise(r => setTimeout(r, 120));   // no atropellar la API
    }
  }

  indice.voces[voz] = { nombre: etiqueta, pistas };
  indice.porDefecto ||= voz;
  await writeFile(join(OUT, 'index.json'), JSON.stringify(indice, null, 2));

  console.log(`\nVoz: ${etiqueta} (${voz}) · proveedor: ${who}`);
  console.log(`Generadas ${hechas}, ya existían ${existian}. ${chars} caracteres facturados.`);
  console.log(`Voces en el índice: ${Object.keys(indice.voces).join(', ')}`);
  console.log('Comitea public/audio/ para que el deploy no dependa de la API.');
}

main().catch(err => { console.error(err.message); process.exit(1); });

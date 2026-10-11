'use client';

import { salir } from '@/app/acciones';
import { useEstado } from '@/app/estado';
import * as audio from '@/lib/audio';
import * as store from '@/lib/local-store';
import { IconAltavoz } from './icons';
import { Hoja } from './Hoja';

/**
 * Ajustes: tu cuenta, la voz y el mazo.
 *
 * Vive en la hoja que la app ya usa para agregar palabra e importar, en vez de
 * ocupar una quinta pestaña. El borde inferior es para lo que se visita muchas
 * veces al día, y esto se toca una vez al mes. Reusar la hoja además evita un
 * segundo tipo de panel haciendo el mismo trabajo.
 */
export function HojaAjustes({
  alCerrar,
  alAbrirImportar,
}: {
  alCerrar: () => void;
  alAbrirImportar: () => void;
}) {
  const { usuario, deck, ajuste, guardarAjuste, recargarMazo, rearmarCola, avisar } = useEstado();
  const mias = store.userWords();
  const grabadas = audio.recordedVoices();
  const inicial = (usuario.nombre ?? usuario.correo ?? '?').trim().charAt(0).toUpperCase();

  async function exportar() {
    try {
      await navigator.clipboard.writeText(store.exportAll());
      avisar('Progreso copiado al portapapeles');
    } catch {
      avisar('No se pudo copiar aquí');
    }
  }

  return (
    <Hoja titulo="Ajustes" alCerrar={alCerrar}>
      <div className="ajustes">
        <div className="cuenta">
          {usuario.foto ? (
            // eslint-disable-next-line @next/next/no-img-element -- la sirve Google desde su dominio; next/image no aporta acá
            <img className="avatar" src={usuario.foto} alt="" width={42} height={42} />
          ) : (
            <span className="avatar">{inicial}</span>
          )}
          <span className="cuenta-txt">
            <b>{usuario.nombre ?? 'Tu cuenta'}</b>
            <span>{usuario.correo}</span>
          </span>
          <button className="pill" onClick={() => salir()}>
            Salir
          </button>
        </div>

        <p className="eyebrow">Voz</p>
        <div className="voicebox">
          {grabadas.length > 0 && (
            <label className="vrow">
              <span>Grabada</span>
              {grabadas.length > 1 ? (
                <select
                  className="sel"
                  value={ajuste('voiceMp3') ?? grabadas[0].clave}
                  onChange={(e) => guardarAjuste('voiceMp3', e.target.value)}
                >
                  {grabadas.map((v) => (
                    <option key={v.clave} value={v.clave}>
                      {v.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="sel comoTexto">{grabadas[0].nombre}</span>
              )}
            </label>
          )}
          <FilaDeVoz lang="en" etiqueta="Inglés" />
          <FilaDeVoz lang="es" etiqueta="Español" />
          <button
            className="btn"
            onClick={() => audio.say('The way to achieve it is practice. Listen carefully.', 'en')}
          >
            <IconAltavoz /> Probar esta voz
          </button>
          <p className="muted sm">
            Las palabras de fábrica usan audio grabado. Las que agregues vos hablan con la voz
            del dispositivo: en iPhone y Mac se descargan voces mucho mejores en{' '}
            <b>Ajustes → Accesibilidad → Contenido hablado → Voces</b>.
          </p>
        </div>

        <p className="eyebrow">Mi mazo · {deck.length} palabras</p>
        <div className="chips">
          <button className="pill" onClick={exportar}>
            Exportar
          </button>
          <button className="pill" onClick={alAbrirImportar}>
            Importar
          </button>
        </div>

        {mias.length > 0 && (
          <>
            <p className="eyebrow">Tus palabras · {mias.length}</p>
            <ul className="mywords">
              {mias.map((w) => (
                <li key={w.en}>
                  <span className="mw-emoji">{w.emoji || '📝'}</span>
                  <span className="mw-txt">
                    <b>{w.en}</b>
                    <span>{w.es}</span>
                  </span>
                  <span className="mw-box">caja {store.progressOf(w.en).box}</span>
                  <button
                    className="xbtn sm"
                    onClick={() => {
                      store.deleteWord(w.en);
                      recargarMazo();
                      rearmarCola();
                      avisar(`“${w.en}” fuera del mazo`);
                    }}
                    aria-label={`Quitar ${w.en} del mazo`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Hoja>
  );
}

/** Las voces del dispositivo, que solo se oyen en las palabras sin audio grabado. */
function FilaDeVoz({ lang, etiqueta }: { lang: audio.Idioma; etiqueta: string }) {
  const lista = audio.voices[lang];
  const actual = audio.currentVoice(lang);
  return (
    <label className="vrow">
      <span>{etiqueta}</span>
      <select
        className="sel"
        value={actual?.name ?? ''}
        onChange={(e) => audio.chooseVoice(lang, e.target.value)}
        disabled={!lista.length}
      >
        {lista.length ? (
          lista.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} · {v.lang}
            </option>
          ))
        ) : (
          <option value="">Sin voces disponibles</option>
        )}
      </select>
    </label>
  );
}

/** Los iconos de legacy/src/lib/ui.js, como componentes. */

type Props = { className?: string };

const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const svg = (hijos: React.ReactNode, props?: Record<string, unknown>) =>
  function Icono({ className }: Props) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...trazo} {...props}>
        {hijos}
      </svg>
    );
  };

export const IconAltavoz = svg(
  <>
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </>
);

export const IconDespacio = svg(
  <>
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="M16 9.5a4 4 0 0 1 0 5" />
  </>
);

export const IconPlay = svg(
  <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />,
  { fill: 'currentColor', stroke: 'none' }
);

export const IconPausa = svg(
  <>
    <rect x="6" y="4" width="4.5" height="16" rx="1.5" />
    <rect x="13.5" y="4" width="4.5" height="16" rx="1.5" />
  </>,
  { fill: 'currentColor', stroke: 'none' }
);

export const IconAtras = svg(
  <>
    <path d="M11 17 6 12l5-5" />
    <path d="M18 17l-5-5 5-5" />
  </>
);

export const IconAdelante = svg(
  <>
    <path d="M13 7l5 5-5 5" />
    <path d="M6 7l5 5-5 5" />
  </>
);

export const IconFlecha = svg(<path d="M9 18l6-6-6-6" />);

export const IconTick = svg(<path d="M4 12.5l5 5L20 6.5" />, { strokeWidth: 2.6 });

export const IconCruz = svg(<path d="M6 6l12 12M18 6L6 18" />, { strokeWidth: 2.6 });

export const IconTarjetas = svg(
  <>
    <rect x="3" y="7" width="13" height="13" rx="2" />
    <path d="M8 3h11a2 2 0 0 1 2 2v11" />
  </>
);

export const IconAdivinar = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7" />
    <path d="M12 17h.01" />
  </>
);

export const IconAuriculares = svg(
  <>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z" />
  </>
);

export const IconInicio = svg(
  <>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M9.5 20v-6h5v6" />
  </>
);

export const IconComillas = svg(
  <path d="M7 7h4v4H9c0 2 .8 3 2 3.4V17c-2.8-.5-4-2.6-4-5.6V7zm8 0h4v4h-2c0 2 .8 3 2 3.4V17c-2.8-.5-4-2.6-4-5.6V7z" />,
  { fill: 'currentColor', stroke: 'none' }
);

export const IconLuna = svg(
  <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
);

export const IconSol = svg(
  <>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
  </>
);

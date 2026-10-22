/**
 * Small inline icons. Always decorative (aria-hidden): meaning is carried by text,
 * so the components read correctly without icons or colour.
 */
import type { SVGProps } from 'react';

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export const EyeIcon = () => (
  <Svg>
    <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z" />
    <circle cx="8" cy="8" r="1.8" />
  </Svg>
);

/** Spark: marks AI inference. */
export const SparkIcon = () => (
  <Svg>
    <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.6 3.6l1.8 1.8M10.6 10.6l1.8 1.8M3.6 12.4l1.8-1.8M10.6 5.4l1.8-1.8" />
  </Svg>
);

export const QuestionIcon = () => (
  <Svg>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M6.2 6.2a1.9 1.9 0 0 1 3.6.8c0 1.3-1.8 1.6-1.8 2.7" />
    <circle cx="8" cy="11.6" r="0.4" fill="currentColor" />
  </Svg>
);

export const LockIcon = () => (
  <Svg>
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </Svg>
);

export const CheckIcon = () => (
  <Svg>
    <path d="M3 8.5 6.5 12 13 4.5" />
  </Svg>
);

export const ChevronIcon = ({ open }: { open: boolean }) => (
  <Svg style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </Svg>
);

export const WarningIcon = () => (
  <Svg>
    <path d="M8 2 14.5 13.5h-13L8 2Z" />
    <path d="M8 6.5v3.2" />
    <circle cx="8" cy="11.6" r="0.4" fill="currentColor" />
  </Svg>
);

export const ArrowRightIcon = () => (
  <Svg>
    <path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" />
  </Svg>
);

/** One small glyph per event source, so evidence rows can be scanned by origin. */
const SOURCE_PATHS: Record<string, string> = {
  monitoring: 'M1.5 8.5h3l1.5-4 3 8 1.8-4.5h3.7',
  nps_log: 'M8 1.8 13 4v4.2c0 2.9-2.1 5-5 6-2.9-1-5-3.1-5-6V4L8 1.8Z',
  cert_inventory: 'M3 2.5h10v7H3zM5.5 5h5M5.5 7h3M6 9.5l-1 4 3-1.5 3 1.5-1-4',
  switch: 'M2 5h12M2 11h12M5 3l-3 2 3 2M11 9l3 2-3 2',
  helpdesk: 'M2.5 3h11v7.5H7L4 13v-2.5H2.5z',
};

export const SourceIcon = ({ source }: { source: string }) => (
  <Svg>
    <path d={SOURCE_PATHS[source] ?? SOURCE_PATHS.monitoring} />
  </Svg>
);

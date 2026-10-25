// Simple line icons, drawn at 24px on a 24-unit grid.
type P = { className?: string };
const base = (className = "h-6 w-6") => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const Car = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 16v-3.5l2.2-5A2 2 0 0 1 7 6.3h10a2 2 0 0 1 1.8 1.2l2.2 5V16" />
    <path d="M3 12.5h18M3 16h18v2.5H3z" />
    <circle cx="7.5" cy="18.5" r="1.6" />
    <circle cx="16.5" cy="18.5" r="1.6" />
  </svg>
);
export const Shield = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z" />
    <path d="m8.8 12 2.2 2.2 4.3-4.4" />
  </svg>
);
export const Wrench = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7 7.3 20l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
  </svg>
);
export const Tag = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 12V4h8l10 10-8 8z" />
    <circle cx="7.5" cy="8.5" r="1.3" />
  </svg>
);
export const Dollar = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15 9.2c-.6-.9-1.7-1.4-3-1.4-1.7 0-3 .9-3 2.1 0 2.9 6 1.4 6 4.2 0 1.2-1.3 2.1-3 2.1-1.4 0-2.6-.6-3.1-1.6M12 6v1.8m0 8.4V18" />
  </svg>
);
export const Umbrella = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 12a9 9 0 0 1 18 0zM12 12v6.5a2 2 0 0 1-4 0M12 3v0" />
  </svg>
);
export const Upload = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);
export const Check = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const Bell = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
  </svg>
);
export const Alert = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.3v.2" />
  </svg>
);
export const Gauge = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 17a8 8 0 1 1 16 0" />
    <path d="m12 17 4-5" />
  </svg>
);

type IconProps = { className?: string };

function Icon({
  children,
  className,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`icon${className ? ` ${className}` : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5v14M16 5v14" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 7h14M5 12h14M5 17h14" />
  </Icon>
);

export const SoundIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h4l5-4v13l-5-4H4z" fill="currentColor" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </Icon>
);

export const MuteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h4l5-4v13l-5-4H4z" fill="currentColor" />
    <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
  </Icon>
);

export const GearIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18.88 12.57 L21.13 13.78 L19.71 17.19 L17.27 16.46 L16.46 17.27 L17.19 19.71 L13.78 21.13 L12.57 18.88 L11.43 18.88 L10.22 21.13 L6.81 19.71 L7.54 17.27 L6.73 16.46 L4.29 17.19 L2.87 13.78 L5.12 12.57 L5.12 11.43 L2.87 10.22 L4.29 6.81 L6.73 7.54 L7.54 6.73 L6.81 4.29 L10.22 2.87 L11.43 5.12 L12.57 5.12 L13.78 2.87 L17.19 4.29 L16.46 6.73 L17.27 7.54 L19.71 6.81 L21.13 10.22 L18.88 11.43 Z" />
    <circle cx="12" cy="12" r="2.6" />
  </Icon>
);

export const RestartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12a8 8 0 1 0 2.5-5.8" />
    <path d="M4 4v5h5" />
  </Icon>
);

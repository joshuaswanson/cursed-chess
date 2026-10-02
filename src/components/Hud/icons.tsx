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

export const RestartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4.5h4.5" />
  </Icon>
);

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

export const SkipIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 5l9 7-9 7z" fill="currentColor" />
    <path d="M18 5v14" />
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

export const WrenchIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 4.5a4.5 4.5 0 0 0-5.6 5.8L4 15.2 8.8 20l4.9-4.9a4.5 4.5 0 0 0 5.8-5.6l-2.8 2.8-3-.5-.5-3z" />
  </Icon>
);

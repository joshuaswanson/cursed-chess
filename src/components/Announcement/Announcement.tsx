import { useState, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import "./Announcement.css";

const CLOSE_ANIMATION_MS = 400;

export function Announcement() {
  const announcement = useGameStore((s) => s.announcement);
  const announcementType = useGameStore((s) => s.announcementType);
  const [shown, setShown] = useState<{
    text: string;
    type: typeof announcementType;
  } | null>(null);
  const [closing, setClosing] = useState(false);
  const [prevAnnouncement, setPrevAnnouncement] = useState(announcement);

  // Keep the last banner mounted while its close animation plays
  if (announcement !== prevAnnouncement) {
    setPrevAnnouncement(announcement);
    if (announcement) {
      setShown({ text: announcement, type: announcementType });
      setClosing(false);
    } else if (shown) {
      setClosing(true);
    }
  }

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setShown(null);
      setClosing(false);
    }, CLOSE_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  if (!shown) return null;

  const typeClass = shown.type === "mode" ? "" : ` ${shown.type}`;
  const closingClass = closing ? " closing" : "";

  return (
    <div className={`announcement-overlay${closingClass}${typeClass}`}>
      <div className={`announcement-banner${closingClass}${typeClass}`}>
        <div className={`announcement-text${typeClass}`}>{shown.text}</div>
      </div>
    </div>
  );
}

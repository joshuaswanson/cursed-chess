import { useState, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import "./Announcement.css";

export function Announcement() {
  const announcement = useGameStore((s) => s.announcement);
  const announcementType = useGameStore((s) => s.announcementType);
  const [visible, setVisible] = useState<string | null>(null);
  const [visibleType, setVisibleType] = useState<"mode" | "intro" | "hint">(
    "mode",
  );
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (announcement) {
      setVisible(announcement);
      setVisibleType(announcementType);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      const timer = setTimeout(() => {
        setVisible(null);
        setClosing(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [announcement]);

  if (!visible) return null;

  const isIntro = visibleType === "intro";
  const isHint = visibleType === "hint";
  const typeClass = isIntro ? " intro" : isHint ? " hint" : "";

  return (
    <div
      className={`announcement-overlay ${closing ? "closing" : ""}${typeClass}`}
    >
      <div
        className={`announcement-banner ${closing ? "closing" : ""}${typeClass}`}
      >
        <div className={`announcement-text${typeClass}`}>{visible}</div>
      </div>
    </div>
  );
}

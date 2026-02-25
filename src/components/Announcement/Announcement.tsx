import { useState, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import "./Announcement.css";

export function Announcement() {
  const announcement = useGameStore((s) => s.announcement);
  const announcementType = useGameStore((s) => s.announcementType);
  const [visible, setVisible] = useState<string | null>(null);
  const [visibleType, setVisibleType] = useState<"mode" | "intro">("mode");
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

  return (
    <div
      className={`announcement-overlay ${closing ? "closing" : ""}${isIntro ? " intro" : ""}`}
    >
      <div
        className={`announcement-banner ${closing ? "closing" : ""}${isIntro ? " intro" : ""}`}
      >
        <div className={`announcement-text${isIntro ? " intro" : ""}`}>
          {visible}
        </div>
      </div>
    </div>
  );
}

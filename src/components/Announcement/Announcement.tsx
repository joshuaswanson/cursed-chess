import { useGameStore } from "../../stores/gameStore";
import "./Announcement.css";

export function Announcement() {
  const announcement = useGameStore((s) => s.announcement);

  if (!announcement) return null;

  return (
    <div className="announcement-overlay">
      <div className="announcement-banner">
        <div className="announcement-text">{announcement}</div>
      </div>
    </div>
  );
}

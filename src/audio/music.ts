import { audio, sfx } from "./sfx";
import soundtrackUrl from "./music/maksymmalko-background.mp3";

const VOLUME = 0.25;
const FADE_IN_S = 1.2;
const FADE_OUT_S = 0.15;
/** Long enough for the fade out to finish before the track is paused */
const PAUSE_AFTER_MS = 800;

let track: HTMLAudioElement | null = null;
let bus: GainNode | null = null;
let wanted = false;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;

/** The track, streamed from its file and routed through the game's own sound, so the master volume applies */
function connect(): { el: HTMLAudioElement; gain: GainNode } | null {
  const a = audio();
  if (!a) return null;
  if (!track || !bus) {
    track = new Audio(soundtrackUrl);
    track.loop = true;
    track.preload = "auto";
    bus = a.ctx.createGain();
    bus.gain.value = 0.0001;
    a.ctx.createMediaElementSource(track).connect(bus);
    bus.connect(a.out);
  }
  return { el: track, gain: bus };
}

function startPlaying(): void {
  const line = connect();
  const a = audio();
  if (!line || !a) return;
  if (pauseTimer) clearTimeout(pauseTimer);
  pauseTimer = null;
  const now = a.ctx.currentTime;
  line.gain.gain.cancelScheduledValues(now);
  line.gain.gain.setValueAtTime(Math.max(line.gain.gain.value, 0.0001), now);
  line.gain.gain.exponentialRampToValueAtTime(VOLUME, now + FADE_IN_S);
  line.el.play().catch(waitForGesture);
}

/** Events Safari and Chrome each count as the user asking for sound */
const GESTURES = ["pointerdown", "pointerup", "click", "touchend", "keydown"];

/** Browsers refuse to play before the user clicks or presses a key, so each gesture tries again until one is let through */
function retryOnGesture(): void {
  if (!track || !audible()) return;
  audio();
  track
    .play()
    .then(() => {
      for (const event of GESTURES)
        window.removeEventListener(event, retryOnGesture, true);
    })
    .catch(() => {});
}

function waitForGesture(): void {
  for (const event of GESTURES)
    window.addEventListener(event, retryOnGesture, true);
}

function stopPlaying(): void {
  const a = audio();
  if (!track || !bus || !a) {
    track?.pause();
    return;
  }
  bus.gain.setTargetAtTime(0.0001, a.ctx.currentTime, FADE_OUT_S);
  const el = track;
  if (pauseTimer) clearTimeout(pauseTimer);
  pauseTimer = setTimeout(() => el.pause(), PAUSE_AFTER_MS);
}

/** Whether the music should be heard: wanted, sound on, and the game's tab the one in front */
const audible = () => wanted && sfx.isEnabled() && !document.hidden;

// The music follows the sound button
sfx.subscribe(() => {
  if (!sfx.isEnabled()) track?.pause();
  else if (audible()) startPlaying();
});

// It goes quiet while another tab is in front, and comes back with this one
document.addEventListener("visibilitychange", () => {
  if (audible()) startPlaying();
  else if (document.hidden) stopPlaying();
});

export const music = {
  /** Plays while `on`, only while sound is turned on and this tab is in front */
  set(on: boolean): void {
    wanted = on;
    if (audible()) startPlaying();
    if (!on) stopPlaying();
  },
};

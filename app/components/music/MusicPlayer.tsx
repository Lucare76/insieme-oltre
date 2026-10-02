import type { CSSProperties } from "react";
import { formatTime, musicTrack } from "../../../lib/musicTimeline";

export type MusicStatus = "idle" | "playing" | "paused" | "ended";

const LABELS: Record<MusicStatus, string> = {
  idle: "Ascolta",
  playing: "Pausa",
  paused: "Riprendi",
  ended: "Ascolta di nuovo",
};

function PlayIcon() {
  return <svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>;
}

function PauseIcon() {
  return <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.4" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.4" /></svg>;
}

function ReplayIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 5a7 7 0 1 1-6.62 9.28 1 1 0 1 1 1.89-.66A5 5 0 1 0 12 7h-1.6l1.3 1.3a1 1 0 0 1-1.4 1.4l-3-3a1 1 0 0 1 0-1.4l3-3a1 1 0 0 1 1.4 1.4L10.4 5H12Z" />
    </svg>
  );
}

function VolumeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" /><path className="music-volume-wave" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" /></svg>;
}

// Un solo grande pulsante, la barra di avanzamento e i tempi. Il volume compare solo su desktop.
export function MusicPlayer({ status, time, duration, volume, onToggle, onSeek, onVolume }: {
  status: MusicStatus;
  time: number;
  duration: number;
  volume: number;
  onToggle: () => void;
  onSeek: (time: number) => void;
  onVolume: (volume: number) => void;
}) {
  const playing = status === "playing";
  const label = LABELS[status];
  const title = `“${musicTrack.title}”`;
  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div className="music-player">
      <button
        type="button"
        className="music-play"
        onClick={onToggle}
        aria-label={playing ? `Metti in pausa ${title}` : `${label} ${title}`}
      >
        <span className="music-play-icon" aria-hidden="true">
          {playing ? <PauseIcon /> : status === "ended" ? <ReplayIcon /> : <PlayIcon />}
        </span>
        <span>{label}</span>
      </button>

      <div className="music-progress">
        <span className="music-time" aria-hidden="true">{formatTime(time)}</span>
        <input
          type="range"
          className="music-range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          step={1}
          value={Math.min(Math.floor(time), Math.floor(duration))}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label="Avanzamento del brano"
          aria-valuetext={`${formatTime(time)} di ${formatTime(duration)}`}
          style={{ "--progress": `${progress}%` } as CSSProperties}
        />
        <span className="music-time" aria-hidden="true">{formatTime(duration)}</span>
        <label className="music-volume">
          <VolumeIcon />
          <input
            type="range"
            className="music-range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => onVolume(Number(event.target.value))}
            aria-label="Volume"
            aria-valuetext={`${Math.round(volume * 100)}%`}
            style={{ "--progress": `${volume * 100}%` } as CSSProperties}
          />
        </label>
      </div>
    </div>
  );
}

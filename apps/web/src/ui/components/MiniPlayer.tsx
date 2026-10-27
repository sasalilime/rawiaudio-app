import type { PlaybackStatus } from '@rawiaudio/shared/core/useCases/playbackSession.ts'
import { episodePath } from '../router.ts'
import { formatClock } from '@rawiaudio/shared/ui/format.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { usePlayback } from '@rawiaudio/shared/ui/hooks/usePlayback.ts'
import { Link } from '../navigation.tsx'

const SKIP_SECONDS = 15

const MESSAGES: Partial<Record<PlaybackStatus, string>> = {
  loading: fr.playerLoading,
  blocked: fr.playerBlocked,
  error: fr.playerError,
  ended: fr.playerEnded,
}

/** Le lecteur en bas de l'écran, visible sur toutes les pages dès qu'un épisode est lancé. */
export function MiniPlayer() {
  const [snapshot, playback] = usePlayback()
  const { episode, status, position } = snapshot
  if (!episode) return null

  const running = status === 'playing' || status === 'loading'

  return (
    <>
      <div className="player-spacer" aria-hidden="true" />
      <section className="player" aria-label={fr.player}>
        <div className="player-top">
          <Link href={episodePath(episode.id)} className="player-title">
            {episode.title}
          </Link>
          <span className="player-time">
            {formatClock(position)} / {formatClock(episode.durationSeconds)}
          </span>
        </div>
        <input
          type="range"
          className="player-progress"
          min={0}
          max={episode.durationSeconds}
          step={1}
          value={Math.floor(position)}
          aria-label={fr.position}
          aria-valuetext={fr.positionText(formatClock(position), formatClock(episode.durationSeconds))}
          onChange={(event) => playback.seekTo(Number(event.currentTarget.value))}
        />
        <div className="player-controls">
          <button type="button" className="player-skip" aria-label={fr.backward} onClick={() => playback.seekBy(-SKIP_SECONDS)}>
            −15
          </button>
          <button
            type="button"
            className="player-toggle"
            aria-label={running ? fr.pause : fr.playLabel}
            onClick={() => playback.toggle()}
          >
            {running ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" className="player-skip" aria-label={fr.forward} onClick={() => playback.seekBy(SKIP_SECONDS)}>
            +15
          </button>
        </div>
        <p className="player-status" role="status">
          {MESSAGES[status]}
        </p>
      </section>
    </>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
    </svg>
  )
}

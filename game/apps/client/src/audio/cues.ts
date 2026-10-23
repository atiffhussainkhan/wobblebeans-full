import { VOLUME, type AudioEventId, type CueShape } from '@wobblebeans/shared'

export interface ListenerPose {
  x: number
  y: number
  z: number
  fx: number
  fy: number
  fz: number
}

export interface VisualCue {
  cueId: string
  eventId: AudioEventId
  label: string
  shape: CueShape
  edgeAngle: number | null
  until: number
  pulseHz: number
}

/**
 * Signed horizontal angle of an off-screen source, or null when it is on screen,
 * too close (the bean in front of the camera), or farther than the ring range.
 * Angle 0 is the camera's forward. Positive is to the right.
 */
export function ringAngle(
  listener: ListenerPose | null,
  source: { x: number; y: number; z: number } | null,
  maxMeters: number,
): number | null {
  if (!listener || !source) return null
  const dx = source.x - listener.x
  const dy = source.y - listener.y
  const dz = source.z - listener.z
  const dist = Math.hypot(dx, dy, dz)
  if (dist < 0.8 || dist > maxMeters) return null
  const flat = Math.hypot(listener.fx, listener.fz) || 1
  const forwardX = listener.fx / flat
  const forwardZ = listener.fz / flat
  const planar = Math.hypot(dx, dz) || 1
  const dot = (dx * forwardX + dz * forwardZ) / planar
  const cross = forwardZ * dx - forwardX * dz
  const angle = Math.atan2(cross, dot)
  if (Math.abs(angle) < 0.55) return null
  return angle
}

export function distanceBetween(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/** Linear rolloff. Full volume inside `min`, silent at `max`. */
export function distanceGain(distance: number, min: number, max: number): number {
  if (distance <= min) return 1
  if (distance >= max) return 0
  return 1 - (distance - min) / (max - min)
}

export interface CueView {
  render(cues: VisualCue[], ring: boolean, reduceMotion: boolean): void
}

/**
 * Visual twins for gameplay-relevant sounds. They render whether or not the
 * bus is muted. Pulses stay at 2 Hz, under the 3 Hz cap. Shape plus label,
 * never colour alone.
 */
export function mountCueLayer(doc: Document): CueView {
  const style = doc.createElement('style')
  style.id = 'wb-audio-cues-style'
  style.textContent = CUE_CSS
  doc.head.appendChild(style)

  const root = doc.createElement('div')
  root.id = 'wb-audio-cues'
  root.setAttribute('aria-live', 'polite')
  doc.body.appendChild(root)

  const ring = doc.createElement('div')
  ring.className = 'wb-ring'
  ring.hidden = true
  root.appendChild(ring)

  const stack = doc.createElement('div')
  stack.className = 'wb-stack'
  root.appendChild(stack)

  return {
    render(cues, ringOn, reduceMotion) {
      root.classList.toggle('wb-still', reduceMotion)
      const banners = cues.filter((cue) => cue.shape !== 'icon').slice(-3)
      const icons = cues.filter((cue) => cue.shape === 'icon').slice(-4)
      const shown = [...banners, ...icons]
      stack.replaceChildren(
        ...shown.map((cue) => {
          const item = doc.createElement('div')
          item.className = `wb-cue wb-${cue.shape}`
          item.dataset.cue = cue.cueId
          item.dataset.event = cue.eventId
          const mark = doc.createElement('span')
          mark.className = 'wb-mark'
          mark.appendChild(markSvg(doc, cue.shape))
          const text = doc.createElement('span')
          text.textContent = cue.label
          item.append(mark, text)
          return item
        }),
      )
      const aimed = ringOn ? cues.find((cue) => cue.edgeAngle !== null) : undefined
      if (!aimed || aimed.edgeAngle === null) {
        ring.hidden = true
        return
      }
      ring.hidden = false
      const angle = aimed.edgeAngle
      const x = 50 + Math.sin(angle) * 42
      const y = 50 - Math.cos(angle) * 36
      ring.style.left = `${x}%`
      ring.style.top = `${y}%`
      ring.dataset.cue = aimed.cueId
      ring.replaceChildren()
      const label = doc.createElement('span')
      label.textContent = aimed.label
      ring.append(markSvg(doc, 'ring'), label)
    },
  }
}

function markSvg(doc: Document, shape: CueShape | 'ring'): SVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 32 32')
  svg.setAttribute('aria-hidden', 'true')
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', MARK[shape])
  svg.appendChild(path)
  return svg
}

const MARK: Record<CueShape | 'ring', string> = {
  banner: 'M6 8h20v12H6z M10 14h12',
  icon: 'M16 6l8 10H8z',
  vignette: 'M4 16a12 12 0 1 0 24 0a12 12 0 1 0-24 0',
  shimmer: 'M16 4l2 8h8l-6 5 2 8-6-5-6 5 2-8-6-5h8z',
  ring: 'M8 16a8 8 0 1 0 16 0a8 8 0 1 0-16 0',
}

const CUE_CSS = `
#wb-audio-cues {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 6;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
  color: #1f2140;
}
#wb-audio-cues .wb-stack {
  position: absolute;
  top: 88px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}
#wb-audio-cues .wb-cue,
#wb-audio-cues .wb-ring {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fffdf7;
  border: 3px solid #1f2140;
  border-radius: 999px;
  padding: 6px 14px 6px 8px;
  font-weight: 800;
  font-size: 18px;
  box-shadow: 0 4px 0 #1f2140;
}
#wb-audio-cues .wb-mark,
#wb-audio-cues .wb-ring svg {
  width: 28px;
  height: 28px;
  flex: none;
}
#wb-audio-cues svg { fill: none; stroke: #1f2140; stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
#wb-audio-cues .wb-vignette { border-radius: 18px; }
#wb-audio-cues .wb-shimmer { border-style: dashed; }
#wb-audio-cues .wb-icon { border-radius: 12px; }
#wb-audio-cues .wb-ring {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  width: 92px;
  height: 92px;
  justify-content: center;
  padding: 8px;
  text-align: center;
  flex-direction: column;
  font-size: 14px;
}
#wb-audio-cues:not(.wb-still) .wb-stack .wb-cue {
  animation: wb-cue-pop ${1 / VOLUME.cuePulseHz}s ease-in-out infinite;
}
#wb-audio-cues:not(.wb-still) .wb-ring {
  animation: wb-ring-fade ${1 / VOLUME.cuePulseHz}s ease-in-out infinite;
}
@keyframes wb-cue-pop {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
@keyframes wb-ring-fade {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.75; }
}
@media (prefers-reduced-motion: reduce) {
  #wb-audio-cues .wb-cue, #wb-audio-cues .wb-ring { animation: none; }
}
`

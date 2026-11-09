/**
 * Progress-bar previews.
 *
 * `GET /api/v1/media/:id/preview.vtt` returns WebVTT whose cues point at
 * rectangles inside one sprite image (`image#xywh=x,y,w,h`). The cues are not
 * attached as a text track — the player looks the rectangle up for the second
 * the pointer is over.
 */

export interface PreviewCue {
  start: number
  end: number
  x: number
  y: number
  width: number
  height: number
}

export interface PreviewSprite {
  url: string
  cues: PreviewCue[]
}

const CUE_TIMING = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/
const CUE_IMAGE = /^(.+?)#xywh=(\d+),(\d+),(\d+),(\d+)$/

function seconds(hours: string, minutes: string, secs: string, millis: string): number {
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(secs) + Number(millis) / 1000
}

/** Parse a preview VTT; malformed cues are skipped so playback never breaks. */
export function parsePreviewVtt(text: string): PreviewSprite | null {
  if (!text.trimStart().startsWith('WEBVTT')) return null
  const lines = text.split(/\r?\n/)
  const cues: PreviewCue[] = []
  let url: string | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const timing = CUE_TIMING.exec(lines[index].trim())
    if (!timing) continue
    const image = CUE_IMAGE.exec((lines[index + 1] ?? '').trim())
    if (!image) continue
    url = image[1]
    cues.push({
      start: seconds(timing[1], timing[2], timing[3], timing[4]),
      end: seconds(timing[5], timing[6], timing[7], timing[8]),
      x: Number(image[2]),
      y: Number(image[3]),
      width: Number(image[4]),
      height: Number(image[5]),
    })
  }

  return url && cues.length > 0 ? { url, cues } : null
}

/** The cue covering `time`, clamped to the first and last cue. */
export function cueAt(sprite: PreviewSprite, time: number): PreviewCue | null {
  if (sprite.cues.length === 0) return null
  if (time <= sprite.cues[0].start) return sprite.cues[0]
  for (const cue of sprite.cues) {
    if (time >= cue.start && time < cue.end) return cue
  }
  return sprite.cues[sprite.cues.length - 1]
}

/** CSS for showing one cue of the sheet inside a fixed-size element. */
export function cueStyle(
  sprite: PreviewSprite,
  cue: PreviewCue,
): { backgroundImage: string; backgroundPosition: string; width: string; height: string } {
  return {
    backgroundImage: `url("${sprite.url}")`,
    backgroundPosition: `-${cue.x}px -${cue.y}px`,
    width: `${cue.width}px`,
    height: `${cue.height}px`,
  }
}

/** Clamp a pointer ratio to 0..1 for time lookups. */
export function ratioOf(clientX: number, left: number, width: number): number {
  if (width <= 0) return 0
  return Math.min(1, Math.max(0, (clientX - left) / width))
}

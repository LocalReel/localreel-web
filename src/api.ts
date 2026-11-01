export interface Health {
  status: string
  version: string
  database: boolean
  ffmpeg: boolean
  media_count: number
  uptime_seconds: number
}

export async function fetchHealth(): Promise<Health> {
  const response = await fetch('/api/v1/health')
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json() as Promise<Health>
}

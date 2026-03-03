/**
 * Returns relative time in Portuguese, e.g. "há 5 min", "há cerca de 2 horas"
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `há ${diffMin} min`
  if (diffHours < 24) return `há cerca de ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`
  if (diffDays < 7) return `há ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

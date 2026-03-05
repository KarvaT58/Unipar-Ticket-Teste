/**
 * Status do usuário exibido na dashboard e para outros usuários.
 * value = código armazenado em profiles.user_status
 */
export const USER_STATUS_LABELS: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  ferias: "Férias",
  intervalo: "Intervalo",
  almoco: "Almoço",
  fim_de_semana: "Fim de semana",
  feriado: "Feriado",
  ocupado: "Ocupado",
  reuniao: "Reunião",
  home_office: "Home office",
  ausente: "Ausente",
}

export const USER_STATUS_OPTIONS = [
  { value: "__none__", label: "Não definido" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "ferias", label: "Férias" },
  { value: "intervalo", label: "Intervalo" },
  { value: "almoco", label: "Almoço" },
  { value: "fim_de_semana", label: "Fim de semana" },
  { value: "feriado", label: "Feriado" },
  { value: "ocupado", label: "Ocupado" },
  { value: "reuniao", label: "Reunião" },
  { value: "home_office", label: "Home office" },
  { value: "ausente", label: "Ausente" },
] as const

export function getUserStatusLabel(value: string | null | undefined): string {
  if (!value) return ""
  return USER_STATUS_LABELS[value] ?? value
}

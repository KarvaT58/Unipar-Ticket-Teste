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

export function getUserStatusLabel(value: string | null | undefined): string {
  if (!value) return ""
  return USER_STATUS_LABELS[value] ?? value
}

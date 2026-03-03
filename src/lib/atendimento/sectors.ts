/**
 * Setores para destino de chamados.
 * value = código armazenado no banco (target_sector / department).
 * label = texto exibido no select.
 */
export const SECTORS = [
  { value: "CPA", label: "CPA - Comissão Própria de Avaliação" },
  { value: "CIA", label: "CIA - Central de Informações Acadêmicas" },
  { value: "CSC", label: "CSC - Central de Serviços Compartilhados" },
  { value: "TI", label: "TI - Tecnologia da Informação" },
  { value: "MAN", label: "MAN - Manutenção" },
  { value: "ADM", label: "ADM - Administração" },
  { value: "RH", label: "RH - Recursos Humanos" },
  { value: "CSE", label: "CSE - Centro de Saúde e Escola" },
  { value: "LAB", label: "LAB - Laboratório de Saúde" },
  { value: "VIG", label: "VIG - Vigilância" },
  { value: "LIM", label: "LIM - Limpeza" },
] as const

export type SectorValue = (typeof SECTORS)[number]["value"]

export const SECTOR_VALUES = SECTORS.map((s) => s.value)

export function getSectorLabel(value: string): string {
  const found = SECTORS.find((s) => s.value === value)
  return found ? found.label : value
}

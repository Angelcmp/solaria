/**
 * Primitivo de permisos del agente.
 *
 * Un tool puede requerir confirmación del usuario antes de ejecutarse. El
 * estado pendiente vive en `useAgent` y se renderiza en la UI; el shell (v0.12)
 * reutilizará este mismo mecanismo con allowlist/denylist y jail de workspace.
 */

export type PermissionDecision = 'allow' | 'deny'

/** Política por herramienta (auto = sin preguntar, deny = bloqueada). */
export type ToolPolicy = 'auto' | 'ask' | 'deny'

export interface PendingConfirmation {
  /** Identificador de la solicitud (permite resolver por llamada). */
  id: string
  toolName: string
  args: Record<string, unknown>
  /** Motivo mostrado al usuario (ruta sensible, fuera del workspace, etc.). */
  warning: string
}

/** ¿Hay que pedir permiso antes de ejecutar la herramienta? */
export function requiresPreConfirmation(toolName: string, confirmWrite: boolean): boolean {
  return toolName === 'write_file' && confirmWrite
}

/** Mensaje de denegación registrado en el historial del agente. */
export function denialMessage(toolName: string): string {
  return `El usuario denegó la ejecución de ${toolName} por seguridad`
}

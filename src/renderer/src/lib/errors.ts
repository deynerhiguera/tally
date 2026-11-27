/**
 * A readable message from any thrown value. Strips Electron's IPC wrapper:
 * "Error invoking remote method 'habits:create': InvalidInputError: name is required." → "name is required."
 */
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '')
}

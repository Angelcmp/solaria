export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParam[]
}

export interface ToolParam {
  name: string
  param_type: string
  description: string
  required: boolean
}

export interface ToolResult {
  success: boolean
  output: string
  error: string | null
  requires_confirmation?: boolean
  preview?: string | null
}

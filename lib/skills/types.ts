/**
 * Standard interfaces for agent skills.
 *
 * Two types of skills:
 * 1. ToolSkill  — .ts file, callable via function-calling (has parameters + execute)
 * 2. Instruction — .md file in lib/skills/instructions/, injected into system prompt
 */

/** OpenAI function-calling parameter schema */
export interface SkillParameterSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    enum?: string[];
  }>;
  required?: string[];
}

/** Skill that becomes a callable tool via function-calling */
export interface ToolSkill {
  kind: 'tool';
  /** Unique name used in tool_call.function.name */
  name: string;
  /** Description shown to the LLM so it knows when to use the skill */
  description: string;
  /** JSON Schema for the function parameters */
  parameters: SkillParameterSchema;
  /** Execute the skill with parsed arguments. Returns a string result for the LLM. */
  execute(args: Record<string, unknown>): Promise<string>;
}

/** OpenAI function-calling tool format (for OpenRouter) */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: SkillParameterSchema;
  };
}

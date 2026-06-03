/** Spec: security-governance/guardrails/prompt-guard.ts */
import { type PolicyDecision } from "@daemon/platform-types";

export interface PromptScan extends PolicyDecision {
  /** Names of the rules that matched, for audit. */
  matches: string[];
}

interface PromptRule {
  id: string;
  pattern: RegExp;
}

/**
 * Heuristic guard that screens free-text prompts for injection and
 * exfiltration attempts before they reach a model or tool. Rules are simple,
 * explainable patterns; matching any one yields a deny with the rule ids.
 */
export class PromptGuard {
  private readonly rules: PromptRule[];

  constructor(extra: PromptRule[] = []) {
    this.rules = [
      { id: "ignore-instructions", pattern: /ignore\b[\w\s]{0,40}\binstructions/i },
      { id: "reveal-system", pattern: /(reveal|print|show).{0,20}(system prompt|hidden)/i },
      { id: "exfiltrate-secrets", pattern: /\b(api[_-]?key|password|secret|token)\b/i },
      { id: "role-override", pattern: /you are now (an?|the) [a-z]/i },
      ...extra,
    ];
  }

  scan(prompt: string): PromptScan {
    const matches = this.rules
      .filter((rule) => rule.pattern.test(prompt))
      .map((rule) => rule.id);
    if (matches.length > 0) {
      return { effect: "deny", reason: "prompt matched guard rules", matches };
    }
    return { effect: "allow", reason: "clean prompt", matches: [] };
  }
}

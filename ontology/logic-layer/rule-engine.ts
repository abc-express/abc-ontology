export interface Fact {
  predicate: string;
  args: string[];
}

export interface Rule {
  id: string;
  /** All conditions must be present in the fact set for the rule to fire. */
  when: Fact[];
  /** Facts asserted when the rule fires. */
  then: Fact[];
}

function factKey(fact: Fact): string {
  return `${fact.predicate}(${fact.args.join(",")})`;
}

/**
 * Forward-chaining rule engine over ground facts. Repeatedly fires rules whose
 * conditions are satisfied until no new facts are produced (fixpoint).
 */
export class RuleEngine {
  private readonly rules: Rule[] = [];

  addRule(rule: Rule): void {
    if (!rule.id) throw new Error("rule id required");
    if (rule.when.length === 0) throw new Error("rule requires conditions");
    this.rules.push(rule);
  }

  evaluate(initialFacts: Fact[]): Fact[] {
    const known = new Map<string, Fact>();
    for (const fact of initialFacts) known.set(factKey(fact), fact);

    let changed = true;
    while (changed) {
      changed = false;
      for (const rule of this.rules) {
        const satisfied = rule.when.every((c) => known.has(factKey(c)));
        if (!satisfied) continue;
        for (const produced of rule.then) {
          const key = factKey(produced);
          if (!known.has(key)) {
            known.set(key, produced);
            changed = true;
          }
        }
      }
    }
    return [...known.values()];
  }
}

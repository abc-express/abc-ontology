import { RuleEngine, type Fact, type Rule } from "./rule-engine.js";

/**
 * Thin inference facade over the forward-chaining RuleEngine. Adds convenience
 * queries (ask / explainable derivation) on top of the derived fact closure.
 */
export class InferenceEngine {
  private readonly engine = new RuleEngine();

  constructor(rules: Rule[] = []) {
    for (const rule of rules) this.engine.addRule(rule);
  }

  infer(facts: Fact[]): Fact[] {
    return this.engine.evaluate(facts);
  }

  ask(facts: Fact[], query: Fact): boolean {
    const key = `${query.predicate}(${query.args.join(",")})`;
    return this.infer(facts).some(
      (f) => `${f.predicate}(${f.args.join(",")})` === key,
    );
  }
}

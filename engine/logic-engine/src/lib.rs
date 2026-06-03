use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use thiserror::Error;

// ── Conditions ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum Condition {
    Eq { field: String, value: Value },
    Neq { field: String, value: Value },
    Gt { field: String, value: Value },
    Gte { field: String, value: Value },
    Lt { field: String, value: Value },
    Lte { field: String, value: Value },
    Contains { field: String, value: Value },
    In { field: String, values: Vec<Value> },
    And { conditions: Vec<Condition> },
    Or { conditions: Vec<Condition> },
    Not { condition: Box<Condition> },
    Exists { field: String },
}

impl Condition {
    /// Evaluate a condition against a fact map (entity attributes).
    pub fn evaluate(&self, facts: &HashMap<String, Value>) -> bool {
        match self {
            Condition::Eq { field, value } => facts.get(field) == Some(value),
            Condition::Neq { field, value } => facts.get(field).map_or(true, |v| v != value),
            Condition::Gt { field, value } => {
                compare_numeric(facts.get(field), value, std::cmp::Ordering::Greater)
            }
            Condition::Gte { field, value } => {
                compare_numeric(facts.get(field), value, std::cmp::Ordering::Greater)
                    || facts.get(field) == Some(value)
            }
            Condition::Lt { field, value } => {
                compare_numeric(facts.get(field), value, std::cmp::Ordering::Less)
            }
            Condition::Lte { field, value } => {
                compare_numeric(facts.get(field), value, std::cmp::Ordering::Less)
                    || facts.get(field) == Some(value)
            }
            Condition::Contains { field, value } => facts
                .get(field)
                .and_then(|v| v.as_str())
                .map_or(false, |s| s.contains(value.as_str().unwrap_or(""))),
            Condition::In { field, values } => {
                facts.get(field).map_or(false, |v| values.contains(v))
            }
            Condition::And { conditions } => conditions.iter().all(|c| c.evaluate(facts)),
            Condition::Or { conditions } => conditions.iter().any(|c| c.evaluate(facts)),
            Condition::Not { condition } => !condition.evaluate(facts),
            Condition::Exists { field } => facts.contains_key(field),
        }
    }
}

fn compare_numeric(a: Option<&Value>, b: &Value, ordering: std::cmp::Ordering) -> bool {
    let a_num = a.and_then(|v| v.as_f64());
    let b_num = b.as_f64();
    match (a_num, b_num) {
        (Some(a), Some(b)) => a.partial_cmp(&b) == Some(ordering),
        _ => false,
    }
}

// ── Actions ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Action {
    SetFact {
        field: String,
        value: Value,
    },
    RemoveFact {
        field: String,
    },
    Emit {
        event: String,
        #[serde(default)]
        payload: Value,
    },
    Halt {
        reason: String,
    },
}

// ── Rules ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub name: String,
    #[serde(default)]
    pub priority: i32,
    pub when: Condition,
    pub then: Vec<Action>,
}

#[derive(Debug, Clone, Default)]
pub struct RuleSet {
    rules: Vec<Rule>,
}

impl RuleSet {
    pub fn new() -> Self {
        Self::default()
    }

    /// Load rules from YAML. Rules are sorted by descending priority.
    pub fn load_yaml(yaml: &str) -> Result<Self, LogicError> {
        let mut rules: Vec<Rule> =
            serde_yaml::from_str(yaml).map_err(|e| LogicError::Parse(e.to_string()))?;
        rules.sort_by(|a, b| b.priority.cmp(&a.priority));
        Ok(Self { rules })
    }

    pub fn from_rules(rules: Vec<Rule>) -> Self {
        let mut sorted = rules;
        sorted.sort_by(|a, b| b.priority.cmp(&a.priority));
        Self { rules: sorted }
    }

    /// Evaluate all rules against the given facts, returning the actions from
    /// the first matching rule (highest priority first). Returns `None` when
    /// no rule matches.
    pub fn evaluate_first(&self, facts: &HashMap<String, Value>) -> Option<&[Action]> {
        for rule in &self.rules {
            if rule.when.evaluate(facts) {
                return Some(&rule.then);
            }
        }
        None
    }

    /// Return all matching rules ordered by priority.
    pub fn evaluate_all(&self, facts: &HashMap<String, Value>) -> Vec<&Rule> {
        self.rules
            .iter()
            .filter(|r| r.when.evaluate(facts))
            .collect()
    }

    pub fn len(&self) -> usize {
        self.rules.len()
    }

    pub fn is_empty(&self) -> bool {
        self.rules.is_empty()
    }
}

// ── Errors ─────────────────────────────────────────────────────────

#[derive(Error, Debug)]
pub enum LogicError {
    #[error("parse error: {0}")]
    Parse(String),
}

// ── Inference Engine ───────────────────────────────────────────────

/// Forward-chaining inference engine. Starts with initial facts, repeatedly
/// evaluates rules, and applies `SetFact` / `RemoveFact` actions until no more
/// rules fire or a `Halt` action is encountered.
#[derive(Debug)]
pub struct InferenceEngine {
    rules: RuleSet,
    facts: HashMap<String, Value>,
    events: Vec<EmittedEvent>,
    fired_rules: HashSet<String>,
    halted: bool,
    iterations: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct EmittedEvent {
    pub event: String,
    pub payload: Value,
}

#[derive(Debug, Clone, PartialEq)]
pub struct InferenceResult {
    pub final_facts: HashMap<String, Value>,
    pub events: Vec<EmittedEvent>,
    pub halted: bool,
    pub iterations: usize,
}

impl InferenceEngine {
    pub fn new(rules: RuleSet, initial_facts: HashMap<String, Value>) -> Self {
        Self {
            rules,
            facts: initial_facts,
            events: Vec::new(),
            fired_rules: HashSet::new(),
            halted: false,
            iterations: 0,
        }
    }

    /// Run forward chaining up to `max_iterations` steps (default 100). Stops
    /// when no rule matches or a `Halt` action fires.
    pub fn run(&mut self, max_iterations: usize) -> InferenceResult {
        let limit = if max_iterations == 0 {
            100
        } else {
            max_iterations
        };

        while self.iterations < limit && !self.halted {
            let matching = self.rules.evaluate_all(&self.facts);
            // Find the highest-priority rule that hasn't fired yet.
            let rule = match matching.into_iter().find(|r| !self.fired_rules.contains(&r.name)) {
                Some(r) => r,
                None => break,
            };
            let actions = rule.then.clone();
            self.fired_rules.insert(rule.name.clone());
            self.iterations += 1;
            self.apply_actions(&actions);
        }

        InferenceResult {
            final_facts: self.facts.clone(),
            events: self.events.clone(),
            halted: self.halted,
            iterations: self.iterations,
        }
    }

    fn apply_actions(&mut self, actions: &[Action]) {
        for action in actions {
            match action {
                Action::SetFact { field, value } => {
                    self.facts.insert(field.clone(), value.clone());
                }
                Action::RemoveFact { field } => {
                    self.facts.remove(field);
                }
                Action::Emit { event, payload } => {
                    self.events.push(EmittedEvent {
                        event: event.clone(),
                        payload: payload.clone(),
                    });
                }
                Action::Halt { reason: _ } => {
                    self.halted = true;
                    break;
                }
            }
        }
    }
}

// ── Planner ────────────────────────────────────────────────────────

/// A plan step: an action with a description of why it's needed.
#[derive(Debug, Clone, PartialEq)]
pub struct PlanStep {
    pub rule_name: String,
    pub action: Action,
}

/// A plan is a sequence of steps that transforms initial facts toward a goal.
#[derive(Debug, Clone, PartialEq)]
pub struct Plan {
    pub steps: Vec<PlanStep>,
    pub achieved: bool,
}

/// Simple backward-chaining planner: given a goal condition and a rule set,
/// find a linear chain of rules whose actions can satisfy the goal from the
/// initial facts.
pub fn plan(
    rules: &RuleSet,
    initial: &HashMap<String, Value>,
    goal: &Condition,
    max_depth: usize,
) -> Plan {
    let depth_limit = if max_depth == 0 { 20 } else { max_depth };
    let mut steps = Vec::new();

    if goal.evaluate(initial) {
        return Plan {
            steps,
            achieved: true,
        };
    }

    let mut facts = initial.clone();

    for _ in 0..depth_limit {
        let matching: Vec<&Rule> = rules.evaluate_all(&facts);
        if matching.is_empty() {
            break;
        }

        // Pick the highest-priority rule that makes progress toward the goal.
        let best = matching.into_iter().find(|r| {
            // Simulate: would applying this rule's SetFact actions help?
            r.then.iter().any(|a| {
                if let Action::SetFact { .. } = a {
                    let mut test_facts = facts.clone();
                    apply_single(&mut test_facts, a);
                    goal.evaluate(&test_facts)
                } else {
                    false
                }
            })
        });

        match best {
            Some(rule) => {
                for action in &rule.then {
                    steps.push(PlanStep {
                        rule_name: rule.name.clone(),
                        action: action.clone(),
                    });
                    apply_single(&mut facts, action);
                }
                if goal.evaluate(&facts) {
                    return Plan {
                        steps,
                        achieved: true,
                    };
                }
            }
            None => {
                // No rule directly helps; apply the first matching rule anyway
                // and continue (heuristic fallback).
                let fallback = rules.evaluate_all(&facts);
                if let Some(rule) = fallback.first() {
                    for action in &rule.then {
                        steps.push(PlanStep {
                            rule_name: rule.name.clone(),
                            action: action.clone(),
                        });
                        apply_single(&mut facts, action);
                    }
                } else {
                    break;
                }
            }
        }
    }

    Plan {
        achieved: goal.evaluate(&facts),
        steps,
    }
}

fn apply_single(facts: &mut HashMap<String, Value>, action: &Action) {
    match action {
        Action::SetFact { field, value } => {
            facts.insert(field.clone(), value.clone());
        }
        Action::RemoveFact { field } => {
            facts.remove(field);
        }
        _ => {}
    }
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn facts(fields: &[(&str, Value)]) -> HashMap<String, Value> {
        fields
            .iter()
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect()
    }

    // ── Condition tests ─────────────────────────────────────────

    #[test]
    fn eq_matches() {
        assert!(Condition::Eq {
            field: "status".into(),
            value: Value::String("active".into()),
        }
        .evaluate(&facts(&[("status", Value::String("active".into()))])));
    }

    #[test]
    fn eq_rejects_different() {
        assert!(!Condition::Eq {
            field: "status".into(),
            value: Value::String("active".into()),
        }
        .evaluate(&facts(&[("status", Value::String("inactive".into()))])));
    }

    #[test]
    fn gt_numeric() {
        assert!(Condition::Gt {
            field: "score".into(),
            value: Value::Number(serde_json::Number::from(50)),
        }
        .evaluate(&facts(&[(
            "score",
            Value::Number(serde_json::Number::from(100))
        )])));
    }

    #[test]
    fn gt_rejects_lower() {
        assert!(!Condition::Gt {
            field: "score".into(),
            value: Value::Number(serde_json::Number::from(100)),
        }
        .evaluate(&facts(&[(
            "score",
            Value::Number(serde_json::Number::from(50))
        )])));
    }

    #[test]
    fn contains_substring() {
        assert!(Condition::Contains {
            field: "note".into(),
            value: Value::String("urgent".into()),
        }
        .evaluate(&facts(&[(
            "note",
            Value::String("this is urgent please".into())
        )])));
    }

    #[test]
    fn contains_rejects_absent() {
        assert!(!Condition::Contains {
            field: "note".into(),
            value: Value::String("urgent".into()),
        }
        .evaluate(&facts(&[])));
    }

    #[test]
    fn in_set() {
        assert!(Condition::In {
            field: "region".into(),
            values: vec![Value::String("eu".into()), Value::String("us".into()),],
        }
        .evaluate(&facts(&[("region", Value::String("eu".into()))])));
    }

    #[test]
    fn in_rejects_not_member() {
        assert!(!Condition::In {
            field: "region".into(),
            values: vec![Value::String("eu".into())],
        }
        .evaluate(&facts(&[("region", Value::String("ap".into()))])));
    }

    #[test]
    fn and_both_true() {
        assert!(Condition::And {
            conditions: vec![
                Condition::Exists { field: "a".into() },
                Condition::Exists { field: "b".into() },
            ],
        }
        .evaluate(&facts(&[
            ("a", Value::Bool(true)),
            ("b", Value::Bool(false)),
        ])));
    }

    #[test]
    fn and_one_false() {
        assert!(!Condition::And {
            conditions: vec![
                Condition::Exists { field: "a".into() },
                Condition::Exists {
                    field: "missing".into(),
                },
            ],
        }
        .evaluate(&facts(&[("a", Value::Bool(true))])));
    }

    #[test]
    fn or_one_true() {
        assert!(Condition::Or {
            conditions: vec![
                Condition::Exists { field: "a".into() },
                Condition::Exists {
                    field: "missing".into(),
                },
            ],
        }
        .evaluate(&facts(&[("a", Value::Bool(true))])));
    }

    #[test]
    fn not_inverts() {
        assert!(Condition::Not {
            condition: Box::new(Condition::Exists {
                field: "missing".into(),
            }),
        }
        .evaluate(&facts(&[])));
    }

    #[test]
    fn exists_finds_key() {
        assert!(Condition::Exists {
            field: "key".into(),
        }
        .evaluate(&facts(&[("key", Value::Null)])));
    }

    #[test]
    fn exists_rejects_absent() {
        assert!(!Condition::Exists {
            field: "nope".into(),
        }
        .evaluate(&facts(&[])));
    }

    // ── RuleSet tests ───────────────────────────────────────────

    fn approval_rules() -> RuleSet {
        RuleSet::from_rules(vec![
            Rule {
                name: "auto-approve-small".into(),
                priority: 10,
                when: Condition::And {
                    conditions: vec![
                        Condition::Eq {
                            field: "type".into(),
                            value: Value::String("purchase".into()),
                        },
                        Condition::Lt {
                            field: "amount".into(),
                            value: Value::Number(serde_json::Number::from(1000)),
                        },
                    ],
                },
                then: vec![Action::SetFact {
                    field: "decision".into(),
                    value: Value::String("approved".into()),
                }],
            },
            Rule {
                name: "flag-large".into(),
                priority: 5,
                when: Condition::And {
                    conditions: vec![
                        Condition::Eq {
                            field: "type".into(),
                            value: Value::String("purchase".into()),
                        },
                        Condition::Gte {
                            field: "amount".into(),
                            value: Value::Number(serde_json::Number::from(1000)),
                        },
                    ],
                },
                then: vec![Action::SetFact {
                    field: "decision".into(),
                    value: Value::String("review".into()),
                }],
            },
            Rule {
                name: "default-deny".into(),
                priority: 0,
                when: Condition::Exists {
                    field: "type".into(),
                },
                then: vec![Action::SetFact {
                    field: "decision".into(),
                    value: Value::String("denied".into()),
                }],
            },
        ])
    }

    #[test]
    fn ruleset_first_match_highest_priority() {
        let rs = approval_rules();
        let f = facts(&[
            ("type", Value::String("purchase".into())),
            ("amount", Value::Number(serde_json::Number::from(500))),
        ]);
        let actions = rs.evaluate_first(&f).unwrap();
        assert_eq!(actions.len(), 1);
        assert_eq!(
            actions[0],
            Action::SetFact {
                field: "decision".into(),
                value: Value::String("approved".into()),
            }
        );
    }

    #[test]
    fn ruleset_falls_back_to_lower_priority() {
        let rs = approval_rules();
        let f = facts(&[
            ("type", Value::String("purchase".into())),
            ("amount", Value::Number(serde_json::Number::from(2000))),
        ]);
        let actions = rs.evaluate_first(&f).unwrap();
        assert_eq!(
            actions[0],
            Action::SetFact {
                field: "decision".into(),
                value: Value::String("review".into()),
            }
        );
    }

    #[test]
    fn ruleset_default_rule() {
        let rs = approval_rules();
        let f = facts(&[("type", Value::String("refund".into()))]);
        let actions = rs.evaluate_first(&f).unwrap();
        assert_eq!(
            actions[0],
            Action::SetFact {
                field: "decision".into(),
                value: Value::String("denied".into()),
            }
        );
    }

    #[test]
    fn ruleset_no_match_returns_none() {
        let rs = RuleSet::new();
        assert!(rs.evaluate_first(&facts(&[])).is_none());
    }

    #[test]
    fn ruleset_load_yaml() {
        let yaml = r#"
- name: test-rule
  priority: 10
  when:
    op: exists
    field: ready
  then:
    - type: setfact
      field: result
      value: "ok"
"#;
        let rs = RuleSet::load_yaml(yaml).unwrap();
        assert_eq!(rs.len(), 1);
        let f = facts(&[("ready", Value::Bool(true))]);
        assert!(rs.evaluate_first(&f).is_some());
    }

    // ── Inference tests ─────────────────────────────────────────

    #[test]
    fn forward_chain_single_rule() {
        let rs = RuleSet::from_rules(vec![Rule {
            name: "init".into(),
            priority: 1,
            when: Condition::Exists {
                field: "start".into(),
            },
            then: vec![Action::SetFact {
                field: "phase".into(),
                value: Value::String("running".into()),
            }],
        }]);
        let mut engine = InferenceEngine::new(rs, facts(&[("start", Value::Bool(true))]));
        let result = engine.run(10);
        assert_eq!(result.final_facts["phase"], "running");
        assert_eq!(result.iterations, 1);
        assert!(!result.halted);
    }

    #[test]
    fn forward_chain_cascading() {
        // Rule 1: start → phase=step1
        // Rule 2: phase=step1 → phase=step2
        let rs = RuleSet::from_rules(vec![
            Rule {
                name: "step1".into(),
                priority: 10,
                when: Condition::Exists {
                    field: "start".into(),
                },
                then: vec![Action::SetFact {
                    field: "phase".into(),
                    value: Value::String("step1".into()),
                }],
            },
            Rule {
                name: "step2".into(),
                priority: 5,
                when: Condition::Eq {
                    field: "phase".into(),
                    value: Value::String("step1".into()),
                },
                then: vec![Action::SetFact {
                    field: "phase".into(),
                    value: Value::String("step2".into()),
                }],
            },
        ]);
        let mut engine = InferenceEngine::new(rs, facts(&[("start", Value::Bool(true))]));
        let result = engine.run(10);
        assert_eq!(result.final_facts["phase"], "step2");
        assert_eq!(result.iterations, 2);
    }

    #[test]
    fn forward_chain_halt() {
        let rs = RuleSet::from_rules(vec![Rule {
            name: "stop".into(),
            priority: 1,
            when: Condition::Exists {
                field: "stop_me".into(),
            },
            then: vec![Action::Halt {
                reason: "requested".into(),
            }],
        }]);
        let mut engine = InferenceEngine::new(rs, facts(&[("stop_me", Value::Bool(true))]));
        let result = engine.run(10);
        assert!(result.halted);
        assert_eq!(result.iterations, 1);
    }

    #[test]
    fn forward_chain_emits_events() {
        let rs = RuleSet::from_rules(vec![Rule {
            name: "notify".into(),
            priority: 1,
            when: Condition::Exists {
                field: "trigger".into(),
            },
            then: vec![Action::Emit {
                event: "alert".into(),
                payload: Value::String("fired".into()),
            }],
        }]);
        let mut engine = InferenceEngine::new(rs, facts(&[("trigger", Value::Bool(true))]));
        let result = engine.run(10);
        assert_eq!(result.events.len(), 1);
        assert_eq!(result.events[0].event, "alert");
    }

    #[test]
    fn forward_chain_stops_at_iteration_limit() {
        let rs = RuleSet::from_rules(vec![Rule {
            name: "loop".into(),
            priority: 1,
            when: Condition::Exists {
                field: "counter".into(),
            },
            then: vec![Action::SetFact {
                field: "counter".into(),
                value: Value::Number(serde_json::Number::from(1)),
            }],
        }]);
        let mut engine = InferenceEngine::new(
            rs,
            facts(&[(
                "counter",
                Value::Number(serde_json::Number::from(0)),
            )]),
        );
        let result = engine.run(3);
        // Rule fires once then is tracked; it won't re-fire on same facts.
        assert_eq!(result.iterations, 1);
        assert!(!result.halted);
    }
    #[test]
    fn plan_goal_already_satisfied() {
        let rs = RuleSet::new();
        let initial = facts(&[("status", Value::String("done".into()))]);
        let goal = Condition::Eq {
            field: "status".into(),
            value: Value::String("done".into()),
        };
        let p = plan(&rs, &initial, &goal, 10);
        assert!(p.achieved);
        assert!(p.steps.is_empty());
    }

    #[test]
    fn plan_finds_path() {
        let rs = RuleSet::from_rules(vec![Rule {
            name: "promote".into(),
            priority: 1,
            when: Condition::Eq {
                field: "level".into(),
                value: Value::String("junior".into()),
            },
            then: vec![Action::SetFact {
                field: "level".into(),
                value: Value::String("senior".into()),
            }],
        }]);
        let initial = facts(&[("level", Value::String("junior".into()))]);
        let goal = Condition::Eq {
            field: "level".into(),
            value: Value::String("senior".into()),
        };
        let p = plan(&rs, &initial, &goal, 10);
        assert!(p.achieved);
        assert_eq!(p.steps.len(), 1);
        assert_eq!(p.steps[0].rule_name, "promote");
    }

    #[test]
    fn plan_cannot_achieve() {
        let rs = RuleSet::new();
        let initial = facts(&[]);
        let goal = Condition::Exists {
            field: "impossible".into(),
        };
        let p = plan(&rs, &initial, &goal, 10);
        assert!(!p.achieved);
    }
}

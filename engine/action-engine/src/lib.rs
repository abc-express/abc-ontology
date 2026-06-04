use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use thiserror::Error;

// ── Action ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionSpec {
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub params: HashMap<String, Value>,
    #[serde(default)]
    pub timeout_ms: u64,
    #[serde(default)]
    pub retries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ActionResult {
    Success { output: Value },
    Failure { error: String },
    Timeout,
}

// ── Executor ───────────────────────────────────────────────────────

#[derive(Error, Debug, PartialEq)]
pub enum ActionError {
    #[error("action not found: {0}")]
    NotFound(String),
    #[error("timeout after {0}ms")]
    Timeout(u64),
    #[error("execution failed: {0}")]
    Failed(String),
}

/// A handler function signature: receives params and returns a result.
pub type ActionHandler = Box<dyn Fn(&HashMap<String, Value>) -> ActionResult + Send + Sync>;

/// Action executor: registers named actions and dispatches them with retry and
/// timeout semantics. In production this would call external services; here it
/// uses pluggable handlers for testability.
pub struct ActionExecutor {
    handlers: HashMap<String, ActionHandler>,
}

impl ActionExecutor {
    pub fn new() -> Self {
        Self {
            handlers: HashMap::new(),
        }
    }

    /// Register a named action handler.
    pub fn register<F>(&mut self, name: &str, handler: F)
    where
        F: Fn(&HashMap<String, Value>) -> ActionResult + Send + Sync + 'static,
    {
        self.handlers.insert(name.to_string(), Box::new(handler));
    }

    /// Execute a single action. Retries up to `spec.retries` times on failure.
    pub fn execute(&self, spec: &ActionSpec) -> ActionResult {
        let handler = match self.handlers.get(&spec.name) {
            Some(h) => h,
            None => {
                return ActionResult::Failure {
                    error: format!("action not found: {}", spec.name),
                }
            }
        };

        let mut last = ActionResult::Failure {
            error: "unreachable".into(),
        };

        for attempt in 0..=spec.retries {
            if attempt > 0 {
                // Exponential backoff would go here in a real implementation.
                std::thread::sleep(std::time::Duration::from_millis(100 * attempt as u64));
            }
            last = handler(&spec.params);

            if matches!(last, ActionResult::Success { .. }) {
                return last;
            }
        }

        last
    }

    /// Execute a sequence of actions in order. Stops on first non-success and
    /// returns the failing result.
    pub fn execute_sequence(&self, specs: &[ActionSpec]) -> Vec<ActionResult> {
        specs.iter().map(|s| self.execute(s)).collect()
    }
}

impl Default for ActionExecutor {
    fn default() -> Self {
        Self::new()
    }
}

// ── Workflow ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkflowStep {
    pub id: String,
    pub action: ActionSpec,
    #[serde(default)]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub on_failure: FailurePolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FailurePolicy {
    Abort,
    Skip,
    Retry,
}

impl Default for FailurePolicy {
    fn default() -> Self {
        FailurePolicy::Abort
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub name: String,
    pub steps: Vec<WorkflowStep>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum StepStatus {
    Pending,
    Running,
    Completed(Value),
    Failed(String),
    Skipped,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WorkflowResult {
    pub completed: usize,
    pub failed: usize,
    pub skipped: usize,
    pub step_results: HashMap<String, StepStatus>,
}

/// Topological sort of steps by dependency graph. Returns steps in execution
/// order or `None` if a cycle is detected.
pub fn topsort_steps(steps: &[WorkflowStep]) -> Option<Vec<&WorkflowStep>> {
    let mut in_degree: HashMap<&str, usize> = HashMap::new();
    let mut adjacency: HashMap<&str, Vec<&str>> = HashMap::new();
    let mut step_map: HashMap<&str, &WorkflowStep> = HashMap::new();

    for step in steps {
        step_map.insert(&step.id, step);
        in_degree.entry(&step.id).or_insert(0);
        for dep in &step.depends_on {
            adjacency.entry(dep.as_str()).or_default().push(&step.id);
            *in_degree.entry(&step.id).or_insert(0) += 1;
        }
    }

    let mut queue: VecDeque<&str> = in_degree
        .iter()
        .filter(|(_, &deg)| deg == 0)
        .map(|(&id, _)| id)
        .collect();

    let mut sorted = Vec::new();

    while let Some(id) = queue.pop_front() {
        sorted.push(*step_map.get(id)?);
        if let Some(dependents) = adjacency.get(id) {
            for &dep in dependents {
                let entry = in_degree.get_mut(dep)?;
                *entry = entry.saturating_sub(1);
                if *entry == 0 {
                    queue.push_back(dep);
                }
            }
        }
    }

    if sorted.len() == steps.len() {
        Some(sorted)
    } else {
        None // cycle
    }
}

/// Orchestrate a workflow by topologically sorting steps and executing them
/// with the given executor.
pub fn orchestrate(
    workflow: &Workflow,
    executor: &ActionExecutor,
) -> Result<WorkflowResult, ActionError> {
    let sorted = topsort_steps(&workflow.steps)
        .ok_or_else(|| ActionError::Failed("cycle detected in workflow".into()))?;

    let mut result = WorkflowResult {
        completed: 0,
        failed: 0,
        skipped: 0,
        step_results: HashMap::new(),
    };

    // Initialize all steps as Pending.
    for step in &workflow.steps {
        result
            .step_results
            .insert(step.id.clone(), StepStatus::Pending);
    }

    // Track completed step IDs so we can check if dependencies succeeded.
    let mut completed_set: HashMap<String, Value> = HashMap::new();

    for step in sorted {
        // Check dependencies.
        let deps_failed = step.depends_on.iter().any(|dep_id| {
            matches!(
                result.step_results.get(dep_id.as_str()),
                Some(StepStatus::Failed(_))
            )
        });

        if deps_failed {
            match step.on_failure {
                FailurePolicy::Skip => {
                    result
                        .step_results
                        .insert(step.id.clone(), StepStatus::Skipped);
                    result.skipped += 1;
                    continue;
                }
                FailurePolicy::Abort => {
                    result
                        .step_results
                        .insert(step.id.clone(), StepStatus::Skipped);
                    result.skipped += 1;
                    break;
                }
                FailurePolicy::Retry => {
                    // Fall through and execute anyway.
                }
            }
        }

        result
            .step_results
            .insert(step.id.clone(), StepStatus::Running);

        let action_result = executor.execute(&step.action);

        match action_result {
            ActionResult::Success { output } => {
                result
                    .step_results
                    .insert(step.id.clone(), StepStatus::Completed(output.clone()));
                completed_set.insert(step.id.clone(), output);
                result.completed += 1;
            }
            ActionResult::Failure { error } => {
                result
                    .step_results
                    .insert(step.id.clone(), StepStatus::Failed(error));
                result.failed += 1;

                if step.on_failure == FailurePolicy::Abort {
                    // Skip remaining steps.
                    for remaining in &workflow.steps {
                        if !matches!(
                            result.step_results.get(&remaining.id),
                            Some(StepStatus::Completed(_) | StepStatus::Failed(_))
                        ) {
                            result
                                .step_results
                                .insert(remaining.id.clone(), StepStatus::Skipped);
                            result.skipped += 1;
                        }
                    }
                    break;
                }
            }
            ActionResult::Timeout => {
                result.step_results.insert(
                    step.id.clone(),
                    StepStatus::Failed(format!("timeout after {}ms", step.action.timeout_ms)),
                );
                result.failed += 1;

                if step.on_failure == FailurePolicy::Abort {
                    break;
                }
            }
        }
    }

    Ok(result)
}

// ── Agent Runner ───────────────────────────────────────────────────

/// An agent observes state, selects an action, and loops until a terminal
/// condition is met.
#[derive(Debug)]
pub struct Agent {
    pub name: String,
    pub actions: Vec<ActionSpec>,
    pub max_steps: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AgentStep {
    pub step: usize,
    pub action_name: String,
    pub result: ActionResult,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AgentRun {
    pub agent_name: String,
    pub steps: Vec<AgentStep>,
    pub terminal: bool,
}

impl Agent {
    pub fn new(name: &str, actions: Vec<ActionSpec>, max_steps: usize) -> Self {
        Self {
            name: name.to_string(),
            actions,
            max_steps,
        }
    }

    /// Run the agent loop. At each step, selects the first action that hasn't
    /// succeeded yet. Stops when all actions succeed or max_steps reached.
    pub fn run(&self, executor: &ActionExecutor) -> AgentRun {
        let mut steps = Vec::new();
        let mut succeeded: HashMap<String, ()> = HashMap::new();

        for step_num in 0..self.max_steps {
            let pending = self
                .actions
                .iter()
                .find(|a| !succeeded.contains_key(&a.name));

            let action = match pending {
                Some(a) => a,
                None => {
                    // All actions succeeded.
                    return AgentRun {
                        agent_name: self.name.clone(),
                        steps,
                        terminal: true,
                    };
                }
            };

            let result = executor.execute(action);

            if matches!(result, ActionResult::Success { .. }) {
                succeeded.insert(action.name.clone(), ());
            }

            steps.push(AgentStep {
                step: step_num,
                action_name: action.name.clone(),
                result,
            });
        }

        AgentRun {
            agent_name: self.name.clone(),
            steps,
            terminal: false,
        }
    }
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn test_executor() -> ActionExecutor {
        let mut exec = ActionExecutor::new();
        exec.register("echo", |params| {
            let msg = params
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("default");
            ActionResult::Success {
                output: Value::String(msg.to_string()),
            }
        });
        exec.register("fail", |_params| ActionResult::Failure {
            error: "always fails".into(),
        });
        exec.register("sum", |params| {
            let a = params.get("a").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let b = params.get("b").and_then(|v| v.as_f64()).unwrap_or(0.0);
            ActionResult::Success {
                output: Value::Number(serde_json::Number::from_f64(a + b).unwrap()),
            }
        });
        exec
    }

    fn action(name: &str) -> ActionSpec {
        ActionSpec {
            name: name.into(),
            command: name.into(),
            params: HashMap::new(),
            timeout_ms: 5000,
            retries: 0,
        }
    }

    // ── Executor tests ──────────────────────────────────────────

    #[test]
    fn executor_dispatches_registered_handler() {
        let exec = test_executor();
        let spec = ActionSpec {
            name: "echo".into(),
            command: "echo".into(),
            params: {
                let mut m = HashMap::new();
                m.insert("message".into(), Value::String("hello".into()));
                m
            },
            timeout_ms: 1000,
            retries: 0,
        };
        let result = exec.execute(&spec);
        assert_eq!(
            result,
            ActionResult::Success {
                output: Value::String("hello".into())
            }
        );
    }

    #[test]
    fn executor_unknown_action() {
        let exec = test_executor();
        let result = exec.execute(&action("nonexistent"));
        assert!(matches!(result, ActionResult::Failure { .. }));
    }

    #[test]
    fn executor_retries_on_failure() {
        let mut exec = ActionExecutor::new();
        let calls = std::sync::atomic::AtomicU32::new(0);
        exec.register("flakey", move |_params| {
            let call = calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            if call < 2 {
                ActionResult::Failure {
                    error: "try again".into(),
                }
            } else {
                ActionResult::Success {
                    output: Value::String("ok".into()),
                }
            }
        });
        let spec = ActionSpec {
            name: "flakey".into(),
            command: "flakey".into(),
            params: HashMap::new(),
            timeout_ms: 5000,
            retries: 3,
        };
        let result = exec.execute(&spec);
        assert_eq!(
            result,
            ActionResult::Success {
                output: Value::String("ok".into())
            }
        );
    }

    #[test]
    fn execute_sequence_runs_all() {
        let exec = test_executor();
        let results = exec.execute_sequence(&[action("echo"), action("echo")]);
        assert_eq!(results.len(), 2);
        assert!(matches!(results[0], ActionResult::Success { .. }));
        assert!(matches!(results[1], ActionResult::Success { .. }));
    }

    // ── Workflow tests ──────────────────────────────────────────

    #[test]
    fn topsort_linear() {
        let steps = vec![
            WorkflowStep {
                id: "a".into(),
                action: action("echo"),
                depends_on: vec![],
                on_failure: FailurePolicy::Abort,
            },
            WorkflowStep {
                id: "b".into(),
                action: action("echo"),
                depends_on: vec!["a".into()],
                on_failure: FailurePolicy::Abort,
            },
            WorkflowStep {
                id: "c".into(),
                action: action("echo"),
                depends_on: vec!["b".into()],
                on_failure: FailurePolicy::Abort,
            },
        ];
        let sorted = topsort_steps(&steps).unwrap();
        let ids: Vec<&str> = sorted.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids, vec!["a", "b", "c"]);
    }

    #[test]
    fn topsort_diamond() {
        let steps = vec![
            WorkflowStep {
                id: "start".into(),
                action: action("echo"),
                depends_on: vec![],
                on_failure: FailurePolicy::Abort,
            },
            WorkflowStep {
                id: "left".into(),
                action: action("echo"),
                depends_on: vec!["start".into()],
                on_failure: FailurePolicy::Abort,
            },
            WorkflowStep {
                id: "right".into(),
                action: action("echo"),
                depends_on: vec!["start".into()],
                on_failure: FailurePolicy::Abort,
            },
            WorkflowStep {
                id: "end".into(),
                action: action("echo"),
                depends_on: vec!["left".into(), "right".into()],
                on_failure: FailurePolicy::Abort,
            },
        ];
        let sorted = topsort_steps(&steps).unwrap();
        let ids: Vec<&str> = sorted.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids[0], "start");
        assert_eq!(ids[3], "end");
        assert!(ids.contains(&"left"));
        assert!(ids.contains(&"right"));
    }

    #[test]
    fn topsort_detects_cycle() {
        let steps = vec![
            WorkflowStep {
                id: "a".into(),
                action: action("echo"),
                depends_on: vec!["b".into()],
                on_failure: FailurePolicy::Abort,
            },
            WorkflowStep {
                id: "b".into(),
                action: action("echo"),
                depends_on: vec!["a".into()],
                on_failure: FailurePolicy::Abort,
            },
        ];
        assert!(topsort_steps(&steps).is_none());
    }

    #[test]
    fn orchestrate_linear_workflow() {
        let exec = test_executor();
        let workflow = Workflow {
            name: "test-linear".into(),
            steps: vec![
                WorkflowStep {
                    id: "s1".into(),
                    action: action("echo"),
                    depends_on: vec![],
                    on_failure: FailurePolicy::Abort,
                },
                WorkflowStep {
                    id: "s2".into(),
                    action: action("echo"),
                    depends_on: vec!["s1".into()],
                    on_failure: FailurePolicy::Abort,
                },
            ],
        };
        let result = orchestrate(&workflow, &exec).unwrap();
        assert_eq!(result.completed, 2);
        assert_eq!(result.failed, 0);
    }

    #[test]
    fn orchestrate_aborts_on_failure() {
        let exec = test_executor();
        let workflow = Workflow {
            name: "test-abort".into(),
            steps: vec![
                WorkflowStep {
                    id: "bad".into(),
                    action: action("fail"),
                    depends_on: vec![],
                    on_failure: FailurePolicy::Abort,
                },
                WorkflowStep {
                    id: "never_runs".into(),
                    action: action("echo"),
                    depends_on: vec!["bad".into()],
                    on_failure: FailurePolicy::Abort,
                },
            ],
        };
        let result = orchestrate(&workflow, &exec).unwrap();
        assert_eq!(result.failed, 1);
        assert_eq!(result.completed, 0);
        assert!(matches!(
            result.step_results.get("never_runs"),
            Some(StepStatus::Skipped)
        ));
    }

    #[test]
    fn orchestrate_skip_on_dep_failure() {
        let exec = test_executor();
        let workflow = Workflow {
            name: "test-skip".into(),
            steps: vec![
                WorkflowStep {
                    id: "bad".into(),
                    action: action("fail"),
                    depends_on: vec![],
                    on_failure: FailurePolicy::Abort,
                },
                WorkflowStep {
                    id: "skip_me".into(),
                    action: action("echo"),
                    depends_on: vec!["bad".into()],
                    on_failure: FailurePolicy::Skip,
                },
            ],
        };
        let result = orchestrate(&workflow, &exec).unwrap();
        assert_eq!(result.skipped, 1);
        assert!(matches!(
            result.step_results.get("skip_me"),
            Some(StepStatus::Skipped)
        ));
    }

    // ── Agent tests ─────────────────────────────────────────────

    #[test]
    fn agent_stops_at_max_steps() {
        // Register a handler that always fails so the agent keeps retrying.
        let mut fail_exec = ActionExecutor::new();
        fail_exec.register("always_fail", |_params| ActionResult::Failure {
            error: "nope".into(),
        });

        let agent = Agent::new("doomed", vec![action("always_fail")], 3);
        let run = agent.run(&fail_exec);
        assert!(!run.terminal);
        assert_eq!(run.steps.len(), 3);
    }

    #[test]
    fn agent_runs_all_actions() {
        let mut exec = ActionExecutor::new();
        exec.register("echo_a", |params| {
            let msg = params
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("a");
            ActionResult::Success {
                output: Value::String(msg.to_string()),
            }
        });
        exec.register("echo_b", |params| {
            let msg = params
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("b");
            ActionResult::Success {
                output: Value::String(msg.to_string()),
            }
        });
        let agent = Agent::new(
            "test-agent",
            vec![action("echo_a"), action("echo_b")],
            5,
        );
        let run = agent.run(&exec);
        assert!(run.terminal);
        assert_eq!(run.steps.len(), 2);
    }
}

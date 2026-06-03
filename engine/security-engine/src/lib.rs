pub use daemon_policy::{Effect, PolicyDecision, PolicyEngine};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reexports_policy() {
        let e = PolicyEngine::new();
        let d = e.evaluate("read", "entity");
        assert_eq!(d.effect, Effect::Deny);
    }
}

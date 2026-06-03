pub fn gateway_health_url(base: &str) -> String {
    format!("{}/health", base.trim_end_matches('/'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_health_url() {
        assert_eq!(
            gateway_health_url("http://localhost:3000/"),
            "http://localhost:3000/health"
        );
    }
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticDocument {
    pub entity_id: String,
    pub text: String,
}

/// Lowercase whitespace tokenizer shared by indexing and querying.
pub fn tokenize(doc: &SemanticDocument) -> Vec<String> {
    tokenize_text(&doc.text)
}

/// Tokenize raw text into lowercase terms.
pub fn tokenize_text(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_lowercase())
        .collect()
}

/// A scored search hit.
#[derive(Debug, Clone, PartialEq)]
pub struct Hit {
    pub entity_id: String,
    pub score: f32,
}

/// A term-frequency / inverse-document-frequency semantic index. Documents are
/// indexed by entity id; querying scores documents by summed TF-IDF over the
/// query terms.
#[derive(Debug, Default)]
pub struct SemanticIndex {
    /// entity_id -> term -> count
    docs: HashMap<String, HashMap<String, usize>>,
    /// term -> number of documents containing it
    doc_freq: HashMap<String, usize>,
}

impl SemanticIndex {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn len(&self) -> usize {
        self.docs.len()
    }

    pub fn is_empty(&self) -> bool {
        self.docs.is_empty()
    }

    /// Index (or re-index) a document. Re-indexing the same entity id replaces
    /// the previous term counts and keeps document-frequency consistent.
    pub fn index(&mut self, doc: &SemanticDocument) {
        if let Some(previous) = self.docs.remove(&doc.entity_id) {
            for term in previous.keys() {
                if let Some(df) = self.doc_freq.get_mut(term) {
                    *df = df.saturating_sub(1);
                }
            }
        }
        let mut counts: HashMap<String, usize> = HashMap::new();
        for term in tokenize(doc) {
            *counts.entry(term).or_insert(0) += 1;
        }
        for term in counts.keys() {
            *self.doc_freq.entry(term.clone()).or_insert(0) += 1;
        }
        self.docs.insert(doc.entity_id.clone(), counts);
    }

    fn idf(&self, term: &str) -> f32 {
        let n = self.docs.len() as f32;
        let df = *self.doc_freq.get(term).unwrap_or(&0) as f32;
        if df == 0.0 {
            return 0.0;
        }
        // Smoothed idf: ln(1 + N/df).
        (1.0 + n / df).ln()
    }

    /// Score documents for a free-text query, returning up to `k` hits ordered
    /// by descending TF-IDF score. Documents with zero score are excluded.
    pub fn search(&self, query: &str, k: usize) -> Vec<Hit> {
        let terms = tokenize_text(query);
        let mut hits: Vec<Hit> = self
            .docs
            .iter()
            .map(|(id, counts)| {
                let score: f32 = terms
                    .iter()
                    .map(|t| (*counts.get(t).unwrap_or(&0) as f32) * self.idf(t))
                    .sum();
                Hit {
                    entity_id: id.clone(),
                    score,
                }
            })
            .filter(|h| h.score > 0.0)
            .collect();
        hits.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.entity_id.cmp(&b.entity_id))
        });
        hits.truncate(k);
        hits
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(id: &str, text: &str) -> SemanticDocument {
        SemanticDocument {
            entity_id: id.into(),
            text: text.into(),
        }
    }

    #[test]
    fn tokenizes() {
        let d = doc("e1", "Hello World");
        assert_eq!(tokenize(&d), vec!["hello", "world"]);
    }

    #[test]
    fn tokenizer_splits_punctuation() {
        assert_eq!(tokenize_text("alpha, beta-gamma!"), vec!["alpha", "beta", "gamma"]);
    }

    #[test]
    fn search_returns_relevant_doc() {
        let mut idx = SemanticIndex::new();
        idx.index(&doc("inv", "invoice payment overdue"));
        idx.index(&doc("ord", "purchase order shipped"));
        let hits = idx.search("invoice", 5);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].entity_id, "inv");
    }

    #[test]
    fn rarer_terms_rank_higher() {
        let mut idx = SemanticIndex::new();
        idx.index(&doc("a", "common common rare"));
        idx.index(&doc("b", "common common common"));
        let hits = idx.search("rare common", 5);
        assert_eq!(hits[0].entity_id, "a");
    }

    #[test]
    fn reindex_replaces_document() {
        let mut idx = SemanticIndex::new();
        idx.index(&doc("a", "alpha"));
        idx.index(&doc("a", "beta"));
        assert_eq!(idx.len(), 1);
        assert!(idx.search("alpha", 5).is_empty());
        assert_eq!(idx.search("beta", 5).len(), 1);
    }

    #[test]
    fn unknown_term_yields_no_hits() {
        let mut idx = SemanticIndex::new();
        idx.index(&doc("a", "alpha"));
        assert!(idx.search("missing", 5).is_empty());
    }
}

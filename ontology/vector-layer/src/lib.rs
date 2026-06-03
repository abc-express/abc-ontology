use std::collections::HashMap;

/// Cosine similarity between two equal-length vectors. Returns 0.0 when either
/// vector has zero magnitude (undefined direction).
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let na = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let nb = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if na == 0.0 || nb == 0.0 {
        return 0.0;
    }
    dot / (na * nb)
}

/// A scored neighbour returned from a similarity search.
#[derive(Debug, Clone, PartialEq)]
pub struct Neighbour {
    pub id: String,
    pub score: f32,
}

/// Errors surfaced by the vector store.
#[derive(Debug, PartialEq, Eq)]
pub enum VectorError {
    /// The supplied vector did not match the store's fixed dimension.
    DimensionMismatch { expected: usize, got: usize },
}

impl std::fmt::Display for VectorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VectorError::DimensionMismatch { expected, got } => {
                write!(f, "dimension mismatch: expected {expected}, got {got}")
            }
        }
    }
}

impl std::error::Error for VectorError {}

/// A fixed-dimension in-memory vector store with cosine nearest-neighbour
/// search. Upserts replace existing vectors for the same id.
#[derive(Debug, Default)]
pub struct VectorStore {
    dim: usize,
    vectors: HashMap<String, Vec<f32>>,
}

impl VectorStore {
    pub fn new(dim: usize) -> Self {
        Self {
            dim,
            vectors: HashMap::new(),
        }
    }

    pub fn dim(&self) -> usize {
        self.dim
    }

    pub fn len(&self) -> usize {
        self.vectors.len()
    }

    pub fn is_empty(&self) -> bool {
        self.vectors.is_empty()
    }

    /// Insert or replace a vector. Rejects vectors of the wrong dimension.
    pub fn upsert(&mut self, id: impl Into<String>, vector: Vec<f32>) -> Result<(), VectorError> {
        if vector.len() != self.dim {
            return Err(VectorError::DimensionMismatch {
                expected: self.dim,
                got: vector.len(),
            });
        }
        self.vectors.insert(id.into(), vector);
        Ok(())
    }

    /// Return up to `k` nearest neighbours ranked by descending cosine score.
    pub fn search(&self, query: &[f32], k: usize) -> Result<Vec<Neighbour>, VectorError> {
        if query.len() != self.dim {
            return Err(VectorError::DimensionMismatch {
                expected: self.dim,
                got: query.len(),
            });
        }
        let mut scored: Vec<Neighbour> = self
            .vectors
            .iter()
            .map(|(id, v)| Neighbour {
                id: id.clone(),
                score: cosine_similarity(query, v),
            })
            .collect();
        scored.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.id.cmp(&b.id))
        });
        scored.truncate(k);
        Ok(scored)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_vectors() {
        let v = [1.0f32, 0.0];
        assert!((cosine_similarity(&v, &v) - 1.0).abs() < 1e-5);
    }

    #[test]
    fn zero_vector_has_zero_similarity() {
        assert_eq!(cosine_similarity(&[0.0, 0.0], &[1.0, 1.0]), 0.0);
    }

    #[test]
    fn upsert_rejects_wrong_dimension() {
        let mut store = VectorStore::new(3);
        let err = store.upsert("a", vec![1.0, 0.0]).unwrap_err();
        assert_eq!(
            err,
            VectorError::DimensionMismatch {
                expected: 3,
                got: 2
            }
        );
    }

    #[test]
    fn search_ranks_by_similarity() {
        let mut store = VectorStore::new(2);
        store.upsert("near", vec![1.0, 0.1]).unwrap();
        store.upsert("far", vec![0.0, 1.0]).unwrap();
        let hits = store.search(&[1.0, 0.0], 2).unwrap();
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].id, "near");
        assert!(hits[0].score > hits[1].score);
    }

    #[test]
    fn search_respects_k() {
        let mut store = VectorStore::new(2);
        store.upsert("a", vec![1.0, 0.0]).unwrap();
        store.upsert("b", vec![0.9, 0.1]).unwrap();
        store.upsert("c", vec![0.8, 0.2]).unwrap();
        assert_eq!(store.search(&[1.0, 0.0], 2).unwrap().len(), 2);
    }

    #[test]
    fn upsert_replaces_existing() {
        let mut store = VectorStore::new(2);
        store.upsert("a", vec![1.0, 0.0]).unwrap();
        store.upsert("a", vec![0.0, 1.0]).unwrap();
        assert_eq!(store.len(), 1);
        let hits = store.search(&[0.0, 1.0], 1).unwrap();
        assert_eq!(hits[0].id, "a");
        assert!((hits[0].score - 1.0).abs() < 1e-5);
    }
}

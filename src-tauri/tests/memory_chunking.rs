use solaria_desktop_lib::embeddings;

#[test]
fn test_chunk_text_short_returns_unchanged() {
    let chunks = embeddings::chunk_text("hello world", 1000, 0);
    assert_eq!(chunks.len(), 1);
    assert_eq!(chunks[0], "hello world");
}

#[test]
fn test_chunk_text_empty_returns_empty() {
    let chunks = embeddings::chunk_text("   \n  ", 100, 0);
    assert!(chunks.is_empty());
}

#[test]
fn test_chunk_text_long_splits_at_boundary() {
    let mut text = String::new();
    for _ in 0..50 {
        text.push_str("This is a sentence. ");
    }
    let chunks = embeddings::chunk_text(&text, 200, 0);
    assert!(chunks.len() > 1, "should split long text");
    for c in &chunks {
        assert!(c.len() <= 250, "chunk too large: {}", c.len());
    }
}

#[test]
fn test_chunk_text_preserves_content() {
    let original = "alpha. beta. gamma. delta.";
    let chunks = embeddings::chunk_text(original, 1000, 0);
    let joined: String = chunks.join(" ");
    assert!(joined.contains("alpha"));
    assert!(joined.contains("beta"));
    assert!(joined.contains("gamma"));
    assert!(joined.contains("delta"));
}

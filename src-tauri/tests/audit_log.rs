use solaria_desktop_lib::audit;
use std::sync::Mutex;

static AUDIT_LOCK: Mutex<()> = Mutex::new(());

#[test]
fn test_audit_log_write_and_read() {
    let _lock = AUDIT_LOCK.lock().unwrap();

    audit::clear_log().ok();
    assert_eq!(audit::read_log(10).total_lines, 0, "should start clean");

    audit::log_execution("shell", "echo test", true, None, Some("/tmp"));
    audit::log_execution("read_file", "/tmp/test.txt", true, None, Some("/tmp"));
    audit::log_execution("write_file", "/tmp/test.txt", false, Some("Permission denied"), Some("/tmp"));

    let result = audit::read_log(10);
    assert_eq!(result.total_lines, 3, "deberían haber 3 entradas");

    let entries = result.entries;
    assert_eq!(entries.len(), 3);

    assert_eq!(entries[0].tool, "shell");
    assert_eq!(entries[0].args, "echo test");
    assert!(entries[0].success);
    assert_eq!(entries[0].error, None);
    assert_eq!(entries[0].working_dir.as_deref(), Some("/tmp"));

    assert_eq!(entries[1].tool, "read_file");
    assert!(entries[1].success);

    assert_eq!(entries[2].tool, "write_file");
    assert!(!entries[2].success);
    assert_eq!(entries[2].error.as_deref(), Some("Permission denied"));

    audit::clear_log().ok();
}

#[test]
fn test_audit_log_clear() {
    let _lock = AUDIT_LOCK.lock().unwrap();

    audit::clear_log().ok();
    assert_eq!(audit::read_log(10).total_lines, 0);

    audit::log_execution("test_tool", "test_args", true, None, None);

    let before = audit::read_log(10);
    assert_eq!(before.total_lines, 1);

    audit::clear_log().ok();

    let after = audit::read_log(10);
    assert_eq!(after.total_lines, 0);
    assert!(after.entries.is_empty());
}

#[test]
fn test_audit_log_empty() {
    let _lock = AUDIT_LOCK.lock().unwrap();

    audit::clear_log().ok();
    let result = audit::read_log(10);
    assert_eq!(result.total_lines, 0);
    assert!(result.entries.is_empty());
}

#[test]
fn test_audit_log_max_lines_filter() {
    let _lock = AUDIT_LOCK.lock().unwrap();

    audit::clear_log().ok();

    for i in 0..10 {
        audit::log_execution(
            &format!("tool_{}", i),
            &format!("args_{}", i),
            true, None, None,
        );
    }

    let all = audit::read_log(100);
    assert_eq!(all.total_lines, 10);

    let limited = audit::read_log(3);
    assert_eq!(limited.entries.len(), 3);
    assert_eq!(limited.total_lines, 10);

    audit::clear_log().ok();
}

#[test]
fn test_audit_log_tool_name_and_args() {
    let _lock = AUDIT_LOCK.lock().unwrap();

    audit::clear_log().ok();

    audit::log_execution("shell", r#"{"command":"ls -la"}"#, true, None, None);

    let result = audit::read_log(10);
    assert_eq!(result.entries.len(), 1);
    assert_eq!(result.entries[0].tool, "shell");
    assert!(result.entries[0].args.contains("ls -la"));

    audit::clear_log().ok();
}

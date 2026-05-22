use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct SandboxResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

pub fn check_docker_available() -> bool {
    Command::new("docker")
        .arg("info")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub fn create_container(image: &str, mount_dir: &str) -> Result<String, String> {
    let mut cmd = Command::new("docker");
    cmd.args([
        "create",
        "--rm",
        "-i",
        "--network", "none",
        "--security-opt", "no-new-privileges",
        "--read-only",
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
        "--tmpfs", "/workspace:rw,noexec,nosuid,size=256m",
    ]);

    if !mount_dir.is_empty() {
        let mount_arg = format!("type=bind,source={},target=/workspace", mount_dir);
        cmd.args(["--mount", &mount_arg]);
    }

    let output = cmd
        .arg(image)
        .arg("sleep")
        .arg("infinity")
        .output()
        .map_err(|e| format!("Error al crear contenedor Docker: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Error creando contenedor: {}", stderr));
    }

    let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if container_id.is_empty() {
        return Err("No se obtuvo ID de contenedor".into());
    }

    // Start the container
    let start = Command::new("docker")
        .args(["start", &container_id])
        .output()
        .map_err(|e| format!("Error al iniciar contenedor: {}", e))?;

    if !start.status.success() {
        let stderr = String::from_utf8_lossy(&start.stderr);
        let _ = Command::new("docker").args(["rm", "-f", &container_id]).output();
        return Err(format!("Error iniciando contenedor: {}", stderr));
    }

    Ok(container_id)
}

pub fn exec_command(container_id: &str, command: &str) -> SandboxResult {
    let output = Command::new("docker")
        .args(["exec", "-i", container_id, "sh", "-c", command])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            SandboxResult {
                success: out.status.success(),
                output: if stdout.is_empty() { stderr.clone() } else { stdout },
                error: if out.status.success() { None } else { Some(stderr) },
            }
        }
        Err(e) => SandboxResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error en docker exec: {}", e)),
        },
    }
}

pub fn read_file(container_id: &str, path: &str) -> SandboxResult {
    let output = Command::new("docker")
        .args(["exec", "-i", container_id, "cat", path])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            SandboxResult {
                success: out.status.success(),
                output: stdout,
                error: if out.status.success() { None } else { Some(stderr) },
            }
        }
        Err(e) => SandboxResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error leyendo archivo en sandbox: {}", e)),
        },
    }
}

pub fn write_file(container_id: &str, path: &str, content: &str) -> SandboxResult {
    use std::process::Stdio;
    let mut child = match Command::new("docker")
        .args(["exec", "-i", container_id, "sh", "-c", &format!("mkdir -p $(dirname '{}') && cat > '{}'", path, path)])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => return SandboxResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error spawn: {}", e)),
        },
    };

    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let _ = stdin.write_all(content.as_bytes());
    }

    let output = match child.wait_with_output() {
        Ok(o) => o,
        Err(e) => return SandboxResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error wait: {}", e)),
        },
    };

    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    SandboxResult {
        success: output.status.success(),
        output: format!("Archivo '{}' escrito en sandbox ({} bytes)", path, content.len()),
        error: if output.status.success() { None } else { Some(stderr) },
    }
}

pub fn remove_container(container_id: &str) -> SandboxResult {
    let output = Command::new("docker")
        .args(["rm", "-f", container_id])
        .output();

    match output {
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            SandboxResult {
                success: out.status.success(),
                output: String::from_utf8_lossy(&out.stdout).to_string(),
                error: if out.status.success() { None } else { Some(stderr) },
            }
        }
        Err(e) => SandboxResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error eliminando contenedor: {}", e)),
        },
    }
}

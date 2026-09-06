// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(|s| s.as_str()) {
        Some("ask") => solaria_desktop_lib::cli::ask(&args),
        Some("agent") => solaria_desktop_lib::cli::agent(&args),
        Some("set-key") => solaria_desktop_lib::cli::set_key(&args),
        Some("serve") => solaria_desktop_lib::cli::serve(),
        Some("status") => solaria_desktop_lib::cli::status(),
        Some("stop") => solaria_desktop_lib::cli::stop(),
        Some("version") | Some("--version") | Some("-V") => {
            println!("solaria {}", env!("CARGO_PKG_VERSION"));
        }
        Some("update") => solaria_desktop_lib::cli::update(&args),
        Some("uninstall") => solaria_desktop_lib::cli::uninstall(&args),
        Some("--gui") => solaria_desktop_lib::run(),
        Some("-h") | Some("--help") => solaria_desktop_lib::cli::print_help(),
        None => {
            // GUI mode: fork to background, free the terminal
            if let Ok(self_path) = std::env::current_exe() {
                let mut cmd = std::process::Command::new(&self_path);
                cmd.arg("--gui")
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .stdin(std::process::Stdio::null());
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    cmd.creation_flags(0x08000000 | 0x00000008);
                }
                let _ = cmd.spawn();
            } else {
                solaria_desktop_lib::run();
            }
        }
        _ => {
            eprintln!("solaria: unknown command '{}'", args[1]);
            eprintln!("Run 'solaria --help' for usage.");
            std::process::exit(1);
        }
    }
}

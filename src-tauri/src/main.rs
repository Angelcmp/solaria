// Solaria es una app GUI. Lanzarla desde la terminal abre la ventana
// (y libera la terminal). No hay interfaz de terminal: toda la
// interacción vive en la ventana de la aplicación.

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && !args[1..].iter().all(|a| a == "--gui") {
        eprintln!("solaria: esta versión solo funciona como app gráfica; abriendo la ventana…");
    }
    if args.iter().any(|a| a == "--gui") {
        solaria_desktop_lib::run();
        return;
    }
    // Sin --gui (terminal, lanzador, .app): fork en fondo y liberar la terminal.
    match std::env::current_exe() {
        Ok(self_path) => {
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
            match cmd.spawn() {
                Ok(_) => {}
                Err(_) => solaria_desktop_lib::run(),
            }
        }
        Err(_) => solaria_desktop_lib::run(),
    }
}

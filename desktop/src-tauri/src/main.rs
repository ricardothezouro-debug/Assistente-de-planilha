use std::env;
use std::net::{SocketAddr, TcpStream};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager, RunEvent, WindowEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct ApiSidecar(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ApiSidecar(Mutex::new(None)))
        .setup(|app| {
            if env::var("FINANCEIRO_SKIP_SIDECAR").as_deref() == Ok("1") {
                return Ok(());
            }

            if is_api_running() {
                println!("[financeiro-api] API local ja esta rodando; sidecar nao foi iniciado.");
                return Ok(());
            }

            let sidecar_command = app.shell().sidecar("financeiro-api")?;
            let (mut rx, child) = sidecar_command.spawn()?;

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[financeiro-api] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[financeiro-api] {}", String::from_utf8_lossy(&line));
                        }
                        _ => {}
                    }
                }
            });

            *app.state::<ApiSidecar>().0.lock().expect("api sidecar lock") = Some(child);
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                stop_api_sidecar(&window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
                stop_api_sidecar(app_handle);
            }
        });
}

fn is_api_running() -> bool {
    let address: SocketAddr = "127.0.0.1:8766"
        .parse()
        .expect("valid financeiro api address");
    TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok()
}

fn stop_api_sidecar(app_handle: &AppHandle) {
    if let Some(child) = app_handle
        .state::<ApiSidecar>()
        .0
        .lock()
        .expect("api sidecar lock")
        .take()
    {
        let _ = child.kill();
    }
}

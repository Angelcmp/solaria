use serde::Serialize;

const SERVICE_NAME: &str = "solaria-desktop";

#[derive(Serialize)]
pub struct KeyResult {
    pub success: bool,
    pub error: Option<String>,
}

pub fn store_key(provider: &str, key: &str) -> KeyResult {
    let entry = keyring::Entry::new(SERVICE_NAME, provider);
    match entry {
        Ok(e) => match e.set_password(key) {
            Ok(_) => KeyResult { success: true, error: None },
            Err(err) => KeyResult { success: false, error: Some(err.to_string()) },
        },
        Err(err) => KeyResult { success: false, error: Some(err.to_string()) },
    }
}

pub fn get_key(provider: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(SERVICE_NAME, provider).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

pub fn delete_key(provider: &str) -> KeyResult {
    match keyring::Entry::new(SERVICE_NAME, provider) {
        Ok(entry) => match entry.delete_credential() {
            Ok(_) => KeyResult { success: true, error: None },
            Err(err) => KeyResult { success: false, error: Some(err.to_string()) },
        },
        Err(err) => KeyResult { success: false, error: Some(err.to_string()) },
    }
}

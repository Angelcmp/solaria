use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter};

// ── Hardware info ────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HardwareInfo {
    pub cpu: CpuInfo,
    pub ram: RamInfo,
    pub gpus: Vec<GpuInfo>,
    pub disks: Vec<DiskInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CpuInfo {
    pub name: String,
    pub cores: usize,
    pub threads: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RamInfo {
    pub total_gb: f32,
    pub available_gb: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub name: String,
    pub vram_gb: f32,
    pub vendor: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    pub mount_point: String,
    pub total_gb: f32,
    pub available_gb: f32,
}

pub fn scan_hardware() -> HardwareInfo {
    use sysinfo::System;
    let sys = System::new_all();

    // CPU
    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .unwrap_or_else(|| "Unknown CPU".into());
    let physical_cores = sys.physical_core_count().unwrap_or(1);
    let threads = sys.cpus().len();

    // RAM
    let total_ram_gb = sys.total_memory() as f32 / (1024.0 * 1024.0);
    let available_ram_gb = sys.available_memory() as f32 / (1024.0 * 1024.0);

    // GPUs
    let gpus = detect_gpus();

    // Disks
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let disk_list: Vec<DiskInfo> = disks
        .iter()
        .filter(|d| d.total_space() > 0)
        .map(|d| DiskInfo {
            mount_point: d.mount_point().to_string_lossy().to_string(),
            total_gb: d.total_space() as f32 / (1024.0 * 1024.0 * 1024.0),
            available_gb: d.available_space() as f32 / (1024.0 * 1024.0 * 1024.0),
        })
        .collect();

    HardwareInfo {
        cpu: CpuInfo { name: cpu_name, cores: physical_cores, threads },
        ram: RamInfo { total_gb: total_ram_gb, available_gb: available_ram_gb },
        gpus,
        disks: disk_list,
    }
}

fn detect_gpus() -> Vec<GpuInfo> {
    let mut gpus = Vec::new();

    // Try nvidia-smi
    if let Ok(output) = std::process::Command::new("nvidia-smi")
        .args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines().filter(|l| !l.trim().is_empty()) {
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 2 {
                gpus.push(GpuInfo {
                    name: parts[0].trim().to_string(),
                    vram_gb: parts[1].trim().parse::<f32>().unwrap_or(0.0) / 1024.0,
                    vendor: "NVIDIA".into(),
                });
            }
        }
    }

    // Try rocm-smi for AMD
    if gpus.is_empty() {
        if let Ok(output) = std::process::Command::new("rocm-smi")
            .args(["--showproductname", "--showmeminfo", "vram", "--csv"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().skip(1).filter(|l| !l.trim().is_empty()) {
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 2 {
                    let vram_mb = parts[1].trim().parse::<f32>().unwrap_or(0.0);
                    gpus.push(GpuInfo {
                        name: parts[0].trim().to_string(),
                        vram_gb: vram_mb / 1024.0,
                        vendor: "AMD".into(),
                    });
                }
            }
        }
    }

    // Fallback: check /sys/class/drm for GPU info
    if gpus.is_empty() {
        if let Ok(entries) = std::fs::read_dir("/sys/class/drm") {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("card") {
                    if let Ok(vendor_path) = entry.path().join("device/vendor").canonicalize() {
                        if let Ok(content) = std::fs::read_to_string(&vendor_path) {
                            let _vendor_id = content.trim().to_string();
                        }
                    }
                }
            }
        }
        // Generic detection via lspci
        if let Ok(output) = std::process::Command::new("sh")
            .arg("-c")
            .arg("lspci 2>/dev/null | grep -iE 'vga|3d|display' | head -3")
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().filter(|l| !l.trim().is_empty()) {
                let name = if let Some(idx) = line.find(": ") {
                    line[idx + 2..].to_string()
                } else {
                    line.to_string()
                };
                let vendor = if name.to_lowercase().contains("nvidia") {
                    "NVIDIA"
                } else if name.to_lowercase().contains("amd") || name.to_lowercase().contains("radeon") {
                    "AMD"
                } else if name.to_lowercase().contains("intel") {
                    "Intel"
                } else {
                    "Unknown"
                };
                gpus.push(GpuInfo {
                    name: name.trim().to_string(),
                    vram_gb: 0.0, // cannot detect via lspci
                    vendor: vendor.into(),
                });
            }
        }
    }

    gpus
}

// ── Model catalog ─────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ModelEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub description_es: String,
    pub category: String,
    pub tags: Vec<String>,
    pub size_gb: f32,
    pub vram_required_gb: f32,
    pub context_window: u32,
    pub quantization: String,
    pub hf_repo: String,
    pub hf_file: String,
    pub license: String,
    pub languages: Vec<String>,
    pub benchmark_mmlu: Option<f32>,
    pub benchmark_humaneval: Option<f32>,
    pub benchmark_gsm8k: Option<f32>,
}

pub fn get_catalog() -> Vec<ModelEntry> {
    vec![
        // ── 1-3B class (runs on CPU / integrated GPU) ──
        ModelEntry {
            id: "llama-3.2-3b-q4".into(),
            name: "Llama 3.2 3B Instruct".into(),
            description: "Fast, multilingual, great for everyday tasks. Fits on any machine.".into(),
            description_es: "Rápido, multilingüe, ideal para tareas diarias. Corre en cualquier máquina.".into(),
            category: "chat".into(),
            tags: vec!["chat".into(), "multilingual".into(), "lightweight".into()],
            size_gb: 2.0,
            vram_required_gb: 3.0,
            context_window: 131072,
            quantization: "Q4_K_M".into(),
            hf_repo: "bartowski/Llama-3.2-3B-Instruct-GGUF".into(),
            hf_file: "Llama-3.2-3B-Instruct-Q4_K_M.gguf".into(),
            license: "Llama 3.2 Community".into(),
            languages: vec!["en".into(), "es".into(), "fr".into(), "de".into(), "pt".into(), "it".into(), "hi".into(), "th".into()],
            benchmark_mmlu: Some(63.4),
            benchmark_humaneval: Some(62.8),
            benchmark_gsm8k: Some(77.7),
        },
        ModelEntry {
            id: "phi-3.5-mini-q4".into(),
            name: "Phi-3.5 Mini 3.8B".into(),
            description: "Microsoft's compact powerhouse. Excellent reasoning and coding for its size.".into(),
            description_es: "Potencia compacta de Microsoft. Excelente razonamiento y código para su tamaño.".into(),
            category: "chat".into(),
            tags: vec!["chat".into(), "code".into(), "reasoning".into(), "lightweight".into()],
            size_gb: 2.4,
            vram_required_gb: 3.5,
            context_window: 131072,
            quantization: "Q4_K_M".into(),
            hf_repo: "bartowski/Phi-3.5-mini-instruct-GGUF".into(),
            hf_file: "Phi-3.5-mini-instruct-Q4_K_M.gguf".into(),
            license: "MIT".into(),
            languages: vec!["en".into()],
            benchmark_mmlu: Some(69.0),
            benchmark_humaneval: Some(72.6),
            benchmark_gsm8k: Some(86.0),
        },
        ModelEntry {
            id: "gemma-3-4b-q4".into(),
            name: "Gemma 3 4B Instruct".into(),
            description: "Google's latest lightweight model. Great multilingual and vision support.".into(),
            description_es: "Último modelo ligero de Google. Excelente soporte multilingüe y visión.".into(),
            category: "chat".into(),
            tags: vec!["chat".into(), "multilingual".into(), "lightweight".into()],
            size_gb: 2.5,
            vram_required_gb: 3.5,
            context_window: 32768,
            quantization: "Q4_K_M".into(),
            hf_repo: "bartowski/gemma-3-4b-it-GGUF".into(),
            hf_file: "gemma-3-4b-it-Q4_K_M.gguf".into(),
            license: "Gemma".into(),
            languages: vec!["en".into(), "es".into(), "fr".into(), "de".into(), "ja".into(), "ko".into(), "zh".into()],
            benchmark_mmlu: Some(64.0),
            benchmark_humaneval: Some(58.0),
            benchmark_gsm8k: Some(72.0),
        },

        // ── 7-9B class (sweet spot for 6-12GB VRAM) ──
        ModelEntry {
            id: "mistral-7b-v0.3-q4".into(),
            name: "Mistral 7B Instruct v0.3".into(),
            description: "Classic open-weight model. Strong reasoning, solid all-rounder.".into(),
            description_es: "Clásico modelo open-weight. Fuerte razonamiento, sólido en todo.".into(),
            category: "chat".into(),
            tags: vec!["chat".into(), "reasoning".into(), "code".into()],
            size_gb: 4.4,
            vram_required_gb: 6.0,
            context_window: 32768,
            quantization: "Q4_K_M".into(),
            hf_repo: "MaziyarPanahi/Mistral-7B-Instruct-v0.3-GGUF".into(),
            hf_file: "Mistral-7B-Instruct-v0.3.Q4_K_M.gguf".into(),
            license: "Apache 2.0".into(),
            languages: vec!["en".into(), "es".into(), "fr".into(), "de".into(), "it".into()],
            benchmark_mmlu: Some(62.5),
            benchmark_humaneval: Some(45.1),
            benchmark_gsm8k: Some(52.2),
        },
        ModelEntry {
            id: "qwen2.5-7b-q4".into(),
            name: "Qwen 2.5 7B Instruct".into(),
            description: "Alibaba's multilingual champion. Best-in-class for coding and math at this size.".into(),
            description_es: "Campeón multilingüe de Alibaba. El mejor para código y matemáticas en este tamaño.".into(),
            category: "chat".into(),
            tags: vec!["chat".into(), "code".into(), "math".into(), "multilingual".into(), "recommended".into()],
            size_gb: 4.7,
            vram_required_gb: 6.5,
            context_window: 131072,
            quantization: "Q4_K_M".into(),
            hf_repo: "bartowski/Qwen2.5-7B-Instruct-GGUF".into(),
            hf_file: "Qwen2.5-7B-Instruct-Q4_K_M.gguf".into(),
            license: "Apache 2.0".into(),
            languages: vec!["en".into(), "zh".into(), "es".into(), "fr".into(), "de".into(), "ja".into(), "ko".into(), "ar".into()],
            benchmark_mmlu: Some(74.6),
            benchmark_humaneval: Some(84.8),
            benchmark_gsm8k: Some(91.6),
        },
        ModelEntry {
            id: "llama-3.1-8b-q4".into(),
            name: "Llama 3.1 8B Instruct".into(),
            description: "Meta's flagship 8B. Excellent multilingual, 128K context, proven reliability.".into(),
            description_es: "Modelo insignia 8B de Meta. Excelente multilingüe, 128K contexto, fiabilidad probada.".into(),
            category: "chat".into(),
            tags: vec!["chat".into(), "multilingual".into(), "reasoning".into(), "recommended".into()],
            size_gb: 4.9,
            vram_required_gb: 7.0,
            context_window: 131072,
            quantization: "Q4_K_M".into(),
            hf_repo: "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF".into(),
            hf_file: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf".into(),
            license: "Llama 3.1 Community".into(),
            languages: vec!["en".into(), "es".into(), "fr".into(), "de".into(), "pt".into(), "it".into(), "hi".into(), "th".into()],
            benchmark_mmlu: Some(73.0),
            benchmark_humaneval: Some(72.6),
            benchmark_gsm8k: Some(84.5),
        },
        ModelEntry {
            id: "gemma-2-9b-q4".into(),
            name: "Gemma 2 9B Instruct".into(),
            description: "Google's 9B punches above its weight. Great for analysis and creative writing.".into(),
            description_es: "El 9B de Google compite con modelos más grandes. Ideal para análisis y escritura creativa.".into(),
            category: "chat".into(),
            tags: vec!["chat".into(), "creative".into(), "analysis".into(), "recommended".into()],
            size_gb: 5.4,
            vram_required_gb: 7.5,
            context_window: 8192,
            quantization: "Q4_K_M".into(),
            hf_repo: "bartowski/gemma-2-9b-it-GGUF".into(),
            hf_file: "gemma-2-9b-it-Q4_K_M.gguf".into(),
            license: "Gemma".into(),
            languages: vec!["en".into(), "es".into(), "fr".into(), "de".into(), "ja".into()],
            benchmark_mmlu: Some(71.3),
            benchmark_humaneval: Some(64.4),
            benchmark_gsm8k: Some(84.0),
        },
        ModelEntry {
            id: "deepseek-r1-7b-q4".into(),
            name: "DeepSeek R1 Distill 7B".into(),
            description: "Chains of thought distilled from DeepSeek R1. Exceptional reasoning and math.".into(),
            description_es: "Cadenas de razonamiento destiladas de DeepSeek R1. Razonamiento y matemáticas excepcionales.".into(),
            category: "reasoning".into(),
            tags: vec!["reasoning".into(), "math".into(), "chain-of-thought".into()],
            size_gb: 4.7,
            vram_required_gb: 6.5,
            context_window: 32768,
            quantization: "Q4_K_M".into(),
            hf_repo: "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF".into(),
            hf_file: "DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf".into(),
            license: "MIT".into(),
            languages: vec!["en".into(), "zh".into()],
            benchmark_mmlu: Some(71.4),
            benchmark_humaneval: None,
            benchmark_gsm8k: Some(89.3),
        },

        // ── 12-14B class (needs 12-16GB VRAM) ──
        ModelEntry {
            id: "qwen2.5-14b-q4".into(),
            name: "Qwen 2.5 14B Instruct".into(),
            description: "Largest open 14B. Near 70B-level quality for coding, math, and multilingual tasks.".into(),
            description_es: "El 14B más grande. Calidad cercana a modelos 70B en código, matemáticas y tareas multilingües.".into(),
            category: "chat".into(),
            tags: vec!["chat".into(), "code".into(), "math".into(), "multilingual".into()],
            size_gb: 8.5,
            vram_required_gb: 11.0,
            context_window: 131072,
            quantization: "Q4_K_M".into(),
            hf_repo: "bartowski/Qwen2.5-14B-Instruct-GGUF".into(),
            hf_file: "Qwen2.5-14B-Instruct-Q4_K_M.gguf".into(),
            license: "Apache 2.0".into(),
            languages: vec!["en".into(), "zh".into(), "es".into(), "fr".into(), "de".into(), "ja".into(), "ko".into(), "ar".into()],
            benchmark_mmlu: Some(79.9),
            benchmark_humaneval: Some(87.8),
            benchmark_gsm8k: Some(93.3),
        },
        ModelEntry {
            id: "phi-4-14b-q4".into(),
            name: "Phi-4 14B".into(),
            description: "Microsoft's most capable small model. Outstanding reasoning, instruction following.".into(),
            description_es: "El modelo más capaz de Microsoft en tamaño pequeño. Razonamiento extraordinario.".into(),
            category: "chat".into(),
            tags: vec!["chat".into(), "reasoning".into(), "code".into()],
            size_gb: 8.5,
            vram_required_gb: 11.0,
            context_window: 16384,
            quantization: "Q4_K_M".into(),
            hf_repo: "bartowski/phi-4-GGUF".into(),
            hf_file: "phi-4-Q4_K_M.gguf".into(),
            license: "MIT".into(),
            languages: vec!["en".into()],
            benchmark_mmlu: Some(83.3),
            benchmark_humaneval: Some(82.6),
            benchmark_gsm8k: Some(91.5),
        },

        // ── 30B+ class (needs 24GB+ VRAM) ──
        ModelEntry {
            id: "qwen2.5-32b-q4".into(),
            name: "Qwen 2.5 32B Instruct".into(),
            description: "Massive 32B with 128K context. Challenges 70B models at half the size.".into(),
            description_es: "Masivo 32B con 128K contexto. Desafía modelos 70B a la mitad del tamaño.".into(),
            category: "chat".into(),
            tags: vec!["chat".into(), "code".into(), "math".into(), "multilingual".into(), "large".into()],
            size_gb: 19.0,
            vram_required_gb: 23.0,
            context_window: 131072,
            quantization: "Q4_K_M".into(),
            hf_repo: "bartowski/Qwen2.5-32B-Instruct-GGUF".into(),
            hf_file: "Qwen2.5-32B-Instruct-Q4_K_M.gguf".into(),
            license: "Apache 2.0".into(),
            languages: vec!["en".into(), "zh".into(), "es".into(), "fr".into(), "de".into(), "ja".into(), "ko".into(), "ar".into()],
            benchmark_mmlu: Some(83.3),
            benchmark_humaneval: Some(92.1),
            benchmark_gsm8k: Some(94.8),
        },

        // ── Specialized: code ──
        ModelEntry {
            id: "deepseek-coder-6.7b-q4".into(),
            name: "DeepSeek Coder 6.7B".into(),
            description: "Dedicated code generation model. Trained on 2 trillion tokens of code.".into(),
            description_es: "Modelo dedicado a generación de código. Entrenado con 2 billones de tokens de código.".into(),
            category: "code".into(),
            tags: vec!["code".into(), "reasoning".into()],
            size_gb: 4.0,
            vram_required_gb: 5.5,
            context_window: 16384,
            quantization: "Q4_K_M".into(),
            hf_repo: "bartowski/deepseek-coder-6.7b-instruct-GGUF".into(),
            hf_file: "deepseek-coder-6.7b-instruct-Q4_K_M.gguf".into(),
            license: "MIT".into(),
            languages: vec!["en".into()],
            benchmark_mmlu: None,
            benchmark_humaneval: Some(78.6),
            benchmark_gsm8k: None,
        },
        ModelEntry {
            id: "codestral-22b-q4".into(),
            name: "Codestral 22B".into(),
            description: "Mistral's dedicated code model. State-of-the-art fill-in-the-middle and code generation.".into(),
            description_es: "Modelo de código de Mistral. Fill-in-the-middle y generación de código de última generación.".into(),
            category: "code".into(),
            tags: vec!["code".into(), "large".into()],
            size_gb: 13.0,
            vram_required_gb: 16.0,
            context_window: 32768,
            quantization: "Q4_K_M".into(),
            hf_repo: "MaziyarPanahi/Codestral-22B-v0.1-GGUF".into(),
            hf_file: "Codestral-22B-v0.1.Q4_K_M.gguf".into(),
            license: "Mistral Non-Production".into(),
            languages: vec!["en".into()],
            benchmark_mmlu: None,
            benchmark_humaneval: Some(81.1),
            benchmark_gsm8k: None,
        },

        // ── Specialized: embedding ──
        ModelEntry {
            id: "nomic-embed-text".into(),
            name: "Nomic Embed Text v1.5".into(),
            description: "State-of-the-art text embeddings. Pairs with Solaria's vector memory. Via Ollama.".into(),
            description_es: "Embeddings de texto de última generación. Complementa la memoria vectorial de Solaria. Vía Ollama.".into(),
            category: "embedding".into(),
            tags: vec!["embedding".into(), "memory".into(), "ollama".into()],
            size_gb: 0.27,
            vram_required_gb: 0.5,
            context_window: 8192,
            quantization: "F16".into(),
            hf_repo: "".into(),
            hf_file: "".into(),
            license: "Apache 2.0".into(),
            languages: vec!["en".into()],
            benchmark_mmlu: None,
            benchmark_humaneval: None,
            benchmark_gsm8k: None,
        },
        ModelEntry {
            id: "mxbai-embed-large".into(),
            name: "mxbai-embed-large v1".into(),
            description: "High-quality multilingual embeddings (1024 dims). Great for RAG in Spanish & English. Via Ollama.".into(),
            description_es: "Embeddings multilingües de alta calidad (1024 dims). Ideal para RAG en español e inglés. Vía Ollama.".into(),
            category: "embedding".into(),
            tags: vec!["embedding".into(), "memory".into(), "multilingual".into(), "ollama".into()],
            size_gb: 0.67,
            vram_required_gb: 1.0,
            context_window: 512,
            quantization: "F16".into(),
            hf_repo: "".into(),
            hf_file: "".into(),
            license: "Apache 2.0".into(),
            languages: vec!["en".into(), "es".into(), "fr".into(), "de".into(), "zh".into(), "ja".into(), "ko".into()],
            benchmark_mmlu: None,
            benchmark_humaneval: None,
            benchmark_gsm8k: None,
        },
    ]
}

// ── Downloaded models persistence ──────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedModel {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub size_bytes: u64,
    pub downloaded_at: String,
    pub ollama_model: Option<String>,
    pub status: String, // "downloaded", "serving", "error"
}

fn models_dir() -> PathBuf {
    home_dir().join(".solaria").join("models")
}

fn models_meta_path() -> PathBuf {
    home_dir().join(".solaria").join("cookbook_models.json")
}

fn home_dir() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("USERPROFILE").map(PathBuf::from))
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn save_downloaded_models(models: &[DownloadedModel]) -> Result<(), String> {
    let path = models_meta_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create_dir: {}", e))?;
    }
    let json = serde_json::to_string_pretty(models).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("write: {}", e))
}

fn load_downloaded_models() -> Vec<DownloadedModel> {
    let path = models_meta_path();
    if !path.exists() {
        return Vec::new();
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

// ── Download logic ────────────────────────────────────────────────────────────

pub async fn download_model(
    app: AppHandle,
    stream_id: String,
    model_id: String,
) -> Result<String, String> {
    let catalog = get_catalog();
    let entry = catalog
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Model '{}' not found in catalog", model_id))?;

    if entry.hf_repo.is_empty() || entry.hf_file.is_empty() {
        return Err("This model is pulled via Ollama directly — use Ollama pull instead".into());
    }

    let cancel_flag = crate::register_cancel(&stream_id);

    let models_dir = models_dir();
    std::fs::create_dir_all(&models_dir).map_err(|e| format!("mkdir: {}", e))?;

    let dest_path = models_dir.join(&entry.hf_file);
    let dest_str = dest_path.to_string_lossy().to_string();

    let download_url = format!(
        "https://huggingface.co/{}/resolve/main/{}",
        entry.hf_repo, entry.hf_file
    );

    // Check if file already exists (complete)
    let existing_size = if dest_path.exists() {
        std::fs::metadata(&dest_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let total_size = (entry.size_gb * 1024.0 * 1024.0 * 1024.0) as u64;

    if existing_size > 0 && existing_size >= total_size.saturating_sub(1024 * 1024) {
        // File already complete
        let _ = app.emit("cookbook://progress", serde_json::json!({
            "stream_id": stream_id,
            "model_id": model_id,
            "downloaded": total_size,
            "total": total_size,
            "speed_mbps": 0.0,
            "eta_secs": 0,
            "status": "complete",
        }));
        add_downloaded_model(&entry, &dest_str, total_size)?;
        crate::unregister_cancel(&stream_id);
        return Ok(format!("Model already downloaded: {}", dest_str));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .build()
        .map_err(|e| e.to_string())?;

    let mut request = client.get(&download_url);
    if existing_size > 0 {
        request = request.header("Range", format!("bytes={}-", existing_size));
    }

    let response = request.send().await.map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() && response.status().as_u16() != 206 {
        return Err(format!("HF returned HTTP {}", response.status()));
    }

    // If server doesn't support range, start fresh
    let append = existing_size > 0 && response.status().as_u16() == 206;
    let actual_total = if response.status().as_u16() == 206 {
        response
            .headers()
            .get("content-range")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| {
                let parts: Vec<&str> = s.split('/').collect();
                parts.get(1).and_then(|p| p.parse::<u64>().ok())
            })
            .unwrap_or(total_size)
    } else {
        response.content_length().unwrap_or(total_size)
    };

    let _ = app.emit("cookbook://progress", serde_json::json!({
        "stream_id": stream_id,
        "model_id": model_id,
        "downloaded": if append { existing_size } else { 0u64 },
        "total": actual_total,
        "speed_mbps": 0.0,
        "eta_secs": 0,
        "status": "downloading",
    }));

    let mut file = if append {
        std::fs::OpenOptions::new()
            .append(true)
            .open(&dest_path)
            .map_err(|e| format!("open: {}", e))?
    } else {
        std::fs::File::create(&dest_path).map_err(|e| format!("create: {}", e))?
    };

    use std::io::Write;
    let mut downloaded = if append { existing_size } else { 0u64 };
    let start_time = std::time::Instant::now();
    let mut last_report = start_time;

    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        if cancel_flag.load(Ordering::SeqCst) {
            let _ = app.emit("cookbook://progress", serde_json::json!({
                "stream_id": stream_id,
                "model_id": model_id,
                "downloaded": downloaded,
                "total": actual_total,
                "speed_mbps": 0.0,
                "eta_secs": 0,
                "status": "cancelled",
            }));
            crate::unregister_cancel(&stream_id);
            return Err("Download cancelled".into());
        }

        let chunk = chunk_result.map_err(|e| format!("stream error: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("write: {}", e))?;
        downloaded += chunk.len() as u64;

        // Report progress every 500ms
        let now = std::time::Instant::now();
        if now.duration_since(last_report).as_millis() >= 500 {
            let elapsed = now.duration_since(start_time).as_secs_f64().max(0.1);
            let speed_mbps = (downloaded as f64 / (1024.0 * 1024.0)) / elapsed;
            let remaining = actual_total.saturating_sub(downloaded) as f64;
            let eta_secs = if speed_mbps > 0.0 {
                (remaining / (1024.0 * 1024.0) / speed_mbps) as u64
            } else {
                0
            };
            let _ = app.emit("cookbook://progress", serde_json::json!({
                "stream_id": stream_id,
                "model_id": model_id,
                "downloaded": downloaded,
                "total": actual_total,
                "speed_mbps": (speed_mbps * 10.0).round() / 10.0,
                "eta_secs": eta_secs,
                "status": "downloading",
            }));
            last_report = now;
        }
    }

    // Final progress
    let elapsed = start_time.elapsed().as_secs_f64().max(0.1);
    let speed_mbps = (downloaded as f64 / (1024.0 * 1024.0)) / elapsed;
    let _ = app.emit("cookbook://progress", serde_json::json!({
        "stream_id": stream_id,
        "model_id": model_id,
        "downloaded": downloaded,
        "total": downloaded,
        "speed_mbps": (speed_mbps * 10.0).round() / 10.0,
        "eta_secs": 0,
        "status": "complete",
    }));

    add_downloaded_model(entry, &dest_str, downloaded)?;

    crate::unregister_cancel(&stream_id);
    Ok(dest_str)
}

fn add_downloaded_model(entry: &ModelEntry, path: &str, size: u64) -> Result<(), String> {
    let mut models = load_downloaded_models();
    let now = chrono_now();
    models.retain(|m| m.id != entry.id);
    models.push(DownloadedModel {
        id: entry.id.clone(),
        name: entry.name.clone(),
        file_path: path.to_string(),
        size_bytes: size,
        downloaded_at: now,
        ollama_model: None,
        status: "downloaded".into(),
    });
    save_downloaded_models(&models)
}

fn chrono_now() -> String {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".into())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

pub fn scan_hardware_cmd() -> HardwareInfo {
    scan_hardware()
}

pub fn list_models_cmd(category: Option<String>) -> Vec<ModelEntry> {
    let catalog = get_catalog();
    if let Some(cat) = category {
        catalog.into_iter().filter(|m| m.category == cat || m.tags.contains(&cat)).collect()
    } else {
        catalog
    }
}

pub fn list_downloaded_cmd() -> Vec<DownloadedModel> {
    load_downloaded_models()
}

pub async fn download_model_cmd(
    app: AppHandle,
    stream_id: String,
    model_id: String,
) -> Result<String, String> {
    download_model(app, stream_id, model_id).await
}

pub fn cancel_download_cmd(stream_id: String) {
    crate::cancel_stream(&stream_id);
}

pub fn delete_model_cmd(model_id: String) -> Result<String, String> {
    let mut models = load_downloaded_models();
    if let Some(m) = models.iter().find(|m| m.id == model_id) {
        let path = m.file_path.clone();
        if std::path::Path::new(&path).exists() {
            std::fs::remove_file(&path).map_err(|e| format!("remove: {}", e))?;
        }
    }
    models.retain(|m| m.id != model_id);
    save_downloaded_models(&models)?;
    Ok(format!("Model '{}' deleted", model_id))
}

pub async fn create_ollama_model_cmd(model_id: String) -> Result<String, String> {
    let models = load_downloaded_models();
    let model = models
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Model '{}' not downloaded yet. Download it first.", model_id))?;

    if model.status == "serving" {
        return Err("Model is already loaded in Ollama".into());
    }

    let dest_path = &model.file_path;
    if !std::path::Path::new(dest_path).exists() {
        return Err(format!("Model file not found: {}", dest_path));
    }

    let modelfile_name = format!("solaria-{}", model_id.replace('.', "-"));
    let modelfile_content = format!(
        "FROM {}\n",
        dest_path
    );

    let temp_dir = std::env::temp_dir().join("solaria_ollama");
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("mkdir: {}", e))?;
    let modelfile_path = temp_dir.join(format!("Modelfile.{}", modelfile_name));
    std::fs::write(&modelfile_path, &modelfile_content)
        .map_err(|e| format!("write Modelfile: {}", e))?;

    let output = std::process::Command::new("ollama")
        .args(["create", &modelfile_name, "-f"])
        .arg(modelfile_path.to_string_lossy().to_string())
        .output()
        .map_err(|e| format!("ollama create failed: {}. Is Ollama installed and running?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("ollama create failed: {}{}", stdout, stderr));
    }

    let mut all_models = models;
    if let Some(m) = all_models.iter_mut().find(|m| m.id == model_id) {
        m.status = "serving".into();
        m.ollama_model = Some(modelfile_name.clone());
    }
    save_downloaded_models(&all_models)?;

    Ok(format!("Model loaded into Ollama as '{}'", modelfile_name))
}

pub fn get_ollama_status_cmd(model_id: String) -> Result<String, String> {
    let models = load_downloaded_models();
    if let Some(m) = models.iter().find(|m| m.id == model_id) {
        Ok(m.status.clone())
    } else {
        Ok("not_downloaded".into())
    }
}

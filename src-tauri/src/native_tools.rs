//! Conversión de herramientas y mensajes al formato nativo de cada proveedor,
//! y parseo de los eventos de streaming de tool calls.
//!
//! El frontend expone las herramientas en formato OpenAI
//! (`[{type:"function", function:{name, description, parameters}}]`) y el
//! historial del agente en el mismo formato (`assistant.tool_calls` + rol
//! `tool` con `tool_call_id`). Aquí se traduce a Anthropic, Google y Cohere.

use serde_json::{json, Value};

use crate::providers::ChatMessage;

/// Convierte el array de tools OpenAI al formato de Anthropic.
pub fn anthropic_tools(tools: &Value) -> Value {
    let out: Vec<Value> = tools
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .filter_map(|t| {
            let f = t.get("function")?;
            Some(json!({
                "name": f.get("name")?.as_str()?,
                "description": f.get("description").and_then(|d| d.as_str()).unwrap_or(""),
                "input_schema": f.get("parameters").cloned()
                    .unwrap_or_else(|| json!({"type": "object", "properties": {}})),
            }))
        })
        .collect();
    Value::Array(out)
}

/// Convierte el array de tools OpenAI al formato de Google Gemini.
pub fn google_tools(tools: &Value) -> Value {
    let declarations: Vec<Value> = tools
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .filter_map(|t| {
            let f = t.get("function")?;
            Some(json!({
                "name": f.get("name")?.as_str()?,
                "description": f.get("description").and_then(|d| d.as_str()).unwrap_or(""),
                "parameters": f.get("parameters").cloned()
                    .unwrap_or_else(|| json!({"type": "object", "properties": {}})),
            }))
        })
        .collect();
    json!([{ "functionDeclarations": declarations }])
}

/// Cohere v2 usa el mismo esquema de tools que OpenAI.
pub fn cohere_tools(tools: &Value) -> Value {
    tools.clone()
}

fn parse_arguments(value: Option<&Value>) -> Value {
    match value {
        Some(Value::String(s)) => serde_json::from_str(s).unwrap_or_else(|_| json!({})),
        Some(Value::Object(_)) => value.cloned().unwrap_or_else(|| json!({})),
        _ => json!({}),
    }
}

/// Convierte el historial OpenAI-shaped en mensajes de Anthropic, agrupando
/// bloques del mismo rol y transformando `tool_calls`/`tool_result`.
pub fn to_anthropic_messages(messages: &[ChatMessage]) -> Vec<Value> {
    let mut out: Vec<Value> = Vec::new();

    for m in messages {
        if m.role == "system" {
            continue;
        }
        let (role, blocks): (&str, Vec<Value>) = match m.role.as_str() {
            "assistant" => {
                let mut blocks: Vec<Value> = Vec::new();
                if !m.content.is_empty() {
                    blocks.push(json!({"type": "text", "text": m.content}));
                }
                if let Some(tcs) = m.tool_calls.as_ref().and_then(|t| t.as_array()) {
                    for (i, tc) in tcs.iter().enumerate() {
                        let id = tc["id"]
                            .as_str()
                            .filter(|s| !s.is_empty())
                            .map(str::to_string)
                            .unwrap_or_else(|| format!("call_{}", i));
                        let name = tc["function"]["name"].as_str().unwrap_or("");
                        let input = parse_arguments(tc["function"].get("arguments"));
                        blocks.push(json!({
                            "type": "tool_use", "id": id, "name": name, "input": input,
                        }));
                    }
                }
                if blocks.is_empty() {
                    blocks.push(json!({"type": "text", "text": ""}));
                }
                ("assistant", blocks)
            }
            "tool" => {
                let id = m.tool_call_id.clone().unwrap_or_default();
                (
                    "user",
                    vec![json!({
                        "type": "tool_result",
                        "tool_use_id": id,
                        "content": m.content,
                    })],
                )
            }
            _ => ("user", vec![json!({"type": "text", "text": m.content})]),
        };

        // Anthropic pide que los bloques consecutivos del mismo rol vayan en
        // un único mensaje.
        if let Some(last) = out.last_mut() {
            if last["role"].as_str() == Some(role) {
                if let (Some(arr), true) = (last["content"].as_array_mut(), true) {
                    arr.extend(blocks);
                    continue;
                }
            }
        }
        out.push(json!({ "role": role, "content": blocks }));
    }

    out
}

/// Convierte el historial OpenAI-shaped en `contents` de Google Gemini.
/// Necesita el nombre de función para los `functionResponse`, por eso mapea
/// primero los ids de llamada a sus nombres.
pub fn to_google_contents(messages: &[ChatMessage]) -> Vec<Value> {
    use std::collections::HashMap;

    let mut names: HashMap<String, String> = HashMap::new();
    for m in messages {
        if let Some(tcs) = m.tool_calls.as_ref().and_then(|t| t.as_array()) {
            for tc in tcs {
                if let (Some(id), Some(name)) = (
                    tc["id"].as_str(),
                    tc["function"]["name"].as_str(),
                ) {
                    names.insert(id.to_string(), name.to_string());
                }
            }
        }
    }

    let mut out: Vec<Value> = Vec::new();
    for m in messages {
        if m.role == "system" {
            continue;
        }
        let (role, parts): (&str, Vec<Value>) = match m.role.as_str() {
            "assistant" => {
                let mut parts: Vec<Value> = Vec::new();
                if !m.content.is_empty() {
                    parts.push(json!({"text": m.content}));
                }
                if let Some(tcs) = m.tool_calls.as_ref().and_then(|t| t.as_array()) {
                    for tc in tcs {
                        let name = tc["function"]["name"].as_str().unwrap_or("");
                        let args = parse_arguments(tc["function"].get("arguments"));
                        parts.push(json!({"functionCall": {"name": name, "args": args}}));
                    }
                }
                if parts.is_empty() {
                    parts.push(json!({"text": ""}));
                }
                ("model", parts)
            }
            "tool" => {
                let name = m
                    .tool_call_id
                    .as_ref()
                    .and_then(|id| names.get(id))
                    .cloned()
                    .unwrap_or_default();
                (
                    "user",
                    vec![json!({
                        "functionResponse": {
                            "name": name,
                            "response": { "result": m.content },
                        },
                    })],
                )
            }
            _ => ("user", vec![json!({"text": m.content})]),
        };

        if let Some(last) = out.last_mut() {
            if last["role"].as_str() == Some(role) {
                if let Some(arr) = last["parts"].as_array_mut() {
                    arr.extend(parts);
                    continue;
                }
            }
        }
        out.push(json!({ "role": role, "parts": parts }));
    }

    out
}

/// Acumulador genérico de tool calls (id, nombre, argumentos JSON en crudo).
#[derive(Default, Debug)]
pub struct ToolCallBuilder {
    calls: Vec<(String, String, String)>,
}

impl ToolCallBuilder {
    pub fn start(&mut self, id: impl Into<String>, name: impl Into<String>) -> usize {
        self.calls.push((id.into(), name.into(), String::new()));
        self.calls.len() - 1
    }

    pub fn append(&mut self, idx: usize, args: &str) {
        if let Some(call) = self.calls.get_mut(idx) {
            call.2.push_str(args);
        }
    }

    pub fn into_json(self) -> Vec<Value> {
        self.calls
            .into_iter()
            .filter(|(_, name, _)| !name.is_empty())
            .enumerate()
            .map(|(i, (id, name, args))| {
                json!({
                    "id": if id.is_empty() { format!("call_{}", i) } else { id },
                    "name": name,
                    "arguments": parse_arguments(Some(&Value::String(args))),
                })
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn msg(role: &str, content: &str) -> ChatMessage {
        ChatMessage {
            role: role.into(),
            content: content.into(),
            ..Default::default()
        }
    }

    fn openai_tools() -> Value {
        json!([{
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Lee un archivo",
                "parameters": {
                    "type": "object",
                    "properties": {"path": {"type": "string"}},
                    "required": ["path"]
                }
            }
        }])
    }

    #[test]
    fn converts_tools_for_anthropic() {
        let out = anthropic_tools(&openai_tools());
        assert_eq!(out[0]["name"], "read_file");
        assert_eq!(out[0]["input_schema"]["required"][0], "path");
    }

    #[test]
    fn converts_tools_for_google() {
        let out = google_tools(&openai_tools());
        assert_eq!(out[0]["functionDeclarations"][0]["name"], "read_file");
    }

    #[test]
    fn anthropic_tool_result_becomes_user_block() {
        let mut assistant = msg("assistant", "");
        assistant.tool_calls = Some(json!([{
            "id": "call_1", "type": "function",
            "function": {"name": "read_file", "arguments": "{\"path\":\"a.txt\"}"}
        }]));
        let mut tool = msg("tool", "contenido");
        tool.tool_call_id = Some("call_1".into());
        let out = to_anthropic_messages(&[msg("user", "hola"), assistant, tool]);
        assert_eq!(out.len(), 3);
        assert_eq!(out[1]["content"][0]["type"], "tool_use");
        assert_eq!(out[1]["content"][0]["input"]["path"], "a.txt");
        assert_eq!(out[2]["role"], "user");
        assert_eq!(out[2]["content"][0]["type"], "tool_result");
        assert_eq!(out[2]["content"][0]["tool_use_id"], "call_1");
    }

    #[test]
    fn anthropic_merges_consecutive_same_role() {
        let out = to_anthropic_messages(&[msg("user", "a"), msg("user", "b")]);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0]["content"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn google_tool_result_uses_function_name() {
        let mut assistant = msg("assistant", "");
        assistant.tool_calls = Some(json!([{
            "id": "call_9", "type": "function",
            "function": {"name": "glob", "arguments": "{\"pattern\":\"*.rs\"}"}
        }]));
        let mut tool = msg("tool", "ok");
        tool.tool_call_id = Some("call_9".into());
        let out = to_google_contents(&[msg("user", "busca"), assistant, tool]);
        assert_eq!(out[1]["role"], "model");
        assert_eq!(out[1]["parts"][0]["functionCall"]["name"], "glob");
        assert_eq!(out[2]["role"], "user");
        assert_eq!(out[2]["parts"][0]["functionResponse"]["name"], "glob");
    }

    #[test]
    fn builder_parses_partial_arguments() {
        let mut b = ToolCallBuilder::default();
        let i = b.start("call_1", "read_file");
        b.append(i, "{\"pa");
        b.append(i, "th\":\"x.md\"}");
        let out = b.into_json();
        assert_eq!(out[0]["name"], "read_file");
        assert_eq!(out[0]["arguments"]["path"], "x.md");
    }

    #[test]
    fn builder_generates_id_when_missing() {
        let mut b = ToolCallBuilder::default();
        b.start("", "glob");
        let out = b.into_json();
        assert!(out[0]["id"].as_str().unwrap().starts_with("call_"));
    }
}

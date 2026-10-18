import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const MODEL_ID = "onnx-community/SmolLM2-135M-Instruct-ONNX";
const form = document.querySelector("#chat-form");
const input = document.querySelector("#chat-input");
const send = document.querySelector("#chat-send");
const log = document.querySelector("#chat-log");
const history = [];
let generatorPromise;

const note = document.querySelector(".ai-note");
if (note) note.textContent = "Runs on this device. First use downloads the model; replies may be slower on older phones.";
const headerNote = document.querySelector(".chat-header small");
if (headerNote) headerNote.textContent = "Private, on-device AI · first load downloads a small model";

function addMessage(role, text, extra = "") {
  const element = document.createElement("div");
  element.className = `chat-message ${role} ${extra}`.trim();
  element.textContent = text;
  log.appendChild(element);
  log.scrollTop = log.scrollHeight;
  return element;
}

function matchContext() {
  const cards = document.querySelector("#match-list")?.innerText?.trim() || "No match cards are currently loaded.";
  const demo = !document.querySelector("#demo-tag")?.hidden;
  return `${demo ? "DEMO MODE: the match examples are fictional. Do not describe them as real." : "Use only the match details shown below; they may be incomplete."}\n${cards.slice(0, 6000)}`;
}

async function loadGenerator(statusMessage) {
  if (generatorPromise) return generatorPromise;
  const load = async (device) => pipeline("text-generation", MODEL_ID, {
    device,
    progress_callback: (progress) => {
      if (progress.status === "progress" && Number.isFinite(progress.progress)) {
        statusMessage.textContent = `Loading the on-device AI… ${Math.round(progress.progress)}%`;
      } else if (progress.status === "progress") {
        statusMessage.textContent = "Downloading the on-device AI model…";
      }
    }
  });
  generatorPromise = (async () => {
    if (navigator.gpu) {
      try { return await load("webgpu"); }
      catch (error) { console.warn("WebGPU unavailable; trying browser CPU/WASM", error); }
    }
    return await load("wasm");
  })();
  try { return await generatorPromise; }
  catch (error) { generatorPromise = undefined; throw error; }
}

async function answer(message, statusMessage) {
  const generator = await loadGenerator(statusMessage);
  const context = matchContext();
  const messages = [
    { role: "system", content: "You are MatchLens, a brief football explainer. Answer in plain language. Explain football terms and the 1X2 market accurately. For match questions, use only the supplied MatchLens context. Never invent live scores, fixtures, injuries, odds, or facts; say when information is unavailable. A probability is an estimate, not a guarantee or betting advice. If the context is demo data, clearly say it is fictional. Keep answers under 100 words." },
    { role: "user", content: `Current MatchLens context:\n${context}` },
    ...history.slice(-6),
    { role: "user", content: message }
  ];
  const result = await generator(messages, {
    max_new_tokens: 120,
    temperature: 0.35,
    do_sample: true,
    repetition_penalty: 1.1
  });
  const generated = result?.[0]?.generated_text;
  const reply = Array.isArray(generated) ? generated.at(-1)?.content : generated;
  return String(reply || "I couldn't form a reply. Try asking in a simpler way.").trim();
}

document.addEventListener("submit", async (event) => {
  if (event.target !== form) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const message = input.value.trim();
  if (!message || send.disabled) return;
  addMessage("user", message);
  input.value = "";
  send.disabled = true;
  const status = addMessage("assistant", "Preparing the on-device AI…", "pending");
  try {
    const reply = await answer(message, status);
    status.remove();
    addMessage("assistant", reply);
    history.push({ role: "user", content: message }, { role: "assistant", content: reply });
    if (history.length > 12) history.splice(0, history.length - 12);
  } catch (error) {
    console.error("Local MatchLens chat error", error);
    status.remove();
    addMessage("assistant", "I couldn't start the local model. Check your connection for the first download, then try again on a browser/device with more memory.");
  } finally {
    send.disabled = false;
    input.focus();
  }
}, true);

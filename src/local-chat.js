import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

// Smaller public ONNX model; inference runs in the visitor's browser.
const MODEL_ID = "onnx-community/flan-t5-small-ONNX";
const form = document.querySelector("#chat-form");
const input = document.querySelector("#chat-input");
const send = document.querySelector("#chat-send");
const log = document.querySelector("#chat-log");
const history = [];
let generatorPromise;

const note = document.querySelector(".ai-note");
if (note) note.textContent = "Runs on this device. The smaller model still needs a first download; replies may be slower on older phones.";
const headerNote = document.querySelector(".chat-header small");
if (headerNote) headerNote.textContent = "Private, on-device AI · smaller first download";

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
  return `${demo ? "DEMO MODE: the match examples are fictional. Do not describe them as real." : "Use only the match details shown below; they may be incomplete."}\n${cards.slice(0, 1600)}`;
}

async function loadGenerator(statusMessage) {
  if (generatorPromise) return generatorPromise;
  const load = async (device) => pipeline("text2text-generation", MODEL_ID, {
    device,
    dtype: "q8",
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
  const transcript = history.slice(-4).map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`).join("\n");
  const prompt = `You are MatchLens, a brief football explainer. Explain football terms and 1X2 accurately, in plain language. For match questions, only use the context below. Never invent live scores, fixtures, injuries, or odds; say when information is unavailable. Probabilities are estimates, not betting advice. Clearly identify demo data as fictional. Keep the reply under 70 words.\n\nMatchLens context:\n${context}\n\n${transcript ? `Recent conversation:\n${transcript}\n\n` : ""}User: ${message}\nAssistant:`;
  const result = await generator(prompt, {
    max_new_tokens: 88,
    do_sample: false
  });
  const reply = result?.[0]?.generated_text;
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
    if (history.length > 8) history.splice(0, history.length - 8);
  } catch (error) {
    console.error("Local MatchLens chat error", error);
    status.remove();
    addMessage("assistant", "I couldn't start the local model. Check your connection for the first download, then try again on a browser/device with more memory.");
  } finally {
    send.disabled = false;
    input.focus();
  }
}, true);

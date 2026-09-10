const FIXTURE_URL = "/api/v1/development/companion-reply-fixture";
const AGENT_URL = "/api/v1/agent/companion-reply";

function requireElement(element, selector) {
  if (element === null) {
    throw new Error(`Missing Agent demo element: ${selector}`);
  }
  return element;
}

const chatLog = requireElement(document.querySelector("#chat-log"), "#chat-log");
const composer = requireElement(document.querySelector("#composer"), "#composer");
const input = requireElement(document.querySelector("#child-input"), "#child-input");
const sendButton = requireElement(document.querySelector("#send"), "#send");
const ageBand = requireElement(document.querySelector("#age-band"), "#age-band");
const publicContext = requireElement(document.querySelector("#public-context"), "#public-context");
const contextLabel = requireElement(document.querySelector("#context-label"), "#context-label");
const status = requireElement(document.querySelector("#call-status"), "#call-status");
const diagnostics = requireElement(document.querySelector("#diagnostics"), "#diagnostics");
const presetList = requireElement(document.querySelector("#preset-list"), "#preset-list");

let fixture;

function showStatus(text, isError) {
  status.textContent = text;
  status.classList.toggle("error", isError);
}

function showDiagnostics(value) {
  diagnostics.textContent = JSON.stringify(value, null, 2);
}

function scrollChatToLatest() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function appendMessage(role, text) {
  const message = document.createElement("article");
  message.className = `message ${role}`;

  const copy = document.createElement("div");
  copy.className = "message-copy";

  const label = document.createElement("p");
  label.className = "message-label";
  label.textContent = role === "yuanlong" ? "元珑" : role === "child" ? "孩子" : "接口错误";

  const body = document.createElement("div");
  body.textContent = text;

  copy.append(label, body);
  message.append(copy);
  chatLog.append(message);
  scrollChatToLatest();
}

async function readJson(response) {
  const rawBody = await response.text();
  return JSON.parse(rawBody);
}

function createRequest(text) {
  if (fixture === undefined) {
    throw new Error("Companion fixture has not loaded");
  }

  return {
    ...fixture,
    requestId: `dev-request:companion:${Date.now()}`,
    childAgeBand: ageBand.value,
    input: {
      ...fixture.input,
      evidenceId: `submission:demo:${Date.now()}`,
      text,
    },
    interaction: { isPublic: publicContext.checked },
  };
}

function resultSummary(result) {
  return {
    providerName: result.providerName,
    knowledgeStatus: result.knowledgeStatus,
    primaryMove: result.primaryMove,
    emotionState: result.emotionState,
    safety: result.safety,
    memoryDecision: result.memoryDecision,
    sourceTrace: result.sourceTrace,
    capabilityCheck: result.capabilityCheck,
  };
}

async function sendMessage() {
  const text = input.value.trim();
  if (text.length === 0) {
    input.focus();
    return;
  }

  const requestBody = createRequest(text);
  const startedAt = performance.now();
  sendButton.disabled = true;
  showStatus("Agent 调用中", false);
  appendMessage("child", text);
  input.value = "";

  try {
    const response = await fetch(AGENT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const body = await readJson(response);
    const elapsedMs = Math.round(performance.now() - startedAt);
    showDiagnostics({ httpStatus: response.status, elapsedMs, request: requestBody, response: body });

    if (!response.ok) {
      appendMessage("error", `${body.error.code}: ${body.error.message}`);
      showStatus(`HTTP ${response.status} · ${body.error.code}`, true);
      return;
    }

    appendMessage("yuanlong", body.data.speechText);
    showStatus(`HTTP 200 · ${elapsedMs}ms · ${body.data.safety.level}`, false);
    showDiagnostics({
      httpStatus: response.status,
      elapsedMs,
      request: requestBody,
      result: resultSummary(body.data),
      rawResponse: body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendMessage("error", message);
    showStatus("DEMO_REQUEST_FAILED", true);
    showDiagnostics({ request: requestBody, code: "DEMO_REQUEST_FAILED", message });
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
}

async function loadFixture() {
  showStatus("正在加载测试请求", false);
  const response = await fetch(FIXTURE_URL, { cache: "no-store" });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(`${body.error.code}: ${body.error.message}`);
  }

  fixture = body.data;
  input.value = fixture.input.text;
  ageBand.value = fixture.childAgeBand;
  publicContext.checked = fixture.interaction.isPublic;
  contextLabel.textContent = "太和门 · 铜狮 · 开发测试上下文";
  showStatus("测试请求已加载", false);
  showDiagnostics({ fixture: body.data });
}

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  void sendMessage();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void sendMessage();
  }
});

presetList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const text = target.dataset.text;
  if (text === undefined) {
    throw new Error("Preset button is missing data-text");
  }
  input.value = text;
  input.focus();
});

void loadFixture().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  showStatus("FIXTURE_LOAD_FAILED", true);
  showDiagnostics({ code: "FIXTURE_LOAD_FAILED", message });
  appendMessage("error", message);
});

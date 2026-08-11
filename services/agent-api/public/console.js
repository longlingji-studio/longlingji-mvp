const FIXTURE_URL = "/api/v1/development/spot-feedback-fixture";
const SPOT_FEEDBACK_URL = "/api/v1/agent/spot-feedback";

const requestEditor = document.querySelector("#request");
const responseViewer = document.querySelector("#response");
const submitButton = document.querySelector("#submit");
const reloadButton = document.querySelector("#reload");
const statusLabel = document.querySelector("#status");

function requireElement(element, selector) {
  if (element === null) {
    throw new Error(`Missing development console element: ${selector}`);
  }
  return element;
}

const editor = requireElement(requestEditor, "#request");
const viewer = requireElement(responseViewer, "#response");
const submit = requireElement(submitButton, "#submit");
const reload = requireElement(reloadButton, "#reload");
const status = requireElement(statusLabel, "#status");

function showResponse(httpStatus, body, elapsedMs) {
  viewer.classList.toggle("error", httpStatus >= 400);
  viewer.textContent = JSON.stringify(
    { httpStatus, elapsedMs: Math.round(elapsedMs), body },
    null,
    2,
  );
}

async function readJson(response) {
  const rawBody = await response.text();
  return JSON.parse(rawBody);
}

async function loadFixture() {
  status.textContent = "正在加载样例";
  const response = await fetch(FIXTURE_URL, { cache: "no-store" });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(JSON.stringify(body));
  }
  editor.value = JSON.stringify(body.data, null, 2);
  status.textContent = "太和门样例已加载";
}

async function submitRequest() {
  submit.disabled = true;
  status.textContent = "Agent 调用中";
  const startedAt = performance.now();

  try {
    const requestBody = JSON.parse(editor.value);
    const response = await fetch(SPOT_FEEDBACK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const body = await readJson(response);
    showResponse(response.status, body, performance.now() - startedAt);
    status.textContent = `HTTP ${response.status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showResponse(0, { code: "CONSOLE_ERROR", message }, performance.now() - startedAt);
    status.textContent = "测试台错误";
  } finally {
    submit.disabled = false;
  }
}

submit.addEventListener("click", () => void submitRequest());
reload.addEventListener("click", () => {
  void loadFixture().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    showResponse(0, { code: "FIXTURE_LOAD_ERROR", message }, 0);
    status.textContent = "样例加载失败";
  });
});

void loadFixture().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  showResponse(0, { code: "FIXTURE_LOAD_ERROR", message }, 0);
  status.textContent = "样例加载失败";
});

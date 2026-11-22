"use strict";

// Keep the original A.1 key so existing browser progress is not lost.
const STORAGE_KEY = "bsm_a1_trial_v2";
const DATA_FILES = ["a1.json", "a2.json", "a3.json", "a4.json", "a5.json", "b1.json", "b2.json", "b3.json", "b4.json", "b5.json", "c1.json", "c2.json", "c3.json", "c4.json", "c5.json", "d1.json", "d2.json", "d3.json", "d4.json", "e1.json"];
const el = id => document.getElementById(id);
let questions = [];
let currentId = null;
let progress = {};
let topicOptions = [];

function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch { return {}; }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
  catch (error) { console.warn("Progress could not be saved", error); }
}
function inTopic(q) {
  const theme = el("theme").value;
  const topic = el("topic").value;
  const level = el("level").value;
  if (theme !== "all" && q.theme !== theme) return false;
  if (topic !== "all" && q.topic !== topic) return false;
  // HL course includes the SL core; "extension" isolates additional HL material.
  if (level === "sl" && q.level !== "SL") return false;
  if (level === "extension" && q.level !== "HL") return false;
  return true;
}
function topicQuestions() { return questions.filter(inTopic); }
function updateTopics(resetSelection = false) {
  const selector = el("topic");
  const theme = el("theme").value;
  const previous = resetSelection ? "all" : selector.value;
  const available = new Set(questions.filter(q => theme === "all" || q.theme === theme).map(q => q.topic));
  selector.replaceChildren();
  for (const original of topicOptions) {
    if (original.value !== "all" && !available.has(original.value)) continue;
    const option = document.createElement("option");
    option.value = original.value;
    option.textContent = original.value === "all"
      ? `All topics · ${questions.filter(q => theme === "all" || q.theme === theme).length} questions`
      : original.label;
    selector.append(option);
  }
  selector.value = [...selector.options].some(o => o.value === previous) ? previous : "all";
}
function filtered() {
  const section = el("section").value;
  const difficulty = el("difficulty").value;
  const mode = el("mode").value;
  return topicQuestions().filter(q => {
    const p = progress[q.id] || {};
    if (section !== "all" && q.section !== section) return false;
    if (difficulty !== "all" && String(q.difficulty) !== difficulty) return false;
    if (mode === "unanswered" && Number.isInteger(p.choice)) return false;
    if (mode === "incorrect" && (!Number.isInteger(p.choice) || p.choice === q.answer)) return false;
    if (mode === "starred" && !p.starred) return false;
    return true;
  });
}
function updateSections() {
  const selector = el("section");
  const previous = selector.value;
  selector.replaceChildren();
  const all = document.createElement("option");
  all.value = "all"; all.textContent = "All sections";
  selector.append(all);
  const sections = [...new Set(topicQuestions().map(q => q.section))].sort((a,b) => a.localeCompare(b));
  for (const section of sections) {
    const option = document.createElement("option");
    option.value = section; option.textContent = section;
    selector.append(option);
  }
  selector.value = sections.includes(previous) ? previous : "all";
}
function updateStats() {
  const scope = topicQuestions();
  const attempted = scope.filter(q => Number.isInteger(progress[q.id]?.choice)).length;
  const correct = scope.filter(q => progress[q.id]?.choice === q.answer).length;
  el("attempted").textContent = attempted;
  el("correct").textContent = correct;
  el("accuracy").textContent = attempted ? `${Math.round(100 * correct / attempted)}%` : "—";
  el("progressBar").style.width = `${scope.length ? 100 * attempted / scope.length : 0}%`;
  el("completion").textContent = `${attempted} of ${scope.length}`;
  el("reset").textContent = "Clear progress for this selection";
}
function showOptionTable(q) {
  el("quiz").querySelectorAll(".option-table").forEach(table => table.remove());
  if (!q.optionTable) return;
  const table = document.createElement("table");
  table.className = "option-table";
  const head = document.createElement("tr");
  for (const label of ["Option", ...q.optionTable.headers]) {
    const cell = document.createElement("th");
    cell.scope = "col"; cell.textContent = label; head.append(cell);
  }
  table.append(head);
  (q.optionTable.rows || []).forEach((row, index) => {
    const tr = document.createElement("tr");
    for (const item of [String.fromCharCode(65 + index), ...row]) {
      const td = document.createElement("td"); td.textContent = item; tr.append(td);
    }
    table.append(tr);
  });
  el("options").before(table);
}
function show() {
  updateStats();
  const arr = filtered();
  el("loading").classList.add("hidden");
  el("quiz").classList.toggle("hidden", arr.length === 0);
  el("empty").classList.toggle("hidden", arr.length > 0);
  if (arr.length === 0) return;
  if (!arr.some(q => q.id === currentId)) currentId = arr[0].id;
  const index = arr.findIndex(q => q.id === currentId);
  const q = arr[index];
  const saved = progress[q.id] || {};
  const answered = Number.isInteger(saved.choice);
  el("questionId").textContent = `${q.id} · ${q.section}`;
  el("difficultyTag").textContent = ["", "Foundation", "Application", "Exam challenge"][q.difficulty] || `Level ${q.difficulty}`;
  el("position").textContent = `Question ${index + 1} of ${arr.length}`;
  el("bookmark").textContent = saved.starred ? "★ Bookmarked" : "☆ Save for review";
  el("bookmark").classList.toggle("active", !!saved.starred);
  el("stem").textContent = q.stem;

  const figure = el("diagram");
  figure.replaceChildren();
  figure.classList.toggle("hidden", !q.diagram);
  if (q.diagram) {
    const image = document.createElement("img");
    image.src = q.diagram;
    image.alt = q.diagramAlt || "Diagram accompanying this question";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      const warning = document.createElement("p");
      warning.textContent = `Diagram unavailable: ${q.diagram}. Check that the file is in the diagrams folder.`;
      warning.className = "muted";
      figure.append(warning);
    });
    figure.append(image);
  }
  showOptionTable(q);

  const options = el("options");
  options.replaceChildren();
  q.options.forEach((label, choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.disabled = answered;
    if (answered && choice === q.answer) button.classList.add("correct");
    if (answered && choice === saved.choice && choice !== q.answer) button.classList.add("wrong");
    const letter = document.createElement("span");
    letter.className = "letter";
    letter.textContent = String.fromCharCode(65 + choice);
    button.append(letter);
    // Graph-choice questions already label their diagrams A–D.
    if (String(label).trim() !== String.fromCharCode(65 + choice)) {
      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;
      button.append(labelSpan);
    }
    button.addEventListener("click", () => {
      progress[q.id] = {...progress[q.id], choice, at: new Date().toISOString()};
      save(); show();
    });
    options.append(button);
  });

  const feedback = el("feedback");
  feedback.classList.toggle("hidden", !answered);
  feedback.classList.toggle("wrong", answered && saved.choice !== q.answer);
  feedback.replaceChildren();
  if (answered) {
    const heading = document.createElement("b");
    heading.textContent = saved.choice === q.answer
      ? "Correct — well done."
      : `Not quite. Correct answer: ${String.fromCharCode(65 + q.answer)}.`;
    const explanation = document.createElement("div");
    explanation.textContent = q.explanation;
    feedback.append(heading, explanation);
  }
  el("previous").disabled = index === 0;
  el("next").disabled = index === arr.length - 1;
}
function navigate(delta) {
  const arr = filtered();
  const index = arr.findIndex(q => q.id === currentId);
  const target = arr[index + delta];
  if (target) {
    currentId = target.id;
    show();
    el("quiz").scrollIntoView({block: "start", behavior: "smooth"});
  }
}
async function init() {
  progress = loadProgress();
  try {
    const responses = await Promise.all(DATA_FILES.map(async file => {
      const res = await fetch(file, {cache: "no-store"});
      if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) throw new Error(`${file} does not contain a question list`);
      return data;
    }));
    questions = responses.flat();
    const ids = questions.map(q => q.id);
    if (new Set(ids).size !== ids.length) throw new Error("Duplicate question identifiers found");
    for (const q of questions) {
      if (!q.id || !["A.1","A.2","A.3","A.4","A.5","B.1","B.2","B.3","B.4","B.5","C.1","C.2","C.3","C.4","C.5","D.1","D.2","D.3","D.4","E.1"].includes(q.topic) || !Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) {
        throw new Error(`Invalid question data: ${q.id || "unknown"}`);
      }
    }
    topicOptions = [...el("topic").options].map(o => ({value: o.value, label: o.textContent}));
    updateTopics();
    el("theme").addEventListener("change", () => {
      updateTopics(true); updateSections(); currentId = null; show();
    });
    el("topic").addEventListener("change", () => {
      updateSections(); currentId = null; show();
    });
    el("level").addEventListener("change", () => {
      updateSections(); currentId = null; show();
    });
    for (const id of ["section", "difficulty", "mode"]) {
      el(id).addEventListener("change", () => {currentId = null; show();});
    }
    el("previous").addEventListener("click", () => navigate(-1));
    el("next").addEventListener("click", () => navigate(1));
    el("bookmark").addEventListener("click", () => {
      const p = progress[currentId] || {};
      progress[currentId] = {...p, starred: !p.starred};
      save(); show();
    });
    el("reset").addEventListener("click", () => {
      const scope = topicQuestions();
      const label = `${scope.length} questions in the selected theme, topic and syllabus level`;
      if (!confirm(`Clear answers and bookmarks for ${label} saved on this browser?`)) return;
      for (const q of scope) delete progress[q.id];
      save(); currentId = null; show();
    });
    updateSections();
    show();
  } catch (error) {
    el("loading").textContent = `Could not load the question bank. Check that all twenty topic JSON files (a1–a5, b1–b5, c1–c5, d1–d4 and e1) are uploaded alongside index.html. Details: ${error.message}`;
    console.error(error);
  }
}
init();

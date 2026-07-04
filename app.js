const state = {
  data: null,
  subjectName: "TA",
  currentIndex: 0,
  answers: {},
  isAnimating: false,
  questionAnimationTimer: null,
  quoteIndexes: {}
};

const QUESTION_TRANSITION_MS = 220;
const SELECT_PAUSE_MS = 120;

const els = {
  appShell: document.querySelector(".app-shell"),
  loading: document.querySelector("#loadingScreen"),
  intro: document.querySelector("#introScreen"),
  question: document.querySelector("#questionScreen"),
  reflection: document.querySelector("#reflectionScreen"),
  result: document.querySelector("#resultScreen"),
  quizPanel: document.querySelector(".quiz-panel"),
  appTitle: document.querySelector("#appTitle"),
  appDescription: document.querySelector("#appDescription"),
  subjectName: document.querySelector("#subjectName"),
  startButton: document.querySelector("#startButton"),
  privacyCopy: document.querySelector("#privacyCopy"),
  backButton: document.querySelector("#backButton"),
  questionCounter: document.querySelector("#questionCounter"),
  progressPercent: document.querySelector("#progressPercent"),
  progressFill: document.querySelector("#progressFill"),
  questionKicker: document.querySelector("#questionKicker"),
  questionText: document.querySelector("#questionText"),
  optionList: document.querySelector("#optionList"),
  bubbleChart: document.querySelector("#bubbleChart"),
  quoteDimension: document.querySelector("#quoteDimension"),
  quoteText: document.querySelector("#quoteText"),
  quoteSource: document.querySelector("#quoteSource"),
  showResultButton: document.querySelector("#showResultButton"),
  resultTitle: document.querySelector("#resultTitle"),
  resultSummary: document.querySelector("#resultSummary"),
  resultAnalysis: document.querySelector("#resultAnalysis"),
  resultHighlight: document.querySelector("#resultHighlight"),
  dimensionScores: document.querySelector("#dimensionScores"),
  computedScores: document.querySelector("#computedScores"),
  restartButton: document.querySelector("#restartButton"),
  reviewButton: document.querySelector("#reviewButton")
};

init();

async function init() {
  bindEvents();

  try {
    try {
      const response = await fetch("questions.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      state.data = await response.json();
    } catch (fetchError) {
      if (!window.ASSESSMENT_DATA) {
        throw fetchError;
      }
      state.data = window.ASSESSMENT_DATA;
    }

    hydrateIntro();
    hideLoading();
  } catch (error) {
    showLoadError(error);
  }
}

function bindEvents() {
  els.startButton.addEventListener("click", startQuiz);
  els.subjectName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      startQuiz();
    }
  });
  els.backButton.addEventListener("click", goBack);
  els.showResultButton.addEventListener("click", renderResult);
  els.restartButton.addEventListener("click", restartQuiz);
  els.reviewButton.addEventListener("click", reviewAnswers);
}

function hydrateIntro() {
  const data = state.data;
  document.title = data.title;
  els.appTitle.textContent = data.title;
  els.appDescription.textContent = data.description;
  els.privacyCopy.textContent = data.uiHints?.privacyNotice || "所有答案只在本地浏览器中计算。";
}

function hideLoading() {
  els.loading.classList.add("is-hidden");
}

function showLoadError(error) {
  hideLoading();
  els.appTitle.textContent = "题目没有成功载入";
  els.appDescription.textContent = `请通过本地服务器打开这个页面，并确认 questions.json 位于同一目录。错误信息：${error.message}`;
  els.startButton.disabled = true;
}

function startQuiz() {
  if (!state.data) {
    return;
  }

  const inputName = els.subjectName.value.trim();
  state.subjectName = inputName || state.data.personToken || "TA";
  state.currentIndex = 0;
  state.answers = {};
  state.isAnimating = false;
  showScreen("question");
  scrollQuizIntoView();
  renderQuestion("forward");
}

function restartQuiz() {
  state.currentIndex = 0;
  state.answers = {};
  state.isAnimating = false;
  els.subjectName.value = "";
  state.subjectName = state.data?.personToken || "TA";
  showScreen("intro");
  scrollQuizIntoView();
}

function reviewAnswers() {
  state.currentIndex = 0;
  state.isAnimating = false;
  showScreen("question");
  scrollQuizIntoView();
  renderQuestion("forward");
}

function goBack() {
  if (state.isAnimating) {
    return;
  }

  if (state.currentIndex === 0) {
    showScreen("intro");
    scrollQuizIntoView();
    return;
  }

  transitionToQuestion(state.currentIndex - 1, "backward");
}

function showScreen(name) {
  els.appShell.classList.toggle("is-result", name === "result");
  els.intro.classList.toggle("is-active", name === "intro");
  els.question.classList.toggle("is-active", name === "question");
  els.reflection.classList.toggle("is-active", name === "reflection");
  els.result.classList.toggle("is-active", name === "result");
}

function renderQuestion(direction = "forward") {
  const data = state.data;
  const question = data.questions[state.currentIndex];
  const total = data.questions.length;
  const questionNumber = state.currentIndex + 1;
  const progress = Math.round(((state.currentIndex) / total) * 100);

  resetQuestionAnimationClasses();
  els.backButton.disabled = false;
  els.questionCounter.textContent = `第 ${questionNumber} / ${total} 题`;
  els.progressPercent.textContent = `${progress}%`;
  els.progressFill.style.width = `${progress}%`;
  els.questionKicker.textContent = `凭第一反应回答`;
  els.questionText.textContent = personalize(question.text);
  els.optionList.innerHTML = "";

  const currentAnswer = state.answers[question.id];
  const options = getQuestionOptions(question, data);
  options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "option-button";
    button.type = "button";
    button.dataset.value = String(option.value);
    button.innerHTML = `
      <span class="option-index">${getOptionMarker(index)}</span>
      <span class="option-label">${option.label}</span>
    `;

    if (String(currentAnswer) === String(option.value)) {
      button.classList.add("is-selected");
    }

    button.addEventListener("click", () => selectAnswer(question.id, option.value));
    els.optionList.appendChild(button);
  });

  playQuestionEnter(direction);
}

function selectAnswer(questionId, value) {
  if (state.isAnimating) {
    return;
  }

  state.answers[questionId] = value;

  [...els.optionList.children].forEach((button) => {
    const selected = String(button.dataset.value) === String(value);
    button.classList.toggle("is-selected", selected);
    button.disabled = true;
  });

  window.setTimeout(() => {
    if (state.currentIndex < state.data.questions.length - 1) {
      transitionToQuestion(state.currentIndex + 1, "forward");
    } else {
      transitionToReflection();
    }
  }, SELECT_PAUSE_MS);
}

function transitionToQuestion(nextIndex, direction) {
  state.isAnimating = true;
  resetQuestionAnimationClasses();
  els.question.classList.add("is-exiting", direction === "backward" ? "to-backward" : "to-forward");

  window.setTimeout(() => {
    state.currentIndex = nextIndex;
    renderQuestion(direction);
    state.isAnimating = false;
  }, QUESTION_TRANSITION_MS);
}

function transitionToReflection() {
  state.isAnimating = true;
  resetQuestionAnimationClasses();
  els.question.classList.add("is-exiting", "to-forward");

  window.setTimeout(() => {
    showScreen("reflection");
    scrollQuizIntoView();
    state.isAnimating = false;
  }, QUESTION_TRANSITION_MS);
}

function playQuestionEnter(direction) {
  if (state.questionAnimationTimer) {
    window.clearTimeout(state.questionAnimationTimer);
  }

  els.question.classList.add("is-entering", direction === "backward" ? "from-backward" : "from-forward");
  state.questionAnimationTimer = window.setTimeout(() => {
    resetQuestionAnimationClasses();
    state.questionAnimationTimer = null;
  }, QUESTION_TRANSITION_MS + 140);
}

function resetQuestionAnimationClasses() {
  els.question.classList.remove(
    "is-exiting",
    "is-entering",
    "to-forward",
    "to-backward",
    "from-forward",
    "from-backward"
  );
}

function renderResult() {
  const scores = calculateScores();
  const result = pickResult(scores);
  const topDimensions = [...scores.dimensionList].sort((a, b) => b.score - a.score).slice(0, 2);
  const loveScore = scores.computed.love_tendency?.score || 0;
  const friendshipScore = scores.computed.friendship_closeness?.score || 0;

  showScreen("result");
  scrollQuizIntoView();
  state.quoteIndexes = {};
  renderScoreBubbles(scores.dimensionList);
  showDimensionQuote(topDimensions[0]?.id || scores.dimensionList[0]?.id, { advance: false });
  els.progressFill.style.width = "100%";
  els.progressPercent.textContent = "100%";
  els.resultTitle.textContent = personalize(result.title);
  els.resultSummary.textContent = personalize(result.summary);
  renderResultAnalysis([
    ...(result.analysis || []),
    ...["q19", "q28"].map((questionId) => buildObservationAnalysis(questionId))
  ].filter(Boolean));
  els.resultHighlight.textContent = buildHighlight(topDimensions, loveScore, friendshipScore);
  renderDimensionScores(scores.dimensionList);
  renderComputedScores(scores.computedList);
}

function calculateScores() {
  const data = state.data;
  const maxValue = data.answerScale.max;
  const dimensionTotals = Object.fromEntries(
    data.dimensions.map((dimension) => [
      dimension.id,
      { ...dimension, weightedScore: 0, totalWeight: 0, score: 0 }
    ])
  );

  data.questions.forEach((question) => {
    const answer = Number(state.answers[question.id] ?? 0);
    if (!Number.isFinite(answer)) {
      return;
    }

    question.dimensionWeights?.forEach((item) => {
      const dimension = dimensionTotals[item.dimensionId];
      if (!dimension) {
        return;
      }

      const rawValue = item.reverse ? maxValue - answer : answer;
      const normalized = normalize(rawValue, maxValue);
      dimension.weightedScore += normalized * item.weight;
      dimension.totalWeight += item.weight;
    });
  });

  const dimensionList = data.dimensions.map((dimension) => {
    const item = dimensionTotals[dimension.id];
    const score = item.totalWeight ? item.weightedScore / item.totalWeight : 0;
    return {
      ...dimension,
      score: roundScore(score)
    };
  });

  const dimensionMap = Object.fromEntries(dimensionList.map((dimension) => [dimension.id, dimension]));
  const computedList = data.scoring.computedScores.map((scoreDef) => {
    let total = 0;
    let weight = 0;

    scoreDef.formula.forEach((item) => {
      let value = 0;
      if (item.dimensionId) {
        value = dimensionMap[item.dimensionId]?.score || 0;
      }
      if (item.questionId) {
        const answer = Number(state.answers[item.questionId] ?? 0);
        value = Number.isFinite(answer) ? normalize(answer, maxValue) : 0;
      }
      if (item.inverse) {
        value = 100 - value;
      }

      total += value * item.weight;
      weight += item.weight;
    });

    return {
      ...scoreDef,
      score: roundScore(weight ? total / weight : 0)
    };
  });

  return {
    dimensions: dimensionMap,
    dimensionList,
    computed: Object.fromEntries(computedList.map((score) => [score.id, score])),
    computedList
  };
}

function normalize(value, maxValue) {
  return (value / maxValue) * 100;
}

function roundScore(value) {
  return Math.round(Math.max(0, Math.min(100, value)));
}

function pickResult(scores) {
  const rules = [...state.data.scoring.resultRules].sort((a, b) => b.priority - a.priority);
  return rules.find((rule) => rule.conditions.every((condition) => matchesCondition(condition, scores)))
    || state.data.scoring.fallbackResult;
}

function matchesCondition(condition, scores) {
  let actual = 0;
  if (condition.dimensionId) {
    actual = scores.dimensions[condition.dimensionId]?.score || 0;
  }
  if (condition.scoreId) {
    actual = scores.computed[condition.scoreId]?.score || 0;
  }

  switch (condition.operator) {
    case ">=":
      return actual >= condition.value;
    case ">":
      return actual > condition.value;
    case "<=":
      return actual <= condition.value;
    case "<":
      return actual < condition.value;
    case "==":
      return actual === condition.value;
    default:
      return false;
  }
}

function renderDimensionScores(dimensions) {
  els.dimensionScores.innerHTML = dimensions.map((dimension) => `
    <article class="score-row">
      <div class="score-head">
        <span class="score-name">${dimension.name}</span>
        <span class="score-value">${dimension.score}</span>
      </div>
      <div class="score-bar" aria-hidden="true">
        <div class="score-fill" style="--bar-color: ${dimension.color}; width: ${dimension.score}%"></div>
      </div>
      <p class="score-description">${personalize(dimension.description)}</p>
    </article>
  `).join("");
}

function renderComputedScores(scores) {
  els.computedScores.innerHTML = scores.map((score) => `
    <article class="score-row">
      <div class="score-head">
        <span class="score-name">${score.name}</span>
        <span class="score-value">${score.score}</span>
      </div>
      <div class="score-bar" aria-hidden="true">
        <div class="score-fill" style="width: ${score.score}%"></div>
      </div>
    </article>
  `).join("");
}

function renderResultAnalysis(analysis) {
  const paragraphs = Array.isArray(analysis) ? analysis : [];
  els.resultAnalysis.innerHTML = paragraphs.map((paragraph) => `
    <p>${personalize(paragraph)}</p>
  `).join("");
  els.resultAnalysis.hidden = paragraphs.length === 0;
}

function getQuestionOptions(question, data) {
  const sourceOptions = question.options || data.answerScale.options;
  const optionMap = new Map(sourceOptions.map((option) => [String(option.value), option]));

  if (!Array.isArray(question.optionOrder)) {
    return sourceOptions;
  }

  const orderedOptions = question.optionOrder
    .map((value) => optionMap.get(String(value)))
    .filter(Boolean);

  return orderedOptions.length ? orderedOptions : sourceOptions;
}

function getOptionMarker(index) {
  return String.fromCharCode(65 + index);
}

function buildObservationAnalysis(questionId) {
  const question = state.data.questions.find((item) => item.id === questionId);
  if (!question?.options) {
    return "";
  }

  const selectedValue = state.answers[question.id];
  const selectedOption = question.options.find((option) => String(option.value) === String(selectedValue));
  return selectedOption?.analysis || "";
}

function showDimensionQuote(dimensionId, options = {}) {
  const dimension = state.data.dimensions.find((item) => item.id === dimensionId);
  const quotes = dimension?.quotes || [];
  if (!dimension || quotes.length === 0) {
    return;
  }

  const currentIndex = state.quoteIndexes[dimensionId] ?? -1;
  const nextIndex = options.advance === false && currentIndex >= 0
    ? currentIndex
    : (currentIndex + 1 + quotes.length) % quotes.length;
  const quote = quotes[nextIndex];

  state.quoteIndexes[dimensionId] = nextIndex;
  els.quoteDimension.textContent = dimension.name;
  els.quoteText.textContent = quote.text;
  els.quoteSource.textContent = quote.source ? `— ${quote.source}` : "";

  els.bubbleChart.querySelectorAll(".score-bubble").forEach((bubble) => {
    bubble.classList.toggle("is-active", bubble.dataset.dimensionId === dimensionId);
  });
}

function renderScoreBubbles(dimensions) {
  els.bubbleChart.innerHTML = dimensions.map((dimension) => {
    const size = Math.round(72 + dimension.score * 0.66);
    return `
      <button
        class="score-bubble"
        type="button"
        data-dimension-id="${dimension.id}"
        style="--bubble-color: ${dimension.color}; --bubble-size: ${size}px"
        aria-label="${dimension.name} ${dimension.score} 分"
      >
        <span class="bubble-content">
          <span class="bubble-score">${dimension.score}</span>
          <span class="bubble-name">${dimension.name}</span>
        </span>
      </button>
    `;
  }).join("");

  els.bubbleChart.querySelectorAll(".score-bubble").forEach((bubble) => {
    bubble.addEventListener("click", () => showDimensionQuote(bubble.dataset.dimensionId));
  });
}

function scrollQuizIntoView() {
  els.quizPanel.scrollIntoView({ block: "start", behavior: "smooth" });
}

function buildHighlight(topDimensions, loveScore, friendshipScore) {
  const [first, second] = topDimensions;
  const lead = first && second
    ? `这次最突出的两个维度是「${first.name}」和「${second.name}」。`
    : "";
  const contrast = loveScore >= friendshipScore
    ? `爱情倾向分比友情亲密分更高，说明你的答案更偏向心动、特殊性和靠近。`
    : `友情亲密分比爱情倾向分更高，说明舒服、信任和祝福感在这段关系里更占上风。`;

  return personalize(`${lead}${contrast}`);
}

function personalize(text) {
  return String(text).replaceAll("TA", state.subjectName || "TA");
}

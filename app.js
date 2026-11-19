(function () {
  "use strict";

  var TABS = ["gpa", "cgpa", "attendance", "about"];
  var GPA_KEY = "vitcalc.gpa";
  var CGPA_KEY = "vitcalc.cgpa";
  var ATTEND_KEY = "vitcalc.attendance";
  var THEME_KEY = "vitcalc.theme";
  var TAB_KEY = "vitcalc.tab";
  var EXPECTED_POINTS = { S: 10, A: 9, B: 8, C: 7, D: 6, E: 5, F: 0 };
  var RING = 100;

  var booting = true;
  var seq = 0;
  var rows = [];
  var subjects = [];
  var gpaScore = { ready: false, last: null };
  var cgpaScore = { ready: false, last: null };
  var GRADE_POINTS = {};
  var CATEGORIES = [];
  var CREDIT_VALUES = [];

  function uid(prefix) {
    seq += 1;
    return prefix + Date.now().toString(36) + seq.toString(36);
  }

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function writeJSON(key, value) {
    if (booting) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {}
  }

  function removeKey(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {}
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseBlank(value) {
    if (value == null) return null;
    var text = String(value).trim();
    if (text === "") return null;
    var number = Number(text);
    if (!Number.isFinite(number)) return null;
    return number;
  }

  function isWhole(number) {
    return Number.isFinite(number) && Math.abs(number - Math.round(number)) < 1e-9;
  }

  function round2(number) {
    return Math.round(number * 100) / 100;
  }

  function formatGpa(number) {
    return round2(number).toFixed(2);
  }

  function formatTrim(number) {
    var rounded = Math.round(number * 100) / 100;
    if (Object.is(rounded, -0)) rounded = 0;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(2).replace(/0$/, "");
  }

  function floorStable(number) {
    var nearest = Math.round(number);
    if (Math.abs(number - nearest) < 1e-6) return nearest;
    return Math.floor(number);
  }

  function ceilStable(number) {
    var nearest = Math.round(number);
    if (Math.abs(number - nearest) < 1e-6) return nearest;
    return Math.ceil(number);
  }

  function standing(shown, emptyLabel) {
    if (shown == null) return emptyLabel;
    if (shown >= 9) return "Outstanding";
    if (shown >= 8) return "Excellent";
    if (shown >= 7) return "Very good";
    if (shown >= 6) return "Good";
    if (shown >= 5) return "Passing";
    return "Needs work";
  }

  function pointsFor(grade) {
    if (!Object.prototype.hasOwnProperty.call(GRADE_POINTS, grade)) return null;
    return GRADE_POINTS[grade];
  }

  function readScale() {
    var template = document.getElementById("course-template");
    var gradeSelect = template.content.querySelector('[data-field="grade"]');
    var categorySelect = template.content.querySelector('[data-field="category"]');
    var creditSelect = template.content.querySelector('[data-field="credits"]');
    Array.prototype.forEach.call(gradeSelect.querySelectorAll("option[data-points]"), function (option) {
      GRADE_POINTS[option.value] = Number(option.getAttribute("data-points"));
    });
    CATEGORIES = Array.prototype.map.call(categorySelect.options, function (option) {
      return option.value;
    });
    CREDIT_VALUES = Array.prototype.map.call(creditSelect.options, function (option) {
      return option.value;
    });
    var letters = Object.keys(EXPECTED_POINTS);
    var scaleOk = letters.every(function (letter) {
      return GRADE_POINTS[letter] === EXPECTED_POINTS[letter];
    }) && Object.keys(GRADE_POINTS).length === letters.length;
    var creditsOk = CREDIT_VALUES.join(",") === "0.5,1,1.5,2,3,4,5,6,10,20";
    var categoriesOk = CATEGORIES.join("|") === [
      "Discipline Core",
      "Discipline Elective",
      "Open Elective",
      "Ability Enhancement",
      "Skill Enhancement",
      "Value Added Course"
    ].join("|");
    if (!scaleOk || !creditsOk || !categoriesOk) {
      throw new Error("VITCalc grade scale is incomplete");
    }
  }

  function resolvedTheme(choice) {
    if (choice === "light" || choice === "dark") return choice;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(choice) {
    var theme = resolvedTheme(choice);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-theme-choice", choice);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#111614" : "#f3efe6");
    Array.prototype.forEach.call(document.querySelectorAll("#theme-group [data-choice]"), function (button) {
      var on = button.getAttribute("data-choice") === choice;
      button.setAttribute("aria-checked", on ? "true" : "false");
      button.tabIndex = on ? 0 : -1;
    });
  }

  function setTheme(choice) {
    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch (err) {}
    applyTheme(choice);
  }

  function initTheme() {
    var choice = document.documentElement.getAttribute("data-theme-choice") || "system";
    applyTheme(choice);
    var group = document.getElementById("theme-group");
    group.addEventListener("click", function (event) {
      var button = event.target.closest("[data-choice]");
      if (!button || !group.contains(button)) return;
      setTheme(button.getAttribute("data-choice"));
      button.focus();
    });
    group.addEventListener("keydown", function (event) {
      var buttons = Array.prototype.slice.call(group.querySelectorAll("[data-choice]"));
      var index = buttons.findIndex(function (button) {
        return button.getAttribute("aria-checked") === "true";
      });
      var next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = buttons[(index + 1) % buttons.length];
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = buttons[(index - 1 + buttons.length) % buttons.length];
      if (!next) return;
      event.preventDefault();
      setTheme(next.getAttribute("data-choice"));
      next.focus();
    });
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    var onScheme = function () {
      if (document.documentElement.getAttribute("data-theme-choice") === "system") applyTheme("system");
    };
    if (media.addEventListener) media.addEventListener("change", onScheme);
    else if (media.addListener) media.addListener(onScheme);
  }

  function selectTab(name, updateHash) {
    if (TABS.indexOf(name) === -1) name = "gpa";
    document.documentElement.setAttribute("data-tab", name);
    TABS.forEach(function (tab) {
      var button = document.getElementById("tab-" + tab);
      var panel = document.getElementById("panel-" + tab);
      var on = tab === name;
      button.setAttribute("aria-selected", on ? "true" : "false");
      button.tabIndex = on ? 0 : -1;
      if (on) panel.removeAttribute("inert");
      else panel.setAttribute("inert", "");
    });
    try {
      sessionStorage.setItem(TAB_KEY, name);
    } catch (err) {}
    if (updateHash && location.hash !== "#" + name) {
      history.replaceState(null, "", "#" + name);
    }
  }

  function initTabs() {
    var initial = document.documentElement.getAttribute("data-tab") || "gpa";
    selectTab(initial, false);
    var tablist = document.getElementById("tablist");
    tablist.addEventListener("click", function (event) {
      var button = event.target.closest("[data-tab]");
      if (!button || !tablist.contains(button)) return;
      selectTab(button.getAttribute("data-tab"), true);
    });
    tablist.addEventListener("keydown", function (event) {
      var buttons = TABS.map(function (tab) { return document.getElementById("tab-" + tab); });
      var index = buttons.indexOf(document.activeElement);
      if (index < 0) return;
      var next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = buttons[(index + 1) % buttons.length];
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = buttons[(index - 1 + buttons.length) % buttons.length];
      if (event.key === "Home") next = buttons[0];
      if (event.key === "End") next = buttons[buttons.length - 1];
      if (!next) return;
      event.preventDefault();
      selectTab(next.getAttribute("data-tab"), true);
      next.focus();
    });
    document.getElementById("brand").addEventListener("click", function (event) {
      event.preventDefault();
      selectTab("gpa", true);
    });
    window.addEventListener("hashchange", function () {
      var hash = (location.hash || "").replace("#", "");
      if (TABS.indexOf(hash) !== -1) selectTab(hash, false);
    });
  }

  function celebrate() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var canvas = document.getElementById("confetti");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var width = window.innerWidth;
    var height = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var colors = dark
      ? ["#8fd9c8", "#e2c08a", "#f0a090", "#9ec0ff"]
      : ["#0f5c50", "#c9893a", "#d4654f", "#3d6b9a"];
    var pieces = [];
    for (var i = 0; i < 46; i += 1) {
      pieces.push({
        x: width * (0.08 + Math.random() * 0.84),
        y: -16 - Math.random() * 120,
        vy: 1.8 + Math.random() * 2.1,
        vx: -0.55 + Math.random() * 1.1,
        rot: Math.random() * Math.PI,
        vr: -0.07 + Math.random() * 0.14,
        color: colors[i % colors.length],
        size: 7 + Math.random() * 5,
        circle: i % 3 === 0
      });
    }
    var start = performance.now();
    if (celebrate.frame) cancelAnimationFrame(celebrate.frame);
    function frame(now) {
      ctx.clearRect(0, 0, width, height);
      pieces.forEach(function (piece) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.028;
        piece.rot += piece.vr;
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rot);
        ctx.fillStyle = piece.color;
        ctx.globalAlpha = 0.92;
        if (piece.circle) {
          ctx.beginPath();
          ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        }
        ctx.restore();
      });
      if (now - start < 1600) celebrate.frame = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, width, height);
    }
    celebrate.frame = requestAnimationFrame(frame);
  }

  function takeScore(slot, shown) {
    if (slot.ready && shown != null && shown >= 9 && !(slot.last != null && slot.last >= 9)) {
      celebrate();
    }
    slot.last = shown;
    slot.ready = true;
  }

  function paintRing(id, exact, shown) {
    var ring = document.getElementById(id);
    var progress = exact == null ? 0 : Math.min(1, Math.max(0, exact / 10));
    ring.style.strokeDasharray = String(RING);
    ring.style.strokeDashoffset = String(RING * (1 - progress));
    ring.classList.toggle("is-high", shown != null && shown >= 9);
    ring.classList.toggle("is-low", shown != null && shown < 5);
  }

  function resultState(shown) {
    if (shown == null) return "idle";
    if (shown >= 9) return "high";
    if (shown < 5) return "low";
    return "ok";
  }

  function defaultRows() {
    return [
      { id: uid("c"), category: "Discipline Core", grade: "", credits: "4" },
      { id: uid("c"), category: "Discipline Core", grade: "", credits: "3" },
      { id: uid("c"), category: "Discipline Elective", grade: "", credits: "3" },
      { id: uid("c"), category: "Open Elective", grade: "", credits: "3" }
    ];
  }

  function loadRows() {
    var data = readJSON(GPA_KEY);
    if (!data || !Array.isArray(data.rows)) return defaultRows();
    return data.rows.slice(0, 40).map(function (raw) {
      var category = CATEGORIES.indexOf(raw && raw.category) !== -1 ? raw.category : CATEGORIES[0];
      var grade = raw && Object.prototype.hasOwnProperty.call(GRADE_POINTS, raw.grade) ? raw.grade : "";
      var credits = raw && CREDIT_VALUES.indexOf(String(raw.credits)) !== -1 ? String(raw.credits) : "3";
      return {
        id: raw && typeof raw.id === "string" ? raw.id : uid("c"),
        category: category,
        grade: grade,
        credits: credits
      };
    });
  }

  function saveGpa() {
    writeJSON(GPA_KEY, { v: 1, rows: rows });
  }

  function paintProduct(article, row) {
    var slot = article.querySelector(".row-product");
    var points = pointsFor(row.grade);
    var credits = Number(row.credits);
    if (points == null || CREDIT_VALUES.indexOf(String(row.credits)) === -1) {
      slot.textContent = "\u2014";
      slot.classList.remove("is-set");
      delete article.dataset.points;
      return;
    }
    var weighted = points * credits;
    slot.textContent = formatTrim(points) + " x " + formatTrim(credits) + " = " + formatTrim(weighted);
    slot.classList.add("is-set");
    article.dataset.points = String(weighted);
  }

  function computeGpa() {
    var sumPoints = 0;
    var sumCredits = 0;
    var count = 0;
    var parts = [];
    rows.forEach(function (row) {
      var points = pointsFor(row.grade);
      if (points == null || CREDIT_VALUES.indexOf(String(row.credits)) === -1) return;
      var credits = Number(row.credits);
      sumPoints += points * credits;
      sumCredits += credits;
      count += 1;
      parts.push(formatTrim(points) + " x " + formatTrim(credits));
    });
    if (count === 0 || sumCredits <= 0) return null;
    return {
      gpa: sumPoints / sumCredits,
      sumPoints: sumPoints,
      sumCredits: sumCredits,
      count: count,
      expression: parts.join(" + ") + " = " + formatTrim(sumPoints) + " / " + formatTrim(sumCredits)
    };
  }

  function renderGpaResult() {
    var result = computeGpa();
    var shown = result ? round2(result.gpa) : null;
    takeScore(gpaScore, shown);
    var value = document.getElementById("gpa-value");
    value.textContent = shown == null ? "\u2014" : formatGpa(result.gpa);
    value.dataset.exact = result ? String(result.gpa) : "";
    value.dataset.points = result ? String(result.sumPoints) : "";
    value.dataset.credits = result ? String(result.sumCredits) : "";
    var label = standing(shown, "Add grades");
    document.getElementById("gpa-label").textContent = label;
    document.getElementById("gpa-credits").textContent = result ? formatTrim(result.sumCredits) : "0";
    document.getElementById("gpa-points").textContent = result ? formatTrim(result.sumPoints) : "0";
    document.getElementById("gpa-courses").textContent = result ? String(result.count) : "0";
    document.getElementById("gpa-expression").textContent = result ? result.expression : "Grade a course to weight it.";
    document.getElementById("gpa-card").setAttribute("data-state", resultState(shown));
    paintRing("gpa-ring", result ? result.gpa : null, shown);
    document.getElementById("gpa-live").textContent = result
      ? "GPA " + formatGpa(result.gpa) + ", " + label + ", " + formatTrim(result.sumCredits) + " credits, " + formatTrim(result.sumPoints) + " grade points."
      : "No graded courses yet.";
  }

  function renderRows() {
    var list = document.getElementById("course-list");
    var fragment = document.createDocumentFragment();
    rows.forEach(function (row, index) {
      var article = document.getElementById("course-template").content.firstElementChild.cloneNode(true);
      var number = index + 1;
      article.dataset.id = row.id;
      article.querySelector(".course-kicker").textContent = "Course " + number;
      var category = article.querySelector('[data-field="category"]');
      var grade = article.querySelector('[data-field="grade"]');
      var credits = article.querySelector('[data-field="credits"]');
      category.value = CATEGORIES.indexOf(row.category) !== -1 ? row.category : CATEGORIES[0];
      grade.value = Object.prototype.hasOwnProperty.call(GRADE_POINTS, row.grade) ? row.grade : "";
      credits.value = CREDIT_VALUES.indexOf(row.credits) !== -1 ? row.credits : "3";
      category.setAttribute("aria-label", "Category for course " + number);
      grade.setAttribute("aria-label", "Grade for course " + number);
      credits.setAttribute("aria-label", "Credits for course " + number);
      var remove = article.querySelector('[data-action="remove"]');
      remove.setAttribute("aria-label", "Remove course " + number);
      paintProduct(article, row);
      category.addEventListener("change", function () {
        row.category = category.value;
        saveGpa();
      });
      grade.addEventListener("change", function () {
        row.grade = grade.value;
        paintProduct(article, row);
        saveGpa();
        renderGpaResult();
      });
      credits.addEventListener("change", function () {
        row.credits = credits.value;
        paintProduct(article, row);
        saveGpa();
        renderGpaResult();
      });
      remove.addEventListener("click", function () {
        rows = rows.filter(function (item) { return item.id !== row.id; });
        saveGpa();
        renderRows();
        renderGpaResult();
        document.getElementById("add-course").focus();
      });
      fragment.appendChild(article);
    });
    list.replaceChildren(fragment);
    document.getElementById("course-empty").hidden = rows.length !== 0;
    document.getElementById("add-course").disabled = rows.length >= 40;
  }

  function initGpa() {
    rows = loadRows();
    renderRows();
    renderGpaResult();
    document.getElementById("add-course").addEventListener("click", function () {
      if (rows.length >= 40) return;
      rows.push({ id: uid("c"), category: "Discipline Core", grade: "", credits: "3" });
      saveGpa();
      renderRows();
      var courses = document.querySelectorAll("#course-list .course");
      var field = courses[courses.length - 1].querySelector('[data-field="category"]');
      if (field) field.focus();
    });
    armReset(document.getElementById("reset-gpa"), function () {
      rows = defaultRows();
      removeKey(GPA_KEY);
      renderRows();
      renderGpaResult();
    });
  }

  function cgpaModel() {
    var planner = document.getElementById("planner");
    return {
      v: 1,
      prevCgpa: document.getElementById("prev-cgpa").value,
      prevCredits: document.getElementById("prev-credits").value,
      currentGpa: document.getElementById("current-gpa").value,
      currentCredits: document.getElementById("current-credits").value,
      target: document.getElementById("target-cgpa").value,
      semesters: document.getElementById("semesters-left").value,
      avgCredits: document.getElementById("avg-credits").value,
      plannerOpen: planner.open
    };
  }

  function computeCgpa(fields) {
    var prevCgpa = parseBlank(fields.prevCgpa);
    var prevCredits = parseBlank(fields.prevCredits);
    var currentGpa = parseBlank(fields.currentGpa);
    var currentCredits = parseBlank(fields.currentCredits);
    if (prevCgpa == null || prevCredits == null || currentGpa == null || currentCredits == null) {
      return {
        state: "idle",
        message: "Enter previous CGPA, previous credits, current GPA, and current credits."
      };
    }
    if (prevCgpa < 0 || prevCgpa > 10 || currentGpa < 0 || currentGpa > 10) {
      return { state: "invalid", message: "Previous CGPA and current GPA must be between 0 and 10." };
    }
    if (prevCredits < 0 || currentCredits < 0) {
      return { state: "invalid", message: "Credits cannot be negative." };
    }
    if (prevCredits > 100000 || currentCredits > 100000) {
      return { state: "invalid", message: "That credit total looks too large." };
    }
    var totalCredits = prevCredits + currentCredits;
    if (totalCredits <= 0) {
      return { state: "invalid", message: "Enter the credits you have completed." };
    }
    var totalPoints = prevCgpa * prevCredits + currentGpa * currentCredits;
    return {
      state: "ok",
      cgpa: totalPoints / totalCredits,
      totalCredits: totalCredits,
      totalPoints: totalPoints,
      prevCgpa: prevCgpa,
      prevCredits: prevCredits,
      currentGpa: currentGpa,
      currentCredits: currentCredits
    };
  }

  function computePlan(record, fields) {
    var idle = "Add a target CGPA, semesters left, and average credits per semester.";
    var target = parseBlank(fields.target);
    var semesters = parseBlank(fields.semesters);
    var avg = parseBlank(fields.avgCredits);
    if (target == null && semesters == null && avg == null) return { state: "idle", message: idle };
    if (record.state !== "ok") return { state: "idle", message: "Calculate a CGPA before planning a target." };
    if (target == null || semesters == null || avg == null) return { state: "idle", message: idle };
    if (target < 0 || target > 10) return { state: "invalid", message: "Target CGPA must be between 0 and 10." };
    if (!isWhole(semesters) || semesters < 0) {
      return { state: "invalid", message: "Semesters left must be a whole number, zero or more." };
    }
    if (avg < 0 || avg > 100000) return { state: "invalid", message: "Average credits must be zero or more." };
    var future = semesters * avg;
    if (future <= 0) {
      var current = round2(record.cgpa);
      var goal = round2(target);
      if (current > goal) {
        return { state: "ok", message: "No credits left to average. Your CGPA is " + formatGpa(record.cgpa) + ", already above a target of " + formatGpa(target) + "." };
      }
      if (current < goal) {
        return { state: "impossible", message: "No credits left to average. Your CGPA is " + formatGpa(record.cgpa) + ", below a target of " + formatGpa(target) + ", so that target is unreachable." };
      }
      return { state: "ok", message: "No credits left to average. Your CGPA matches the target of " + formatGpa(target) + "." };
    }
    var required = (target * (record.totalCredits + future) - record.totalPoints) / future;
    var shown = round2(required);
    if (shown < 0) {
      return { state: "ok", message: "You already beat this target. Even with zeros ahead, your CGPA stays above it." };
    }
    if (shown > 10) {
      return { state: "impossible", message: "This target is unreachable. It would take a future GPA of " + formatGpa(required) + ", above the maximum of 10." };
    }
    return { state: "ok", message: "You need a future GPA of " + formatGpa(required) + " across " + formatTrim(future) + " credits." };
  }

  function renderCgpa() {
    var fields = cgpaModel();
    var record = computeCgpa(fields);
    var shown = record.state === "ok" ? round2(record.cgpa) : null;
    takeScore(cgpaScore, shown);
    var value = document.getElementById("cgpa-value");
    value.textContent = shown == null ? "\u2014" : formatGpa(record.cgpa);
    value.dataset.exact = record.state === "ok" ? String(record.cgpa) : "";
    var label = standing(shown, "Enter both terms");
    document.getElementById("cgpa-label").textContent = label;
    document.getElementById("cgpa-credits").textContent = record.state === "ok" ? formatTrim(record.totalCredits) : "\u2014";
    document.getElementById("cgpa-points").textContent = record.state === "ok" ? formatTrim(record.totalPoints) : "\u2014";
    var expression = document.getElementById("cgpa-expression");
    if (record.state === "ok") {
      expression.textContent = "(" + formatGpa(record.prevCgpa) + " x " + formatTrim(record.prevCredits) + ") + (" + formatGpa(record.currentGpa) + " x " + formatTrim(record.currentCredits) + ") = " + formatTrim(record.totalPoints) + " / " + formatTrim(record.totalCredits);
      expression.classList.remove("is-error");
    } else {
      expression.textContent = record.message;
      expression.classList.toggle("is-error", record.state === "invalid");
    }
    document.getElementById("cgpa-card").setAttribute("data-state", record.state === "invalid" ? "invalid" : resultState(shown));
    paintRing("cgpa-ring", record.state === "ok" ? record.cgpa : null, shown);
    document.getElementById("cgpa-live").textContent = record.state === "ok"
      ? "CGPA " + formatGpa(record.cgpa) + ", " + label + ", " + formatTrim(record.totalCredits) + " credits."
      : record.message;
    var plan = computePlan(record, fields);
    var planEl = document.getElementById("planner-result");
    planEl.textContent = plan.message;
    planEl.classList.toggle("is-error", plan.state === "invalid" || plan.state === "impossible");
  }

  function fieldString(value) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.length <= 24) return value;
    return "";
  }

  function initCgpa() {
    var data = readJSON(CGPA_KEY) || {};
    document.getElementById("prev-cgpa").value = fieldString(data.prevCgpa);
    document.getElementById("prev-credits").value = fieldString(data.prevCredits);
    document.getElementById("current-gpa").value = fieldString(data.currentGpa);
    document.getElementById("current-credits").value = fieldString(data.currentCredits);
    document.getElementById("target-cgpa").value = fieldString(data.target);
    document.getElementById("semesters-left").value = fieldString(data.semesters);
    document.getElementById("avg-credits").value = fieldString(data.avgCredits);
    document.getElementById("planner").open = data.plannerOpen === true;
    ["prev-cgpa", "prev-credits", "current-gpa", "current-credits", "target-cgpa", "semesters-left", "avg-credits"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function () {
        writeJSON(CGPA_KEY, cgpaModel());
        renderCgpa();
      });
    });
    document.getElementById("planner").addEventListener("toggle", function () {
      writeJSON(CGPA_KEY, cgpaModel());
    });
    renderCgpa();
    armReset(document.getElementById("reset-cgpa"), function () {
      ["prev-cgpa", "prev-credits", "current-gpa", "current-credits", "target-cgpa", "semesters-left", "avg-credits"].forEach(function (id) {
        document.getElementById(id).value = "";
      });
      document.getElementById("planner").open = false;
      removeKey(CGPA_KEY);
      renderCgpa();
    });
  }

  // Can miss = floor((attended - min/100 * total) / (min/100))
  function classesYouCanMiss(attended, total, minPercent) {
    return Math.max(0, floorStable((attended * 100 - minPercent * total) / minPercent));
  }

  // Must attend = ceil((min * total - 100 * attended) / (100 - min))
  function classesYouMustAttend(attended, total, minPercent) {
    return Math.max(0, ceilStable((minPercent * total - 100 * attended) / (100 - minPercent)));
  }

  function evaluateAttendance(attendedRaw, totalRaw, minRaw) {
    var total = parseBlank(totalRaw);
    var attended = parseBlank(attendedRaw);
    var minPercent = parseBlank(minRaw);
    if (total == null && attended == null) {
      return { state: "idle", percent: null, count: null, countLabel: "", detail: "Enter total and attended classes." };
    }
    if (total == null || attended == null || minPercent == null) {
      return { state: "idle", percent: null, count: null, countLabel: "", detail: "Enter total, attended, and a minimum percent." };
    }
    if (!isWhole(total) || !isWhole(attended)) {
      return { state: "invalid", percent: null, count: null, countLabel: "", detail: "Use whole numbers for class counts." };
    }
    if (total < 0 || attended < 0) {
      return { state: "invalid", percent: null, count: null, countLabel: "", detail: "Class counts cannot be negative." };
    }
    if (attended > total) {
      return { state: "invalid", percent: null, count: null, countLabel: "", detail: "Attended classes cannot be more than the total." };
    }
    if (minPercent < 0 || minPercent > 100) {
      return { state: "invalid", percent: null, count: null, countLabel: "", detail: "Minimum percent must be between 0 and 100." };
    }
    if (total === 0) {
      return { state: "invalid", percent: null, count: null, countLabel: "", detail: "Enter a total above zero." };
    }
    var percent = (attended / total) * 100;
    if (minPercent === 0) {
      return { state: "none", percent: percent, count: null, countLabel: "", detail: "No minimum is set, so every remaining class can be missed." };
    }
    if (minPercent >= 100) {
      if (attended === total) {
        return { state: "ok", percent: percent, count: 0, countLabel: "Can miss", detail: "You can miss 0 classes and stay at 100%." };
      }
      return { state: "impossible", percent: percent, count: null, countLabel: "", detail: "A 100% minimum is unreachable once a class is missed." };
    }
    if (attended / total + 1e-12 >= minPercent / 100) {
      var canMiss = classesYouCanMiss(attended, total, minPercent);
      var missWord = canMiss === 1 ? "class" : "classes";
      return {
        state: "ok",
        percent: percent,
        count: canMiss,
        countLabel: "Can miss",
        detail: "You can miss " + canMiss + " more " + missWord + " and stay at or above " + formatTrim(minPercent) + "%."
      };
    }
    var must = classesYouMustAttend(attended, total, minPercent);
    var mustWord = must === 1 ? "class" : "classes";
    return {
      state: "short",
      percent: percent,
      count: must,
      countLabel: "Must attend",
      detail: "Attend the next " + must + " " + mustWord + " in a row to reach " + formatTrim(minPercent) + "%."
    };
  }

  function formatPercent(number) {
    var rounded = Math.round(number * 10) / 10;
    return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + "%";
  }

  function paintMeter(fill, mark, outcome, minRaw) {
    var percent = outcome.percent == null ? 0 : Math.max(0, Math.min(100, outcome.percent));
    fill.style.width = percent + "%";
    fill.classList.toggle("is-ok", outcome.state === "ok" || outcome.state === "none");
    fill.classList.toggle("is-short", outcome.state === "short" || outcome.state === "impossible");
    var minPercent = parseBlank(minRaw);
    var markAt = minPercent == null ? 75 : Math.max(0, Math.min(100, minPercent));
    mark.style.left = markAt + "%";
  }

  function renderOverall() {
    var total = document.getElementById("overall-total").value;
    var attended = document.getElementById("overall-attended").value;
    var minPercent = document.getElementById("overall-min").value;
    var outcome = evaluateAttendance(attended, total, minPercent);
    var status = {
      idle: "Add classes",
      invalid: "Check numbers",
      ok: "On track",
      short: "Short",
      none: "No minimum",
      impossible: "Out of reach"
    };
    document.getElementById("overall-status").textContent = status[outcome.state] || "Add classes";
    var percentEl = document.getElementById("overall-percent");
    percentEl.textContent = outcome.percent == null ? "\u2014" : formatPercent(outcome.percent);
    percentEl.classList.toggle("is-ok", outcome.state === "ok");
    percentEl.classList.toggle("is-short", outcome.state === "short" || outcome.state === "impossible");
    var countEl = document.getElementById("overall-count");
    countEl.textContent = outcome.count == null ? "\u2014" : String(outcome.count);
    countEl.classList.toggle("is-ok", outcome.state === "ok");
    countEl.classList.toggle("is-short", outcome.state === "short");
    document.getElementById("overall-count-label").textContent = outcome.count == null ? "Classes" : outcome.countLabel;
    document.getElementById("overall-detail").textContent = outcome.detail;
    var meter = document.getElementById("overall-meter");
    if (outcome.percent == null) {
      meter.setAttribute("aria-valuenow", "0");
      meter.setAttribute("aria-valuetext", outcome.detail);
    } else {
      meter.setAttribute("aria-valuenow", String(Math.round(outcome.percent)));
      meter.setAttribute("aria-valuetext", formatPercent(outcome.percent) + ". " + outcome.detail);
    }
    paintMeter(
      document.getElementById("overall-fill"),
      document.getElementById("overall-min-mark"),
      outcome,
      minPercent
    );
    var invalid = outcome.state === "invalid";
    document.getElementById("overall-attended").setAttribute("aria-invalid", invalid ? "true" : "false");
    document.getElementById("overall-total").setAttribute("aria-invalid", invalid ? "true" : "false");
  }

  function attendanceState() {
    return {
      v: 1,
      total: document.getElementById("overall-total").value,
      attended: document.getElementById("overall-attended").value,
      min: document.getElementById("overall-min").value,
      subjects: subjects
    };
  }

  function saveAttendance() {
    writeJSON(ATTEND_KEY, attendanceState());
  }

  function paintSubject(article, subject) {
    var outcome = evaluateAttendance(subject.attended, subject.total, subject.min);
    var result = article.querySelector(".subject-result");
    result.dataset.state = outcome.state;
    var name = escapeHtml(subject.name.trim() || "Subject");
    result.innerHTML = '<span class="subject-name">' + name + "</span> " + '<span class="subject-msg">' + escapeHtml(outcome.detail) + "</span>";
    paintMeter(article.querySelector(".meter-fill"), article.querySelector(".meter-min"), outcome, subject.min);
    ["total", "attended", "min"].forEach(function (field) {
      var input = article.querySelector('[data-field="' + field + '"]');
      input.setAttribute("aria-invalid", outcome.state === "invalid" ? "true" : "false");
    });
  }

  function blankSubject() {
    return { id: uid("s"), name: "", total: "", attended: "", min: "75" };
  }

  function renderSubjects() {
    var list = document.getElementById("subject-list");
    var fragment = document.createDocumentFragment();
    subjects.forEach(function (subject, index) {
      var article = document.getElementById("subject-template").content.firstElementChild.cloneNode(true);
      var number = index + 1;
      article.dataset.id = subject.id;
      var name = article.querySelector('[data-field="name"]');
      var total = article.querySelector('[data-field="total"]');
      var attended = article.querySelector('[data-field="attended"]');
      var minPercent = article.querySelector('[data-field="min"]');
      name.value = subject.name;
      total.value = subject.total;
      attended.value = subject.attended;
      minPercent.value = subject.min === "" ? "" : subject.min;
      name.setAttribute("aria-label", "Subject " + number + " name");
      total.setAttribute("aria-label", "Subject " + number + " total classes");
      attended.setAttribute("aria-label", "Subject " + number + " attended classes");
      minPercent.setAttribute("aria-label", "Subject " + number + " minimum percent");
      var result = article.querySelector(".subject-result");
      result.id = "subject-result-" + subject.id;
      [name, total, attended, minPercent].forEach(function (input) {
        input.setAttribute("aria-describedby", result.id);
      });
      var remove = article.querySelector('[data-action="remove"]');
      remove.setAttribute("aria-label", "Remove subject " + number);
      function onField(field, input) {
        input.addEventListener("input", function () {
          subject[field] = input.value;
          saveAttendance();
          paintSubject(article, subject);
        });
      }
      onField("name", name);
      onField("total", total);
      onField("attended", attended);
      onField("min", minPercent);
      remove.addEventListener("click", function () {
        subjects = subjects.filter(function (item) { return item.id !== subject.id; });
        saveAttendance();
        renderSubjects();
        document.getElementById("add-subject").focus();
      });
      paintSubject(article, subject);
      fragment.appendChild(article);
    });
    list.replaceChildren(fragment);
    document.getElementById("subject-empty").hidden = subjects.length !== 0;
    document.getElementById("add-subject").disabled = subjects.length >= 40;
  }

  function loadAttendance() {
    var data = readJSON(ATTEND_KEY);
    if (!data) {
      subjects = [blankSubject()];
      return { total: "", attended: "", min: "75" };
    }
    subjects = Array.isArray(data.subjects) ? data.subjects.slice(0, 40).map(function (raw) {
      return {
        id: raw && typeof raw.id === "string" ? raw.id : uid("s"),
        name: raw && typeof raw.name === "string" ? raw.name.slice(0, 80) : "",
        total: fieldString(raw && raw.total),
        attended: fieldString(raw && raw.attended),
        min: fieldString(raw && raw.min) || "75"
      };
    }) : [];
    return {
      total: fieldString(data.total),
      attended: fieldString(data.attended),
      min: Object.prototype.hasOwnProperty.call(data, "min") ? fieldString(data.min) : "75"
    };
  }

  function initAttendance() {
    var overall = loadAttendance();
    document.getElementById("overall-total").value = overall.total;
    document.getElementById("overall-attended").value = overall.attended;
    document.getElementById("overall-min").value = overall.min;
    ["overall-total", "overall-attended", "overall-min"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function () {
        saveAttendance();
        renderOverall();
      });
    });
    renderOverall();
    renderSubjects();
    document.getElementById("add-subject").addEventListener("click", function () {
      if (subjects.length >= 40) return;
      subjects.push(blankSubject());
      saveAttendance();
      renderSubjects();
      var cards = document.querySelectorAll("#subject-list .subject");
      var field = cards[cards.length - 1].querySelector('[data-field="name"]');
      if (field) field.focus();
    });
    armReset(document.getElementById("reset-attendance"), function () {
      document.getElementById("overall-total").value = "";
      document.getElementById("overall-attended").value = "";
      document.getElementById("overall-min").value = "75";
      subjects = [blankSubject()];
      removeKey(ATTEND_KEY);
      renderOverall();
      renderSubjects();
    });
  }

  function armReset(button, onConfirm) {
    var label = button.querySelector(".btn-label");
    var original = label.textContent;
    var armed = false;
    var armedAt = 0;
    var timer = 0;
    button.addEventListener("click", function () {
      if (!armed) {
        armed = true;
        armedAt = Date.now();
        label.textContent = "Confirm clear";
        button.classList.add("is-armed");
        timer = window.setTimeout(function () {
          armed = false;
          label.textContent = original;
          button.classList.remove("is-armed");
        }, 3500);
        return;
      }
      if (Date.now() - armedAt < 400) return;
      window.clearTimeout(timer);
      armed = false;
      label.textContent = original;
      button.classList.remove("is-armed");
      onConfirm();
    });
  }

  function initGuards() {
    document.addEventListener("wheel", function (event) {
      var target = event.target;
      if (target && target.tagName === "INPUT" && target.type === "number" && document.activeElement === target) {
        target.blur();
      }
    }, { passive: true });
  }

  readScale();
  initTheme();
  initTabs();
  initGpa();
  initCgpa();
  initAttendance();
  initGuards();
  booting = false;
})();

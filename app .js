/* ============================================================
   VIT Calc — app.js
   ============================================================ */

'use strict';

/* ════════════════════════════════════════════════════════════
   1. THEME MANAGEMENT
   ════════════════════════════════════════════════════════════ */

const THEME_KEY = 'vitcalc_theme';

function applyTheme(theme) {
  const html = document.documentElement;
  const icon = document.getElementById('themeIcon');
  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
    icon.className = 'fas fa-sun';
  } else if (theme === 'light') {
    html.setAttribute('data-theme', 'light');
    icon.className = 'fas fa-moon';
  } else {
    html.setAttribute('data-theme', 'auto');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    icon.className = prefersDark ? 'fas fa-sun' : 'fas fa-moon';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let next;
  if (current === 'auto') next = prefersDark ? 'light' : 'dark';
  else if (current === 'dark') next = 'light';
  else next = 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

// Initialise theme
(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'auto';
  applyTheme(saved);
})();

// Watch system preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const current = localStorage.getItem(THEME_KEY) || 'auto';
  if (current === 'auto') applyTheme('auto');
});

/* ════════════════════════════════════════════════════════════
   2. NAVIGATION / TAB SWITCHING
   ════════════════════════════════════════════════════════════ */

function switchTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Hide hero on tab switch, show main
  const hero = document.getElementById('hero');
  const main = document.getElementById('main');

  // Show/hide sections
  document.querySelectorAll('.tab-section').forEach(sec => {
    sec.classList.remove('active');
  });
  const target = document.getElementById(tab);
  if (target) {
    target.classList.add('active');
    // Trigger re-animation
    target.style.animation = 'none';
    target.offsetHeight; // reflow
    target.style.animation = '';
  }

  // Scroll to main content
  main.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToTop() {
  document.getElementById('hero').scrollIntoView({ behavior: 'smooth' });
}

/* ════════════════════════════════════════════════════════════
   3. HERO COUNTER ANIMATION
   ════════════════════════════════════════════════════════════ */

function animateCounter(el) {
  const target = parseFloat(el.dataset.target);
  const duration = 1800;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Number.isInteger(target)
      ? Math.floor(eased * target)
      : (eased * target).toFixed(1);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounter(e.target);
      counterObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-num').forEach(el => counterObserver.observe(el));

/* ════════════════════════════════════════════════════════════
   4. SVG RING GRADIENT — injected once
   ════════════════════════════════════════════════════════════ */

(function injectSvgDefs() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.cssText = 'width:0;height:0;position:absolute;';
  svg.innerHTML = `
    <defs>
      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6c63ff"/>
        <stop offset="100%" stop-color="#3ecfcf"/>
      </linearGradient>
    </defs>`;
  document.body.prepend(svg);
})();

/* ════════════════════════════════════════════════════════════
   5. RING ANIMATION HELPER
   ════════════════════════════════════════════════════════════ */

function animateRing(ringFillId, value, max = 10) {
  const el = document.getElementById(ringFillId);
  if (!el) return;
  const circumference = 2 * Math.PI * 50; // r=50
  const fraction = Math.min(Math.max(value / max, 0), 1);
  const offset = circumference * (1 - fraction);
  el.style.strokeDashoffset = offset;

  // Color based on value
  const pct = fraction * 100;
  if (pct >= 80) el.style.stroke = 'url(#ringGrad)';
  else if (pct >= 60) el.style.stroke = '#f59e0b';
  else el.style.stroke = '#ef4444';
}

/* ════════════════════════════════════════════════════════════
   6. GPA CALCULATOR
   ════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  'Discipline Core',
  'Discipline Elective',
  'Open Elective',
  'Ability Enhancement',
  'Skill Enhancement',
  'Value Added Course',
];

const GRADES = [
  { label: 'S', value: 10 },
  { label: 'A', value: 9 },
  { label: 'B', value: 8 },
  { label: 'C', value: 7 },
  { label: 'D', value: 6 },
  { label: 'F', value: 0 },
];

const CREDITS = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 10, 20];

let courseCount = 0;

function buildCategoryOptions() {
  return CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
}

function buildGradeOptions() {
  return GRADES.map(g => `<option value="${g.value}">${g.label} (${g.value})</option>`).join('');
}

function buildCreditOptions() {
  return CREDITS.map(c => `<option value="${c}">${c}</option>`).join('');
}

function addCourseRow(data = {}) {
  const id = ++courseCount;
  const container = document.getElementById('courses');

  const row = document.createElement('div');
  row.className = 'course-row';
  row.dataset.rowId = id;

  row.innerHTML = `
    <select class="category" aria-label="Course category">
      <option value="">Category</option>
      ${buildCategoryOptions()}
    </select>
    <select class="grade" aria-label="Grade">
      <option value="">Grade</option>
      ${buildGradeOptions()}
    </select>
    <select class="credits" aria-label="Credits">
      <option value="">Credits</option>
      ${buildCreditOptions()}
    </select>
    <button class="row-del" onclick="removeCourseRow(this)" title="Remove">
      <i class="fas fa-times"></i>
    </button>`;

  // Restore saved data
  if (data.category) row.querySelector('.category').value = data.category;
  if (data.grade !== undefined) row.querySelector('.grade').value = data.grade;
  if (data.credits !== undefined) row.querySelector('.credits').value = data.credits;

  // Animate in
  row.style.opacity = '0';
  row.style.transform = 'translateY(-8px)';
  container.appendChild(row);
  requestAnimationFrame(() => {
    row.style.transition = 'opacity 0.25s, transform 0.25s';
    row.style.opacity = '1';
    row.style.transform = 'translateY(0)';
  });

  saveGPAData();
  return row;
}

function removeCourseRow(btn) {
  const row = btn.closest('.course-row');
  row.style.transition = 'opacity 0.2s, transform 0.2s';
  row.style.opacity = '0';
  row.style.transform = 'translateX(20px)';
  setTimeout(() => { row.remove(); saveGPAData(); }, 220);
}

function calculateGPA() {
  const rows = document.querySelectorAll('#courses .course-row');
  const errorEl = document.getElementById('gpaError');
  const resultEl = document.getElementById('gpaResult');

  let totalPoints = 0;
  let totalCredits = 0;
  let filledRows = 0;

  rows.forEach(row => {
    const grade = parseFloat(row.querySelector('.grade').value);
    const credits = parseFloat(row.querySelector('.credits').value);
    if (!isNaN(grade) && !isNaN(credits) && credits > 0) {
      totalPoints += grade * credits;
      totalCredits += credits;
      filledRows++;
    }
  });

  if (filledRows === 0) {
    showError(errorEl, 'Please fill at least one course with grade and credits.');
    resultEl.classList.add('hidden');
    return;
  }

  errorEl.classList.add('hidden');

  const gpa = totalPoints / totalCredits;
  const perf = gpaPerformanceLabel(gpa);

  document.getElementById('gpaValue').textContent = gpa.toFixed(2);
  document.getElementById('gpaTotalCredits').textContent = totalCredits;
  document.getElementById('gpaTotalPoints').textContent = totalPoints.toFixed(1);
  document.getElementById('gpaPerf').textContent = perf;

  resultEl.classList.remove('hidden');
  animateRing('gpaRingFill', gpa, 10);

  if (gpa >= 9) launchConfetti();

  saveGPAData();
}

function gpaPerformanceLabel(gpa) {
  if (gpa >= 9.5) return '🏆 Outstanding';
  if (gpa >= 9.0) return '⭐ Excellent';
  if (gpa >= 8.0) return '✅ Very Good';
  if (gpa >= 7.0) return '👍 Good';
  if (gpa >= 6.0) return '📈 Average';
  return '⚠️ Needs Improvement';
}

function resetGPA() {
  document.getElementById('courses').innerHTML = '';
  courseCount = 0;
  document.getElementById('gpaResult').classList.add('hidden');
  document.getElementById('gpaError').classList.add('hidden');
  // Add fresh rows
  for (let i = 0; i < 8; i++) addCourseRow();
  localStorage.removeItem('vitcalc_gpa');
}

/* ════════════════════════════════════════════════════════════
   7. CGPA CALCULATOR
   ════════════════════════════════════════════════════════════ */

function calculateCGPA() {
  const prevCgpa = parseFloat(document.getElementById('prevCgpa').value);
  const prevCredits = parseFloat(document.getElementById('prevCredits').value);
  const currentGpa = parseFloat(document.getElementById('currentGpa').value);
  const currentCredits = parseFloat(document.getElementById('currentCredits').value);

  const errorEl = document.getElementById('cgpaError');
  const resultEl = document.getElementById('cgpaResult');

  // Validation
  if ([prevCgpa, prevCredits, currentGpa, currentCredits].some(isNaN)) {
    showError(errorEl, 'Please fill in all four fields with valid numbers.');
    resultEl.classList.add('hidden');
    return;
  }
  if (prevCgpa < 0 || prevCgpa > 10) { showError(errorEl, 'Previous CGPA must be between 0 and 10.'); return; }
  if (currentGpa < 0 || currentGpa > 10) { showError(errorEl, 'Current GPA must be between 0 and 10.'); return; }
  if (prevCredits < 0 || prevCredits > 500) { showError(errorEl, 'Previous credits seem out of range.'); return; }
  if (currentCredits < 1 || currentCredits > 60) { showError(errorEl, 'Current semester credits seem out of range.'); return; }

  errorEl.classList.add('hidden');

  const totalCredits = prevCredits + currentCredits;
  const totalPoints = (prevCgpa * prevCredits) + (currentGpa * currentCredits);
  const cgpa = totalPoints / totalCredits;
  const classification = cgpaClassification(cgpa);

  document.getElementById('cgpaValue').textContent = cgpa.toFixed(2);
  document.getElementById('cgpaTotalCredits').textContent = totalCredits.toFixed(0);
  document.getElementById('cgpaTotalPoints').textContent = totalPoints.toFixed(1);
  document.getElementById('cgpaClass').textContent = classification;

  resultEl.classList.remove('hidden');
  animateRing('cgpaRingFill', cgpa, 10);

  // Target CGPA planner
  const targetCgpa = parseFloat(document.getElementById('targetCgpa').value);
  const semsRemaining = parseFloat(document.getElementById('semsRemaining').value);
  const avgCreditsPerSem = parseFloat(document.getElementById('avgCreditsPerSem').value);
  const plannerResult = document.getElementById('plannerResult');
  const plannerText = document.getElementById('plannerText');

  if (!isNaN(targetCgpa) && !isNaN(semsRemaining) && !isNaN(avgCreditsPerSem) && semsRemaining > 0 && avgCreditsPerSem > 0) {
    const futureCredits = semsRemaining * avgCreditsPerSem;
    const totalFutureCredits = totalCredits + futureCredits;
    const requiredTotalPoints = targetCgpa * totalFutureCredits;
    const requiredFuturePoints = requiredTotalPoints - totalPoints;
    const requiredGPA = requiredFuturePoints / futureCredits;

    plannerResult.classList.remove('hidden');

    if (requiredGPA > 10) {
      plannerText.textContent = `To reach a CGPA of ${targetCgpa.toFixed(2)}, you would need a GPA of ${requiredGPA.toFixed(2)} across the remaining ${semsRemaining} semester(s) — which exceeds the maximum of 10. Consider revising your target CGPA.`;
    } else if (requiredGPA < 0) {
      plannerText.textContent = `Great news! Your current CGPA already exceeds your target of ${targetCgpa.toFixed(2)}. Keep it up! 🎉`;
    } else {
      plannerText.textContent = `To achieve a CGPA of ${targetCgpa.toFixed(2)}, you need to maintain an average GPA of ${requiredGPA.toFixed(2)} across your remaining ${semsRemaining} semester(s) (${futureCredits} total credits).`;
    }
  } else {
    plannerResult.classList.add('hidden');
  }

  if (cgpa >= 9) launchConfetti();
  saveCGPAData();
}

function cgpaClassification(cgpa) {
  if (cgpa >= 9.0) return 'Chancellor\'s List 🏆';
  if (cgpa >= 8.5) return 'First Class with Distinction ⭐';
  if (cgpa >= 7.5) return 'First Class ✅';
  if (cgpa >= 6.5) return 'Second Class 📘';
  if (cgpa >= 5.5) return 'Third Class 📄';
  return 'Below Standard ⚠️';
}

function resetCGPA() {
  ['prevCgpa', 'prevCredits', 'currentGpa', 'currentCredits', 'targetCgpa', 'semsRemaining', 'avgCreditsPerSem']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('cgpaResult').classList.add('hidden');
  document.getElementById('cgpaError').classList.add('hidden');
  document.getElementById('plannerResult').classList.add('hidden');
  localStorage.removeItem('vitcalc_cgpa');
}

/* ════════════════════════════════════════════════════════════
   8. ATTENDANCE CALCULATOR
   ════════════════════════════════════════════════════════════ */

let subjectCount = 0;

function addSubject(data = {}) {
  const id = ++subjectCount;
  const list = document.getElementById('subjectList');

  const row = document.createElement('div');
  row.className = 'subject-row';
  row.dataset.subId = id;

  row.innerHTML = `
    <input type="text" class="subj-name" placeholder="Subject name (optional)" value="${data.name || ''}" />
    <input type="number" class="subj-total" placeholder="Total" min="0" value="${data.total || ''}" />
    <input type="number" class="subj-attended" placeholder="Attended" min="0" value="${data.attended || ''}" />
    <input type="number" class="subj-min" placeholder="Min %" min="0" max="100" value="${data.min || 75}" />
    <button class="row-del" onclick="removeSubject(this)" title="Remove">
      <i class="fas fa-times"></i>
    </button>`;

  list.appendChild(row);
  saveAttendanceData();
}

function removeSubject(btn) {
  const row = btn.closest('.subject-row');
  row.style.transition = 'opacity 0.2s';
  row.style.opacity = '0';
  setTimeout(() => { row.remove(); saveAttendanceData(); }, 220);
}

function calculateAttendance() {
  const total = parseFloat(document.getElementById('totalClasses').value);
  const attended = parseFloat(document.getElementById('attendedClasses').value);
  const minPct = parseFloat(document.getElementById('minAttendance').value) || 75;

  const errorEl = document.getElementById('attError');
  const resultEl = document.getElementById('attResult');
  resultEl.innerHTML = '';
  errorEl.classList.add('hidden');

  let hasOverall = false;

  // Overall attendance block
  if (!isNaN(total) && !isNaN(attended)) {
    if (attended > total) { showError(errorEl, 'Classes attended cannot exceed total classes held.'); return; }
    if (total <= 0) { showError(errorEl, 'Total classes must be greater than 0.'); return; }

    hasOverall = true;
    const pct = (attended / total) * 100;
    const status = pct >= minPct ? 'safe' : pct >= minPct - 10 ? 'warn' : 'danger';
    const emoji = status === 'safe' ? '✅' : status === 'warn' ? '⚠️' : '❌';

    let advisoryHTML = '';
    let advisoryClass = '';
    if (pct >= minPct) {
      // Can miss N more classes
      // attended/(total+x) >= minPct/100 → attended - minPct*total/100 >= minPct*x/100
      // x <= (attended - minPct*total/100) * 100/minPct
      const canMiss = Math.floor((attended - (minPct / 100) * total) / (minPct / 100));
      advisoryClass = 'can-miss';
      advisoryHTML = `<i class="fas fa-check-circle" style="color:var(--green);margin-right:8px;"></i>You can afford to miss <strong>${canMiss}</strong> more class${canMiss !== 1 ? 'es' : ''} and still meet the ${minPct}% requirement.`;
    } else {
      // Must attend N more
      // (attended + x)/(total + x) >= minPct/100
      // attended + x >= minPct*(total+x)/100
      // 100*attended + 100x >= minPct*total + minPct*x
      // x(100 - minPct) >= minPct*total - 100*attended
      const mustAttend = Math.ceil((minPct * total - 100 * attended) / (100 - minPct));
      advisoryClass = 'must-attend';
      advisoryHTML = `<i class="fas fa-exclamation-triangle" style="color:var(--red);margin-right:8px;"></i>You must attend the next <strong>${mustAttend}</strong> consecutive class${mustAttend !== 1 ? 'es' : ''} to reach ${minPct}% attendance.`;
    }

    resultEl.innerHTML += `
      <div class="att-overall-card ${status}">
        <div class="att-icon">${emoji}</div>
        <div class="att-info" style="flex:1">
          <h4>${pct.toFixed(1)}% Attendance</h4>
          <p>${attended} of ${total} classes attended</p>
          <div class="att-progress">
            <div class="att-progress-bar" style="width:0%;background:${status === 'safe' ? 'var(--green)' : status === 'warn' ? 'var(--yellow)' : 'var(--red)'};" id="overallBar"></div>
          </div>
        </div>
      </div>
      <div class="att-advisory ${advisoryClass}">${advisoryHTML}</div>`;

    // Animate progress bar
    setTimeout(() => {
      const bar = document.getElementById('overallBar');
      if (bar) bar.style.width = Math.min(pct, 100) + '%';
    }, 100);
  }

  // Subject-wise
  const subjectRows = document.querySelectorAll('#subjectList .subject-row');
  const subResults = [];

  subjectRows.forEach(row => {
    const name = row.querySelector('.subj-name').value.trim() || 'Subject';
    const tot = parseFloat(row.querySelector('.subj-total').value);
    const att = parseFloat(row.querySelector('.subj-attended').value);
    const mn = parseFloat(row.querySelector('.subj-min').value) || 75;

    if (!isNaN(tot) && !isNaN(att) && tot > 0 && att <= tot) {
      const pct = (att / tot) * 100;
      const st = pct >= mn ? 'safe' : pct >= mn - 10 ? 'warn' : 'danger';
      let note = '';
      if (pct >= mn) {
        const canMiss = Math.floor((att - (mn / 100) * tot) / (mn / 100));
        note = `Can miss ${canMiss} more`;
      } else {
        const mustAtt = Math.ceil((mn * tot - 100 * att) / (100 - mn));
        note = `Must attend ${mustAtt} more`;
      }
      subResults.push({ name, pct, st, note });
    }
  });

  if (subResults.length > 0) {
    let subHTML = '<div class="att-section-label" style="margin-top:8px;"><i class="fas fa-book-open"></i> Subject-wise Summary</div><div class="subject-cards">';
    subResults.forEach(s => {
      subHTML += `
        <div class="sub-result-card ${s.st}">
          <div class="sub-name">${escHtml(s.name)}</div>
          <div class="sub-pct ${s.st}">${s.pct.toFixed(1)}%</div>
          <div class="sub-note">${s.note}</div>
        </div>`;
    });
    subHTML += '</div>';
    resultEl.innerHTML += subHTML;
  }

  if (!hasOverall && subResults.length === 0) {
    showError(errorEl, 'Please enter overall attendance data or at least one subject with valid numbers.');
    return;
  }

  resultEl.classList.remove('hidden');
  saveAttendanceData();
}

function resetAttendance() {
  document.getElementById('totalClasses').value = '';
  document.getElementById('attendedClasses').value = '';
  document.getElementById('minAttendance').value = '75';
  document.getElementById('subjectList').innerHTML = '';
  subjectCount = 0;
  document.getElementById('attResult').classList.add('hidden');
  document.getElementById('attResult').innerHTML = '';
  document.getElementById('attError').classList.add('hidden');
  localStorage.removeItem('vitcalc_att');
}

/* ════════════════════════════════════════════════════════════
   9. LOCAL STORAGE
   ════════════════════════════════════════════════════════════ */

function saveGPAData() {
  const rows = document.querySelectorAll('#courses .course-row');
  const data = Array.from(rows).map(r => ({
    category: r.querySelector('.category').value,
    grade: r.querySelector('.grade').value,
    credits: r.querySelector('.credits').value,
  }));
  localStorage.setItem('vitcalc_gpa', JSON.stringify(data));
}

function saveCGPAData() {
  const ids = ['prevCgpa', 'prevCredits', 'currentGpa', 'currentCredits', 'targetCgpa', 'semsRemaining', 'avgCreditsPerSem'];
  const data = {};
  ids.forEach(id => { data[id] = document.getElementById(id).value; });
  localStorage.setItem('vitcalc_cgpa', JSON.stringify(data));
}

function saveAttendanceData() {
  const overall = {
    total: document.getElementById('totalClasses').value,
    attended: document.getElementById('attendedClasses').value,
    min: document.getElementById('minAttendance').value,
  };
  const subjects = Array.from(document.querySelectorAll('#subjectList .subject-row')).map(r => ({
    name: r.querySelector('.subj-name').value,
    total: r.querySelector('.subj-total').value,
    attended: r.querySelector('.subj-attended').value,
    min: r.querySelector('.subj-min').value,
  }));
  localStorage.setItem('vitcalc_att', JSON.stringify({ overall, subjects }));
}

function loadSavedData() {
  // GPA
  const savedGPA = JSON.parse(localStorage.getItem('vitcalc_gpa') || 'null');
  if (savedGPA && savedGPA.length > 0) {
    savedGPA.forEach(d => addCourseRow(d));
  } else {
    for (let i = 0; i < 8; i++) addCourseRow();
  }

  // CGPA
  const savedCGPA = JSON.parse(localStorage.getItem('vitcalc_cgpa') || 'null');
  if (savedCGPA) {
    Object.entries(savedCGPA).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
  }

  // Attendance
  const savedAtt = JSON.parse(localStorage.getItem('vitcalc_att') || 'null');
  if (savedAtt) {
    if (savedAtt.overall) {
      document.getElementById('totalClasses').value = savedAtt.overall.total || '';
      document.getElementById('attendedClasses').value = savedAtt.overall.attended || '';
      document.getElementById('minAttendance').value = savedAtt.overall.min || '75';
    }
    if (savedAtt.subjects && savedAtt.subjects.length > 0) {
      savedAtt.subjects.forEach(s => addSubject(s));
    }
  }
}

// Auto-save on input change
document.addEventListener('input', () => {
  // Debounce via requestIdleCallback
  if (window.requestIdleCallback) {
    requestIdleCallback(() => { saveGPAData(); saveCGPAData(); saveAttendanceData(); });
  } else {
    setTimeout(() => { saveGPAData(); saveCGPAData(); saveAttendanceData(); }, 300);
  }
});

/* ════════════════════════════════════════════════════════════
   10. CONFETTI
   ════════════════════════════════════════════════════════════ */

function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colours = ['#6c63ff', '#3ecfcf', '#f43f5e', '#f59e0b', '#22c55e', '#818cf8'];
  const total = 140;

  for (let i = 0; i < total; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -200 - 10,
      w: 8 + Math.random() * 8,
      h: 6 + Math.random() * 6,
      color: colours[Math.floor(Math.random() * colours.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.15,
      opacity: 1,
    });
  }

  let frame;
  let ticks = 0;
  const maxTicks = 160;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();

      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.vy += 0.08; // gravity
      if (ticks > maxTicks * 0.6) p.opacity -= 0.015;
    });

    ticks++;
    if (ticks < maxTicks) {
      frame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  cancelAnimationFrame(frame);
  draw();
}

/* ════════════════════════════════════════════════════════════
   11. UTILITY
   ════════════════════════════════════════════════════════════ */

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'section-in 0.3s ease both';
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ════════════════════════════════════════════════════════════
   12. INIT
   ════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  loadSavedData();
});

// Navbar shadow on scroll
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  nav.style.boxShadow = window.scrollY > 10
    ? '0 4px 24px rgba(0,0,0,0.12)'
    : 'var(--shadow-sm)';
});

// Resize confetti canvas
window.addEventListener('resize', () => {
  const canvas = document.getElementById('confettiCanvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

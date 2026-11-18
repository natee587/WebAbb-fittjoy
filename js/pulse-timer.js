/**
 * FitEasy - Pulse Timer & Counter Tool
 * เครื่องมือจับเวลานับชีพจร 60 วินาที และ 15 วินาที x 4 พร้อมเสียงสัญญาณ
 */

class PulseTimer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      defaultMode: 60, // 60 หรือ 15
      onComplete: null,
      ...options
    };

    this.mode = this.options.defaultMode; // 60 หรือ 15
    this.timeLeft = this.mode;
    this.totalTime = this.mode;
    this.timerInterval = null;
    this.isRunning = false;

    // สถานะสำหรับตัวจับเวลาการพูด (Talk Stopwatch)
    this.talkSeconds = 0;
    this.talkTimerInterval = null;
    this.isTalkRunning = false;

    this.render();
  }

  setMode(mode) {
    if (this.isRunning) this.stop();
    if (this.isTalkRunning) this.stopTalkTimer();
    this.mode = mode;

    const clockView = this.container.querySelector(`#pulse-clock-view-${this.container.id}`);
    const talkView = this.container.querySelector(`#talk-test-view-${this.container.id}`);

    if (mode === "talk") {
      if (clockView) clockView.style.display = "none";
      if (talkView) talkView.style.display = "block";
    } else {
      if (clockView) clockView.style.display = "block";
      if (talkView) talkView.style.display = "none";
      this.totalTime = mode;
      this.timeLeft = mode;
      this.updateDisplay();
    }

    // ซ่อนผลการประเมินรอบเก่าเมื่อสลับโหมด
    const resultBox = this.container.querySelector(`#calc-result-box-${this.container.id}`);
    if (resultBox) resultBox.style.display = "none";
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="pulse-timer-card">
        <div class="timer-mode-switcher">
          <button type="button" class="mode-pill ${this.mode === 60 ? 'active' : ''}" data-mode="60">
            เต็ม 60 วิ
          </button>
          <button type="button" class="mode-pill ${this.mode === 15 ? 'active' : ''}" data-mode="15">
            ด่วน 15 วิ (x4)
          </button>
          <button type="button" class="mode-pill ${this.mode === 'talk' ? 'active' : ''}" data-mode="talk">
            🗣️ ทดสอบการพูด
          </button>
        </div>

        <!-- 1. หน้าจอโหมดจับเวลานับชีพจร (60 วินาที และ 15 วินาที x 4) -->
        <div class="pulse-clock-view" id="pulse-clock-view-${this.container.id}" style="${this.mode === 'talk' ? 'display: none;' : ''}">
          <div class="timer-dial-wrapper">
            <svg class="timer-dial-svg" viewBox="0 0 160 160">
              <circle class="timer-track" cx="80" cy="80" r="70" />
              <circle class="timer-progress" id="timer-progress-circle-${this.container.id}" cx="80" cy="80" r="70" />
            </svg>
            <div class="timer-dial-content">
              <div class="pulsing-heart ${this.isRunning ? 'beating' : ''}" id="pulse-heart-icon-${this.container.id}">
                ❤️
              </div>
              <div class="timer-seconds" id="timer-seconds-text-${this.container.id}">${this.timeLeft}</div>
              <div class="timer-label">วินาที</div>
            </div>
          </div>

          <div class="timer-actions">
            <button type="button" class="btn-timer-primary" id="btn-start-${this.container.id}">
              ${this.isRunning ? '⏸ หยุดชั่วคราว' : '▶ เริ่มจับเวลา'}
            </button>
            <button type="button" class="btn-timer-secondary" id="btn-reset-${this.container.id}">
              รีเซ็ต
            </button>
          </div>

          <div class="timer-input-section" id="timer-input-box-${this.container.id}">
            <label class="timer-input-label" id="timer-input-label-${this.container.id}">
              ${this.mode === 60 ? 'จำนวนครั้งชีพจร (60 วินาที):' : 'จำนวนครั้งชีพจร (15 วินาที):'}
            </label>
            <div class="timer-input-row">
              <input type="number" class="input-pulse" id="input-pulse-count-${this.container.id}" placeholder="${this.mode === 60 ? 'เช่น 72' : 'เช่น 18'}" min="${this.mode === 60 ? '30' : '8'}" max="${this.mode === 60 ? '220' : '60'}" />
              <button type="button" class="btn-calc-pulse" id="btn-calc-${this.container.id}">ประเมินผล</button>
            </div>
            <div class="calc-result-box" id="calc-result-box-${this.container.id}" style="display: none;"></div>
          </div>
        </div>

        <!-- 2. หน้าจอโหมดประเมินด้วยการพูด (Talk Test View) -->
        <div class="talk-test-view" id="talk-test-view-${this.container.id}" style="${this.mode === 'talk' ? '' : 'display: none;'}">
          <div class="talk-test-header-card">
            <div class="talk-badge-pill">🗣️ การทดสอบการพูดขณะออกกำลังกาย (Talk Test)</div>
            <h4 class="talk-title">จับเวลาการพูด & ประเมินระดับความเหนื่อย</h4>
            <p class="talk-subtitle">
              กดปุ่มเริ่มจับเวลา 3 วินาที แล้วลองพูดประโยคทดสอบ เมื่อครบเวลาระบบจะมีป็อบอัพให้เลือกระดับความรู้สึกและประเมินผลตามเกณฑ์ช่วงอายุให้ทันที
            </p>
          </div>

          <!-- การ์ดตัวจับเวลาการพูด (Talk Stopwatch) -->
          <div class="talk-stopwatch-card">
            <div class="talk-stopwatch-display">
              <div class="talk-mic-indicator" id="talk-mic-icon-${this.container.id}">🎙️</div>
              <div class="talk-stopwatch-time">
                <span class="talk-time-number" id="talk-timer-num-${this.container.id}">0</span>
                <span class="talk-time-unit">วินาที</span>
              </div>
              <div class="talk-stopwatch-status" id="talk-timer-status-${this.container.id}">พร้อมเริ่มจับเวลาพูด (3 วินาที)</div>
            </div>

            <!-- กล่องประโยคทดสอบที่ต้องพูด (วางเด่นชัดเหนือปุ่มจับเวลา) -->
            <div class="talk-prompt-highlight-box">
              <div class="prompt-box-header">
                <span class="prompt-header-icon">💬</span>
                <strong>ประโยคที่ต้องลองพูดขณะออกกำลังกาย:</strong>
              </div>
              <div class="prompt-box-subtext">
                💡 ลองพูดประโยคสั้นๆ 1 ประโยค ขณะที่ระบบกำลังจับเวลา 3 วินาที
              </div>
            </div>

            <div class="talk-stopwatch-actions">
              <button type="button" class="btn-talk-timer-toggle" id="btn-talk-toggle-${this.container.id}">
                ▶ เริ่มจับเวลาพูด (3 วินาที)
              </button>
              <button type="button" class="btn-timer-secondary" id="btn-talk-reset-${this.container.id}">
                รีเซ็ต
              </button>
            </div>
          </div>

          <div class="talk-level-list-label">
            <span>📋 เกณฑ์ระดับความเหนื่อยและตัวอย่างประโยคสำหรับศึกษา:</span>
          </div>

          <div class="talk-level-list">
            <!-- 1. ระดับเบา -->
            <div class="talk-card card-light" data-level="light">
              <div class="talk-card-top">
                <div class="talk-card-title-wrap">
                  <span class="talk-color-dot dot-light"></span>
                  <strong class="talk-card-title">ระดับเบา</strong>
                </div>
                <span class="talk-chip chip-light">🎵 พูดต่อเนื่อง / ร้องเพลงได้</span>
              </div>
              <div class="talk-card-desc">
                สามารถพูดได้อย่างสบาย โดยพูดได้นานเกิน 10 วินาที หรือสามารถร้องเพลงได้
              </div>
              <div class="talk-indicator-tag">
                <span>ความรู้สึก:</span> หายใจสบายเหมือนปกติ ไม่รู้สึกเหนื่อยหอบ
              </div>
            </div>

            <!-- 2. ระดับปานกลาง (เป้าหมายแนะนำ) -->
            <div class="talk-card card-moderate" data-level="moderate">
              <div class="talk-card-top">
                <div class="talk-card-title-wrap">
                  <span class="talk-color-dot dot-moderate"></span>
                  <strong class="talk-card-title">ระดับปานกลาง</strong>
                </div>
                <span class="talk-chip chip-target">⭐ เป้าหมายเพื่อสุขภาพแนะนำ</span>
              </div>
              <div class="talk-card-desc">
                รู้สึกเหนื่อยและหายใจเร็วขึ้น แต่ยังสามารถพูดประโยคสั้นๆ ที่ใช้เวลาประมาณ 2-3 วินาทีได้
              </div>
              <div class="talk-speech-test-box">
                <span class="speech-test-label">💬 ตัวอย่างประโยคทดสอบพูด:</span>
                <div class="speech-quote-items">
                  <span class="quote-pill">“วันนี้อยากไปเที่ยววัดไหม”</span>
                  <span class="quote-pill">“วันนี้อยากไปดูหนังไหม”</span>
                </div>
              </div>
            </div>

            <!-- 3. ระดับหนัก -->
            <div class="talk-card card-heavy" data-level="heavy">
              <div class="talk-card-top">
                <div class="talk-card-title-wrap">
                  <span class="talk-color-dot dot-heavy"></span>
                  <strong class="talk-card-title">ระดับหนัก</strong>
                </div>
                <span class="talk-chip chip-heavy">⚠️ พูดเป็นคำๆ ต้องหยุดหายใจ</span>
              </div>
              <div class="talk-card-desc">
                รู้สึกเหนื่อยมาก หายใจแรง และพูดเป็นคำๆ ต้องหยุดพักหายใจระหว่างพูด
              </div>
              <div class="talk-indicator-tag warning">
                <span>ความรู้สึก:</span> หายใจหอบเร็ว ไม่สามารถพูดจบประโยคได้โดยไม่พักหายใจ
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
    if (this.mode !== "talk") {
      this.updateDisplay();
    }
  }

  bindEvents() {
    // Mode Switcher (60 วินาที / 15 วินาที / ประเมินด้วยการพูด)
    const pills = this.container.querySelectorAll(".mode-pill");
    pills.forEach(p => {
      p.addEventListener("click", () => {
        pills.forEach(x => x.classList.remove("active"));
        p.classList.add("active");
        const modeVal = p.dataset.mode === "talk" ? "talk" : Number(p.dataset.mode);
        this.setMode(modeVal);
      });
    });

    // Start / Pause
    const btnStart = this.container.querySelector(`#btn-start-${this.container.id}`);
    if (btnStart) {
      btnStart.addEventListener("click", () => {
        if (this.isRunning) {
          this.pause();
        } else {
          this.start();
        }
      });
    }

    // Reset
    const btnReset = this.container.querySelector(`#btn-reset-${this.container.id}`);
    if (btnReset) {
      btnReset.addEventListener("click", () => this.reset());
    }

    // Calc button
    const btnCalc = this.container.querySelector(`#btn-calc-${this.container.id}`);
    if (btnCalc) {
      btnCalc.addEventListener("click", () => this.evaluateInput());
    }

    // Talk Stopwatch Controls (ปุ่มเริ่ม/หยุด และรีเซ็ตตัวจับเวลาพูด 3 วินาที)
    const btnTalkToggle = this.container.querySelector(`#btn-talk-toggle-${this.container.id}`);
    const btnTalkReset = this.container.querySelector(`#btn-talk-reset-${this.container.id}`);

    if (btnTalkToggle) {
      btnTalkToggle.addEventListener("click", () => {
        if (!this.isTalkRunning) {
          this.startTalkTimer();
        }
      });
    }

    if (btnTalkReset) {
      btnTalkReset.addEventListener("click", () => this.resetTalkTimer());
    }
  }

  start() {
    audioCues.initContext();
    this.isRunning = true;
    const btnStart = this.container.querySelector(`#btn-start-${this.container.id}`);
    if (btnStart) btnStart.textContent = "⏸ หยุดชั่วคราว";

    const heart = this.container.querySelector(`#pulse-heart-icon-${this.container.id}`);
    if (heart) heart.classList.add("beating");

    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      audioCues.playPulseBeep();
      this.updateDisplay();

      if (this.timeLeft <= 0) {
        this.complete();
      }
    }, 1000);
  }

  pause() {
    this.isRunning = false;
    clearInterval(this.timerInterval);
    const btnStart = this.container.querySelector(`#btn-start-${this.container.id}`);
    if (btnStart) btnStart.textContent = "▶ ทำต่อ";
    const heart = this.container.querySelector(`#pulse-heart-icon-${this.container.id}`);
    if (heart) heart.classList.remove("beating");
  }

  stop() {
    this.pause();
  }

  reset() {
    this.pause();
    this.timeLeft = this.totalTime;
    const btnStart = this.container.querySelector(`#btn-start-${this.container.id}`);
    if (btnStart) btnStart.textContent = "▶ เริ่มจับเวลา";
    this.updateDisplay();
  }

  complete() {
    this.pause();
    this.timeLeft = 0;
    this.updateDisplay();
    audioCues.playTimerDone();

    const resultInput = this.container.querySelector(`#input-pulse-count-${this.container.id}`);
    if (resultInput) resultInput.focus();

    if (this.options.onComplete) {
      this.options.onComplete();
    }
  }

  updateDisplay() {
    const text = this.container.querySelector(`#timer-seconds-text-${this.container.id}`);
    if (text) text.textContent = this.timeLeft;

    // SVG Circular progress
    const circle = this.container.querySelector(`#timer-progress-circle-${this.container.id}`);
    if (circle) {
      const radius = 70;
      const circumference = 2 * Math.PI * radius;
      const fraction = this.timeLeft / this.totalTime;
      const offset = circumference * (1 - fraction);
      circle.style.strokeDasharray = `${circumference} ${circumference}`;
      circle.style.strokeDashoffset = offset;
    }

    // อัปเดต Label และ Placeholder เมื่อสลับโหมด 60 วินาที หรือ 15 วินาที
    const label = this.container.querySelector(`#timer-input-label-${this.container.id}`) || this.container.querySelector(".timer-input-label");
    const input = this.container.querySelector(`#input-pulse-count-${this.container.id}`);
    if (label) {
      label.textContent = this.mode === 60 ? "จำนวนครั้งชีพจร (60 วินาที):" : "จำนวนครั้งชีพจร (15 วินาที):";
    }
    if (input) {
      input.placeholder = this.mode === 60 ? "เช่น 72" : "เช่น 18";
      input.min = this.mode === 60 ? "30" : "8";
      input.max = this.mode === 60 ? "220" : "60";
    }
  }

  evaluateInput() {
    const input = this.container.querySelector(`#input-pulse-count-${this.container.id}`);
    const resultBox = this.container.querySelector(`#calc-result-box-${this.container.id}`);
    if (!input || !resultBox) return;

    let count = Number(input.value);
    if (!count || count <= 0) {
      alert("กรุณากรอกตัวเลขชีพจรที่นับได้ครับ");
      return;
    }

    // ถ้าเป็นโหมด 15 วิ ให้คูณ 4
    let bpm = this.mode === 15 ? count * 4 : count;

    // หากอยู่ในหน้าต่าง Post Workout Modal ให้เชื่อมข้อมูลชีพจรไปยังช่องกรอกผลลัพธ์
    const modalInp = document.getElementById("modal-post-hr-input");
    if (modalInp) {
      modalInp.value = bpm;
      if (window.postWorkoutModal && typeof window.postWorkoutModal.evaluateResult === "function") {
        window.postWorkoutModal.evaluateResult(bpm);
      }
    }

    // นำกลุ่มวัยของผู้ใช้ปัจจุบันมาประเมิน
    const ageGroup = userStore.profile.ageGroup || "adult";
    const criteria = AGE_CRITERIA[ageGroup] || AGE_CRITERIA.adult;

    let statusText = "";
    let badgeClass = "";
    let advice = "";

    if (ageGroup === "youth") {
      // เด็ก 6-17: 120-150 bpm
      if (bpm < 120) {
        statusText = "ระดับเบา (ต่ำกว่าเป้าหมายวัยรุ่น 120-150 bpm)";
        badgeClass = "badge-info";
        advice = "สามารถเพิ่มความเร็วและความต่อเนื่องเพื่อให้หัวใจทำงานในระดับปานกลาง-หนักได้อย่างสมวัย";
      } else if (bpm <= 150) {
        statusText = "อยู่ในเกณฑ์ยอดเยี่ยม (120 - 150 bpm)";
        badgeClass = "badge-success";
        advice = "ยอดเยี่ยมมาก! หัวใจเต้นอยู่ในช่วงเหมาะสม ช่วยเสริมสร้างการเจริญเติบโตและความฟิต";
      } else {
        statusText = "ระดับสูงกว่าเกณฑ์ (ควรพัก)";
        badgeClass = "badge-warning";
        advice = "หัวใจเต้นเร็วมาก ควรชะลอความเร็ว ดื่มน้ำ และพักผ่อนให้หายเหนื่อย";
      }
    } else if (ageGroup === "adult") {
      // 18-64: ปานกลาง (105-135 bpm)
      if (bpm < 105) {
        statusText = "ระดับเบา (ต่ำกว่าช่วงปานกลาง 105-135 bpm)";
        badgeClass = "badge-info";
        advice = "หากสุขภาพแข็งแรง สามารถขยับให้กระฉับกระเฉงขึ้นอีกนิดเพื่อผลดีต่อการป้องกันโรค NCDs";
      } else if (bpm <= 135) {
        statusText = "อยู่ในเกณฑ์ระดับปานกลางที่ยอดเยี่ยม!";
        badgeClass = "badge-success";
        advice = "ระดับความหนักปานกลางพอดี ช่วยเผาผลาญไขมัน ลดความดัน และน้ำตาลในเลือดได้อย่างมีประสิทธิภาพ";
      } else {
        statusText = "ระดับหนักมาก (ควรระวัง)";
        badgeClass = "badge-warning";
        advice = "ควรผ่อนความหนักลง เดินช้าๆ เพื่อคูลดาวน์ และจิบน้ำ ไม่ควรหักโหม";
      }
    } else {
      // 65 ปีขึ้นไป: ระดับเบาๆ (85-115 bpm)
      if (bpm < 85) {
        statusText = "ระดับเบามาก / ปกติขณะพัก";
        badgeClass = "badge-info";
        advice = "ออกกำลังกายขยับกายเบาๆ เพื่อให้ข้อต่อและกล้ามเนื้อได้ทำงานอย่างสม่ำเสมอ";
      } else if (bpm <= 115) {
        statusText = "อยู่ในเกณฑ์ระดับเบาที่ปลอดภัยมาก!";
        badgeClass = "badge-success";
        advice = "ยอดเยี่ยมและปลอดภัยสำหรับผู้สูงอายุ ช่วยให้ระบบไหลเวียนโลหิตดีโดยไม่เป็นอันตรายต่อหัวใจ";
      } else {
        statusText = "ค่อนข้างเร็วสำหรับผู้สูงอายุ (ควรหยุดพัก)";
        badgeClass = "badge-warning";
        advice = "ควรหยุดพักนั่งบนเก้าอี้ทันที หายใจเข้าออกลึกๆ ช้าๆ หากมีอาการแน่นหน้าอกให้รีบแจ้ง อสม. หรือญาติ";
      }
    }

    resultBox.style.display = "block";
    resultBox.innerHTML = `
      <div class="result-card ${badgeClass}">
        <div class="result-bpm-val">อัตราชีพจร: <strong>${bpm} ครั้ง/นาที (BPM)</strong> ${this.mode === 15 ? `<span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">(คำนวณจาก ${count} ครั้ง × 4)</span>` : ''}</div>
        <div class="result-status-badge">${statusText}</div>
        <p class="result-advice">${advice}</p>
        <div class="result-age-group">เกณฑ์สำหรับ: ${criteria.label} (${criteria.recommendation})</div>
        <button type="button" class="btn-timer-secondary" id="btn-practice-again-${this.container.id}" style="margin-top: 14px; width: 100%; padding: 11px 16px; border-radius: var(--radius-md); font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
          🔄 ฝึกวัดใหม่อีกครั้ง
        </button>
      </div>
    `;

    // ผูกปุ่มฝึกวัดใหม่อีกครั้ง
    const btnAgain = resultBox.querySelector(`#btn-practice-again-${this.container.id}`);
    if (btnAgain) {
      btnAgain.addEventListener("click", () => {
        this.reset();
        if (input) {
          input.value = "";
          input.focus();
        }
        resultBox.style.display = "none";
      });
    }

    // เลื่อนหน้าจออย่างนุ่มนวลให้เห็นกล่องผลลัพธ์ครบถ้วนโดยไม่กระตุกเด้ง
    setTimeout(() => {
      resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  }

  // เริ่มจับเวลาการพูด 3 วินาที แล้วหยุดอัตโนมัติ (3-Second Talk Stopwatch)
  startTalkTimer() {
    if (this.isTalkRunning) return;
    audioCues.initContext();
    this.isTalkRunning = true;
    this.talkSeconds = 0;

    const btn = this.container.querySelector(`#btn-talk-toggle-${this.container.id}`);
    const mic = this.container.querySelector(`#talk-mic-icon-${this.container.id}`);
    const status = this.container.querySelector(`#talk-timer-status-${this.container.id}`);
    const numEl = this.container.querySelector(`#talk-timer-num-${this.container.id}`);

    if (numEl) numEl.textContent = "0";
    if (btn) {
      btn.innerHTML = "⏳ กำลังจับเวลา (3 วินาที)...";
      btn.classList.add("is-running");
      btn.disabled = true;
    }
    if (mic) mic.classList.add("recording");
    if (status) status.innerHTML = "🎙️ กำลังจับเวลา: <strong>0 / 3 วินาที</strong> (เริ่มพูดประโยคทดสอบ)...";

    audioCues.playPulseBeep();

    this.talkTimerInterval = setInterval(() => {
      this.talkSeconds++;
      if (numEl) numEl.textContent = this.talkSeconds;
      audioCues.playPulseBeep();

      if (status) {
        status.innerHTML = `🎙️ กำลังจับเวลา: <strong>${this.talkSeconds} / 3 วินาที</strong>...`;
      }

      if (this.talkSeconds >= 3) {
        clearInterval(this.talkTimerInterval);
        this.isTalkRunning = false;
        audioCues.playTimerDone();

        if (btn) {
          btn.innerHTML = "▶ เริ่มจับเวลาพูด (3 วินาที)";
          btn.classList.remove("is-running");
          btn.disabled = false;
        }
        if (mic) mic.classList.remove("recording");
        if (status) status.innerHTML = "✅ จับเวลาครบ 3 วินาทีแล้ว เรียบร้อย";

        // เปิดป๊อปอัปให้เลือกระดับความรู้สึก 3 ข้อทันที
        setTimeout(() => {
          this.showTalkQuestionnairePopup();
        }, 300);
      }
    }, 1000);
  }

  // หยุดจับเวลาการพูด
  stopTalkTimer() {
    this.isTalkRunning = false;
    clearInterval(this.talkTimerInterval);

    const btn = this.container.querySelector(`#btn-talk-toggle-${this.container.id}`);
    const mic = this.container.querySelector(`#talk-mic-icon-${this.container.id}`);
    const status = this.container.querySelector(`#talk-timer-status-${this.container.id}`);

    if (btn) {
      btn.innerHTML = "▶ เริ่มจับเวลาพูด (3 วินาที)";
      btn.classList.remove("is-running");
      btn.disabled = false;
    }
    if (mic) mic.classList.remove("recording");
    if (status) status.textContent = `หยุดเวลาที่ ${this.talkSeconds} วินาที`;
  }

  // รีเซ็ตตัวจับเวลาการพูด
  resetTalkTimer() {
    this.isTalkRunning = false;
    clearInterval(this.talkTimerInterval);
    this.talkSeconds = 0;

    const btn = this.container.querySelector(`#btn-talk-toggle-${this.container.id}`);
    const mic = this.container.querySelector(`#talk-mic-icon-${this.container.id}`);
    const numEl = this.container.querySelector(`#talk-timer-num-${this.container.id}`);
    const status = this.container.querySelector(`#talk-timer-status-${this.container.id}`);

    if (btn) {
      btn.innerHTML = "▶ เริ่มจับเวลาพูด (3 วินาที)";
      btn.classList.remove("is-running");
      btn.disabled = false;
    }
    if (mic) mic.classList.remove("recording");
    if (numEl) numEl.textContent = "0";
    if (status) status.textContent = "พร้อมเริ่มจับเวลาพูด (3 วินาที)";

    // เอาไฮไลต์ออกจากการ์ด
    const talkCards = this.container.querySelectorAll(".talk-card");
    talkCards.forEach(c => c.classList.remove("selected"));
  }

  // ขั้นตอนที่ 1: แสดงป๊อปอัปให้เลือก 1 ใน 3 อาการ
  showTalkQuestionnairePopup() {
    const modal = document.getElementById("talk-test-popup-modal");
    const titleEl = document.getElementById("talk-popup-modal-title-text") || modal?.querySelector(".talk-popup-modal-title span:last-child");
    const content = document.getElementById("talk-popup-modal-content");
    const footer = document.getElementById("talk-popup-footer");
    const btnClose = document.getElementById("btn-close-talk-popup");
    if (!modal || !content) return;

    if (titleEl) titleEl.textContent = "ประเมินความรู้สึกขณะพูด (Talk Test)";

    content.innerHTML = `
      <div class="talk-questionnaire-card">
        <div class="talk-q-header">
          <div class="talk-q-badge">⏱️ จับเวลาครบ 3 วินาทีแล้ว</div>
          <h3 class="talk-q-title">ขณะลองพูดประโยค คุณรู้สึกอย่างไร?</h3>
          <p class="talk-q-desc">แตะเลือก 1 ข้อที่ตรงกับอาการขณะออกกำลังกายของคุณที่สุด เพื่อประเมินผลตามเกณฑ์ช่วงอายุ:</p>
        </div>

        <div class="talk-q-options">
          <button type="button" class="talk-q-btn btn-choice-light" data-level="light">
            <div class="talk-q-badge-num">1</div>
            <div class="talk-q-info">
              <strong class="talk-q-name">1. พูดได้อย่างสบาย</strong>
              <div class="talk-q-sub">หายใจสบายเหมือนปกติ พูดคุยได้คล่อง หรือร้องเพลงได้ (ระดับเบา 🟢)</div>
            </div>
            <span class="talk-q-action-icon">➔</span>
          </button>

          <button type="button" class="talk-q-btn btn-choice-moderate" data-level="moderate">
            <div class="talk-q-badge-num">2</div>
            <div class="talk-q-info">
              <strong class="talk-q-name">2. รู้สึกเหนื่อยและหายใจเร็วขึ้น</strong>
              <div class="talk-q-sub">ยังสามารถพูดประโยค 2-3 วินาทีจบได้ (ระดับปานกลาง 🟡 ⭐)</div>
            </div>
            <span class="talk-q-action-icon">➔</span>
          </button>

          <button type="button" class="talk-q-btn btn-choice-heavy" data-level="heavy">
            <div class="talk-q-badge-num">3</div>
            <div class="talk-q-info">
              <strong class="talk-q-name">3. รู้สึกเหนื่อยมาก หายใจหอบ/หายใจแรง</strong>
              <div class="talk-q-sub">พูดได้เพียงเป็นคำๆ ต้องหยุดพักหายใจ (ระดับหนัก 🔴)</div>
            </div>
            <span class="talk-q-action-icon">➔</span>
          </button>
        </div>
      </div>
    `;

    // ผูกปุ่มเลือกตัวเลือก 3 ข้อ
    const qBtns = content.querySelectorAll(".talk-q-btn");
    qBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const selectedLevel = btn.dataset.level;
        audioCues.playPulseBeep();
        this.showTalkResultPopup(3, selectedLevel);
      });
    });

    if (footer) {
      footer.style.display = "block";
      footer.innerHTML = `
        <button type="button" class="btn-timer-secondary" id="btn-cancel-talk-questionnaire" style="width: 100%; padding: 12px 18px; border-radius: var(--radius-md); font-weight: 600; font-size: 14px;">
          ยกเลิก / ปิดหน้าต่าง
        </button>
      `;
      const btnCancel = footer.querySelector("#btn-cancel-talk-questionnaire");
      if (btnCancel) {
        btnCancel.addEventListener("click", () => {
          closeModal();
          this.resetTalkTimer();
        });
      }
    }

    modal.classList.add("active");
    modal.style.display = "flex";

    const closeModal = () => {
      modal.classList.remove("active");
      modal.style.display = "none";
      this.resetTalkTimer();
    };

    if (btnClose) btnClose.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  // ขั้นตอนที่ 2: แสดงป๊อปอัปผลประเมินตามเกณฑ์ช่วงอายุ
  showTalkResultPopup(seconds = 3, manualLevel = "moderate") {
    const modal = document.getElementById("talk-test-popup-modal");
    const titleEl = document.getElementById("talk-popup-modal-title-text") || modal?.querySelector(".talk-popup-modal-title span:last-child");
    const content = document.getElementById("talk-popup-modal-content");
    const footer = document.getElementById("talk-popup-footer");
    const btnClose = document.getElementById("btn-close-talk-popup");
    if (!modal || !content) return;

    if (titleEl) titleEl.textContent = "ผลการประเมินการพูด (Talk Test)";

    const level = manualLevel || "moderate";
    const age = Number(userStore.profile?.age) || 25;
    const ageKey = age <= 17 ? "youth" : (age >= 65 ? "senior" : "adult");
    const criteria = (typeof AGE_CRITERIA !== "undefined" && AGE_CRITERIA[ageKey]) ? AGE_CRITERIA[ageKey] : { recommendation: "ออกกำลังกายสม่ำเสมอ" };

    // คำนวณสถานะผ่าน / ไม่ผ่าน ตามเกณฑ์ช่วงอายุที่กำหนด:
    // • เด็กและวัยรุ่น (6 - 17 ปี): ปานกลาง หรือ หนัก = ผ่านเกณฑ์
    // • ผู้ใหญ่ (18 - 64 ปี): ปานกลาง = ผ่านเกณฑ์
    // • ผู้สูงอายุ (อายุ 65 ปีขึ้นไป): ปานกลาง = ผ่านเกณฑ์ (หากเลือกระดับเบาหรือระดับหนัก = ไม่ผ่านเกณฑ์)
    let isPassed = false;
    let ageGroupText = "";
    let passRuleText = "";

    if (age <= 17) {
      ageGroupText = "เด็กและวัยรุ่น (อายุ 6 - 17 ปี)";
      passRuleText = "ระดับปานกลาง หรือ ระดับหนัก = ผ่านเกณฑ์";
      isPassed = (level === "moderate" || level === "heavy");
    } else if (age <= 64) {
      ageGroupText = "ผู้ใหญ่ (อายุ 18 - 64 ปี)";
      passRuleText = "ระดับปานกลาง = ผ่านเกณฑ์";
      isPassed = (level === "moderate");
    } else {
      ageGroupText = "ผู้สูงอายุ (อายุ 65 ปีขึ้นไป)";
      passRuleText = "ระดับปานกลาง = ผ่านเกณฑ์";
      isPassed = (level === "moderate");
    }

    let title = "";
    let colorTheme = "";
    let criteriaDesc = "";
    let advice = "";
    let icon = "";

    if (level === "light") {
      title = "ระดับเบา (Light Intensity)";
      colorTheme = "light";
      icon = "🟢";
      criteriaDesc = "พูดได้อย่างสบาย หายใจปกติ ไม่รู้สึกเหนื่อยหอบ หรือร้องเพลงได้";
      if (age <= 17) {
        advice = "ระดับนี้ยังเบาไปสำหรับเด็กและวัยรุ่น แนะนำให้เพิ่มความเร็วหรือออกแรงเคลื่อนไหวให้กระฉับกระเฉงขึ้น เพื่อให้หัวใจเต้นในระดับปานกลางถึงหนัก (120 - 150 bpm) เสริมพัฒนาการของกระดูกและกล้ามเนื้ออย่างสมวัย";
      } else if (age <= 64) {
        advice = "ระดับนี้ยังไม่ถึงเกณฑ์เป้าหมาย เหมาะสำหรับช่วงอบอุ่นร่างกาย (Warm-up) หากต้องการเผาผลาญไขมันและป้องกันโรค NCDs ให้ขยับร่างกายให้กระฉับกระเฉงขึ้นอีกนิดจนเข้าสู่ระดับปานกลาง (พูดได้ประโยคสั้นๆ 2-3 วินาที)";
      } else {
        advice = "ระดับนี้ยังเบาเกินไป ยังไม่ถึงเกณฑ์เป้าหมายระดับปานกลางที่ช่วยบริหารหัวใจและหลอดเลือด หากร่างกายพร้อมและไม่มีข้อห้ามจากแพทย์ แนะนำให้เพิ่มความกระฉับกระเฉงขึ้นทีละน้อยจนรู้สึกเหนื่อยขึ้นเล็กน้อยและหายใจเร็วขึ้น (ระดับปานกลาง)";
      }
    } else if (level === "moderate") {
      title = "ระดับปานกลาง (Moderate Intensity)";
      colorTheme = "moderate";
      icon = "🟡";
      criteriaDesc = "รู้สึกเหนื่อยและหายใจเร็วขึ้น แต่ยังสามารถพูดประโยคสั้นๆ ที่ใช้เวลาประมาณ 2-3 วินาทีได้ เช่น “วันนี้อยากไปเที่ยววัดไหม”";
      if (age <= 17) {
        advice = "ยอดเยี่ยมมาก! หัวใจเต้นอยู่ในช่วงเหมาะสม ช่วยเสริมสร้างระบบหลอดเลือดและหัวใจให้แข็งแรง มีพลังและความฟิต";
      } else if (age <= 64) {
        advice = "ยอดเยี่ยมที่สุด! ผ่านเกณฑ์ระดับที่กระทรวงสาธารณสุขและองค์การอนามัยโลกแนะนำ (Target Zone) ช่วยลดความเสี่ยงโรคหัวใจ เบาหวาน และความดันโลหิต ควรสะสมให้ได้อย่างน้อย 150 นาทีต่อสัปดาห์";
      } else {
        advice = "ยอดเยี่ยมและผ่านเกณฑ์! นี่คือระดับที่เหมาะสมและปลอดภัยสำหรับผู้สูงอายุ ช่วยให้ระบบไหลเวียนโลหิตดีขึ้น เสริมสร้างการทำงานของหัวใจโดยไม่เป็นอันตรายต่อร่างกาย";
      }
    } else {
      title = "ระดับหนัก (Vigorous Intensity)";
      colorTheme = "heavy";
      icon = "🔴";
      criteriaDesc = "รู้สึกเหนื่อยมาก หายใจแรง และพูดเป็นคำๆ ต้องหยุดพักหายใจระหว่างพูด";
      if (age <= 17) {
        advice = "หัวใจเต้นเร็วมาก เหมาะกับการเล่นกีฬาเป็นช่วงสั้นๆ ควรมีช่วงพักหายใจและดื่มน้ำ ไม่ควรหักโหมติดต่อกันนานเกินไป";
      } else if (age <= 64) {
        advice = "หัวใจทำงานหนักเกินระดับเป้าหมาย ควรผ่อนความเร็วลง เดินช้าๆ และหายใจลึกๆ เพื่อคูลดาวน์ (Cool-down) พร้อมจิบน้ำ ไม่ควรหยุดเคลื่อนไหวกะทันหัน";
      } else {
        advice = "⚠️ หัวใจทำงานหนักเกินไปและไม่ปลอดภัยสำหรับผู้สูงอายุ ควรหยุดพักและนั่งบนเก้าอี้ทันที หายใจเข้า-ออกลึกๆ ช้าๆ หากมีอาการแน่นหน้าอก หน้ามืด หรือวิงเวียนศีรษะ ให้รีบแจ้ง อสม. หรือคนใกล้ชิดทันที";
      }
    }

    if (isPassed) {
      audioCues.playCelebration();
    }

    content.innerHTML = `
      <div class="talk-popup-result-card popup-theme-${colorTheme}">
        
        <!-- แถบแสดงสถานะ ผ่านเกณฑ์ / ยังไม่ผ่านเกณฑ์ เด่นชัด -->
        <div class="talk-pass-hero-card ${isPassed ? 'status-passed' : 'status-not-passed'}">
          <div class="pass-hero-left">
            <span class="pass-hero-emoji">${isPassed ? '🎉' : '⚠️'}</span>
            <div>
              <div class="pass-hero-title">
                ${isPassed ? 'ผลการประเมิน: ผ่านเกณฑ์! ✅' : 'ผลการประเมิน: ยังไม่ผ่านเกณฑ์ ⚠️'}
              </div>
              <div class="pass-hero-sub">
                สำหรับ${ageGroupText}: เกณฑ์คือ ${passRuleText}
              </div>
            </div>
          </div>
          <span class="pass-status-pill ${isPassed ? 'pill-passed' : 'pill-not-passed'}">
            ${isPassed ? '✓ ผ่านเกณฑ์' : '✕ ไม่ผ่านเกณฑ์'}
          </span>
        </div>

        <div class="talk-popup-time-badge">
          ⏱️ จับเวลาทดสอบพูด: <strong>${seconds} วินาที</strong>
        </div>

        <div class="talk-popup-hero-level">
          <div class="talk-hero-title">
            <span>${icon}</span>
            <strong>${title}</strong>
          </div>
          ${level === 'moderate' ? '<span class="talk-target-pill-pop">⭐ ระดับเป้าหมายแนะนำ</span>' : ''}
        </div>

        <div class="talk-popup-criteria-box">
          <div class="criteria-box-title">📝 ลักษณะและอาการที่คุณเลือก:</div>
          <p class="criteria-box-desc">${criteriaDesc}</p>
        </div>

        <div class="talk-popup-advice-box">
          <div class="advice-box-title">💡 คำแนะนำสุขภาพสำหรับคุณ:</div>
          <p class="advice-box-desc">${advice}</p>
        </div>

        <div class="talk-popup-age-badge">
          กลุ่มวัยของคุณ: <strong>${ageGroupText}</strong> (อายุลงทะเบียน: <strong>${age} ปี</strong>)
        </div>

      </div>
    `;

    // ไฮไลต์การ์ดในหน้ารายการด้านหลังให้ตรงกัน
    const talkCards = this.container.querySelectorAll(".talk-card");
    talkCards.forEach(c => {
      c.classList.remove("selected");
      if (c.dataset.level === level) c.classList.add("selected");
    });

    if (footer) {
      footer.style.display = "block";
      footer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
          <button type="button" class="btn-save-health-log" id="btn-save-talk-result" style="width: 100%; padding: 12px 18px; border-radius: var(--radius-md); font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; background: #0284c7; color: white; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);">
            💾 บันทึกในสมุดสุขภาพดิจิทัล
          </button>
          <div style="display: flex; gap: 10px; width: 100%;">
            <button type="button" class="btn-timer-secondary" id="btn-back-to-questionnaire" style="flex: 1; padding: 11px; border-radius: var(--radius-md); font-weight: 600; font-size: 13.5px; cursor: pointer;">
              ← เลือกข้อใหม่
            </button>
            <button type="button" class="btn-timer-secondary" id="btn-dismiss-talk-popup" style="flex: 1; padding: 11px; border-radius: var(--radius-md); font-weight: 600; font-size: 13.5px; cursor: pointer;">
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      `;

      const btnSave = footer.querySelector("#btn-save-talk-result");
      if (btnSave) {
        btnSave.addEventListener("click", () => {
          const currentEx = window.postWorkoutModal?.currentExercise || window.videoManager?.currentExercise;
          const exTitle = currentEx?.title 
            ? `${currentEx.title} (ประเมินด้วยการพูด)` 
            : "การประเมินการพูด (Talk Test)";
          const durationMins = currentEx?.duration 
            ? (parseInt(currentEx.duration) || 10) 
            : 5;

          const levelLabel = level === "light" 
            ? "ระดับเบา (พูดได้สบาย)" 
            : (level === "moderate" ? "ระดับปานกลาง (เหนื่อย/หายใจเร็ว)" : "ระดับหนัก (เหนื่อยมาก/หอบ)");

          // บันทึกลง User Store
          userStore.addRecord({
            exerciseTitle: exTitle,
            durationMinutes: durationMins,
            ageGroup: ageKey,
            ageGroupLabel: (typeof AGE_CRITERIA !== "undefined" && AGE_CRITERIA[ageKey]) ? AGE_CRITERIA[ageKey].label : ageGroupText,
            heartRate: levelLabel,
            status: isPassed ? `ผ่านเกณฑ์! (${title}) 🟢` : `ยังไม่ถึงเกณฑ์ (${title}) 🔴`,
            badgeClass: isPassed ? "badge-success" : "badge-warning",
            recommendation: advice,
            method: "talk-test",
            talkLevel: level
          });

          // บันทึกกลุ่มวัย
          userStore.saveProfile({ ageGroup: ageKey });

          audioCues.playCelebration();
          btnSave.innerHTML = "✓ บันทึกสำเร็จแล้ว!";
          btnSave.disabled = true;
          btnSave.style.background = "#10b981";

          setTimeout(() => {
            closeModal();
            // ปิด postWorkoutModal ด้วยหากเปิดซ้อนอยู่
            if (window.postWorkoutModal && typeof window.postWorkoutModal.close === "function") {
              window.postWorkoutModal.close();
            }
            // รีเฟรชส่วนต่างๆ ในแอป
            if (window.app && window.app.renderProfileView) {
              window.app.renderProfileView();
            }
            if (window.app && window.app.renderDailyStatCard) {
              window.app.renderDailyStatCard();
            }
            if (window.workoutCalendar && window.workoutCalendar.render) {
              window.workoutCalendar.render();
            }
          }, 1200);
        });
      }

      const btnBack = footer.querySelector("#btn-back-to-questionnaire");
      if (btnBack) {
        btnBack.addEventListener("click", () => {
          this.showTalkQuestionnairePopup();
        });
      }

      const btnDismissNew = footer.querySelector("#btn-dismiss-talk-popup");
      if (btnDismissNew) {
        btnDismissNew.addEventListener("click", () => {
          closeModal();
          this.resetTalkTimer();
        });
      }
    }

    modal.classList.add("active");
    modal.style.display = "flex";

    const closeModal = () => {
      modal.classList.remove("active");
      modal.style.display = "none";
      this.resetTalkTimer();
    };

    if (btnClose) btnClose.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }
}

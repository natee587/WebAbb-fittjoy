/**
 * ฟิตจอย - Post-Workout Heart Rate Modal
 * ปลดล็อกทันทีเมื่อดูคลิปจบ 100% เพื่อประเมินชีพจรตาม 3 กลุ่มวัย
 */

class PostWorkoutModal {
  constructor() {
    this.modalEl = document.getElementById("post-workout-modal");
    this.currentExercise = null;
    this.selectedAgeGroup = userStore.profile.ageGroup || "adult";
    this.timerInstance = null;
    this.init();
  }

  init() {
    if (!this.modalEl) return;
    this.bindGlobalEvents();
  }

  bindGlobalEvents() {
    const closeBtn = this.modalEl.querySelector(".modal-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.close());
    }

    // ปิดเมื่อคลิกนอก Backdrop
    this.modalEl.addEventListener("click", (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });
  }

  open(exerciseData, durationSec = null) {
    this.currentExercise = exerciseData || {
      title: "ออกกำลังกายตามคลิป",
      duration: "10 นาที"
    };

    // คิดเวลาสะสมจากความยาวคลิปจริงตาม EXERCISE_EXACT_DURATIONS
    const exact = (typeof getExactExerciseDuration === 'function')
      ? getExactExerciseDuration(exerciseData)
      : null;
    const finalDurSec = durationSec || exact?.durationSeconds || exerciseData?.durationSeconds || 60;
    this.recordedDurationSeconds = Math.round(finalDurSec);

    audioCues.playCelebration();
    this.selectedAgeGroup = userStore.profile.ageGroup || "adult";
    this.render();
    this.modalEl.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  close() {
    if (this.timerInstance) {
      this.timerInstance.stop();
    }
    this.modalEl.classList.remove("active");
    document.body.style.overflow = "";
  }

  render() {
    const modalBody = this.modalEl.querySelector(".modal-content-area");
    if (!modalBody) return;

    const ex = this.currentExercise;
    const durSec = this.recordedDurationSeconds || 60;
    const durMins = Math.floor(durSec / 60);
    const durRemSec = durSec % 60;
    const durDisplayLong = durRemSec > 0 ? `${durMins} นาที ${durRemSec} วินาที` : `${durMins} นาที`;

    modalBody.innerHTML = `
      <div class="post-workout-card">
        <div class="post-badge-celebrate">
          <span class="icon-trophy">🏆</span> ยอดเยี่ยมมาก! ทำกิจกรรมจบแล้ว
        </div>
        <h2 class="post-modal-title">${ex.title}</h2>
        <p class="post-modal-subtitle">ดูคลิปสาธิตและออกกำลังกายตามจนจบขั้นตอน (เวลาสะสมที่ได้รับ: <strong>${durDisplayLong}</strong>)</p>

        <!-- ส่วนเลือกกลุ่มวัย (3 กลุ่มวัยตามโจทย์) -->
        <div class="age-group-selection-box">
          <label class="section-label">1. เลือกกลุ่มวัยของคุณ เพื่อประเมินผลอย่างถูกต้อง:</label>
          <div class="age-pills-row">
            <button type="button" class="age-select-pill ${this.selectedAgeGroup === 'youth' ? 'active' : ''}" data-age="youth">
              <strong>👶 อายุ 6 - 17 ปี</strong>
              <span>(ปานกลาง-หนัก 120-150 bpm)</span>
            </button>
            <button type="button" class="age-select-pill ${this.selectedAgeGroup === 'adult' ? 'active' : ''}" data-age="adult">
              <strong>🧑 อายุ 18 - 64 ปี</strong>
              <span>(ปานกลาง 105-135 bpm)</span>
            </button>
            <button type="button" class="age-select-pill ${this.selectedAgeGroup === 'senior' ? 'active' : ''}" data-age="senior">
              <strong>👵 อายุ 65 ปีขึ้นไป</strong>
              <span>(ระดับเบาๆ 85-115 bpm)</span>
            </button>
          </div>
        </div>

        <!-- กล่องคำแนะนำสำหรับกลุ่มวัยที่เลือก -->
        <div class="age-guideline-box" id="modal-age-guideline-display">
          ${this.getGuidelineHtml(this.selectedAgeGroup)}
        </div>

        <!-- ส่วนวัดและกรอกอัตราการเต้นของหัวใจ -->
        <div class="hr-input-block">
          <label class="section-label">2. ตรวจวัดอัตราการเต้นของหัวใจ (ชีพจร) ทันที:</label>
          
          <div class="quick-timer-embed" id="modal-quick-timer-container"></div>

          <div class="manual-input-box">
            <span class="manual-label">หรือกรอกตัวเลขที่วัดได้จาก Smartwatch / นาฬิกา:</span>
            <div class="input-with-button">
              <input type="number" id="modal-post-hr-input" class="input-pulse-lg" placeholder="กรอกค่าชีพจร เช่น 115" min="40" max="220" />
              <button type="button" class="btn-primary-blue" id="btn-modal-eval-hr">ประเมินผล</button>
            </div>
          </div>
        </div>

        <!-- กล่องแสดงผลการประเมิน -->
        <div id="modal-eval-result-area" style="display: none; margin-top: 16px;"></div>
      </div>
    `;

    // ผูก Event ปุ่มเลือกกลุ่มวัย
    const pills = modalBody.querySelectorAll(".age-select-pill");
    pills.forEach(p => {
      p.addEventListener("click", () => {
        pills.forEach(x => x.classList.remove("active"));
        p.classList.add("active");
        this.selectedAgeGroup = p.dataset.age;

        // อัปเดตกล่องคำแนะนำ
        const guideBox = document.getElementById("modal-age-guideline-display");
        if (guideBox) {
          guideBox.innerHTML = this.getGuidelineHtml(this.selectedAgeGroup);
        }

        // หากมีผลประเมินอยู่แล้ว ให้ประเมินซ้ำทันที
        const inputVal = document.getElementById("modal-post-hr-input");
        if (inputVal && inputVal.value) {
          this.evaluateResult(Number(inputVal.value));
        }
      });
    });

    // สร้าง Quick Timer
    this.timerInstance = new PulseTimer("modal-quick-timer-container", {
      defaultMode: 15, // หลังออกกำลังกาย 15s x 4 เหมาะสมและรวดเร็ว
      onComplete: () => {
        const inp = document.getElementById("modal-post-hr-input");
        if (inp) inp.focus();
      }
    });

    // ปุ่มประเมินผล
    const btnEval = modalBody.querySelector("#btn-modal-eval-hr");
    btnEval.addEventListener("click", () => {
      const inp = document.getElementById("modal-post-hr-input");
      if (!inp || !inp.value) {
        alert("กรุณากรอกตัวเลขชีพจร (BPM) ครับ");
        return;
      }
      this.evaluateResult(Number(inp.value));
    });
  }

  getGuidelineHtml(ageGroup) {
    const c = AGE_CRITERIA[ageGroup] || AGE_CRITERIA.adult;
    return `
      <div class="guideline-card">
        <div class="guide-title">📌 เกณฑ์สำหรับ: ${c.label}</div>
        <div class="guide-rec"><strong>คำแนะนำ:</strong> ${c.recommendation}</div>
        <div class="guide-target"><strong>ช่วงชีพจรเป้าหมาย:</strong> ${c.targetHRText}</div>
        <div class="guide-talk"><strong>การสังเกต:</strong> ${c.talkTestGuide}</div>
      </div>
    `;
  }

  evaluateResult(bpm) {
    const resultArea = document.getElementById("modal-eval-result-area");
    if (!resultArea) return;

    const ageGroup = this.selectedAgeGroup;
    const c = AGE_CRITERIA[ageGroup] || AGE_CRITERIA.adult;

    let statusText = "";
    let badgeClass = "";
    let advice = "";

    if (ageGroup === "youth") {
      // 1. อายุ 6-17 ปี: ปานกลาง-หนัก (120-150 bpm), วันละ 60 นาที
      if (bpm < 120) {
        statusText = "ระดับเบา (ต่ำกว่าเป้าหมาย 120-150 bpm)";
        badgeClass = "badge-info";
        advice = "สามารถเพิ่มความกระฉับกระเฉงอีกนิด เพื่อให้หัวใจเต้นในระดับปานกลาง-หนัก ช่วยสร้างกระดูกและกล้ามเนื้อที่แข็งแรง";
      } else if (bpm <= 150) {
        statusText = "อยู่ในเกณฑ์ยอดเยี่ยมสำหรับเด็กและวัยรุ่น! 🎉";
        badgeClass = "badge-success";
        advice = "ยอดเยี่ยมมาก! หัวใจเต้นอยู่ในช่วง 120-150 bpm พอดี มีประโยชน์สูงสุดต่อการเจริญเติบโตและความทนทาน";
      } else {
        statusText = "ระดับหนักมาก (ควรพักผ่อน)";
        badgeClass = "badge-warning";
        advice = "หัวใจเต้นเร็วเกิน 150 bpm ควรชะลอความเร็ว ดื่มน้ำ และนั่งพักจนกว่าชีพจรจะกลับสู่ภาวะปกติ";
      }
    } else if (ageGroup === "adult") {
      // 2. อายุ 18-64 ปี: อย่างน้อย 3 วัน/สัปดาห์ นาน 30 นาที/วัน ออกแบบปานกลาง (105-135 bpm)
      if (bpm < 105) {
        statusText = "ระดับเบา (ต่ำกว่าช่วงปานกลาง 105-135 bpm)";
        badgeClass = "badge-info";
        advice = "ควรออกกำลังกายอย่างน้อย 3 วันต่อสัปดาห์ นาน 30 นาทีต่อวัน ในระดับปานกลางเพื่อการเผาผลาญที่ดี";
      } else if (bpm <= 135) {
        statusText = "อยู่ในเกณฑ์ระดับปานกลางที่ยอดเยี่ยม! 🎉";
        badgeClass = "badge-success";
        advice = "ระดับความหนักปานกลางพอดี ช่วยลดความเสี่ยงโรคเบาหวาน ความดันโลหิตสูง และโรคหลอดเลือดหัวใจ (NCDs) ได้อย่างดีเลิศ";
      } else {
        statusText = "ระดับหนักมาก (ควรระวัง)";
        badgeClass = "badge-warning";
        advice = "หัวใจเต้นค่อนข้างเร็ว ควรเดินผ่อนคลาย (Cool-down) 3-5 นาที และจิบน้ำ ไม่ควรหยุดทันที";
      }
    } else {
      // 3. อายุ 65 ปีขึ้นไป: อย่างน้อย 3 วัน/สัปดาห์ นาน 30 นาทีต่อวัน ออกกำลังกายแบบเบาๆ (85-115 bpm)
      if (bpm < 85) {
        statusText = "ระดับเบามาก / อัตราพักปกติ";
        badgeClass = "badge-info";
        advice = "ควรออกกำลังกายแบบเบาๆ อย่างน้อย 3 วันต่อสัปดาห์ นาน 30 นาทีต่อวัน เพื่อบริหารข้อต่อและการทรงตัว";
      } else if (bpm <= 115) {
        statusText = "อยู่ในเกณฑ์ระดับเบาที่ปลอดภัยมาก! 🎉";
        badgeClass = "badge-success";
        advice = "ยอดเยี่ยมและปลอดภัยสำหรับผู้สูงอายุ หัวใจสูบฉีดเลือดได้ดีโดยไม่เป็นอันตรายต่อหลอดเลือดและข้อต่อ";
      } else {
        statusText = "ชีพจรค่อนข้างเร็วสำหรับผู้สูงอายุ (ควรหยุดพัก)";
        badgeClass = "badge-warning";
        advice = "ควรหยุดพักนั่งบนเก้าอี้ทันที สูดหายใจเข้าลึกๆ หากรู้สึกเวียนศีรษะหรือแน่นหน้าอกให้รีบแจ้ง อสม. หรือญาติ";
      }
    }

    resultArea.style.display = "block";
    resultArea.innerHTML = `
      <div class="eval-result-card ${badgeClass}">
        <div class="eval-bpm-header">
          อัตราการเต้นของหัวใจ: <span class="bpm-num">${bpm} BPM</span>
        </div>
        <div class="eval-status-pill">${statusText}</div>
        <p class="eval-advice-text">${advice}</p>
        <div class="eval-guideline-note">
          <strong>เกณฑ์กลุ่มวัย:</strong> ${c.recommendation}
        </div>
        <div class="eval-button-row">
          <button type="button" class="btn-save-health-log" id="btn-save-from-post-modal">
            💾 บันทึกในสมุดสุขภาพดิจิทัล
          </button>
          <button type="button" class="btn-close-secondary" id="btn-dismiss-post-modal">
            ปิดหน้านี้
          </button>
        </div>
      </div>
    `;

    // บันทึกผล
    const btnSave = resultArea.querySelector("#btn-save-from-post-modal");
    if (btnSave) {
      btnSave.addEventListener("click", () => {
        const durSec = this.recordedDurationSeconds || 60;
        const durMins = Math.floor(durSec / 60);
        const durRemSec = durSec % 60;
        const durFormatted = durRemSec > 0 ? `${durMins} น. ${durRemSec} วิ.` : `${durMins} น.`;

        userStore.addRecord({
          exerciseTitle: this.currentExercise.title,
          durationSeconds: durSec,
          durationMinutes: durSec / 60,
          durationFormatted: durFormatted,
          ageGroup: ageGroup,
          ageGroupLabel: c.label,
          heartRate: bpm,
          status: statusText,
          badgeClass: badgeClass,
          recommendation: c.recommendation
        });

        // อัปเดตค่าโปรไฟล์ล่าสุด
        userStore.saveProfile({ ageGroup: ageGroup });

        btnSave.textContent = "✓ บันทึกสำเร็จแล้ว!";
        btnSave.disabled = true;
        audioCues.playCelebration();

        setTimeout(() => {
          this.close();
          // รีเฟรชหน้าทั้งหมดในแอป (หน้าแรก, ปฏิทิน, โปรไฟล์)
          if (window.app && window.app.refreshAllViews) {
            window.app.refreshAllViews();
          } else {
            if (window.app && window.app.renderProfileView) {
              window.app.renderProfileView();
            }
            if (window.app && window.app.renderDailyStatCard) {
              window.app.renderDailyStatCard();
            }
            if (window.workoutCalendar && window.workoutCalendar.render) {
              window.workoutCalendar.render();
            }
          }

          // ตรวจสอบระบบ Cool Down อัตโนมัติ: หากเวลาสะสมวันนี้ถึงเป้าหมายแล้ว ให้เด้งคลิป Cool Down สำหรับผู้ใช้นี้
          const cooldownEx = window.COOLDOWN_EXERCISE || (typeof COOLDOWN_EXERCISE !== "undefined" ? COOLDOWN_EXERCISE : null);
          if (window.userStore && window.videoManager && cooldownEx) {
            const todayStats = userStore.getTodayStats();
            const activeUserId = userStore.activeUserId || "default";
            const cooldownStorageKey = `fitjoy_cooldown_done_${activeUserId}`;
            const cooldownDoneDate = localStorage.getItem(cooldownStorageKey);
            if (todayStats.isGoalReached && cooldownDoneDate !== todayStats.todayIso) {
              window.videoManager.showToastNotice("🎉 ยอดเยี่ยมมาก! วันนี้ออกกำลังกายครบตามเกณฑ์แล้ว ระบบกำลังพาไปยืดเหยียดร่างกาย (Cool Down) 🧘‍♂️");
              setTimeout(() => {
                window.videoManager.openVideo(cooldownEx, false);
              }, 600);
            }
          }
        }, 1200);
      });
    }

    const btnDismiss = resultArea.querySelector("#btn-dismiss-post-modal");
    if (btnDismiss) {
      btnDismiss.addEventListener("click", () => this.close());
    }
  }
}

// Global modal instance placeholder
let postWorkoutModal = null;

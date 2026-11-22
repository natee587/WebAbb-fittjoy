/**
 * ฟิตจอย - Main Application Controller
 * ควบคุมการเปลี่ยนแท็บ 5 หน้า, การลงทะเบียน Onboarding, การ์ดสถิติเวลาสะสมประจำวัน (Daily Stat Card),
 * แนะนำท่าเฉพาะบุคคล (Personalized Recommendation), ปฏิทินบันทึกผลการออกกำลังกาย, ระบบสลับบัญชี และออกจากระบบ
 */

class FitJoyApp {

  constructor() {
    this.currentTab = "home";
    this.currentCategory = "ทั้งหมด";
    this.searchQuery = "";
    // isMobileFrame removed
    this.tempRegistrationData = null;
    this.isEditingUser = false;

    this.init();
  }

  init() {
    if (window.userStore) {
      window.userStore.cleanupAllDemoData();
    }

    window.postWorkoutModal = new PostWorkoutModal();
    window.videoManager = new VideoManager();
    window.workoutCalendar = new WorkoutCalendar("workout-calendar-mount");
    window.workoutCalendar.init();

    this.checkOnboardingStatus();
    this.bindNavigation();
    this.bindSearchAndFilters();
    this.bindViewportSwitcher();
    this.bindSoundToggle();
    this.bindRegistrationEvents();
    this.bindBmiPopupModal();
    this.bindUserSwitcherEvents();
    this.bindQuickWeightEdit();

    this.refreshAllViews();

    new PulseTimer("practice-pulse-timer-container", {
      defaultMode: 60,
      allowSaveHealthLog: false
    });
  }

  // อัปเดตข้อมูลและส่วนแสดงผลทุกส่วนเมื่อผู้ใช้เปลี่ยนหรือมีบันทึกใหม่
  refreshAllViews() {
    this.updateUserHeaderDisplay();
    this.renderDailyStatCard();
    this.renderPersonalizedRecommendation();
    this.renderHomeExercises();
    this.renderKnowledgeView();
    if (window.workoutCalendar) {
      window.workoutCalendar.render();
    }
    this.renderProfileView();
  }

  // ========================================================================
  // การ์ดแสดงเวลาสะสมในการออกกำลังกายประจำวัน (Daily Stat Card - 30 นาที/วัน)
  // รีเซ็ตอัตโนมัติเมื่อขึ้นวันใหม่ พร้อมบันทึกลงในปฏิทิน
  // ========================================================================
  renderDailyStatCard() {
    const container = document.getElementById("home-daily-stat-card");
    if (!container) return;

    const stats = userStore.getTodayStats();

    let goalPillHtml = "";
    if (stats.isGoalReached) {
      goalPillHtml = `<span class="daily-goal-pill completed">✓ บรรลุเป้าหมายแล้ว 🎉</span>`;
    } else {
      const remainingSec = Math.max(0, stats.targetSeconds - stats.totalSeconds);
      const remMins = Math.floor(remainingSec / 60);
      const remSecOnly = remainingSec % 60;
      const remText = remSecOnly > 0 ? `ขาดอีก ${remMins} น. ${remSecOnly} วิ.` : `ขาดอีก ${remMins} นาที`;
      goalPillHtml = `<span class="daily-goal-pill pending">${remText}</span>`;
    }

    let chipsHtml = "";
    if (stats.records && stats.records.length > 0) {
      chipsHtml = `
        <div class="daily-today-chips-list" style="margin-top: 12px;">
          ${stats.records.map(r => {
            const durText = r.durationFormatted || (r.durationMinutes ? `${r.durationMinutes} น.` : '1 น.');
            return `
              <span class="today-workout-chip">
                ✓ ${r.exerciseTitle} (${durText})
              </span>
            `;
          }).join('')}
        </div>
      `;
    }

    if (stats.isGoalReached) {
      const activeUserId = userStore.activeUserId || "default";
      const cooldownStorageKey = `fitjoy_cooldown_done_${activeUserId}`;
      const isCooldownDone = localStorage.getItem(cooldownStorageKey) === stats.todayIso;

      if (!isCooldownDone) {
        // เด้งอัตโนมัติ 1 ครั้งต่อเซสชันของผู้ใช้นี้เมื่อเวลาสะสมครบตามเกณฑ์
        if (!this.sessionCooldownPromptedUsers) {
          this.sessionCooldownPromptedUsers = {};
        }
        if (!this.sessionCooldownPromptedUsers[activeUserId]) {
          this.sessionCooldownPromptedUsers[activeUserId] = true;
          setTimeout(() => {
            const cooldownEx = window.COOLDOWN_EXERCISE || (typeof COOLDOWN_EXERCISE !== "undefined" ? COOLDOWN_EXERCISE : null);
            if (window.videoManager && cooldownEx) {
              window.videoManager.showToastNotice("🎉 ยอดเยี่ยมมาก! เวลาสะสมครบตามเกณฑ์แล้ว ระบบกำลังพาไปยืดเหยียด (Cool Down) 🧘‍♂️");
              setTimeout(() => {
                window.videoManager.openVideo(cooldownEx, false);
              }, 600);
            }
          }, 400);
        }
      }
    }

    container.innerHTML = `
      <div class="daily-stat-header">
        <div class="daily-stat-title-group">
          <span style="font-size: 20px;">⏱️</span>
          <h3>เวลาสะสมวันนี้</h3>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="daily-date-tag">${stats.todayFormatted}</span>
          ${goalPillHtml}
        </div>
      </div>

      <div class="daily-counter-row">
        <div class="daily-big-number-wrap">
          <span class="daily-time-giant">${stats.totalFormatted}</span>
          <span class="daily-target-giant">/ ${stats.targetMinutes} <span class="unit">นาที</span></span>
        </div>
        <div class="daily-percent-badge ${stats.isGoalReached ? 'completed' : ''}">${stats.percent}%</div>
      </div>

      <!-- แถบความคืบหน้า Progress Bar -->
      <div class="daily-progress-track">
        <div class="daily-progress-fill ${stats.isGoalReached ? 'completed' : ''}" style="width: ${stats.percent}%;"></div>
      </div>

      ${chipsHtml}
    `;
  }

  checkOnboardingStatus() {
    const onboardingEl = document.getElementById("onboarding-screen");
    if (!onboardingEl) return;

    const isOnboarded = userStore.isRegistered() || localStorage.getItem("fitjoy_onboarded") === "true";

    if (!isOnboarded) {
      this.openOnboardingModal("register");
    } else {
      this.closeOnboardingModal();
    }
  }

  openOnboardingModal(mode = "register") {
    const onboardingEl = document.getElementById("onboarding-screen");
    const form = document.getElementById("onboarding-form");
    const resultBox = document.getElementById("onboarding-result-box");
    const titleEl = document.getElementById("onboarding-title");
    const descEl = document.getElementById("onboarding-desc");
    const btnEnter = document.getElementById("btn-enter-website");
    const btnClose = document.getElementById("btn-close-onboarding-edit");
    const existingUsersBar = document.getElementById("onboarding-existing-users-bar");
    const btnSubmit = document.getElementById("btn-submit-registration");
    if (!onboardingEl) return;

    this.isEditingUser = (mode === "edit");
    this.tempRegistrationData = null;

    const allUsers = userStore.getAllUsers();
    const hasUsers = allUsers.length > 0;
    const activeUser = userStore.activeUserId ? userStore.getActiveUser() : null;

    if (this.isEditingUser) {
      const p = userStore.profile || {};
      if (titleEl) titleEl.textContent = "✏️ แก้ไขข้อมูลสุขภาพของคุณ";
      if (descEl) descEl.textContent = "แก้ไขชื่อ นามสกุล อายุ น้ำหนัก และส่วนสูง เพื่อคำนวณช่วงวัย ค่าดัชนีมวลกาย (BMI) และช่วงชีพจรใหม่";
      if (btnEnter) btnEnter.innerHTML = "✓ บันทึกการแก้ไขข้อมูล";
      if (btnSubmit) btnSubmit.innerHTML = "⚡ คำนวณผลใหม่";
      if (btnClose) btnClose.style.display = "inline-flex";
      if (existingUsersBar) existingUsersBar.style.display = "none";

      const fnInput = document.getElementById("reg-first-name");
      const lnInput = document.getElementById("reg-last-name");
      const ageInput = document.getElementById("reg-age");
      const wInput = document.getElementById("reg-weight");
      const hInput = document.getElementById("reg-height");

      if (fnInput) fnInput.value = p.firstName || "";
      if (lnInput) lnInput.value = p.lastName || "";
      if (ageInput) ageInput.value = p.age || "";
      if (wInput) wInput.value = p.weight || "";
      if (hInput) hInput.value = p.height || "";

      const radioGender = document.querySelectorAll('input[name="reg-gender"]');
      radioGender.forEach(r => {
        if (r.value === p.gender) r.checked = true;
      });

      this.handleRegistrationSubmit(false);
    } else {
      if (form) form.reset();
      if (resultBox) resultBox.style.display = "none";
      if (titleEl) titleEl.textContent = "ลงทะเบียนประเมินสุขภาพเบื้องต้น";
      if (descEl) descEl.textContent = "กรุณากรอกข้อมูลเพื่อคำนวณช่วงวัย ค่าดัชนีมวลกาย (BMI) และกำหนดช่วงอัตราการเต้นของหัวใจที่ปลอดภัยและเหมาะสมกับคุณก่อนเข้าสู่เว็บไซต์";
      if (btnEnter) btnEnter.innerHTML = "🎉 บันทึกและเข้าสู่ฟิตจอย";
      if (btnSubmit) btnSubmit.innerHTML = "⚡ คำนวณช่วงวัย & อัตราการเต้นของหัวใจ";

      if (btnClose) btnClose.style.display = activeUser ? "inline-flex" : "none";
      if (existingUsersBar) existingUsersBar.style.display = hasUsers ? "block" : "none";

      const bmiCard = document.getElementById("res-bmi-metric-card");
      if (bmiCard) bmiCard.className = "metric-card reg-bmi-card";
      const pingpongTag = document.getElementById("res-bmi-pingpong-tag");
      if (pingpongTag) {
        pingpongTag.style.display = "none";
        pingpongTag.innerHTML = "";
      }
    }

    // แถบติดตั้งแอปบนหน้าลงทะเบียน (แสดงเสมอเมื่อลงทะเบียน เพื่อให้ผู้ใช้สามารถติดตั้งแอปได้สะดวก)
    const obInstallBanner = document.getElementById("onboarding-install-banner");
    if (obInstallBanner) {
      obInstallBanner.style.display = this.isEditingUser ? "none" : "flex";
    }

    onboardingEl.style.removeProperty("display");
    onboardingEl.style.display = "flex";
    onboardingEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  closeOnboardingModal() {
    this.isEditingUser = false;
    this.tempRegistrationData = null;
    const onboardingEl = document.getElementById("onboarding-screen");
    if (onboardingEl) {
      onboardingEl.style.removeProperty("display");
      onboardingEl.style.display = "none";
      onboardingEl.classList.add("hidden");
    }
    document.body.style.overflow = "";
  }

  openRegistrationForNewUser() {
    this.openOnboardingModal("register");
  }

  updateUserHeaderDisplay() {
    const topName = document.getElementById("top-bar-user-name");
    const greeting = document.getElementById("header-user-greeting");
    const p = userStore.profile;

    if (topName) {
      topName.textContent = p.name ? `ผู้ใช้: ${p.name}` : "สลับผู้ใช้";
    }
    if (greeting) {
      greeting.textContent = p.firstName ? `สวัสดี, คุณ${p.firstName}` : "เริ่มต้นง่าย ได้ทุกวัน";
    }
  }

  // ข้อมูลและเป้าหมายสุขภาพเฉพาะบุคคลตามช่วงวัย (ขนาดตัวอักษรใหญ่ อ่านง่าย สบายตาบนมือถือ ไม่ตกกรอบ)
  renderPersonalizedRecommendation() {
    const cardContainer = document.getElementById("home-personalized-rec-card");
    if (!cardContainer) return;

    const p = userStore.profile;
    const ageGroup = p.ageGroup || "adult";
    const c = AGE_CRITERIA[ageGroup] || AGE_CRITERIA.adult;
    const ageText = p.age ? ` อายุ ${p.age} ปี` : '';

    cardContainer.innerHTML = `
      <div class="rec-header-row">
        <h3 class="rec-user-title">คุณ${p.name || 'สมาชิก'}${ageText} (${c.label})</h3>
      </div>

      <!-- รายการกล่องข้อมูลสุขภาพขนาดใหญ่ อ่านง่าย ไม่ตกกรอบ -->
      <div class="rec-meta-items-list">
        <div class="rec-meta-card item-target">
          <span class="rec-meta-icon">⏱️</span>
          <div class="rec-meta-text">
            <span class="rec-meta-label">เป้าหมายการออกกำลังกาย</span>
            <strong class="rec-meta-val">${c.recommendation}</strong>
          </div>
        </div>

        <div class="rec-meta-card item-pulse">
          <span class="rec-meta-icon">💓</span>
          <div class="rec-meta-text">
            <span class="rec-meta-label">อัตราการเต้นของหัวใจเป้าหมาย (ชีพจร)</span>
            <strong class="rec-meta-val">${c.targetHRText}</strong>
          </div>
        </div>

        ${p.bmi ? `
          <div class="rec-meta-card item-bmi">
            <span class="rec-meta-icon">⚖️</span>
            <div class="rec-meta-text">
              <span class="rec-meta-label">ดัชนีมวลกาย (BMI)</span>
              <strong class="rec-meta-val">${p.bmi} <span class="rec-meta-sub">(${p.bmiCategory || 'ปกติ'})</span></strong>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  bindUserSwitcherEvents() {
    const btnOpenSwitcher = document.getElementById("btn-open-user-switcher");
    const btnProfileSwitch = document.getElementById("btn-profile-switch-user");
    const btnCloseModal = document.getElementById("btn-close-switch-modal");
    const switchModal = document.getElementById("switch-user-modal");
    const btnRegisterNew = document.getElementById("btn-register-new-user-modal");
    const btnLogout = document.getElementById("btn-profile-logout");

    if (btnOpenSwitcher) btnOpenSwitcher.addEventListener("click", () => this.openSwitchUserModal());
    if (btnProfileSwitch) btnProfileSwitch.addEventListener("click", () => this.openSwitchUserModal());

    if (btnCloseModal) btnCloseModal.addEventListener("click", () => this.closeSwitchUserModal());
    if (switchModal) {
      switchModal.addEventListener("click", (e) => {
        if (e.target === switchModal) this.closeSwitchUserModal();
      });
    }

    if (btnRegisterNew) {
      btnRegisterNew.addEventListener("click", () => {
        this.closeSwitchUserModal();
        this.openOnboardingModal("register");
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        if (confirm("คุณต้องการออกจากระบบเพื่อสลับหรือลงทะเบียนผู้ใช้ใหม่หรือไม่?")) {
          userStore.logout();
          this.openOnboardingModal("register");
          if (window.videoManager) {
            window.videoManager.showToastNotice("🚪 ออกจากระบบเรียบร้อยแล้ว");
          }
        }
      });
    }
  }

  openSwitchUserModal() {
    const modal = document.getElementById("switch-user-modal");
    const container = document.getElementById("user-roster-list-container");
    if (!modal || !container) return;

    const allUsers = userStore.getAllUsers();

    if (allUsers.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">
          ยังไม่มีรายชื่อผู้ใช้ที่บันทึกไว้ในเครื่องนี้
        </div>
      `;
    } else {
      container.innerHTML = allUsers.map(u => {
        const isActive = u.id === userStore.activeUserId;
        const c = AGE_CRITERIA[u.ageGroup] || AGE_CRITERIA.adult;
        const avatar = u.gender === "หญิง" ? "👩" : "👨";
        return `
          <div class="user-roster-item ${isActive ? 'active' : ''}" onclick="window.app.handleSelectUser('${u.id}')">
            <div class="roster-avatar">${avatar}</div>
            <div class="roster-info">
              <div class="roster-name">${u.name} ${isActive ? '(กำลังใช้งาน)' : ''}</div>
              <div class="roster-meta">
                อายุ ${u.age} ปี | ${c.label} | BMI ${u.bmi || '-'} (${u.bmiCategory || '-'})
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;" onclick="event.stopPropagation();">
              ${isActive ? '<span class="roster-active-badge">ใช้งานอยู่</span>' : `<button type="button" class="top-control-btn" style="font-size: 11px;" onclick="window.app.handleSelectUser('${u.id}')">เลือก</button>`}
              <button type="button" class="btn-delete-user" title="ลบบัญชีนี้ทันที" onclick="window.app.handleDeleteUser('${u.id}')">
                🗑️ ลบ
              </button>
            </div>
          </div>
        `;
      }).join("");
    }

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  closeSwitchUserModal() {
    const modal = document.getElementById("switch-user-modal");
    if (modal) modal.classList.remove("active");
    document.body.style.overflow = "";
  }

  handleSelectUser(userId) {
    if (userStore.switchUser(userId)) {
      localStorage.setItem("fitjoy_onboarded", "true");
      this.closeSwitchUserModal();
      if (window.videoManager) {
        window.videoManager.resetSessionWarmup(userId);
        const u = userStore.getActiveUser();
        window.videoManager.showToastNotice(`👋 สลับไปยังบัญชี "${u ? u.name : ''}" เรียบร้อยแล้ว`);
      }
      if (this.sessionCooldownPromptedUsers) {
        delete this.sessionCooldownPromptedUsers[userId];
      }
      this.refreshAllViews();
      try {
        if (typeof audioCues !== 'undefined' && audioCues.playCelebration) {
          audioCues.playCelebration();
        }
      } catch (e) {}
    }
  }

  handleDeleteUser(userId) {
    const targetUser = userStore.users.find(u => u.id === userId);
    const targetName = targetUser ? targetUser.name : "ผู้ใช้";
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี "${targetName}" ออกจากเครื่องนี้?`)) {
      return;
    }
    const remainingCount = userStore.deleteUser(userId);

    if (remainingCount === 0) {
      userStore.logout();
      this.closeSwitchUserModal();
      this.openOnboardingModal("register");
      if (window.videoManager) {
        window.videoManager.showToastNotice("ลบบัญชีเรียบร้อยแล้ว กรุณาลงทะเบียนใหม่ครับ");
      }
    } else {
      this.openSwitchUserModal();
      this.refreshAllViews();
      if (window.videoManager) {
        window.videoManager.showToastNotice("ลบบัญชีผู้ใช้เรียบร้อยแล้ว");
      }
    }
  }

  handleRegistrationSubmit(shouldScroll = true) {
    const firstName = (document.getElementById("reg-first-name")?.value || "").trim();
    const lastName = (document.getElementById("reg-last-name")?.value || "").trim();
    const age = Number(document.getElementById("reg-age")?.value);
    const gender = (document.querySelector('input[name="reg-gender"]:checked')?.value) || "ชาย";
    const weight = parseFloat(document.getElementById("reg-weight")?.value);
    const height = parseFloat(document.getElementById("reg-height")?.value);

    if (!firstName || !lastName || !age || !weight || !height) {
      if (shouldScroll) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วนทุกช่องครับ");
      }
      return;
    }

    const ageGroup = userStore.determineAgeGroup(age);
    const criteria = AGE_CRITERIA[ageGroup] || AGE_CRITERIA.adult;
    const bmiResult = userStore.calculateBMI(weight, height);
    const activeColor = bmiResult.info || BMI_7_COLORS[1];

    this.tempRegistrationData = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      age,
      gender,
      weight,
      height,
      bmi: bmiResult.bmi,
      category: bmiResult.category,
      badgeClass: bmiResult.badgeClass,
      pingpongColor: bmiResult.pingpongColor,
      pingpongName: bmiResult.pingpongName,
      ageGroup
    };

    const resultBox = document.getElementById("onboarding-result-box");
    const ageGroupLabel = document.getElementById("res-age-group-label");
    const bmiVal = document.getElementById("res-bmi-val");
    const bmiCategory = document.getElementById("res-bmi-category");
    const targetHrVal = document.getElementById("res-target-hr-val");
    const hrRecommendation = document.getElementById("res-hr-recommendation");

    if (ageGroupLabel) ageGroupLabel.textContent = criteria.label;
    if (bmiVal) bmiVal.textContent = `${bmiResult.bmi}`;
    if (bmiCategory) bmiCategory.textContent = `(${bmiResult.category})`;
    if (targetHrVal) targetHrVal.textContent = criteria.targetHRText;
    if (hrRecommendation) hrRecommendation.textContent = criteria.intensityLabel;

    // อัปเดตสีกรอบของ BMI ตามเกณฑ์ปิงปองจราจร 7 สี
    const bmiCard = document.getElementById("res-bmi-metric-card");
    if (bmiCard) {
      bmiCard.className = `metric-card reg-bmi-card reg-bmi-${activeColor.key}`;
    }
    const pingpongTag = document.getElementById("res-bmi-pingpong-tag");
    if (pingpongTag) {
      pingpongTag.style.display = "inline-flex";
      pingpongTag.className = `metric-pingpong-tag pingpong-badge-${activeColor.key}`;
      pingpongTag.innerHTML = `● ${activeColor.colorName}`;
    }

    const guidelineCard = document.getElementById("res-guideline-card");
    if (guidelineCard) {
      guidelineCard.innerHTML = `
        <strong>💡 ข้อแนะนำสำหรับกลุ่มวัยของคุณ:</strong><br>
        • <strong>กิจกรรม:</strong> ${criteria.recommendation}<br>
        • <strong>ช่วงชีพจรที่ปลอดภัย:</strong> ${criteria.targetHRText}<br>
        • <strong>ประโยชน์หลัก:</strong> ${criteria.healthBenefit}
      `;
    }

    if (resultBox) {
      resultBox.style.display = "block";
    }

    if (shouldScroll) {
      try {
        if (typeof audioCues !== 'undefined' && audioCues.playCelebration) {
          audioCues.playCelebration();
        }
      } catch (e) {}
      setTimeout(() => {
        resultBox?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  }

  handleEnterApp() {
    try {
      const firstName = (document.getElementById("reg-first-name")?.value || "").trim() || "ผู้รัก";
      const lastName = (document.getElementById("reg-last-name")?.value || "").trim() || "สุขภาพ";
      const age = Number(document.getElementById("reg-age")?.value) || 30;
      const gender = (document.querySelector('input[name="reg-gender"]:checked')?.value) || "ชาย";
      const weight = parseFloat(document.getElementById("reg-weight")?.value) || 60;
      const height = parseFloat(document.getElementById("reg-height")?.value) || 165;
      const bmiResult = userStore.calculateBMI(weight, height);
      const ageGroup = userStore.determineAgeGroup(age);

      const regData = {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        age,
        gender,
        weight,
        height,
        bmi: bmiResult.bmi,
        category: bmiResult.category,
        badgeClass: bmiResult.badgeClass,
        pingpongColor: bmiResult.pingpongColor,
        pingpongName: bmiResult.pingpongName,
        ageGroup
      };

      if (this.isEditingUser && userStore.activeUserId) {
        userStore.saveProfile(regData);
        if (window.videoManager) {
          window.videoManager.showToastNotice("✅ แก้ไขข้อมูลส่วนตัวเรียบร้อยแล้ว");
        }
      } else {
        const newUser = userStore.register(regData);
        if (window.videoManager && newUser) {
          window.videoManager.resetSessionWarmup(newUser.id);
          window.videoManager.showToastNotice(`🎉 ยินดีต้อนรับ ${newUser.name} เข้าสู่ฟิตจอย!`);
        }
      }

      localStorage.setItem("fitjoy_onboarded", "true");
      this.closeOnboardingModal();
      this.refreshAllViews();

      try {
        if (typeof audioCues !== 'undefined' && audioCues.playCelebration) {
          audioCues.playCelebration();
        }
      } catch (e) {}
    } catch (err) {
      console.error("[Enter App Error]", err);
      this.closeOnboardingModal();
    }
  }

  bindRegistrationEvents() {
    const btnEnter = document.getElementById("btn-enter-website");
    if (btnEnter) {
      btnEnter.onclick = (e) => {
        e.preventDefault();
        this.handleEnterApp();
      };
    }

    const btnCloseOnboarding = document.getElementById("btn-close-onboarding-edit");
    if (btnCloseOnboarding) {
      btnCloseOnboarding.addEventListener("click", () => {
        this.closeOnboardingModal();
      });
    }

    const btnSwitchExisting = document.getElementById("btn-onboarding-switch-existing");
    if (btnSwitchExisting) {
      btnSwitchExisting.addEventListener("click", () => {
        this.closeOnboardingModal();
        this.openSwitchUserModal();
      });
    }

    const btnEdit = document.getElementById("btn-edit-registration");
    if (btnEdit) {
      btnEdit.addEventListener("click", () => {
        this.openOnboardingModal("edit");
      });
    }
  }

  bindNavigation() {
    const navItems = document.querySelectorAll(".bottom-nav-item");
    navItems.forEach(item => {
      item.addEventListener("click", () => {
        const targetTab = item.dataset.tab;
        this.switchTab(targetTab);
      });
    });

    const btnProfileTop = document.getElementById("btn-header-profile");
    if (btnProfileTop) {
      btnProfileTop.addEventListener("click", () => this.switchTab("profile"));
    }

    const btnFirstStep = document.getElementById("btn-hero-first-step");
    if (btnFirstStep) {
      btnFirstStep.addEventListener("click", () => {
        if (EXERCISES && EXERCISES[0]) {
          window.videoManager.openVideo(EXERCISES[0]);
        }
      });
    }
  }

  switchTab(tabId) {
    this.currentTab = tabId;

    const navItems = document.querySelectorAll(".bottom-nav-item");
    navItems.forEach(item => {
      if (item.dataset.tab === tabId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    const views = document.querySelectorAll(".app-tab-view");
    views.forEach(v => {
      if (v.id === `view-${tabId}`) {
        v.classList.add("active");
      } else {
        v.classList.remove("active");
      }
    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (tabId === "calendar" && window.workoutCalendar) {
      window.workoutCalendar.render();
    }

    if (tabId === "profile") {
      this.renderProfileView();
    }
  }

  bindSearchAndFilters() {
    const searchInput = document.getElementById("input-exercise-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderHomeExercises();
      });
    }

    const filterChips = document.querySelectorAll(".filter-chip");
    filterChips.forEach(chip => {
      chip.addEventListener("click", () => {
        filterChips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        this.currentCategory = chip.dataset.category;
        this.renderHomeExercises();
      });
    });
  }

  bindViewportSwitcher() {
    // ลบการสลับมุมมองจำลองมือถือออกตามความต้องการของผู้ใช้
  }

  bindSoundToggle() {
    const btnSound = document.getElementById("btn-toggle-sound");
    if (btnSound) {
      const updateText = () => {
        btnSound.textContent = audioCues.isEnabled ? "🔊 เปิดเสียง" : "🔇 ปิดเสียง";
      };
      updateText();
      btnSound.addEventListener("click", () => {
        audioCues.toggleSound();
        updateText();
      });
    }
  }

  renderHomeExercises() {
    const container = document.getElementById("home-exercises-grid");
    const countBadge = document.getElementById("home-exercises-count");
    if (!container) return;

    let filtered = EXERCISES.filter(ex => {
      const matchCat = (this.currentCategory === "ทั้งหมด") || (ex.category && ex.category.includes(this.currentCategory));
      const matchSearch = !this.searchQuery || 
        ex.title.toLowerCase().includes(this.searchQuery) ||
        (ex.englishTitle && ex.englishTitle.toLowerCase().includes(this.searchQuery)) ||
        (ex.benefits && ex.benefits.toLowerCase().includes(this.searchQuery));
      return matchCat && matchSearch;
    });

    if (countBadge) {
      countBadge.textContent = `${filtered.length} ท่าแนะนำ`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-search-state" style="text-align: center; padding: 30px; grid-column: span 2;">
          <div class="empty-icon" style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <p style="color: var(--text-muted); font-size: 14px;">ไม่พบท่าออกกำลังกายที่ตรงกับ "${this.searchQuery}"</p>
          <button type="button" class="btn-clear-search" style="margin-top: 10px; background: var(--primary-light); color: var(--primary); border: 1px solid #bae6fd; border-radius: 12px; padding: 6px 14px; cursor: pointer;" onclick="document.getElementById('input-exercise-search').value=''; window.app.searchQuery=''; window.app.renderHomeExercises();">
            ล้างคำค้นหา
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(ex => `
      <div class="exercise-card" data-id="${ex.id}" onclick="window.videoManager.openVideo(EXERCISES.find(e => e.id === '${ex.id}'))" style="cursor: pointer;">
        <div class="card-img-wrapper">
          ${ex.image ? `
            <img src="${encodeURI(ex.image)}" alt="${ex.title}" loading="lazy" class="exercise-photo" />
          ` : `
            <div class="card-img-placeholder">
              <div class="ph-icon-box">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              </div>
              <span class="ph-text">รอเพิ่มรูปภาพสำหรับผู้พัฒนา</span>
            </div>
          `}
          <span class="badge-level">${ex.level}</span>
          ${!ex.videoUrl ? '<span class="badge-placeholder">รอคลิปจากผู้พัฒนา</span>' : ''}
        </div>
        <div class="card-body">
          <div class="card-english-title">${ex.englishTitle}</div>
          <h3 class="card-thai-title">${ex.title}</h3>
          <div class="card-footer-info">
            <span class="info-duration">⏱️ ${ex.duration} | ${ex.frequency || '3–4 ครั้งต่อสัปดาห์'}</span>
            <button type="button" class="btn-card-play" title="กดดูรายละเอียดและออกกำลังกายตาม" onclick="event.stopPropagation(); window.videoManager.openVideo(EXERCISES.find(e => e.id === '${ex.id}'))">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `).join("");
  }

  renderKnowledgeView() {
    const ncdContainer = document.getElementById("knowledge-ncd-container");
    if (ncdContainer) {
      ncdContainer.innerHTML = NCDS_KNOWLEDGE.map(item => `
        <div class="ncd-card ncd-theme-${item.themeKey}" id="card-${item.id}">
          <div class="ncd-header">
            <span class="ncd-icon">${item.icon}</span>
            <div class="ncd-title-wrap">
              <h4 class="ncd-title">${item.name}</h4>
              <span class="ncd-badge-sub">${item.badgeLabel}</span>
            </div>
          </div>

          <!-- เนื้อหาสรุปสั้น (แสดงตลอดเวลา) -->
          <div class="ncd-summary-box">
            <p class="ncd-summary-text">${item.summary}</p>
          </div>

          <!-- เนื้อหาฉบับเต็ม (พับ-ขยายได้) -->
          <div class="ncd-expandable-content" id="detail-${item.id}" style="display: none;">
            <div class="ncd-detail-section">
              <div class="ncd-section-label">📌 ภาวะและสาเหตุของโรค:</div>
              <p class="ncd-desc-text">${item.description}</p>
            </div>

            <div class="ncd-detail-section warning-box">
              <div class="ncd-section-label">⚠️ ภาวะแทรกซ้อนและความเสี่ยง:</div>
              <p class="ncd-desc-text">${item.complications}</p>
            </div>

            <div class="ncd-detail-section prevention-box">
              <div class="ncd-section-label">💡 แนวทางป้องกันและปรับเปลี่ยนพฤติกรรม:</div>
              <p class="ncd-desc-text">${item.prevention}</p>
            </div>

            <div class="ncd-source-tag">
              <span class="source-icon">🏛️</span> ข้อมูลอ้างอิง: <strong>${item.source}</strong>
            </div>
          </div>

          <!-- ปุ่มกดพับ-ขยายอ่านเพิ่มเติม -->
          <button type="button" class="btn-ncd-toggle" data-target="detail-${item.id}">
            <span class="toggle-btn-text">📖 อ่านรายละเอียดเพิ่มเติม</span>
            <span class="toggle-btn-arrow">▼</span>
          </button>
        </div>
      `).join("");

      // ผูก Event ปุ่มกดพับ-ขยาย
      const toggleBtns = ncdContainer.querySelectorAll(".btn-ncd-toggle");
      toggleBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          const targetId = btn.dataset.target;
          const detailEl = document.getElementById(targetId);
          const textSpan = btn.querySelector(".toggle-btn-text");
          const arrowSpan = btn.querySelector(".toggle-btn-arrow");
          const card = btn.closest(".ncd-card");

          if (!detailEl) return;

          const isExpanded = detailEl.style.display !== "none";
          if (isExpanded) {
            detailEl.style.display = "none";
            btn.classList.remove("expanded");
            if (card) card.classList.remove("card-expanded");
            if (textSpan) textSpan.textContent = "📖 อ่านรายละเอียดเพิ่มเติม";
            if (arrowSpan) arrowSpan.textContent = "▼";
          } else {
            detailEl.style.display = "block";
            btn.classList.add("expanded");
            if (card) card.classList.add("card-expanded");
            if (textSpan) textSpan.textContent = "▲ ย่อข้อมูล";
            if (arrowSpan) arrowSpan.textContent = "▲";
          }
        });
      });
    }

    const fittContainer = document.getElementById("knowledge-fitt-container");
    if (fittContainer) {
      fittContainer.innerHTML = FITT_DATA.map(f => `
        <div class="fitt-card">
          <div class="fitt-badge">${f.letter}</div>
          <div class="fitt-content">
            <h4>${f.title}</h4>
            <div class="fitt-summary">${f.summary}</div>
            <p class="fitt-detail">${f.detail}</p>
          </div>
        </div>
      `).join("");
    }

    const ageContainer = document.getElementById("knowledge-age-container");
    if (ageContainer) {
      const keys = ["youth", "adult", "senior"];
      ageContainer.innerHTML = keys.map(k => {
        const c = AGE_CRITERIA[k];
        return `
          <div class="age-knowledge-card">
            <div class="age-badge-tag">${c.badgeText}</div>
            <h4>${c.label}</h4>
            <p class="age-rec-text"><strong>คำแนะนำกิจกรรม:</strong> ${c.recommendation}</p>
            <p class="age-target-text"><strong>ช่วงชีพจรเป้าหมาย:</strong> ${c.targetHRText}</p>
            <p class="age-benefit-text"><strong>ประโยชน์เด่น:</strong> ${c.healthBenefit}</p>
            <p class="age-safety-text"><strong>ข้อควรระวัง:</strong> ${c.safetyTips}</p>
          </div>
        `;
      }).join("");
    }
  }

  renderProfileView() {
    const profile = userStore.profile;

    const nameEl = document.getElementById("profile-display-name");
    const villageEl = document.getElementById("profile-display-village");
    const avatarEl = document.getElementById("profile-display-avatar");
    const totalMinsEl = document.getElementById("profile-stat-total-mins");
    const totalActsEl = document.getElementById("profile-stat-total-acts");

    if (nameEl) nameEl.textContent = profile.name || "ผู้รักสุขภาพชุมชน";
    if (villageEl) villageEl.textContent = profile.village;
    if (avatarEl) avatarEl.textContent = profile.gender === "หญิง" ? "👩" : "👨";

    const profAge = document.getElementById("prof-age");
    const profGender = document.getElementById("prof-gender");
    const profBmi = document.getElementById("prof-bmi");
    if (profAge) profAge.textContent = profile.age || "-";
    if (profGender) profGender.textContent = profile.gender || "-";
    if (profBmi) profBmi.textContent = profile.bmi ? `${profile.bmi} (${profile.bmiCategory})` : "-";

    const c = AGE_CRITERIA[profile.ageGroup] || AGE_CRITERIA.adult;
    const badgeAge = document.getElementById("prof-badge-age-group");
    const hrText = document.getElementById("prof-target-hr-text");
    const recText = document.getElementById("prof-guideline-rec-text");

    if (badgeAge) badgeAge.textContent = c.label;
    if (hrText) hrText.textContent = `🎯 ช่วงชีพจรเป้าหมาย: ${c.targetHRText}`;
    if (recText) recText.textContent = `📌 คำแนะนำ: ${c.recommendation}`;

    const totalMins = userStore.getWeeklyTotalMinutes();
    if (totalMinsEl) totalMinsEl.textContent = `${totalMins} นาที`;
    if (totalActsEl) totalActsEl.textContent = `${(userStore.history || []).length} ครั้ง`;

    // อัปเดตแถบสรุปด่วน อายุ / น้ำหนัก / ส่วนสูง
    const sumAge = document.getElementById("prof-summary-age");
    const sumWeight = document.getElementById("prof-summary-weight");
    const sumHeight = document.getElementById("prof-summary-height");
    if (sumAge) sumAge.textContent = profile.age || "-";
    if (sumWeight) sumWeight.textContent = profile.weight || "-";
    if (sumHeight) sumHeight.textContent = profile.height || "-";

    // เรนเดอร์การ์ดดัชนีมวลกาย BMI ปิงปองจราจร 7 สี
    this.renderBmiPingpongCard(profile);
  }

  // สรุปและสร้างโครงร่าง HTML การ์ด BMI ปิงปองจราจร 7 สี (ใช้ร่วมกันทั้งหน้าโปรไฟล์และป๊อปอัปหน้าลงทะเบียน)
  getBmiPingpongCardHtml(weight, height) {
    const bmiResult = userStore.calculateBMI(weight, height);
    const activeColor = bmiResult.info || BMI_7_COLORS[1];

    // คำนวณตำแหน่งเข็มชี้บนสเกล 15 ถึง 43
    const pointerPercent = Math.min(96, Math.max(4, ((bmiResult.bmi - 15) / (43 - 15)) * 100));

    return `
      <div class="bmi-card-inner">
        <!-- หัวการ์ด BMI -->
        <div class="bmi-header-row">
          <div class="bmi-header-left">
            <h3 class="bmi-card-title">ดัชนีมวลกาย (BMI)</h3>
            <span class="bmi-calc-formula">เกณฑ์เฝ้าระวังสุขภาพปิงปองจราจร 7 สี</span>
          </div>
          <div class="bmi-pingpong-active-pill pingpong-${activeColor.key}">
            <span class="pingpong-circle-dot"></span>
            <span>เกณฑ์${activeColor.colorName}</span>
          </div>
        </div>

        <!-- ตัวเลข BMI และสถานะระดับ -->
        <div class="bmi-score-hero-row">
          <div class="bmi-big-num-wrap">
            <span class="bmi-giant-val">${bmiResult.bmi > 0 ? bmiResult.bmi : '-'}</span>
            <span class="bmi-unit-label">kg/m²</span>
          </div>
          <div class="bmi-level-pill pingpong-pill-${activeColor.key}">
            ${activeColor.title}
          </div>
        </div>

        <!-- แถบสเกล 7 สี ปิงปองจราจร (Gauge Scale with Pointer) -->
        <div class="bmi-gauge-container">
          <div class="bmi-gauge-bar">
            <div class="gauge-segment seg-green-light" style="flex: 3.5;" title="สีเขียวอ่อน (< 18.5)"></div>
            <div class="gauge-segment seg-white" style="flex: 4.4;" title="สีขาว (18.5 - 22.9)"></div>
            <div class="gauge-segment seg-green-dark" style="flex: 2.0;" title="สีเขียวเข้ม (23.0 - 24.9)"></div>
            <div class="gauge-segment seg-yellow" style="flex: 5.0;" title="สีเหลือง (25.0 - 29.9)"></div>
            <div class="gauge-segment seg-orange" style="flex: 5.0;" title="สีส้ม (30.0 - 34.9)"></div>
            <div class="gauge-segment seg-red" style="flex: 5.0;" title="สีแดง (35.0 - 39.9)"></div>
            <div class="gauge-segment seg-black" style="flex: 3.0;" title="สีดำ (≥ 40.0)"></div>
          </div>
          <!-- เข็มชี้ระบุตำแหน่งปัจจุบัน -->
          ${bmiResult.bmi > 0 ? `
            <div class="bmi-gauge-pointer" style="left: ${pointerPercent}%;">
              <div class="pointer-pin pingpong-${activeColor.key}"></div>
              <div class="pointer-stem"></div>
            </div>
          ` : ''}
          <!-- ขีดตัวเลขช่วงกำกับ -->
          <div class="bmi-scale-labels-row">
            <span>15</span>
            <span>18.5</span>
            <span>23</span>
            <span>25</span>
            <span>30</span>
            <span>35</span>
            <span>40+</span>
          </div>
        </div>

        <!-- กล่องคำแนะนำสุขภาพตามเกณฑ์ปิงปองจราจรปัจจุบัน -->
        <div class="bmi-advice-card pingpong-box-${activeColor.key}">
          <div class="advice-card-header">
            <span class="advice-icon">💡</span>
            <strong>คำแนะนำสำหรับเกณฑ์${activeColor.colorName}:</strong>
          </div>
          <p class="advice-card-text">${activeColor.advice}</p>
        </div>

        <!-- รายการแจกแจงเกณฑ์ 7 สีครบถ้วน พร้อมไฮไลต์ระดับปัจจุบัน -->
        <div class="bmi-7colors-breakdown-section">
          <div class="breakdown-header-title">
            <span class="info-icon">ℹ️</span>
            <span>เกณฑ์ BMI ปิงปองจราจร 7 สี (เพื่อการเฝ้าระวังโรคไม่ติดต่อ NCDs)</span>
          </div>

          <div class="bmi-7colors-list">
            ${BMI_7_COLORS.map(c => {
              const isCurrent = (c.level === activeColor.level && bmiResult.bmi > 0);
              return `
                <div class="bmi-color-item ${isCurrent ? 'is-current-level current-' + c.key : ''}">
                  <div class="color-item-header">
                    <div class="color-item-left">
                      <span class="color-bullet-dot pingpong-${c.key}"></span>
                      <strong class="color-item-title">${c.title}</strong>
                      <span class="color-name-badge pingpong-badge-${c.key}">${c.colorName}</span>
                    </div>
                    <div class="color-item-right">
                      <span class="color-range-val">${c.rangeText}</span>
                      ${isCurrent ? `<span class="current-you-tag tag-${c.key}">📍 คุณอยู่เกณฑ์นี้</span>` : ''}
                    </div>
                  </div>
                  <p class="color-item-advice">${c.advice}</p>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="bmi-footnote-text">
          * ดัชนีมวลกาย (BMI) คำนวณจากน้ำหนัก (กก.) หารด้วยส่วนสูง (ม.) ยกกำลังสอง อ้างอิงตามเกณฑ์ปิงปองจราจร 7 สี กรมควบคุมโรค กระทรวงสาธารณสุข
        </div>
      </div>
    `;
  }

  // เรนเดอร์การ์ด BMI ปิงปองจราจร 7 สี พร้อมแถบสเกล เข็มชี้ และคำแนะนำสุขภาพในหน้าโปรไฟล์
  renderBmiPingpongCard(profile) {
    const container = document.getElementById("bmi-pingpong-card-container");
    if (!container) return;
    container.innerHTML = this.getBmiPingpongCardHtml(profile.weight, profile.height);
  }

  // ผูกปุ่มคลิกที่กรอบผลประเมิน BMI ในหน้าลงทะเบียน เพื่อเปิดป๊อปอัปเกณฑ์ปิงปองจราจร 7 สี
  bindBmiPopupModal() {
    const bmiCard = document.getElementById("res-bmi-metric-card");
    const modal = document.getElementById("bmi-pingpong-popup-modal");
    const btnClose = document.getElementById("btn-close-bmi-popup-modal");
    const btnDismiss = document.getElementById("btn-dismiss-bmi-popup-modal");
    const content = document.getElementById("bmi-popup-modal-content");

    if (bmiCard && modal && content) {
      const openModal = () => {
        const weight = this.tempRegistrationData?.weight || parseFloat(document.getElementById("reg-weight")?.value) || 0;
        const height = this.tempRegistrationData?.height || parseFloat(document.getElementById("reg-height")?.value) || 0;

        content.innerHTML = this.getBmiPingpongCardHtml(weight, height);
        modal.classList.add("active");
        modal.style.display = "flex";
      };

      bmiCard.addEventListener("click", openModal);
      bmiCard.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal();
        }
      });
    }

    const closeModal = () => {
      if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
      }
    };

    if (btnClose) btnClose.addEventListener("click", closeModal);
    if (btnDismiss) btnDismiss.addEventListener("click", closeModal);
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
      });
    }
  }

  // ผูกการทำงาน Modal อัปเดตน้ำหนักและส่วนสูงแบบด่วน
  bindQuickWeightEdit() {
    const btnOpen = document.getElementById("btn-quick-edit-weight");
    const backdrop = document.getElementById("quick-weight-modal-backdrop");
    const btnClose = document.getElementById("btn-close-quick-weight-modal");
    const btnCancel = document.getElementById("btn-cancel-quick-weight");
    const form = document.getElementById("form-quick-weight");
    const inpWeight = document.getElementById("quick-input-weight");
    const inpHeight = document.getElementById("quick-input-height");

    if (btnOpen && backdrop) {
      btnOpen.onclick = () => {
        const p = userStore.profile;
        if (inpWeight) inpWeight.value = p.weight || "";
        if (inpHeight) inpHeight.value = p.height || "";
        backdrop.style.display = "flex";
        document.body.style.overflow = "hidden";
      };
    }

    const closeModal = () => {
      if (backdrop) {
        backdrop.style.display = "none";
        document.body.style.overflow = "";
      }
    };

    if (btnClose) btnClose.onclick = closeModal;
    if (btnCancel) btnCancel.onclick = closeModal;
    if (backdrop) {
      backdrop.onclick = (e) => {
        if (e.target === backdrop) closeModal();
      };
    }

    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const w = parseFloat(inpWeight.value);
        const h = parseFloat(inpHeight.value);
        if (w > 0 && h > 0) {
          userStore.saveProfile({ weight: w, height: h });
          closeModal();
          this.refreshAllViews();
        }
      };
    }
  }
}

window.FitEasyApp = FitJoyApp;
document.addEventListener("DOMContentLoaded", () => {
  window.app = new FitJoyApp();
});

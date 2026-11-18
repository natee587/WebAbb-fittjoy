/**
 * FitEasy - YouTube Video Player & Anti-Seek Lock Manager
 * ควบคุมการเล่นวิดีโอ YouTube ในสัดส่วน 16:9 ขอบมน 16px และล็อกห้ามเลื่อนข้าม 100%
 */

class VideoManager {
  constructor() {
    this.player = null;
    this.localVideoEl = null;
    this.currentExercise = null;
    this.maxWatchedTime = 0;
    this.seekInterval = null;
    this.localSeekInterval = null;
    this.lastWarningToastTime = 0;
    this.isApiReady = false;
    this.pendingExercise = null;
    this.sessionWarmedUpUsers = {};
    this.routineRecordedThisSession = false;
    this.customUrls = JSON.parse(localStorage.getItem("fiteasy_custom_video_urls") || "{}");

    window.videoManager = this;

    this.initYouTubeApi();
    this.bindModalEvents();
    this.bindRoutineBanners();
  }

  recordRoutineTime(routineExercise, customSec = null) {
    if (!routineExercise || !window.userStore) return "";
    
    // ดึงเวลาจริงจากคลิปวิดีโอ หรือ customSec
    let durSec = customSec;
    if (durSec === null) {
      if (this.localVideoEl && this.localVideoEl.duration) {
        durSec = Math.round(this.localVideoEl.duration);
      } else if (this.player && typeof this.player.getDuration === "function" && this.player.getDuration() > 0) {
        durSec = Math.round(this.player.getDuration());
      } else {
        durSec = 60; // ขั้นต่ำ 1 นาที (60 วินาที) หากยังไม่มีคลิป
      }
    }

    // หากความยาวคลิปไม่ถึง 1 นาที ให้ปัดขึ้นเป็น 1 นาทีเต็ม (60 วินาที)
    durSec = Math.max(60, Math.round(durSec || 60));

    const mins = Math.floor(durSec / 60);
    const secs = durSec % 60;
    const durFormatted = secs > 0 ? `${mins} น. ${secs} วิ.` : `${mins} น.`;

    const isWarmup = routineExercise.id === "routine-warmup";
    const title = isWarmup 
      ? "ท่าบริหารร่างกายก่อนออกกำลังกาย (Warm-up)" 
      : "ท่ายืดเหยียดร่างกายหลังออกกำลังกาย (Cool Down)";

    userStore.addRecord({
      exerciseTitle: title,
      durationSeconds: durSec,
      durationMinutes: durSec / 60,
      durationFormatted: durFormatted,
      ageGroup: userStore.profile ? userStore.profile.ageGroup || "adult" : "adult",
      ageGroupLabel: isWarmup ? "อบอุ่นร่างกาย" : "ยืดเหยียดผ่อนคลาย",
      heartRate: "-",
      status: isWarmup ? "อบอุ่นร่างกายเรียบร้อย" : "ยืดเหยียดร่างกายเรียบร้อย",
      badgeClass: "badge-success",
      recommendation: isWarmup 
        ? "อบอุ่นร่างกายช่วยป้องกันการบาดเจ็บและเพิ่มประสิทธิภาพการออกกำลังกาย" 
        : "ช่วยคลายกล้ามเนื้อ ลดอาการปวดเมื่อย และปรับอัตราการเต้นของหัวใจสู่สภาวะปกติ"
    });

    if (window.app && window.app.renderDailyStatCard) {
      window.app.renderDailyStatCard();
    }

    return durFormatted;
  }

  resetSessionWarmup(userId) {
    if (userId) {
      delete this.sessionWarmedUpUsers[userId];
    } else {
      this.sessionWarmedUpUsers = {};
    }
  }

  isUserWarmedUp(userId) {
    return !!this.sessionWarmedUpUsers[userId];
  }

  markUserWarmedUp(userId) {
    this.sessionWarmedUpUsers[userId] = true;
  }

  bindRoutineBanners() {
    const btnWarmup = document.getElementById("btn-open-warmup");
    const btnCooldown = document.getElementById("btn-open-cooldown");
    if (btnWarmup) {
      btnWarmup.addEventListener("click", () => {
        const warmupEx = window.WARMUP_EXERCISE || (typeof WARMUP_EXERCISE !== "undefined" ? WARMUP_EXERCISE : null);
        if (warmupEx) {
          this.pendingExercise = null;
          this.openVideo(warmupEx, false);
        }
      });
    }
    if (btnCooldown) {
      btnCooldown.addEventListener("click", () => {
        const cooldownEx = window.COOLDOWN_EXERCISE || (typeof COOLDOWN_EXERCISE !== "undefined" ? COOLDOWN_EXERCISE : null);
        if (cooldownEx) {
          this.openVideo(cooldownEx, false);
        }
      });
    }
  }

  initYouTubeApi() {
    if (window.YT && window.YT.Player) {
      this.isApiReady = true;
      return;
    }

    // โหลด YouTube IFrame API แบบ Asynchronous
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      this.isApiReady = true;
    };
  }

  bindModalEvents() {
    const modal = document.getElementById("video-player-modal");
    if (!modal) return;

    const closeBtn = modal.querySelector(".video-modal-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeModal());
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });
  }

  // ดึง Video ID จาก URL รูปแบบต่างๆ ของ YouTube
  extractYouTubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  }

  openVideo(exercise, checkFirstTime = true) {
    if (!exercise) return;

    // ระบบนำทางอัตโนมัติ: หากคลิกออกกำลังกายครั้งแรกของรอบนี้ ให้เด้งไป Warm-up ก่อน
    // เมื่อสลับบัญชีหรือสร้างบัญชีใหม่ สถานะจะถูกรีเซ็ตและเด้ง Warm-up สำหรับคนนั้นเสมอ
    const warmupEx = window.WARMUP_EXERCISE || (typeof WARMUP_EXERCISE !== "undefined" ? WARMUP_EXERCISE : null);
    if (checkFirstTime && exercise.id !== "routine-warmup" && exercise.id !== "routine-cooldown" && warmupEx) {
      const activeUserId = (window.userStore && userStore.activeUserId) ? userStore.activeUserId : "default";

      // หากผู้ใช้นี้ยังไม่ได้ทำ Warm-up ในรอบนี้
      if (!this.isUserWarmedUp(activeUserId)) {
        this.markUserWarmedUp(activeUserId);
        this.pendingExercise = exercise; // บันทึกท่าที่ต้องการเล่นไว้

        if (window.audioCues && typeof audioCues.playBeep === "function") {
          audioCues.playBeep();
        }
        this.showToastNotice("🔔 เริ่มต้นออกกำลังกาย! เพื่อความปลอดภัย ระบบพาคุณมาวอร์มอัพ (Warm-up) ก่อนครับ ☀️");

        // เปิดหน้าต่าง Warm-up ทันที ไม่ต้องรอหน่วงเวลา
        this.openVideo(warmupEx, false);
        return;
      }
    }

    this.routineRecordedThisSession = false;
    this.currentExercise = exercise;
    const modal = document.getElementById("video-player-modal");
    if (!modal) return;

    // ตรวจสอบว่ามีการแก้ไข URL กำหนดเองหรือไม่
    const effectiveUrl = this.customUrls[exercise.id] || exercise.videoUrl;
    const videoId = this.extractYouTubeId(effectiveUrl);

    this.renderModalContent(exercise, videoId, effectiveUrl);
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    if (videoId) {
      this.initPlayer(videoId);
    } else if (effectiveUrl) {
      this.initLocalVideo();
    }
  }

  closeModal() {
    this.stopSeekMonitor();
    if (this.localSeekInterval) {
      clearInterval(this.localSeekInterval);
      this.localSeekInterval = null;
    }
    if (this.localVideoEl) {
      try {
        this.localVideoEl.pause();
        this.localVideoEl.removeAttribute("src");
        this.localVideoEl.load();
      } catch (e) {}
      this.localVideoEl = null;
    }
    if (this.player && this.player.destroy) {
      try {
        this.player.destroy();
      } catch (e) {}
      this.player = null;
    }
    const modal = document.getElementById("video-player-modal");
    if (modal) {
      modal.classList.remove("active");
    }
    document.body.style.overflow = "";

    // หากเป็นการดู Warm-up หรือ Cool Down และยังไม่ได้บันทึกเวลา ให้บันทึกเวลาสะสมทันที
    let routineTimeFormatted = "";
    if (this.currentExercise && (this.currentExercise.id === "routine-warmup" || this.currentExercise.id === "routine-cooldown")) {
      if (!this.routineRecordedThisSession) {
        this.routineRecordedThisSession = true;
        routineTimeFormatted = this.recordRoutineTime(this.currentExercise) || "1 น.";
      }

      if (this.currentExercise.id === "routine-cooldown" && window.userStore) {
        const activeUserId = userStore.activeUserId || "default";
        const todayStats = userStore.getTodayStats();
        localStorage.setItem(`fiteasy_cooldown_done_${activeUserId}`, todayStats.todayIso);
        if (routineTimeFormatted) {
          this.showToastNotice(`🧘‍♂️ บันทึกเวลายืดเหยียด Cool Down (+${routineTimeFormatted}) เรียบร้อยแล้ว สุขภาพดีเยี่ยมครับ!`);
        }
      }
      if (window.app && window.app.renderDailyStatCard) {
        window.app.renderDailyStatCard();
      }
    }

    // หากเพิ่งเสร็จจาก Warm-up และมีท่าที่ผู้ใช้เลือกไว้ค้างอยู่ ให้นำเข้าสู่ท่านั้นอัตโนมัติ
    if (this.pendingExercise) {
      const nextEx = this.pendingExercise;
      this.pendingExercise = null;
      setTimeout(() => {
        const noticeTxt = routineTimeFormatted 
          ? `✨ วอร์มอัพเรียบร้อยแล้ว (+${routineTimeFormatted})! กำลังเปิดท่า "${nextEx.title}" ▶`
          : `✨ วอร์มอัพเรียบร้อยแล้ว! กำลังเปิดท่า "${nextEx.title}" ▶`;
        this.showToastNotice(noticeTxt);
        setTimeout(() => {
          this.openVideo(nextEx, false);
        }, 700);
      }, 350);
    }
  }

  renderModalContent(exercise, videoId, effectiveUrl) {
    const titleEl = document.getElementById("video-modal-exercise-title");
    const container = document.getElementById("video-embed-container");

    if (titleEl) {
      titleEl.textContent = `${exercise.title} (${exercise.englishTitle || ''})`;
    }

    if (!container) return;

    if (videoId || effectiveUrl) {
      const playerHtml = videoId
        ? `<div id="youtube-player-mount"></div>`
        : `<video id="html5-video-player" class="native-video-player" src="${encodeURI(effectiveUrl)}" controls autoplay playsinline preload="auto"></video>`;

      // กรณีมี YouTube URL หรือไฟล์วิดีโอ MP4 ในเครื่อง: เรนเดอร์เครื่องเล่นพร้อมแถบล็อก
      container.innerHTML = `
        <div class="video-ratio-box">
          ${playerHtml}
        </div>
        <div class="video-lock-badge-bar">
          <span class="lock-icon">🔒</span>
          <span class="lock-text">ระบบล็อกแถบเลื่อน: กรุณาดูคลิปและทำตามจนจบเพื่อปลดล็อกการบันทึกชีพจร</span>
        </div>
        <div class="video-instructions-card">
          <h4>💡 ประโยชน์และคำแนะนำ:</h4>
          <p style="font-size: 13.5px; color: #475569; margin-bottom: 12px; line-height: 1.6;">${exercise.benefits || ''}</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #166534;">
            <strong>🎯 เป้าหมายการฝึก:</strong> ${exercise.duration} | ${exercise.frequency || '3–4 ครั้งต่อสัปดาห์'}<br>
            ${exercise.restTime ? `<strong>⏱️ เวลาพักระหว่างเซ็ต:</strong> ${exercise.restTime}` : ''}
          </div>
          <h4>📋 ขั้นตอนการปฏิบัติ:</h4>
          <div class="step-guide-list">
            ${(exercise.instructions || []).map((step, idx) => `
              <div class="step-item">
                <span class="step-num">${idx + 1}</span>
                <span class="step-txt">${step}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      let practiceBtnText = "⏱️ ทำกิจกรรมจบแล้ว บันทึกชีพจร / การประเมิน";
      if (exercise.id === "routine-warmup") {
        practiceBtnText = this.pendingExercise 
          ? `✨ วอร์มอัพเรียบร้อยแล้ว เข้าสู่ท่า "${this.pendingExercise.title}" เลย ▶`
          : "✨ วอร์มอัพเรียบร้อยแล้ว พร้อมเริ่มออกกำลังกาย!";
      } else if (exercise.id === "routine-cooldown") {
        practiceBtnText = "🧘 ยืดเหยียดผ่อนคลายร่างกายเสร็จสิ้น";
      }

      // กรณีไม่มี URL: แสดง Placeholder ว่าง "รอคลิปจากผู้พัฒนา"
      container.innerHTML = `
        ${exercise.id === "routine-warmup" && this.pendingExercise ? `
          <div style="background: linear-gradient(135deg, #fffbeb, #fef3c7); border: 2px solid #f59e0b; border-radius: 12px; padding: 12px 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(245,158,11,0.15);">
            <span style="font-size: 26px;">☀️</span>
            <div style="font-size: 13.5px; color: #92400e; line-height: 1.5;">
              <strong>เริ่มออกกำลังกายรอบใหม่!</strong> เพื่อความปลอดภัยและป้องกันการบาดเจ็บ ระบบพาคุณมาวอร์มอัพ (Warm-up) ร่างกายก่อน<br>
              เมื่อวอร์มอัพเสร็จ จะเปิดท่า <strong>"${this.pendingExercise.title}"</strong> ให้ทันทีครับ
            </div>
          </div>
        ` : ''}
        ${exercise.id === "routine-cooldown" ? `
          <div style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 2px solid #10b981; border-radius: 12px; padding: 12px 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(16,185,129,0.15);">
            <span style="font-size: 26px;">🧘‍♂️</span>
            <div style="font-size: 13.5px; color: #065f46; line-height: 1.5;">
              <strong>ยอดเยี่ยมมาก! วันนี้คุณออกกำลังกายครบตามเกณฑ์เป้าหมายแล้ว 🎉</strong><br>
              เข้าสู่ช่วงการยืดเหยียดร่างกาย (Cool Down) เพื่อลดอัตราการเต้นของหัวใจและผ่อนคลายกล้ามเนื้ออย่างปลอดภัยครับ
            </div>
          </div>
        ` : ''}
        <div class="video-placeholder-card">
          <div class="placeholder-icon">${exercise.id === 'routine-warmup' ? '☀️' : (exercise.id === 'routine-cooldown' ? '🧘‍♂️' : '📹')}</div>
          <h3 class="placeholder-title">${exercise.id === 'routine-warmup' ? 'คลิปวิดีโอ Warm-up (รอคลิปจากผู้พัฒนา)' : (exercise.id === 'routine-cooldown' ? 'คลิปวิดีโอ Cool Down (รอคลิปจากผู้พัฒนา)' : 'รอคลิปจากผู้พัฒนา')}</h3>
          <p class="placeholder-desc">
            ${exercise.id === 'routine-warmup' || exercise.id === 'routine-cooldown'
              ? 'ขณะนี้อยู่ในระหว่างจัดทำคลิปวิดีโอสาธิตเพื่อสุขภาพ ท่านสามารถปฏิบัติตามคำแนะนำและขั้นตอนด้านล่างได้ทันที'
              : 'ขณะนี้อยู่ในระหว่างจัดทำคลิปวิดีโอสาธิตท่าทางที่ถูกต้องสำหรับชุมชน โดยระบบจะมาพร้อมการล็อกห้ามข้ามคลิปเพื่อให้ดูและฝึกตามจนจบ'}
          </p>
          <div class="video-lock-badge-bar" style="margin: 12px 0;">
            <span class="lock-icon">🔒</span>
            <span class="lock-text">ระบบห้ามข้ามคลิป: ให้ดูคลิปจนจบเพื่อความปลอดภัยสูงสุดต่อสุขภาพ</span>
          </div>
          <div class="placeholder-buttons">
            <button type="button" class="btn-direct-practice" id="btn-practice-placeholder">
              ${practiceBtnText}
            </button>
          </div>
        </div>
        
        <div class="video-instructions-card">
          <h4>💡 ประโยชน์และคำแนะนำ:</h4>
          <p style="font-size: 13.5px; color: #475569; margin-bottom: 12px; line-height: 1.6;">${exercise.benefits || ''}</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #166534;">
            <strong>🎯 เป้าหมายการฝึก:</strong> ${exercise.duration} | ${exercise.frequency || '3–4 ครั้งต่อสัปดาห์'}<br>
            ${exercise.restTime ? `<strong>⏱️ เวลาพักระหว่างเซ็ต:</strong> ${exercise.restTime}` : ''}
          </div>
          <h4>📋 ขั้นตอนการปฏิบัติ:</h4>
          <div class="step-guide-list">
            ${(exercise.instructions || []).map((step, idx) => `
              <div class="step-item">
                <span class="step-num">${idx + 1}</span>
                <span class="step-txt">${step}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // ผูก Event ปุ่มใน Placeholder
      const btnPractice = container.querySelector("#btn-practice-placeholder");
      if (btnPractice) {
        btnPractice.addEventListener("click", () => {
          const ex = this.currentExercise;
          if (ex && (ex.id === "routine-warmup" || ex.id === "routine-cooldown")) {
            if (!this.routineRecordedThisSession) {
              this.routineRecordedThisSession = true;
              this.recordRoutineTime(ex, 60);
            }
          }
          this.closeModal();
          if (ex && ex.id !== "routine-warmup" && ex.id !== "routine-cooldown") {
            if (window.postWorkoutModal) {
              window.postWorkoutModal.open(ex, 60);
            }
          }
        });
      }
    }
  }

  triggerWarningNotice() {
    const now = Date.now();
    if (now - this.lastWarningToastTime < 2200) return;
    this.lastWarningToastTime = now;

    if (window.audioCues && typeof audioCues.playWarning === "function") {
      audioCues.playWarning();
    }
    this.showToastNotice("กรุณาดูคลิปและทำตามจนจบตามเวลาจริง เพื่อความปลอดภัยและประโยชน์สูงสุดต่อสุขภาพครับ 🔒");
  }

  initLocalVideo() {
    this.maxWatchedTime = 0;
    this.localVideoEl = document.getElementById("html5-video-player");
    if (!this.localVideoEl) return;

    if (this.localSeekInterval) {
      clearInterval(this.localSeekInterval);
      this.localSeekInterval = null;
    }

    // ฟังก์ชันบังคับล็อกแถบเวลา ไม่ให้ข้ามเกิน maxWatchedTime (Snap-Back)
    const enforceTimeLock = (showWarning = false) => {
      if (!this.localVideoEl) return;
      const current = this.localVideoEl.currentTime;

      // หากข้ามไปข้างหน้าเกินกว่าที่ดูจริง + 0.6 วินาที
      if (current > this.maxWatchedTime + 0.6) {
        this.localVideoEl.currentTime = this.maxWatchedTime;
        if (showWarning) {
          this.triggerWarningNotice();
        }
      } else if (!this.localVideoEl.paused && current > this.maxWatchedTime) {
        // อัปเดตเวลาที่ดูจริงเฉพาะตอนกำลังเล่นตามปกติ
        this.maxWatchedTime = current;
      }
    };

    // ดักจับทุกสถานะ: เมื่อกำลังเลื่อน, เลื่อนเสร็จ, กำลังเล่น, หรืออัปเดตเวลา
    this.localVideoEl.addEventListener("seeking", () => enforceTimeLock(true));
    this.localVideoEl.addEventListener("seeked", () => enforceTimeLock(true));
    this.localVideoEl.addEventListener("timeupdate", () => enforceTimeLock(false));
    this.localVideoEl.addEventListener("play", () => enforceTimeLock(true));
    this.localVideoEl.addEventListener("pause", () => enforceTimeLock(true));

    // ตัวตรวจสอบความถี่สูง (120ms) เพื่อดักจับทุกเบราว์เซอร์ทั้งบนคอมและมือถือ แม้ขณะกดหยุด (Pause)
    this.localSeekInterval = setInterval(() => {
      if (!this.localVideoEl) return;
      const current = this.localVideoEl.currentTime;
      if (current > this.maxWatchedTime + 0.6) {
        this.localVideoEl.currentTime = this.maxWatchedTime;
        this.triggerWarningNotice();
      } else if (!this.localVideoEl.paused && current > this.maxWatchedTime) {
        this.maxWatchedTime = current;
      }
    }, 120);

    // เมื่อดูคลิปจบ 100% -> ปลดล็อกบันทึกชีพจร/ประเมินผลอัตโนมัติ
    this.localVideoEl.addEventListener("ended", () => {
      if (this.localSeekInterval) {
        clearInterval(this.localSeekInterval);
        this.localSeekInterval = null;
      }
      let durationSec = 60;
      if (this.localVideoEl) {
        const rawDur = this.localVideoEl.duration || this.localVideoEl.currentTime || 0;
        durationSec = Math.max(60, Math.round(rawDur));
      }
      const ex = this.currentExercise;
      if (ex && (ex.id === "routine-warmup" || ex.id === "routine-cooldown")) {
        if (!this.routineRecordedThisSession) {
          this.routineRecordedThisSession = true;
          this.recordRoutineTime(ex, durationSec);
        }
        this.closeModal();
        return;
      }

      this.closeModal();
      if (ex) {
        if (window.postWorkoutModal) {
          window.postWorkoutModal.open(ex, durationSec);
        }
      }
    });

    // สั่งเริ่มเล่นวิดีโอทันทีอัตโนมัติ (Autoplay)
    try {
      const playPromise = this.localVideoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          // หากเบราว์เซอร์มีนโยบายบล็อกเสียง ให้เปิดแบบปิดเสียงเริ่มต้นเพื่อให้วิดีโอวิ่งอัตโนมัติ
          console.warn("Autoplay with audio blocked, fallback to muted:", e);
          if (this.localVideoEl) {
            this.localVideoEl.muted = true;
            this.localVideoEl.play().catch(() => {});
          }
        });
      }
    } catch (e) {}
  }

  initPlayer(videoId) {
    this.maxWatchedTime = 0;
    this.stopSeekMonitor();

    const checkReady = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(checkReady);
        this.player = new YT.Player("youtube-player-mount", {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1
          },
          events: {
            onReady: (event) => {
              try {
                event.target.playVideo();
              } catch (e) {}
            },
            onStateChange: (event) => this.onPlayerStateChange(event)
          }
        });
      }
    }, 100);
  }

  checkYouTubeSeek(showWarning = true) {
    if (!this.player || typeof this.player.getCurrentTime !== "function") return;
    const currentTime = this.player.getCurrentTime();

    if (currentTime > this.maxWatchedTime + 0.8) {
      this.player.seekTo(this.maxWatchedTime, true);
      if (showWarning) {
        this.triggerWarningNotice();
      }
    } else if (currentTime > this.maxWatchedTime) {
      this.maxWatchedTime = currentTime;
    }
  }

  onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
      this.startSeekMonitor();
      this.checkYouTubeSeek(true);
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
      this.checkYouTubeSeek(true);
    } else if (event.data === YT.PlayerState.ENDED) {
      // ดูคลิปจนจบ 100% -> ปลดล็อกระบบวัดชีพจรหลังออกกำลังกายทันที!
      this.stopSeekMonitor();
      let durationSec = 60;
      if (this.player && typeof this.player.getDuration === "function") {
        const rawDur = this.player.getDuration();
        durationSec = Math.max(60, Math.round(rawDur || 0));
      }
      const ex = this.currentExercise;
      if (ex && (ex.id === "routine-warmup" || ex.id === "routine-cooldown")) {
        if (!this.routineRecordedThisSession) {
          this.routineRecordedThisSession = true;
          this.recordRoutineTime(ex, durationSec);
        }
        this.closeModal();
        return;
      }

      this.closeModal();
      if (ex) {
        if (window.postWorkoutModal) {
          window.postWorkoutModal.open(ex, durationSec);
        }
      }
    }
  }

  startSeekMonitor() {
    this.stopSeekMonitor();
    this.seekInterval = setInterval(() => {
      this.checkYouTubeSeek(true);
    }, 200);
  }

  stopSeekMonitor() {
    if (this.seekInterval) {
      clearInterval(this.seekInterval);
      this.seekInterval = null;
    }
  }

  showToastNotice(msg) {
    let toast = document.getElementById("fiteasy-toast-notice");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "fiteasy-toast-notice";
      toast.className = "toast-notice-box";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("visible");
    setTimeout(() => {
      toast.classList.remove("visible");
    }, 3200);
  }
}

// Global instance reference
let videoManager = window.videoManager || null;

/**
 * ฟิตจอย - YouTube Video Player & Anti-Seek Lock Manager
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
    this.customUrls = JSON.parse(localStorage.getItem((localStorage.getItem("fitjoy_custom_video_urls") ? "fitjoy_custom_video_urls" : "fiteasy_custom_video_urls")) || "{}");

    window.videoManager = this;

    this.initYouTubeApi();
    this.bindModalEvents();
    this.bindRoutineBanners();
  }

  recordRoutineTime(routineExercise, customSec = null) {
    if (!routineExercise || !window.userStore) return "";
    
    // ดึงเวลาจริงจากตาราง EXERCISE_EXACT_DURATIONS หรือคลิปวิดีโอ หรือ customSec
    let durSec = customSec;
    if (durSec === null) {
      const exact = (typeof getExactExerciseDuration === 'function')
        ? getExactExerciseDuration(routineExercise)
        : null;
      if (exact && exact.durationSeconds) {
        durSec = exact.durationSeconds;
      } else if (routineExercise.durationSeconds) {
        durSec = routineExercise.durationSeconds;
      } else if (this.localVideoEl && this.localVideoEl.duration) {
        durSec = Math.round(this.localVideoEl.duration);
      } else if (this.player && typeof this.player.getDuration === "function" && this.player.getDuration() > 0) {
        durSec = Math.round(this.player.getDuration());
      } else {
        durSec = 60;
      }
    }

    durSec = Math.round(durSec || 60);

    const mins = Math.floor(durSec / 60);
    const secs = durSec % 60;
    const durFormatted = secs > 0 ? `${mins} น. ${secs} วิ.` : `${mins} น.`;
    const durDisplay = secs > 0 ? `${mins} นาที ${secs} วินาที` : `${mins} นาที`;

    const isWarmup = routineExercise.id === "routine-warmup";
    const title = isWarmup 
      ? "ท่าบริหารร่างกายก่อนออกกำลังกาย (Warm-up)" 
      : "ท่ายืดเหยียดร่างกายหลังออกกำลังกาย (Cool Down)";

    userStore.addRecord({
      exerciseTitle: title,
      durationSeconds: durSec,
      durationMinutes: durSec / 60,
      durationFormatted: durFormatted,
      durationDisplay: durDisplay,
      ageGroup: userStore.profile ? userStore.profile.ageGroup || "adult" : "adult",
      ageGroupLabel: isWarmup ? "อบอุ่นร่างกาย" : "ยืดเหยียดผ่อนคลาย",
      heartRate: "-",
      status: isWarmup ? "อบอุ่นร่างกายเรียบร้อย" : "ยืดเหยียดร่างกายเรียบร้อย",
      badgeClass: "badge-success",
      recommendation: isWarmup 
        ? "อบอุ่นร่างกายช่วยป้องกันการบาดเจ็บและเพิ่มประสิทธิภาพการออกกำลังกาย" 
        : "ช่วยคลายกล้ามเนื้อ ลดอาการปวดเมื่อย และปรับอัตราการเต้นของหัวใจสู่สภาวะปกติ"
    });

    if (window.app && window.app.refreshAllViews) {
      window.app.refreshAllViews();
    } else if (window.app && window.app.renderDailyStatCard) {
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
      btnWarmup.addEventListener("click", (e) => {
        if (e.target && e.target.closest && e.target.closest("#btn-dl-warmup-card")) return;
        const warmupEx = window.WARMUP_EXERCISE || (typeof WARMUP_EXERCISE !== "undefined" ? WARMUP_EXERCISE : null);
        if (warmupEx) {
          this.pendingExercise = null;
          this.openVideo(warmupEx, false);
        }
      });
    }
    if (btnCooldown) {
      btnCooldown.addEventListener("click", (e) => {
        if (e.target && e.target.closest && e.target.closest("#btn-dl-cooldown-card")) return;
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

  openVideo(exercise) {
    if (!exercise) return;

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
        localStorage.setItem(`fitjoy_cooldown_done_${activeUserId}`, todayStats.todayIso);
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

    let practiceBtnText = "⏱️ ปฏิบัติกิจกรรมเสร็จแล้ว บันทึกชีพจร & เวลา";
    if (exercise.id === "routine-warmup") {
      practiceBtnText = "☀️ วอร์มอัพร่างกายเสร็จสิ้น บันทึกเวลา";
    } else if (exercise.id === "routine-cooldown") {
      practiceBtnText = "🧘‍♂️ ยืดเหยียดผ่อนคลายร่างกายเสร็จสิ้น บันทึกเวลา";
    }

    const isYouTube = Boolean(videoId);
    const hasVideo = Boolean(effectiveUrl);

    const isWarmupRoutine = exercise.id === "routine-warmup";
    const isCooldownRoutine = exercise.id === "routine-cooldown";
    const routineDlLabel = isWarmupRoutine ? "ดาวน์โหลดคลิปวอร์มอัพไว้ดูออฟไลน์" : (isCooldownRoutine ? "ดาวน์โหลดคลิปคูลดาวน์ไว้ดูออฟไลน์" : "ดาวน์โหลดคลิปนี้ไว้ดูออฟไลน์");
    const routineDlSavedLabel = isWarmupRoutine ? "✓ บันทึกคลิปวอร์มอัพในเครื่องแล้ว (ดูออฟไลน์ได้)" : (isCooldownRoutine ? "✓ บันทึกคลิปคูลดาวน์ในเครื่องแล้ว (ดูออฟไลน์ได้)" : "✓ บันทึกคลิปในเครื่องแล้ว (ดูออฟไลน์ได้)");
    const routineSuccessNotice = isWarmupRoutine ? "✅ ดาวน์โหลดคลิปวอร์มอัพไว้ดูออฟไลน์เรียบร้อยแล้ว!" : (isCooldownRoutine ? "✅ ดาวน์โหลดคลิปคูลดาวน์ไว้ดูออฟไลน์เรียบร้อยแล้ว!" : "✅ ดาวน์โหลดคลิปนี้ไว้ดูออฟไลน์เรียบร้อยแล้ว!");

    let mediaHtml = "";
    if (hasVideo && isYouTube) {
      mediaHtml = `
        <div class="video-iframe-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 14px; margin-bottom: 10px; background: #000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <div id="youtube-player-mount"></div>
        </div>
        <div class="video-lock-badge-bar" style="margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; background: #fef2f2; border: 1.5px solid #fecaca; color: #b91c1c; padding: 10px 14px; border-radius: 12px; font-size: 13px; font-weight: 600;">
          <span class="lock-icon" style="font-size: 16px;">🔒</span>
          <span class="lock-text">ระบบล็อกแถบเลื่อน: กรุณาดูคลิปและทำตามจนจบเพื่อปลดล็อกการประเมินผลชีพจร & คำพูด</span>
        </div>
      `;
    } else if (hasVideo) {
      mediaHtml = `
        <div class="video-player-wrapper" style="border-radius: 14px; overflow: hidden; margin-bottom: 8px; background: #000; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <video id="html5-video-player" class="native-video-player" src="${encodeURI(effectiveUrl)}" poster="${exercise.image ? encodeURI(exercise.image) : ''}" controls playsinline preload="metadata" style="width: 100%; max-height: 280px; display: block; margin: 0 auto; outline: none;"></video>
        </div>
        <div class="video-lock-badge-bar" style="margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; background: #fef2f2; border: 1.5px solid #fecaca; color: #b91c1c; padding: 10px 14px; border-radius: 12px; font-size: 13px; font-weight: 600;">
          <span class="lock-icon" style="font-size: 16px;">🔒</span>
          <span class="lock-text">ระบบล็อกแถบเลื่อน: กรุณาดูคลิปและทำตามจนจบเพื่อปลดล็อกการประเมินผลชีพจร & คำพูด</span>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
          <button type="button" id="btn-cache-current-video" style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 20px; padding: 6px 14px; font-size: 12.5px; color: #1d4ed8; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; transition: all 0.2s;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span id="cache-text-current">${routineDlLabel}</span>
          </button>
        </div>
      `;
    } else {
      mediaHtml = `
        <div class="exercise-guide-hero" style="border-radius: 14px; overflow: hidden; margin-bottom: 14px; background: #f8fafc; text-align: center; border: 1.5px solid #e2e8f0;">
          ${exercise.image ? `
            <img src="${encodeURI(exercise.image)}" alt="${exercise.title}" style="max-height: 260px; width: 100%; object-fit: contain; background: #ffffff; padding: 8px; border-radius: 14px;" />
          ` : `
            <div style="padding: 40px; font-size: 54px;">${exercise.id === 'routine-warmup' ? '☀️' : (exercise.id === 'routine-cooldown' ? '🧘‍♂️' : '🏃')}</div>
          `}
        </div>
      `;
    }

    container.innerHTML = `
      ${mediaHtml}

      <!-- แถบข้อมูลสรุปเป้าหมายและความหนัก -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-bottom: 14px;">
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #0369a1;">
          <strong>🎯 เป้าหมาย:</strong> ${exercise.duration || '1–2 นาที'}
        </div>
        <div style="background: #fdf4ff; border: 1px solid #f5d0fe; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #86198f;">
          <strong>🔄 ความถี่:</strong> ${exercise.frequency || '3–4 ครั้ง/สัปดาห์'}
        </div>
        <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #854d0e;">
          <strong>👥 กลุ่มวัย:</strong> ${exercise.suitableAge || exercise.level || 'ทุกกลุ่มวัย'}
        </div>
      </div>

      <!-- กล่องคำแนะนำและประโยชน์ -->
      <div class="video-instructions-card" style="margin-top: 0;">
        <h4>💡 ประโยชน์และคำแนะนำเพื่อสุขภาพ:</h4>
        <p style="font-size: 13.5px; color: #475569; margin-bottom: 12px; line-height: 1.6;">${exercise.benefits || 'ช่วยเสริมสร้างสุขภาพและความแข็งแรงของร่างกาย'}</p>
        
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

      <!-- พื้นที่ปุ่มประเมินผล: แสดงปุ่มเฉพาะกรณีไม่มีคลิปวิดีโอ (หากมีคลิประบบจะบังคับดูจนจบแล้วปลดล็อกอัตโนมัติ) -->
      ${!hasVideo ? `
        <div style="margin-top: 18px;">
          <button type="button" class="btn-direct-practice" id="btn-practice-guide" style="width: 100%; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white; border: none; border-radius: 14px; padding: 14px 20px; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35); font-family: inherit;">
            ${practiceBtnText}
          </button>
        </div>
      ` : `
        <div style="margin-top: 16px; text-align: center; padding: 14px 16px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; color: #475569; font-size: 13.5px; line-height: 1.6;">
          🔒 <strong>ระบบล็อกห้ามเลื่อนข้ามคลิป:</strong> กรุณาดูและฝึกตามจนจบคลิป<br>
          <span style="color: #0284c7; font-weight: 600;">เมื่อคลิปเล่นจบ ระบบจะเปิดหน้าต่างประเมินชีพจร (15 วิ / 60 วิ) และแบบประเมินคำพูดให้อัตโนมัติครับ</span>
        </div>
      `}
    `;

    // ผูก Event ปุ่มกดบันทึกกิจกรรม (สำหรับกรณีไม่มีวิดีโอ)
    const btnPractice = container.querySelector("#btn-practice-guide");
    if (btnPractice) {
      btnPractice.addEventListener("click", () => {
        const ex = this.currentExercise;
        this.closeModal();

        if (ex && (ex.id === "routine-warmup" || ex.id === "routine-cooldown")) {
          this.recordRoutineTime(ex, 120);
          this.showToastNotice(`✨ บันทึกเวลา ${ex.title} เรียบร้อยแล้วครับ!`);
          if (window.app && window.app.renderDailyStatCard) {
            window.app.renderDailyStatCard();
          }
          return;
        }

        if (ex) {
          if (window.postWorkoutModal) {
            window.postWorkoutModal.open(ex, 120);
          }
        }
      });
    }

    // ผูก Event ปุ่มดาวน์โหลดคลิปนี้ไว้ดูออฟไลน์
    const btnCacheCurrent = container.querySelector("#btn-cache-current-video");
    if (btnCacheCurrent && hasVideo && !isYouTube) {
      const videoPath = effectiveUrl;
      if (window.offlineVideoManager) {
        window.offlineVideoManager.isVideoCached(videoPath).then(isCached => {
          if (isCached) {
            btnCacheCurrent.style.background = "#f0fdf4";
            btnCacheCurrent.style.borderColor = "#86efac";
            btnCacheCurrent.style.color = "#15803d";
            btnCacheCurrent.innerHTML = `<span>${routineDlSavedLabel}</span>`;
          } else {
            btnCacheCurrent.style.background = "#eff6ff";
            btnCacheCurrent.style.borderColor = "#bfdbfe";
            btnCacheCurrent.style.color = "#1d4ed8";
            btnCacheCurrent.innerHTML = `<span>💾 ${routineDlLabel}</span>`;
          }
        });
      }

      btnCacheCurrent.addEventListener("click", async () => {
        if (!navigator.onLine) {
          alert("กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อเริ่มดาวน์โหลดคลิปเก็บไว้ในเครื่องครับ");
          return;
        }
        btnCacheCurrent.disabled = true;
        btnCacheCurrent.innerHTML = "<span>⏳ กำลังดาวน์โหลดคลิป...</span>";
        if (window.offlineVideoManager) {
          const success = await window.offlineVideoManager.cacheSingleVideo(videoPath);
          if (success) {
            btnCacheCurrent.style.background = "#f0fdf4";
            btnCacheCurrent.style.borderColor = "#86efac";
            btnCacheCurrent.style.color = "#15803d";
            btnCacheCurrent.innerHTML = `<span>${routineDlSavedLabel}</span>`;
            this.showToastNotice(routineSuccessNotice);
            if (window.offlineVideoManager.checkCachedVideosCount) {
              window.offlineVideoManager.checkCachedVideosCount();
            }
          } else {
            btnCacheCurrent.disabled = false;
            btnCacheCurrent.innerHTML = "<span>❌ ไม่สามารถดาวน์โหลดได้ ลองใหม่อีกครั้ง</span>";
          }
        }
      });
    }

    // เริ่มต้นตัวเล่นวิดีโอ (ถ้ามี)
    if (hasVideo) {
      if (isYouTube) {
        this.initPlayer(videoId);
      } else {
        this.initLocalVideo();
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
      const ex = this.currentExercise;
      const exact = (typeof getExactExerciseDuration === 'function')
        ? getExactExerciseDuration(ex)
        : null;
      let durationSec = exact?.durationSeconds || ex?.durationSeconds || 60;
      if (this.localVideoEl && (!exact || !exact.durationSeconds)) {
        const rawDur = this.localVideoEl.duration || this.localVideoEl.currentTime || 0;
        if (rawDur > 0) durationSec = Math.round(rawDur);
      }
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
      const ex = this.currentExercise;
      const exact = (typeof getExactExerciseDuration === 'function')
        ? getExactExerciseDuration(ex)
        : null;
      let durationSec = exact?.durationSeconds || ex?.durationSeconds || 60;
      if (this.player && typeof this.player.getDuration === "function" && (!exact || !exact.durationSeconds)) {
        const rawDur = this.player.getDuration();
        if (rawDur > 0) durationSec = Math.round(rawDur);
      }
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
    let toast = document.getElementById("fitjoy-toast-notice");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "fitjoy-toast-notice";
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

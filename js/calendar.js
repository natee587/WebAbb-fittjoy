/**
 * ฟิตจอย - Interactive Workout Calendar Module
 * ปฏิทินบันทึกผลเวลาการออกกำลังกายในแต่ละวัน & สรุปผลรายสัปดาห์
 * - เกณฑ์รายวัน: ผู้ใหญ่/สูงอายุ >= 30 นาที (เขียว ผ่าน), < 30 นาที (แดง ไม่ผ่าน) | วัยรุ่น 60 นาที
 * - เกณฑ์รายสัปดาห์: ผ่าน >= 3 วันต่อสัปดาห์ = สัปดาห์ผ่าน (เขียว), < 3 วัน = ยังไม่ผ่าน (แดง)
 * - สรุปผลรายสัปดาห์เด่น ชัดเจน ตัวหนังสือน้อย คลิกดูประวัติย้อนหลังได้ทุกวัน
 * - ปุ่มดูประวัติทั้งหมด & ส่งออก PDF  ในรูปแบบ Modal สวยงาม
 */

class WorkoutCalendar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);

    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth(); // 0-11

    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    this.selectedDateStr = `${y}-${m}-${d}`;

    this.monthNamesThai = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];

    this.weekdayNamesThai = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  }

  init() {
    this.render();
  }

  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.render();
  }

  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.render();
  }

  goToToday() {
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    this.selectedDateStr = `${y}-${m}-${d}`;
    this.render();
  }

  getSelectedDayFormattedThai() {
    if (!this.selectedDateStr) return "";
    const parts = this.selectedDateStr.split("-");
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    const dateObj = new Date(y, m, d);
    const dayOfWeekThai = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"][dateObj.getDay()];
    return `${dayOfWeekThai}ที่ ${d} ${this.monthNamesThai[m]} พ.ศ. ${y + 543}`;
  }

  render() {
    if (!this.container) return;

    const monthThai = this.monthNamesThai[this.currentMonth];
    const yearThai = this.currentYear + 543;

    // ดึงสถิติของเดือนปัจจุบัน
    const stats = userStore.getMonthStats(this.currentYear, this.currentMonth);
    const activeUser = userStore.profile;
    const targetMinsPerDay = userStore.getDailyTargetMinutes();
    const totalRecordsCount = (userStore.history || []).length;

    this.container.innerHTML = `
      <div class="calendar-card-wrapper">
        
        <!-- Header เดือน & การนำทาง -->
        <div class="calendar-nav-bar">
          <div class="calendar-month-title">
            <h2>📅 ${monthThai} ${yearThai}</h2>
            <div class="calendar-meta-tags">
              <span class="calendar-user-badge">สำหรับ: คุณ${activeUser.name || 'สมาชิก'}</span>
              <span class="calendar-target-badge">🎯 เกณฑ์ประจำวัน: ${targetMinsPerDay} นาที/วัน</span>
            </div>
          </div>
          <div class="calendar-nav-actions">
            <div class="calendar-nav-buttons">
              <button type="button" class="btn-cal-nav" id="btn-cal-prev" title="เดือนก่อนหน้า">◀</button>
              <button type="button" class="btn-cal-nav-today" id="btn-cal-today">วันนี้</button>
              <button type="button" class="btn-cal-nav" id="btn-cal-next" title="เดือนถัดไป">▶</button>
            </div>
          </div>
        </div>

        <!-- การ์ดสรุปผลรายสัปดาห์ เด่นๆ ง่ายๆ ตัวหนังสือไม่เยอะ -->
        <div id="weekly-summary-hero-mount">
          ${this.generateWeeklySummaryHeroHtml()}
        </div>

        <!-- แถบสรุปสถิติประจำเดือน -->
        <div class="calendar-monthly-stats-row">
          <div class="cal-stat-item">
            <div class="cal-stat-number">${stats.activeDaysCount} วัน</div>
            <div class="cal-stat-label">วันที่ออกกำลังกาย</div>
          </div>
          <div class="cal-stat-item">
            <div class="cal-stat-number">${stats.totalMinutes} นาที</div>
            <div class="cal-stat-label">เวลารวมในเดือนนี้</div>
          </div>
          <div class="cal-stat-item">
            <div class="cal-stat-number" style="color: #0284c7;">${stats.avgHeartRate ? stats.avgHeartRate + ' bpm' : '-'}</div>
            <div class="cal-stat-label">ชีพจรเฉลี่ย</div>
          </div>
          <div class="cal-stat-item">
            <div class="cal-stat-number" style="color: ${stats.activeDaysCount >= 12 ? '#10b981' : '#f59e0b'};">
              ${stats.activeDaysCount >= 12 ? 'บรรลุเป้าหมาย 🎉' : `${stats.activeDaysCount}/12 วัน`}
            </div>
            <div class="cal-stat-label">เป้าหมายเดือน (>=12 วัน)</div>
          </div>
        </div>

        <!-- คำอธิบายสัญลักษณ์สีประจำวัน (Legend) -->
        <div class="calendar-color-legend">
          <div class="legend-item">
            <span class="legend-box legend-passed"></span>
            <span>ผ่านเกณฑ์ (>= ${targetMinsPerDay} นาที)</span>
          </div>
          <div class="legend-item">
            <span class="legend-box legend-failed"></span>
            <span>ไม่ผ่าน (< ${targetMinsPerDay} นาที)</span>
          </div>
          <div class="legend-item">
            <span class="legend-box legend-rest"></span>
            <span>วันพัก / ยังไม่ออก</span>
          </div>
        </div>

        <!-- ตารางปฏิทินรายเดือน -->
        <div class="calendar-table-container">
          <!-- แถวชื่อวัน 7 วัน (เริ่ม อาทิตย์ - เสาร์) -->
          <div class="calendar-weekdays-row">
            ${this.weekdayNamesThai.map((w, idx) => `
              <div class="cal-weekday-cell ${idx === 0 || idx === 6 ? 'weekend' : ''}">${w}</div>
            `).join('')}
          </div>

          <!-- ช่องวันทั้งหมดในเดือน -->
          <div class="calendar-days-grid" id="calendar-days-grid-body">
            ${this.generateDaysGridHtml()}
          </div>
        </div>

      </div>

      <!-- 1. ส่วนแสดงรายละเอียดผลการออกกำลังกายของวันที่เลือก (ประวัติรายวัน) -->
      <div class="calendar-day-detail-wrapper" id="calendar-day-detail-box">
        ${this.generateSelectedDayDetailHtml()}
      </div>

      <!-- 2. ปุ่มเปิดดูประวัติทั้งหมด & ส่งออก PDF  แถบยาวเด่นชัดเจน -->
      <div class="calendar-all-history-cta-wrap">
        <button type="button" class="btn-all-history-modal" id="btn-open-all-history-modal">
          <div class="btn-all-history-left">
            <span class="icon-pulse-badge">📋</span>
            <div class="btn-all-history-text">
              <div class="btn-title">ดูประวัติการออกกำลังกายทั้งหมด (${totalRecordsCount} รายการ)</div>
              <div class="btn-subtitle">ตรวจสอบภาพรวมย้อนหลัง & พิมพ์ส่งออก PDF </div>
            </div>
          </div>
          <div class="btn-all-history-action">
            <span>เปิดดู & ส่งออก PDF</span>
            <span class="btn-arrow">➔</span>
          </div>
        </button>
      </div>

      <!-- 3. Modal หน้าต่างป๊อปอัปสำหรับดูประวัติทั้งหมด & พิมพ์ PDF -->
      <div class="all-history-modal-backdrop" id="all-history-modal-backdrop" style="display: none;">
        <div class="all-history-modal-content">
          <!-- Header -->
          <div class="modal-all-history-header">
            <div class="modal-header-titles">
              <h3>📋 สมุดบันทึกประวัติสุขภาพและการออกกำลังกาย</h3>
              <p>สำหรับ: คุณ${activeUser.name || 'ผู้รักสุขภาพ'} | ชุมชนบ้านหม้อแข็งแรง</p>
            </div>
            <button type="button" class="btn-close-modal-x" id="btn-close-all-history-modal" title="ปิดหน้าต่าง">✕</button>
          </div>

          <!-- Summary metrics row -->
          <div class="modal-stats-overview-row">
            <div class="modal-stat-card">
              <span class="m-val">${userStore.getWeeklyTotalMinutes()} นาที</span>
              <span class="m-lbl">เวลารวมทั้งหมด</span>
            </div>
            <div class="modal-stat-card">
              <span class="m-val">${totalRecordsCount} ครั้ง</span>
              <span class="m-lbl">จำนวนกิจกรรม</span>
            </div>
            <div class="modal-stat-card">
              <span class="m-val" style="color: #0284c7;">${stats.avgHeartRate ? stats.avgHeartRate + ' bpm' : '-'}</span>
              <span class="m-lbl">ชีพจรเฉลี่ย</span>
            </div>
          </div>

          <!-- Action buttons bar for PDF printing -->
          <div class="modal-print-toolbar">
            <button type="button" class="btn-print-action-main" id="btn-print-full-pdf">
              🖨️ พิมพ์ประวัติทั้งหมดเป็น PDF 
            </button>
            <button type="button" class="btn-print-action-secondary" id="btn-print-selected-day-pdf">
              📅 พิมพ์เฉพาะวันที่เลือก (${this.selectedDateStr})
            </button>
          </div>

          <!-- Table of all history -->
          <div class="modal-table-scroll-wrap">
            <table class="all-history-full-table">
              <thead>
                <tr>
                  <th width="38%">วัน-เวลา / กิจกรรม</th>
                  <th width="15%" style="text-align: center;">ระยะเวลา</th>
                  <th width="20%" style="text-align: center;">ชีพจร (HR)</th>
                  <th width="27%">ผลการประเมิน</th>
                </tr>
              </thead>
              <tbody id="all-history-modal-tbody">
                ${this.generateAllHistoryTableRowsHtml()}
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div class="modal-all-history-footer">
            <span class="footer-hint">💡 สามารถกด "พิมพ์เป็น PDF" เพื่อบันทึกเป็นไฟล์เอกสารหรือส่งเข้า LINE ให้ อสม. ได้ทันที</span>
            <button type="button" class="btn-modal-dismiss" id="btn-dismiss-all-history-modal">ปิดหน้าต่าง</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  // สร้างแถวตารางสำหรับ Modal แสดงประวัติทั้งหมด
  generateAllHistoryTableRowsHtml() {
    const history = userStore.history || [];
    if (history.length === 0) {
      return `
        <tr>
          <td colspan="4" class="empty-table-cell" style="text-align: center; padding: 32px 16px; color: #94a3b8;">
            ยังไม่มีประวัติการออกกำลังกาย ลองออกกำลังกายตามคลิปแล้วบันทึกผลเพื่อเริ่มสะสมสุขภาพดี
          </td>
        </tr>
      `;
    }

    return history.map((item, idx) => `
      <tr>
        <td>
          <div class="hist-row-title">${item.exerciseTitle}</div>
          <div class="hist-row-meta">📅 ${item.date}</div>
        </td>
        <td style="text-align: center;">
          <span class="hist-row-dur">${item.durationDisplay || item.durationFormatted || (item.durationMinutes + ' นาที')}</span>
        </td>
        <td style="text-align: center;">
          <span class="hist-row-hr">${typeof item.heartRate === 'number' ? `${item.heartRate} bpm` : (item.heartRate || '-')}</span>
        </td>
        <td>
          <span class="hist-row-badge ${item.badgeClass || 'badge-success'}">${item.status}</span>
        </td>
      </tr>
    `).join('');
  }

  // สร้างการ์ดสรุปผลรายสัปดาห์ เด่นๆ ชัดเจน ตัวหนังสือน้อย
  generateWeeklySummaryHeroHtml() {
    const weekStats = userStore.getWeekStats(this.selectedDateStr);
    const status = weekStats.weekStatus || (weekStats.isWeekPassed ? "passed" : "in_progress");

    // คลังข้อความให้กำลังใจเชิงบวก (Positive Encouragement Quotes)
    const ENCOURAGING_QUOTES = [
      "ไม่เป็นไรนะ! การดูแลสุขภาพคือการเดินทางระยะยาว สัปดาห์หน้ามาเริ่มต้นใหม่ไปด้วยกัน ทุกก้าวที่คุณขยับสร้างสุขภาพที่ดีขึ้นเสมอ 💪✨",
      "อย่าเพิ่งท้อนะ! พักผ่อนให้เต็มที่แล้วสัปดาห์หน้ามาพิชิตเป้าหมาย 3 วันร่วมกัน ฟิตจอยพร้อมเคียงข้างคุณเสมอ ❤️",
      "ทุกความพยายามมีคุณค่า สัปดาห์นี้ผ่านไป สัปดาห์ใหม่คือโอกาสใหม่ เริ่มต้นใหม่อีกครั้งนะ! 🌟",
      "สุขภาพดีไม่มีคำว่าสายเกินไป สัปดาห์หน้ามาขยับกายวันละนิดไปด้วยกันนะ 🌱"
    ];

    // สุ่มข้อความให้กำลังใจโดยอิงจากวันที่เลือก
    const selDate = this.selectedDateStr ? new Date(this.selectedDateStr) : new Date();
    const quoteIndex = Math.abs(selDate.getDate() % ENCOURAGING_QUOTES.length);
    const positiveQuote = ENCOURAGING_QUOTES[quoteIndex];

    let cardClass = "status-progress";
    let icon = "⏳";
    let pillClass = "pill-progress";
    let pillText = "⏳ กำลังดำเนินการ";
    let descHtml = "";
    let metricTextClass = "text-progress";

    if (status === "passed") {
      cardClass = "status-pass";
      icon = "🏆";
      pillClass = "pill-pass";
      pillText = "✅ สัปดาห์นี้ผ่านเกณฑ์";
      descHtml = `สุดยอดมาก! คุณออกกำลังกายผ่านเกณฑ์ครบ <strong>${weekStats.passedDaysCount} วัน</strong> รวม <strong>${weekStats.totalMinutes} นาที</strong>`;
      metricTextClass = "text-pass";
    } else if (status === "in_progress") {
      cardClass = "status-progress";
      icon = "⏳";
      pillClass = "pill-progress";
      pillText = "⏳ กำลังดำเนินการ";
      descHtml = `กำลังสะสมวันออกกำลังกาย! สัปดาห์นี้ผ่านไปแล้ว <strong>${weekStats.passedDaysCount}/3 วัน</strong> (ยังมีเวลาอีก <strong>${weekStats.daysRemainingInWeek} วัน</strong> ในสัปดาห์นี้ สู้ๆ นะครับ!)`;
      metricTextClass = "text-progress";
    } else {
      // not_passed
      cardClass = "status-not-passed";
      icon = "💛";
      pillClass = "pill-not-passed";
      pillText = "💛 สัปดาห์นี้ยังไม่ผ่านเกณฑ์";
      descHtml = `
        <div style="margin-bottom: 4px;">ออกกำลังกายผ่านเกณฑ์ไป <strong>${weekStats.passedDaysCount}/3 วัน</strong></div>
        <div class="week-encouragement-quote">${positiveQuote}</div>
      `;
      metricTextClass = "text-not-passed";
    }

    return `
      <div class="weekly-hero-card ${cardClass}">
        <div class="week-hero-left">
          <div class="week-hero-badge-tag">
            <span class="badge-icon">${icon}</span>
            <span>สรุปผลรายสัปดาห์ (จันทร์ - อาทิตย์)</span>
          </div>
          <div class="week-hero-headline">
            <span class="week-status-pill ${pillClass}">
              ${pillText}
            </span>
            <span class="week-range-text">${weekStats.startLabel} - ${weekStats.endLabel}</span>
          </div>
          <div class="week-hero-desc">
            ${descHtml}
          </div>
        </div>

        <div class="week-hero-right">
          <div class="week-metric-counter">
            <div class="metric-big-num ${metricTextClass}">${weekStats.passedDaysCount}</div>
            <div class="metric-sub-label">/ 3 วันที่ผ่าน</div>
          </div>
          <!-- Visual Dot Indicators 3 จุด แสดงความก้าวหน้า -->
          <div class="week-progress-dots" title="เป้าหมายอย่างน้อย 3 วันต่อสัปดาห์">
            <div class="dot-item ${weekStats.passedDaysCount >= 1 ? 'active' : ''}">1</div>
            <div class="dot-item ${weekStats.passedDaysCount >= 2 ? 'active' : ''}">2</div>
            <div class="dot-item ${weekStats.passedDaysCount >= 3 ? 'active' : ''}">3</div>
          </div>
        </div>
      </div>
    `;
  }

  // สร้างตารางช่องวันของเดือน พร้อมสีเขียว/แดง ตามเกณฑ์
  generateDaysGridHtml() {
    const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();

    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let html = "";

    // 1. ช่องวันที่จากเดือนก่อนหน้า (Padding)
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDateNum = daysInPrevMonth - i;
      html += `<div class="cal-day-cell prev-month-day"><span class="day-num">${prevDateNum}</span></div>`;
    }

    // 2. ช่องวันที่ในเดือนปัจจุบัน
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(this.currentMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const isoDate = `${this.currentYear}-${mStr}-${dStr}`;

      const dayStatus = userStore.getDayStatus(isoDate);
      const isToday = isoDate === todayIso;
      const isSelected = isoDate === this.selectedDateStr;

      let workoutPillHtml = "";
      let statusClass = "";

      if (dayStatus.hasWorkout) {
        if (dayStatus.isPassed) {
          // ผ่านเกณฑ์ >= 30 นาที (หรือ 60 สำหรับวัยรุ่น) -> สีเขียว 🟢
          statusClass = "day-passed";
          workoutPillHtml = `
            <div class="cal-day-workout-pill pill-passed" title="ผ่านเกณฑ์: ออกกำลังกายสะสม ${dayStatus.totalFormatted} (เป้าหมาย ${dayStatus.targetMinutes} นาที)">
              <span class="pill-status-icon">✓</span>
              <span class="pill-mins-txt"><span class="pill-mins-num">${dayStatus.totalFormattedShort}</span></span>
            </div>
          `;
        } else {
          // ไม่ผ่านเกณฑ์ < 30 นาที -> สีแดง 🔴
          statusClass = "day-failed";
          workoutPillHtml = `
            <div class="cal-day-workout-pill pill-failed" title="ไม่ผ่านเกณฑ์: ${dayStatus.totalFormatted} (ขาดอีก ${dayStatus.remainingFormatted})">
              <span class="pill-status-icon">✕</span>
              <span class="pill-mins-txt"><span class="pill-mins-num">${dayStatus.totalFormattedShort}</span></span>
            </div>
          `;
        }
      }

      html += `
        <div class="cal-day-cell current-month-day ${dayStatus.hasWorkout ? 'has-workout ' + statusClass : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" data-isodate="${isoDate}">
          <div class="day-num-header">
            <span class="day-num">${day}</span>
            ${isToday ? '<span class="today-tag">วันนี้</span>' : ''}
          </div>
          <div class="day-cell-content">
            ${workoutPillHtml}
          </div>
        </div>
      `;
    }

    // 3. ช่องวันที่จากเดือนถัดไป (Padding ให้ครบแถว)
    const totalCellsSoFar = firstDayIndex + daysInMonth;
    const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;
    for (let j = 1; j <= remainingCells; j++) {
      html += `<div class="cal-day-cell next-month-day"><span class="day-num">${j}</span></div>`;
    }

    return html;
  }

  // สร้าง HTML แสดงรายละเอียดผลการออกกำลังกายของวันที่เลือก (ประวัติรายวัน)
  generateSelectedDayDetailHtml() {
    if (!this.selectedDateStr) return "";

    const dateFormattedThai = this.getSelectedDayFormattedThai();
    const dayStatus = userStore.getDayStatus(this.selectedDateStr);
    const records = dayStatus.records;

    if (!dayStatus.hasWorkout) {
      return `
        <div class="day-detail-card empty">
          <div class="day-detail-header">
            <div class="detail-date-title">📋 ผลการออกกำลังกาย: ${dateFormattedThai}</div>
            <span class="detail-count-badge">วันพัก / 0 กิจกรรม</span>
          </div>
          <div class="empty-workout-state">
            <div class="empty-cal-icon">🧘‍♂️</div>
            <h4>วันนี้ยังไม่มีประวัติการบันทึกผล</h4>
            <p>เมื่อคุณดูคลิปวิดีโอสาธิตและออกกำลังกายตามจนจบ ระบบจะบันทึกผลลงในปฏิทินนี้โดยอัตโนมัติ พร้อมตรวจวัดเกณฑ์เวลาเขียว/แดงทันที</p>
            <button type="button" class="btn-first-step-cta" style="margin-top: 12px;" onclick="window.app.switchTab('home')">
              ▶ ไปที่หน้าแรกเพื่อเริ่มออกกำลังกาย
            </button>
          </div>
        </div>
      `;
    }

    // กล่อง Banner สรุปผลของวันที่เลือก (เขียว หรือ แดง)
    const evalBannerHtml = dayStatus.isPassed
      ? `
        <div class="day-eval-summary-banner pass">
          <div class="eval-banner-left">
            <div class="eval-banner-icon">🟢</div>
            <div>
              <div class="eval-banner-status">ผ่านเกณฑ์ประจำวันแล้ว! 🎉</div>
              <div class="eval-banner-detail">
                ออกกำลังกายรวม <strong>${dayStatus.totalFormatted}</strong> (บรรลุเกณฑ์เป้าหมาย ≥ ${dayStatus.targetMinutes} นาที/วัน)
              </div>
            </div>
          </div>
          <div class="eval-banner-score-tag pass">✓ ผ่านเกณฑ์</div>
        </div>
      `
      : `
        <div class="day-eval-summary-banner fail">
          <div class="eval-banner-left">
            <div class="eval-banner-icon">🔴</div>
            <div>
              <div class="eval-banner-status">ยังไม่ผ่านเกณฑ์ประจำวัน ⚠️</div>
              <div class="eval-banner-detail">
                ออกกำลังกายสะสม <strong>${dayStatus.totalFormatted}</strong> (เกณฑ์คือ ${dayStatus.targetMinutes} นาที ขาดอีก <strong>${dayStatus.remainingFormatted}</strong>)
              </div>
            </div>
          </div>
          <div class="eval-banner-score-tag fail">✕ ไม่ผ่าน</div>
        </div>
      `;

    return `
      <div class="day-detail-card">
        <div class="day-detail-header">
          <div>
            <div class="detail-date-title">📋 ผลการออกกำลังกาย: ${dateFormattedThai}</div>
            <div class="detail-date-summary">ออกกำลังกายไปทั้งหมด ${records.length} ท่า รวมระยะเวลา ${dayStatus.totalFormatted}</div>
          </div>
          <div class="day-detail-header-actions">
            <button type="button" class="btn-print-day-pill" id="btn-print-day-direct" title="พิมพ์เฉพาะรายงานของวันนี้">
              🖨️ พิมพ์เฉพาะวันนี้
            </button>
            <span class="detail-count-badge ${dayStatus.isPassed ? 'active' : 'warning'}">
              ${dayStatus.isPassed ? '✓ ผ่านเกณฑ์' : '✕ ยังไม่ผ่าน'}
            </span>
          </div>
        </div>

        <!-- แบนเนอร์ประเมินผลรายวัน เขียว/แดง -->
        ${evalBannerHtml}

        <!-- รายการกิจกรรมที่ออกกำลังกายในวันนั้น -->
        <div class="day-workout-items-list">
          ${records.map(item => `
            <div class="day-workout-item-card">
              <div class="workout-card-left">
                <div class="workout-icon-badge">🏃</div>
                <div>
                  <h4 class="workout-item-name">${item.exerciseTitle}</h4>
                  <div class="workout-item-time">⏰ บันทึกเมื่อ: ${item.timeStr || item.date} | ⏱️ ระยะเวลา: ${item.durationDisplay || item.durationFormatted || (item.durationMinutes + ' นาที')}</div>
                </div>
              </div>
              <div class="workout-card-right">
                <div class="workout-hr-display">
                  <span class="hr-value">${typeof item.heartRate === 'number' ? item.heartRate : (item.heartRate || 'Talk Test')}</span>
                  <span class="hr-unit">${typeof item.heartRate === 'number' ? 'BPM' : ''}</span>
                </div>
                <div class="workout-status-badge ${item.badgeClass || 'badge-success'}">${item.status}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // เปิด Modal แสดงประวัติทั้งหมด & พิมพ์ PDF
  openAllHistoryModal() {
    const backdrop = document.getElementById("all-history-modal-backdrop");
    if (backdrop) {
      // รีเฟรชตารางประวัติทั้งหมดให้เป็นข้อมูลล่าสุด
      const tbody = document.getElementById("all-history-modal-tbody");
      if (tbody) {
        tbody.innerHTML = this.generateAllHistoryTableRowsHtml();
      }
      backdrop.style.display = "flex";
      document.body.style.overflow = "hidden";
    }
  }

  // ปิด Modal
  closeAllHistoryModal() {
    const backdrop = document.getElementById("all-history-modal-backdrop");
    if (backdrop) {
      backdrop.style.display = "none";
      document.body.style.overflow = "";
    }
  }

  bindEvents() {
    // ปุ่มเปลี่ยนเดือน
    const btnPrev = this.container.querySelector("#btn-cal-prev");
    const btnNext = this.container.querySelector("#btn-cal-next");
    const btnToday = this.container.querySelector("#btn-cal-today");

    if (btnPrev) btnPrev.addEventListener("click", () => this.prevMonth());
    if (btnNext) btnNext.addEventListener("click", () => this.nextMonth());
    if (btnToday) btnToday.addEventListener("click", () => this.goToToday());

    // การคลิกเลือกช่องวันที่ในปฏิทิน
    const dayCells = this.container.querySelectorAll(".cal-day-cell.current-month-day");
    dayCells.forEach(cell => {
      cell.addEventListener("click", () => {
        dayCells.forEach(c => c.classList.remove("is-selected"));
        cell.classList.add("is-selected");

        this.selectedDateStr = cell.dataset.isodate;

        // อัปเดตรายละเอียดวันที่เลือก
        const detailBox = document.getElementById("calendar-day-detail-box");
        if (detailBox) {
          detailBox.innerHTML = this.generateSelectedDayDetailHtml();
          // ผูกปุ่มพิมพ์เฉพาะวัน
          const btnPrintDay = detailBox.querySelector("#btn-print-day-direct");
          if (btnPrintDay) {
            btnPrintDay.addEventListener("click", () => {
              userStore.printHealthReport(this.selectedDateStr, this.getSelectedDayFormattedThai());
            });
          }
        }

        // อัปเดตการ์ดสรุปผลรายสัปดาห์ตามสัปดาห์ของวันที่คลิก
        const heroMount = document.getElementById("weekly-summary-hero-mount");
        if (heroMount) {
          heroMount.innerHTML = this.generateWeeklySummaryHeroHtml();
        }

        // อัปเดตข้อความปุ่มพิมพ์เฉพาะวันใน Modal ให้ตรงกับวันที่เลือก
        const btnPrintSelDay = document.getElementById("btn-print-selected-day-pdf");
        if (btnPrintSelDay) {
          btnPrintSelDay.textContent = `📅 พิมพ์เฉพาะวันที่เลือก (${this.selectedDateStr})`;
        }
      });
    });

    // ปุ่มเปิด Modal ดูประวัติทั้งหมด & ส่งออก PDF
    const btnOpenModal = this.container.querySelector("#btn-open-all-history-modal");
    if (btnOpenModal) {
      btnOpenModal.addEventListener("click", () => this.openAllHistoryModal());
    }

    // ปุ่มปิด Modal
    const btnCloseModal = this.container.querySelector("#btn-close-all-history-modal");
    const btnDismissModal = this.container.querySelector("#btn-dismiss-all-history-modal");
    const modalBackdrop = this.container.querySelector("#all-history-modal-backdrop");

    if (btnCloseModal) btnCloseModal.addEventListener("click", () => this.closeAllHistoryModal());
    if (btnDismissModal) btnDismissModal.addEventListener("click", () => this.closeAllHistoryModal());

    // ปิดเมื่อคลิกนอกกล่อง Modal
    if (modalBackdrop) {
      modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) {
          this.closeAllHistoryModal();
        }
      });
    }

    // ปุ่มพิมพ์ใน Modal
    const btnPrintFull = this.container.querySelector("#btn-print-full-pdf");
    if (btnPrintFull) {
      btnPrintFull.addEventListener("click", () => {
        userStore.printHealthReport();
      });
    }

    const btnPrintSelectedDay = this.container.querySelector("#btn-print-selected-day-pdf");
    if (btnPrintSelectedDay) {
      btnPrintSelectedDay.addEventListener("click", () => {
        userStore.printHealthReport(this.selectedDateStr, this.getSelectedDayFormattedThai());
      });
    }

    // ปุ่มพิมพ์เฉพาะวันในการ์ดรายวัน
    const btnPrintDayDirect = this.container.querySelector("#btn-print-day-direct");
    if (btnPrintDayDirect) {
      btnPrintDayDirect.addEventListener("click", () => {
        userStore.printHealthReport(this.selectedDateStr, this.getSelectedDayFormattedThai());
      });
    }
  }
}

// Global calendar instance placeholder
let workoutCalendar = null;

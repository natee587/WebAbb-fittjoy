/**
 * FitEasy - User Store & Multi-Profile Manager
 * รองรับการลงทะเบียนหลายผู้ใช้ (Multi-User Switcher), การลบบัญชี,
 * ประวัติการวัดชีพจรแบบระบุวันที่สำหรับระบบปฏิทิน และการคำนวณสถิติสะสมประจำวัน (Daily Reset)
 */

const STORAGE_KEYS = {
  USERS_ROSTER: "fiteasy_users_roster_v2",
  ACTIVE_USER_ID: "fiteasy_active_user_id_v2"
};

// เกณฑ์ปิงปองจราจร 7 สี (ดัชนีมวลกาย BMI เพื่อการเฝ้าระวังโรคไม่ติดต่อเรื้อรัง NCDs)
const BMI_7_COLORS = [
  {
    level: 1,
    key: "green-light",
    colorName: "สีเขียวอ่อน",
    title: "น้ำหนักน้อยกว่าเกณฑ์ / ผอม",
    rangeText: "น้อยกว่า 18.5",
    dotColor: "#4ade80",
    borderColor: "#86efac",
    bgColor: "#f0fdf4",
    textColor: "#166534",
    advice: "น้ำหนักต่ำกว่าเกณฑ์ อาจเสี่ยงขาดสารอาหาร ภูมิต้านทานต่ำ และกล้ามเนื้อน้อย ควรรับประทานอาหารให้ครบ 5 หมู่ เพิ่มโปรตีน และออกกำลังกายสร้างกล้ามเนื้อ"
  },
  {
    level: 2,
    key: "white",
    colorName: "สีขาว",
    title: "น้ำหนักปกติ / สมส่วน",
    rangeText: "18.5 – 22.9",
    dotColor: "#ffffff",
    borderColor: "#94a3b8",
    bgColor: "#f8fafc",
    textColor: "#334155",
    advice: "น้ำหนักอยู่ในเกณฑ์มาตรฐาน สุขภาพดี ความเสี่ยงโรคต่ำ ควรรักษาการกินอาหารสมดุลและออกกำลังกายสม่ำเสมออย่างน้อย 150 นาทีต่อสัปดาห์"
  },
  {
    level: 3,
    key: "green-dark",
    colorName: "สีเขียวเข้ม",
    title: "น้ำหนักเกิน / ท้วม",
    rangeText: "23.0 – 24.9",
    dotColor: "#15803d",
    borderColor: "#166534",
    bgColor: "#ecfdf5",
    textColor: "#14532d",
    advice: "เริ่มมีน้ำหนักเกิน เริ่มมีความเสี่ยงเบาหวานและความดันสูง ควรควบคุมอาหารหวาน มัน เค็ม และเพิ่มการเคลื่อนไหวในแต่ละวัน"
  },
  {
    level: 4,
    key: "yellow",
    colorName: "สีเหลือง",
    title: "โรคอ้วนระดับที่ 1",
    rangeText: "25.0 – 29.9",
    dotColor: "#eab308",
    borderColor: "#ca8a04",
    bgColor: "#fefce8",
    textColor: "#854d0e",
    advice: "เสี่ยงโรคเบาหวาน ความดัน ไขมันในเลือดสูง ควรลดน้ำหนักอย่างต่อเนื่อง ออกกำลังกายคาร์ดิโอร่วมกับเวทเทรนนิ่ง และปรึกษาแพทย์หากมีโรคประจำตัว"
  },
  {
    level: 5,
    key: "orange",
    colorName: "สีส้ม",
    title: "โรคอ้วนระดับที่ 2",
    rangeText: "30.0 – 34.9",
    dotColor: "#f97316",
    borderColor: "#ea580c",
    bgColor: "#fff7ed",
    textColor: "#9a3412",
    advice: "ภาวะอ้วนระดับปานกลาง-สูง เสี่ยงต่อโรคหลอดเลือดหัวใจและข้อเข่าเสื่อม ควรปรึกษาแพทย์หรือนักโภชนาการ และเน้นการออกกำลังกายที่มีแรงกระแทกต่ำ"
  },
  {
    level: 6,
    key: "red",
    colorName: "สีแดง",
    title: "โรคอ้วนระดับที่ 3 / อ้วนมาก",
    rangeText: "35.0 – 39.9",
    dotColor: "#ef4444",
    borderColor: "#dc2626",
    bgColor: "#fef2f2",
    textColor: "#991b1b",
    advice: "ความเสี่ยงโรคร้ายแรงสูง เช่น โรคหัวใจ เบาหวาน ข้อเข่าเสื่อม ควรปรึกษาแพทย์หรือนักโภชนาการเพื่อวางแผนลดน้ำหนักอย่างปลอดภัย"
  },
  {
    level: 7,
    key: "black",
    colorName: "สีดำ",
    title: "โรคอ้วนรุนแรงสูงสุด",
    rangeText: "ตั้งแต่ 40.0 ขึ้นไป",
    dotColor: "#0f172a",
    borderColor: "#0f172a",
    bgColor: "#f1f5f9",
    textColor: "#0f172a",
    advice: "ภาวะอ้วนขั้นวิกฤต มีความเสี่ยงต่อภาวะแทรกซ้อนที่คุกคามต่อชีวิตสูงสุด ควรได้รับการประเมินและดูแลจากแพทย์เฉพาะทางโดยเร่งด่วน"
  }
];

class UserStore {
  constructor() {
    this.users = this.loadAllUsers();
    this.activeUserId = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);

    if ((!this.activeUserId || !this.getUserById(this.activeUserId)) && this.users.length > 0) {
      this.activeUserId = this.users[0].id;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, this.activeUserId);
    }

    // ล้างข้อมูลจำลองโหมดทดสอบออกอัตโนมัติ เพื่อให้แสดงเฉพาะประวัติจริงของผู้ใช้
    this.cleanupAllDemoData();
  }

  cleanupAllDemoData() {
    let changed = false;
    this.users.forEach(u => {
      if (u.history && u.history.length > 0) {
        const initialLen = u.history.length;
        u.history = u.history.filter(r => !r.isDemo && !(r.id && (String(r.id).startsWith("sample-") || String(r.id).startsWith("demo-"))));
        if (u.history.length !== initialLen) {
          changed = true;
        }
      }
    });
    if (changed) {
      this.saveAllUsers();
    }
  }

  loadAllUsers() {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS_ROSTER);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    return [];
  }

  saveAllUsers() {
    localStorage.setItem(STORAGE_KEYS.USERS_ROSTER, JSON.stringify(this.users));
  }

  getUserById(id) {
    return this.users.find(u => u.id === id);
  }

  get profile() {
    const u = this.getUserById(this.activeUserId);
    if (u) {
      if (!u.weight || !u.height) {
        u.weight = u.weight || 87;
        u.height = u.height || 180;
        const res = this.calculateBMI(u.weight, u.height);
        u.bmi = res.bmi;
        u.bmiCategory = res.category;
      }
      return u;
    }
    return {
      isRegistered: false,
      name: "ผู้รักสุขภาพชุมชน",
      age: 22,
      gender: "ชาย",
      weight: 87,
      height: 180,
      bmi: 26.9,
      bmiCategory: "โรคอ้วนระดับที่ 1",
      ageGroup: "adult",
      village: "ชุมชนบ้านหม้อแข็งแรง",
      weeklyGoalMinutes: 150,
      history: []
    };
  }

  get history() {
    return this.profile.history || [];
  }

  isRegistered() {
    return !!(this.profile && this.profile.isRegistered);
  }

  getAllUsers() {
    return this.users;
  }

  determineAgeGroup(age) {
    const num = Number(age);
    if (num <= 17) {
      return "youth"; // 6 - 17 ปี (เด็กและวัยรุ่น)
    } else if (num <= 64) {
      return "adult"; // 18 - 64 ปี (วัยผู้ใหญ่)
    } else {
      return "senior"; // 65 ปีขึ้นไป (ผู้สูงอายุ)
    }
  }

  // ดึงเป้าหมายเวลาออกกำลังกายประจำวันตามกลุ่มวัย (นาที/วัน)
  getDailyTargetMinutes() {
    const ageGroup = this.profile.ageGroup || "adult";
    return ageGroup === "youth" ? 60 : 30;
  }

  // คำนวณค่าดัชนีมวลกาย BMI และประเมินผลตามเกณฑ์ปิงปองจราจร 7 สี
  calculateBMI(weight, height) {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100;
    if (!w || !h || h <= 0) {
      return {
        bmi: 0,
        category: "-",
        badgeClass: "badge-info",
        pingpongColor: "white",
        pingpongName: "สีขาว",
        level: 2,
        info: BMI_7_COLORS[1]
      };
    }

    const bmi = parseFloat((w / (h * h)).toFixed(1));
    let matched = BMI_7_COLORS[1];

    if (bmi < 18.5) {
      matched = BMI_7_COLORS[0]; // เขียวอ่อน (< 18.5)
    } else if (bmi <= 22.9) {
      matched = BMI_7_COLORS[1]; // ขาว (18.5 - 22.9)
    } else if (bmi <= 24.9) {
      matched = BMI_7_COLORS[2]; // เขียวเข้ม (23.0 - 24.9)
    } else if (bmi <= 29.9) {
      matched = BMI_7_COLORS[3]; // เหลือง (25.0 - 29.9)
    } else if (bmi <= 34.9) {
      matched = BMI_7_COLORS[4]; // ส้ม (30.0 - 34.9)
    } else if (bmi <= 39.9) {
      matched = BMI_7_COLORS[5]; // แดง (35.0 - 39.9)
    } else {
      matched = BMI_7_COLORS[6]; // ดำ (>= 40.0)
    }

    return {
      bmi,
      category: matched.title,
      badgeClass: `bmi-badge-${matched.key}`,
      pingpongColor: matched.key,
      pingpongName: matched.colorName,
      level: matched.level,
      info: matched
    };
  }

  getInitialSampleHistory() {
    const today = new Date();
    const helperDate = (daysAgo) => {
      const dt = new Date(today);
      dt.setDate(today.getDate() - daysAgo);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      const isoDate = `${y}-${m}-${d}`;
      const thDate = dt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
      return { dt, isoDate, thDate };
    };

    const d1 = helperDate(1); // 1 วันที่แล้ว (เมื่อวาน) -> 35 นาที (ผ่านเกณฑ์ สีเขียว)
    const d2 = helperDate(2); // 2 วันที่แล้ว -> 25 นาที (ไม่ผ่านเกณฑ์ สีแดง)
    const d3 = helperDate(3); // 3 วันที่แล้ว -> 30 นาที (ผ่านเกณฑ์ สีเขียว)
    const d4 = helperDate(4); // 4 วันที่แล้ว -> 40 นาที (ผ่านเกณฑ์ สีเขียว)

    return [
      {
        id: "demo-d1",
        isDemo: true,
        isoDate: d1.isoDate,
        date: `${d1.thDate}, 17:30 น.`,
        timeStr: "17:30 น.",
        exerciseTitle: "แอโรบิกแดนซ์เพื่อหัวใจแข็งแรง (Aerobic Dance)",
        ageGroup: "adult",
        ageGroupLabel: "อายุ 18 - 64 ปี (วัยผู้ใหญ่)",
        heartRate: 125,
        durationMinutes: 35,
        status: "ผ่านเกณฑ์! หัวใจเต้นในระดับปานกลางยอดเยี่ยม 🟢",
        badgeClass: "badge-success",
        recommendation: "ออกกำลังกายอย่างน้อย 3 วันต่อสัปดาห์ นาน 30 นาทีต่อวัน"
      },
      {
        id: "demo-d2",
        isDemo: true,
        isoDate: d2.isoDate,
        date: `${d2.thDate}, 06:45 น.`,
        timeStr: "06:45 น.",
        exerciseTitle: "เดินเร็วสลับแกว่งแขน (Brisk Walk)",
        ageGroup: "adult",
        ageGroupLabel: "อายุ 18 - 64 ปี (วัยผู้ใหญ่)",
        heartRate: 110,
        durationMinutes: 25,
        status: "ยังไม่ถึงเกณฑ์เวลา 30 นาที (ขาดอีก 5 นาที) 🔴",
        badgeClass: "badge-warning",
        recommendation: "ออกกำลังกายอย่างน้อย 3 วันต่อสัปดาห์ นาน 30 นาทีต่อวัน"
      },
      {
        id: "demo-d3",
        isDemo: true,
        isoDate: d3.isoDate,
        date: `${d3.thDate}, 16:20 น.`,
        timeStr: "16:20 น.",
        exerciseTitle: "การเต้นบาสโลบเพื่อสุขภาพ (Pasolob)",
        ageGroup: "adult",
        ageGroupLabel: "อายุ 18 - 64 ปี (วัยผู้ใหญ่)",
        heartRate: 118,
        durationMinutes: 30,
        status: "ผ่านเกณฑ์พอดี 30 นาที! สุขภาพแข็งแรง 🟢",
        badgeClass: "badge-success",
        recommendation: "ออกกำลังกายอย่างน้อย 3 วันต่อสัปดาห์ นาน 30 นาทีต่อวัน"
      },
      {
        id: "demo-d4",
        isDemo: true,
        isoDate: d4.isoDate,
        date: `${d4.thDate}, 07:00 น.`,
        timeStr: "07:00 น.",
        exerciseTitle: "บอดี้เวท & ยางยืดชะลอวัย (Resistance Band)",
        ageGroup: "adult",
        ageGroupLabel: "อายุ 18 - 64 ปี (วัยผู้ใหญ่)",
        heartRate: 120,
        durationMinutes: 40,
        status: "ผ่านเกณฑ์ยอดเยี่ยม! ออกกำลังกายเกินเป้าหมาย 🟢",
        badgeClass: "badge-success",
        recommendation: "ออกกำลังกายอย่างน้อย 3 วันต่อสัปดาห์ นาน 30 นาทีต่อวัน"
      }
    ];
  }

  // ตรวจสอบว่าขณะนี้เปิดโหมดทดสอบอยู่หรือไม่
  isDemoMode() {
    return (this.history || []).some(r => r.isDemo === true || (r.id && (r.id.startsWith("sample-") || r.id.startsWith("demo-"))));
  }

  // เปิดโหมดทดสอบ: เติมข้อมูลตัวอย่าง
  enableDemoMode() {
    const u = this.getUserById(this.activeUserId);
    if (!u) return false;
    if (!u.history) u.history = [];
    // ลบข้อมูลทดสอบเก่าออกก่อนป้องกันการเพิ่มซ้ำ
    u.history = u.history.filter(r => !r.isDemo && !(r.id && (r.id.startsWith("sample-") || r.id.startsWith("demo-"))));
    // เติมข้อมูลทดสอบใหม่
    const samples = this.getInitialSampleHistory();
    u.history.unshift(...samples);
    this.saveAllUsers();
    return true;
  }

  // ปิดโหมดทดสอบ: ลบเฉพาะข้อมูลจำลอง ข้อมูลจริงไม่สูญหาย
  disableDemoMode() {
    const u = this.getUserById(this.activeUserId);
    if (!u) return false;
    if (!u.history) return false;
    u.history = u.history.filter(r => !r.isDemo && !(r.id && (r.id.startsWith("sample-") || r.id.startsWith("demo-"))));
    this.saveAllUsers();
    return true;
  }

  // สลับสถานะโหมดทดสอบ (Toggle)
  toggleDemoMode() {
    if (this.isDemoMode()) {
      return this.disableDemoMode() ? false : true;
    } else {
      return this.enableDemoMode() ? true : false;
    }
  }

  // เติมข้อมูลตัวอย่างสำหรับการทดสอบระบบปฏิทินและสรุปผลรายสัปดาห์ (คงไว้สำหรับ backwards compatibility)
  seedSampleData(force = false) {
    if (this.isDemoMode()) {
      return this.disableDemoMode();
    } else {
      return this.enableDemoMode();
    }
  }

  register(formData) {
    const age = Number(formData.age);
    const ageGroup = this.determineAgeGroup(age);
    const bmiResult = this.calculateBMI(formData.weight, formData.height);
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();

    const newUser = {
      id: "usr-" + Date.now(),
      isRegistered: true,
      firstName: formData.firstName,
      lastName: formData.lastName,
      name: fullName || "ผู้รักสุขภาพ",
      age: age,
      gender: formData.gender || "ชาย",
      weight: parseFloat(formData.weight),
      height: parseFloat(formData.height),
      bmi: bmiResult.bmi,
      bmiCategory: bmiResult.category,
      bmiBadgeClass: bmiResult.badgeClass,
      bmiPingpongColor: bmiResult.pingpongColor,
      bmiPingpongName: bmiResult.pingpongName,
      bmiLevel: bmiResult.level,
      ageGroup: ageGroup,
      village: formData.village || "ชุมชนบ้านหม้อแข็งแรง",
      weeklyGoalMinutes: 150,
      createdAt: new Date().toLocaleDateString("th-TH"),
      history: this.getInitialSampleHistory()
    };

    this.users.push(newUser);
    this.activeUserId = newUser.id;
    this.saveAllUsers();
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, this.activeUserId);

    return newUser;
  }

  switchUser(userId) {
    if (this.getUserById(userId)) {
      this.activeUserId = userId;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, this.activeUserId);
      return true;
    }
    return false;
  }

  deleteUser(userId) {
    this.users = this.users.filter(u => u.id !== userId);
    this.saveAllUsers();

    if (this.activeUserId === userId) {
      if (this.users.length > 0) {
        this.activeUserId = this.users[0].id;
        localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, this.activeUserId);
      } else {
        this.activeUserId = null;
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
      }
    }
    return this.users.length;
  }

  logout() {
    this.activeUserId = null;
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
  }

  saveProfile(updated) {
    const u = this.getUserById(this.activeUserId);
    if (!u) return;

    Object.assign(u, updated);
    if (updated.age) {
      u.ageGroup = this.determineAgeGroup(updated.age);
    }
    if (updated.weight && updated.height) {
      const bmiResult = this.calculateBMI(updated.weight, updated.height);
      u.bmi = bmiResult.bmi;
      u.bmiCategory = bmiResult.category;
      u.bmiBadgeClass = bmiResult.badgeClass;
      u.bmiPingpongColor = bmiResult.pingpongColor;
      u.bmiPingpongName = bmiResult.pingpongName;
      u.bmiLevel = bmiResult.level;
    }
    this.saveAllUsers();
    return u;
  }

  // เพิ่มประวัติเมื่อดูคลิปจบและวัดชีพจรเสร็จ พร้อมระบุวันเวลาสำหรับปฏิทิน
  addRecord(record) {
    const u = this.getUserById(this.activeUserId);
    if (!u) return;

    if (!u.history) u.history = [];

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const isoDate = `${y}-${m}-${d}`;

    const newRecord = {
      id: "rec-" + Date.now(),
      isoDate: isoDate,
      date: now.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }) + " น.",
      timeStr: now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
      ...record
    };

    u.history.unshift(newRecord);
    this.saveAllUsers();
    return newRecord;
  }

  // ดึงรายการประวัติของวันที่ระบุ (YYYY-MM-DD)
  getRecordsByDate(isoDateStr) {
    return (this.history || []).filter(item => item.isoDate === isoDateStr);
  }

  // คำนวณสถิติสะสมสำหรับ "วันนี้" โดยจะรีเซ็ตอัตโนมัติเมื่อขึ้นวันใหม่ (Daily Reset)
  getTodayStats() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayIso = `${y}-${m}-${d}`;

    const todayRecords = this.getRecordsByDate(todayIso);
    const totalSeconds = todayRecords.reduce((sum, r) => {
      if (r.durationSeconds) return sum + Number(r.durationSeconds);
      if (r.durationMinutes) return sum + Math.round(Number(r.durationMinutes) * 60);
      return sum + 60;
    }, 0);

    const targetMinutes = this.getDailyTargetMinutes();
    const targetSeconds = targetMinutes * 60;

    const totalMins = Math.floor(totalSeconds / 60);
    const remSec = totalSeconds % 60;
    let totalFormatted = "";
    if (totalSeconds === 0) {
      totalFormatted = "0 นาที";
    } else if (remSec > 0) {
      totalFormatted = `${totalMins} นาที ${remSec} วินาที`;
    } else {
      totalFormatted = `${totalMins} นาที`;
    }

    return {
      todayIso,
      todayFormatted: now.toLocaleDateString("th-TH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }),
      totalSeconds,
      totalMinutes: totalMins,
      totalMinutesDecimal: (totalSeconds / 60).toFixed(1),
      totalFormatted,
      targetMinutes,
      targetSeconds,
      isGoalReached: totalSeconds >= targetSeconds,
      percent: Math.min(100, Math.round((totalSeconds / targetSeconds) * 100)),
      records: todayRecords
    };
  }

  // ดึงสถิติของเดือนที่ระบุ (year, month 0-indexed)
  getMonthStats(year, monthIndex) {
    const records = (this.history || []).filter(item => {
      if (!item.isoDate) return false;
      const parts = item.isoDate.split("-");
      return Number(parts[0]) === year && Number(parts[1]) === (monthIndex + 1);
    });

    const uniqueDays = new Set(records.map(r => r.isoDate)).size;
    const totalMinutes = records.reduce((sum, r) => sum + (Number(r.durationMinutes) || 0), 0);
    const avgHeartRate = records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + (Number(r.heartRate) || 0), 0) / records.length)
      : 0;

    return {
      recordCount: records.length,
      activeDaysCount: uniqueDays,
      totalMinutes,
      avgHeartRate,
      records
    };
  }

  // ตรวจสอบผลสถานะของวันใดวันหนึ่ง (isoDate: YYYY-MM-DD)
  // เกณฑ์รายวัน: ผู้ใหญ่/ผู้สูงอายุ 30 นาที, วัยรุ่น 60 นาที
  // < เกณฑ์ = สีแดง (failed), >= เกณฑ์ = สีเขียว (passed)
  getDayStatus(isoDateStr) {
    const records = this.getRecordsByDate(isoDateStr);
    const totalMinutes = records.reduce((sum, r) => sum + (Number(r.durationMinutes) || 0), 0);
    const targetMinutes = this.getDailyTargetMinutes();

    if (totalMinutes === 0) {
      return {
        isoDate: isoDateStr,
        hasWorkout: false,
        totalMinutes: 0,
        targetMinutes,
        isPassed: false,
        status: "none",
        records: []
      };
    }

    const isPassed = totalMinutes >= targetMinutes;
    return {
      isoDate: isoDateStr,
      hasWorkout: true,
      totalMinutes,
      targetMinutes,
      isPassed,
      status: isPassed ? "passed" : "failed",
      remainingMinutes: Math.max(0, targetMinutes - totalMinutes),
      records
    };
  }

  // คำนวณผลสรุปรายสัปดาห์ (รอบวันจันทร์ - อาทิตย์) สำหรับวันที่ที่ระบุ
  // เกณฑ์รายสัปดาห์: ผ่าน >= 3 วันต่อสัปดาห์ = ผ่าน (Passed), < 3 วัน = ไม่ผ่าน (Failed)
  getWeekStats(targetIsoDateStr) {
    let dateObj;
    if (targetIsoDateStr) {
      const parts = targetIsoDateStr.split("-");
      dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      dateObj = new Date();
    }

    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    // หา offset ไปยังวันจันทร์ของสัปดาห์นั้น
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    const monday = new Date(dateObj);
    monday.setDate(dateObj.getDate() + diffToMonday);

    const weekDays = [];
    let passedDaysCount = 0;
    let activeDaysCount = 0;
    let totalMinutes = 0;

    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${d}`;

      const dayStatus = this.getDayStatus(iso);
      if (dayStatus.hasWorkout) {
        activeDaysCount++;
        totalMinutes += dayStatus.totalMinutes;
        if (dayStatus.isPassed) {
          passedDaysCount++;
        }
      }
      weekDays.push({
        date: cur,
        isoDate: iso,
        ...dayStatus
      });
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monMidnight = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
    const sunMidnight = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());

    const targetDays = 3;
    const isWeekPassed = passedDaysCount >= targetDays;
    const remainingDays = Math.max(0, targetDays - passedDaysCount);

    let weekStatus = "in_progress"; // "passed" | "in_progress" | "not_passed"
    let daysRemainingInWeek = 0;

    if (isWeekPassed) {
      weekStatus = "passed";
    } else if (today > sunMidnight) {
      // สัปดาห์ในอดีตที่สิ้นสุดลงแล้ว และออกกำลังกายไม่ครบ 3 วัน
      weekStatus = "not_passed";
    } else if (today < monMidnight) {
      // สัปดาห์ในอนาคต
      weekStatus = "in_progress";
      daysRemainingInWeek = 7;
    } else {
      // สัปดาห์ปัจจุบัน (today อยู่ระหว่างวันจันทร์ถึงวันอาทิตย์)
      const curDayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      // วันคงเหลือในสัปดาห์นี้นับรวมวันนี้ไปถึงวันอาทิตย์
      daysRemainingInWeek = (curDayOfWeek === 0) ? 1 : (7 - curDayOfWeek + 1);

      // หากวันที่เหลือยังมีโอกาสทำครบเป้าหมาย ให้แสดงเป็น กำลังดำเนินการ
      // หากวันที่เหลือไม่พอแล้ว (เช่น เหลือ 2 วัน แต่ต้องการอีก 3 วัน) ให้แสดง สัปดาห์นี้ยังไม่ผ่าน
      if (remainingDays <= daysRemainingInWeek) {
        weekStatus = "in_progress";
      } else {
        weekStatus = "not_passed";
      }
    }

    return {
      monday,
      sunday,
      startLabel: `${monday.getDate()} ${this.getMonthShortThai(monday.getMonth())}`,
      endLabel: `${sunday.getDate()} ${this.getMonthShortThai(sunday.getMonth())} ${sunday.getFullYear() + 543}`,
      weekDays,
      passedDaysCount,
      activeDaysCount,
      totalMinutes,
      targetDays,
      isWeekPassed,
      remainingDays,
      weekStatus,
      daysRemainingInWeek
    };
  }

  getMonthShortThai(monthIndex) {
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return months[monthIndex] || "";
  }

  getWeeklyTotalMinutes() {
    return (this.history || []).reduce((sum, item) => sum + (Number(item.durationMinutes) || 0), 0);
  }

  printHealthReport(filterDate = null, filterDateLabel = "") {
    const p = this.profile;
    const records = filterDate
      ? (this.history || []).filter(item => item.isoDate === filterDate)
      : (this.history || []);

    const historyRows = records.map((item, idx) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${item.date}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${item.exerciseTitle}</strong></td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${item.durationMinutes} นาที</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0284c7;">${item.heartRate} bpm</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${item.status}</td>
      </tr>
    `).join("");

    const c = AGE_CRITERIA[p.ageGroup] || AGE_CRITERIA.adult;
    const reportSubtitle = filterDateLabel
      ? `รายงานบันทึกผลประจำ${filterDateLabel} `
      : ``;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8">
        <title>สมุดสุขภาพดิจิทัล - FitEasy ชุมชนบ้านหม้อแข็งแรง</title>
        <link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Anuphan', sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: bold; color: #0284c7; }
          .subtitle { font-size: 14px; color: #64748b; }
          .info-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 14px; }
          .grid-info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
          th { background: #e0f2fe; color: #0369a1; padding: 10px; border: 1px solid #cbd5e1; }
          .signatures { margin-top: 40px; display: flex; justify-content: space-between; padding: 0 40px; }
          .sig-box { text-align: center; font-size: 13px; }
          .sig-line { width: 200px; border-bottom: 1px dotted #64748b; margin-bottom: 8px; height: 40px; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">📋 สมุดบันทึกสุขภาพและการออกกำลังกายดิจิทัล (ฟิตจอย)</div>
          <div class="subtitle">${reportSubtitle}</div>
        </div>

        <div class="info-box">
          <div class="grid-info">
            <div><strong>ชื่อ-นามสกุล:</strong> ${p.name || 'ผู้รักสุขภาพ'}</div>
            <div><strong>เพศ:</strong> ${p.gender || '-'} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>อายุ:</strong> ${p.age || '-'} ปี</div>
            <div><strong>น้ำหนัก:</strong> ${p.weight ? p.weight + ' กก.' : '-'} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>ส่วนสูง:</strong> ${p.height ? p.height + ' ซม.' : '-'}</div>
            <div><strong>ดัชนีมวลกาย (BMI):</strong> ${p.bmi ? p.bmi + ' (' + p.bmiCategory + ')' : '-'}</div>
            <div><strong>กลุ่มวัยประเมิน:</strong> ${c.label}</div>
            <div><strong>เป้าหมาย HR:</strong> ${c.targetHRText}</div>
          </div>
          <p style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #bae6fd;">
            <strong>คำแนะนำการออกกำลังกายประจำกลุ่มวัย:</strong> ${c.recommendation}
          </p>
        </div>

        <h3 style="margin-bottom: 6px; font-size: 16px; color: #0369a1;">ประวัติการออกกำลังกายและบันทึกอัตราการเต้นของหัวใจ (Heart Rate Log)</h3>
        <table>
          <thead>
            <tr>
              <th width="5%">ลำดับ</th>
              <th width="20%">วัน-เวลา</th>
              <th width="25%">กิจกรรม / ท่าทาง</th>
              <th width="12%">ระยะเวลา</th>
              <th width="15%">ชีพจร (BPM)</th>
              <th width="23%">การประเมินผล</th>
            </tr>
          </thead>
          <tbody>
            ${historyRows || '<tr><td colspan="6" style="text-align: center; padding: 16px;">ยังไม่มีประวัติการบันทึก</td></tr>'}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">

          </div>
          <div class="sig-box">

          </div>
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-family: 'Anuphan', sans-serif;">
            🖨️ กดพิมพ์เอกสารนี้ (Print / Save as PDF)
          </button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  }
}

const userStore = new UserStore();

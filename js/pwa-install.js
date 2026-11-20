/**
 * FitJoy Unified PWA Installation Manager
 * รองรับ iOS, Android, Windows ในหน้าต่างเดียวจบ
 */

(function () {
  let deferredPrompt = window.fitjoyDeferredPrompt || null;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isWindows = /Windows/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  function isAppInstalled() {
    if (typeof window.fitjoyIsAppInstalled === 'function') {
      return window.fitjoyIsAppInstalled();
    }
    try {
      const isStandalone = (window.matchMedia && (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches
      )) || window.navigator.standalone === true;

      const isReferrerPwa = typeof document.referrer === 'string' && document.referrer.includes('android-app://');
      const isStorageInstalled = localStorage.getItem('fitjoy_pwa_installed') === 'true';

      if (isStandalone || isReferrerPwa) {
        try { localStorage.setItem('fitjoy_pwa_installed', 'true'); } catch (e) {}
      }
      return isStandalone || isReferrerPwa || isStorageInstalled;
    } catch (e) {
      return false;
    }
  }

  // 1. ลงทะเบียน Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // ตรวจสอบแอปที่ติดตั้งแล้ว (getInstalledRelatedApps)
  if ('getInstalledRelatedApps' in navigator) {
    navigator.getInstalledRelatedApps().then((apps) => {
      if (apps && apps.length > 0) {
        console.log('[PWA] Installed related apps detected:', apps);
        try { localStorage.setItem('fitjoy_pwa_installed', 'true'); } catch (e) {}
        document.documentElement.classList.add('pwa-installed');
        hideInstallUI();
      }
    }).catch(() => {});
  }

  // 2. ดักจับ Event beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.fitjoyDeferredPrompt = e;
    console.log('[PWA] beforeinstallprompt captured!');
    if (!isAppInstalled()) {
      showInstallUI();
    }
  });

  // 3. เมื่อติดตั้งสำเร็จ
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] FitJoy installed successfully');
    try { localStorage.setItem('fitjoy_pwa_installed', 'true'); } catch (e) {}
    document.documentElement.classList.add('pwa-installed');
    deferredPrompt = null;
    window.fitjoyDeferredPrompt = null;
    hideInstallUI();
    const confirmModal = document.getElementById('pwa-confirm-modal');
    if (confirmModal) confirmModal.style.display = 'none';
    showToast('ติดตั้งแอป "ฟิตจอย" เรียบร้อยแล้ว!');
  });

  document.addEventListener('DOMContentLoaded', () => {
    initInstallUI();
  });

  function initInstallUI() {
    const btnInstall = document.getElementById('btn-pwa-install');
    const btnHeaderInstall = document.getElementById('btn-header-pwa-install');
    const btnOnboardingInstall = document.getElementById('btn-onboarding-pwa-install');
    const btnCloseBanner = document.getElementById('btn-pwa-banner-close');
    const btnCloseOnboardingBanner = document.getElementById('btn-onboarding-install-close');

    const confirmModal = document.getElementById('pwa-confirm-modal');
    const btnConfirmCancel = document.getElementById('btn-pwa-confirm-cancel');
    const btnConfirmInstall = document.getElementById('btn-pwa-confirm-install');

    if (isAppInstalled()) {
      document.documentElement.classList.add('pwa-installed');
      hideInstallUI();
      return;
    }

    showInstallUI();

    // เปิดหน้าต่างถามยืนยัน
    if (btnInstall) btnInstall.addEventListener('click', openConfirmModal);
    if (btnHeaderInstall) btnHeaderInstall.addEventListener('click', openConfirmModal);
    if (btnOnboardingInstall) btnOnboardingInstall.addEventListener('click', openConfirmModal);

    // กดยกเลิก
    if (btnConfirmCancel && confirmModal) {
      btnConfirmCancel.addEventListener('click', () => {
        confirmModal.style.display = 'none';
      });
    }

    // กดปุ่มติดตั้ง
    if (btnConfirmInstall) {
      btnConfirmInstall.addEventListener('click', handleExecuteInstall);
    }

    // ปิดแบนเนอร์หน้าแรก
    if (btnCloseBanner) {
      btnCloseBanner.addEventListener('click', () => {
        const installBanner = document.getElementById('pwa-install-banner');
        if (installBanner) installBanner.style.display = 'none';
        sessionStorage.setItem('fitjoy_dismiss_install', 'true');
      });
    }

    // ปิดแบนเนอร์ในหน้าลงทะเบียน
    if (btnCloseOnboardingBanner) {
      btnCloseOnboardingBanner.addEventListener('click', () => {
        const obBanner = document.getElementById('onboarding-install-banner');
        if (obBanner) obBanner.style.display = 'none';
        sessionStorage.setItem('fitjoy_dismiss_onboarding_install', 'true');
      });
    }

    // ปิดเมื่อคลิกพื้นหลังสีดำ
    if (confirmModal) {
      confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) confirmModal.style.display = 'none';
      });
    }
  }

  function showInstallUI() {
    if (isAppInstalled()) {
      hideInstallUI();
      return;
    }

    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner && sessionStorage.getItem('fitjoy_dismiss_install') !== 'true') {
      installBanner.style.display = 'flex';
    }

    const headerBtn = document.getElementById('btn-header-pwa-install');
    if (headerBtn) headerBtn.style.display = 'inline-flex';

    const onboardingBanner = document.getElementById('onboarding-install-banner');
    if (onboardingBanner && sessionStorage.getItem('fitjoy_dismiss_onboarding_install') !== 'true') {
      onboardingBanner.style.display = 'flex';
    }
  }

  function hideInstallUI() {
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) installBanner.style.display = 'none';

    const headerBtn = document.getElementById('btn-header-pwa-install');
    if (headerBtn) headerBtn.style.display = 'none';

    const onboardingBanner = document.getElementById('onboarding-install-banner');
    if (onboardingBanner) onboardingBanner.style.display = 'none';
  }

  // เปิดหน้าต่างยืนยัน
  function openConfirmModal() {
    if (!deferredPrompt && window.fitjoyDeferredPrompt) {
      deferredPrompt = window.fitjoyDeferredPrompt;
    }

    const confirmModal = document.getElementById('pwa-confirm-modal');
    const guideIos = document.getElementById('pwa-guide-ios');
    const guideDesktop = document.getElementById('pwa-guide-desktop');
    const btnText = document.getElementById('btn-pwa-confirm-install-text');

    if (isIOS) {
      if (guideIos) guideIos.style.display = 'block';
      if (guideDesktop) guideDesktop.style.display = 'none';
      if (btnText) btnText.textContent = 'วิธีเพิ่มลงหน้าจอโฮม (iOS)';
    } else if (isWindows) {
      if (guideIos) guideIos.style.display = 'none';
      if (guideDesktop) guideDesktop.style.display = 'block';
      if (btnText) btnText.textContent = 'ติดตั้งลงเครื่อง (Windows)';
    } else if (isAndroid) {
      if (guideIos) guideIos.style.display = 'none';
      if (guideDesktop) guideDesktop.style.display = 'none';
      if (btnText) btnText.textContent = 'เพิ่มลงหน้าจอโฮม (Android)';
    }

    if (confirmModal) {
      confirmModal.style.display = 'flex';
    }
  }

  // เมื่อผู้ใช้กดปุ่ม "ติดตั้งแอปพลิเคชัน"
  async function handleExecuteInstall() {
    const promptObj = deferredPrompt || window.fitjoyDeferredPrompt;

    if (promptObj) {
      console.log('[PWA] Triggering install prompt directly...');
      try {
        promptObj.prompt();
        const choiceResult = await promptObj.userChoice;
        console.log('[PWA] User choice outcome:', choiceResult.outcome);
        if (choiceResult.outcome === 'accepted') {
          try { localStorage.setItem('fitjoy_pwa_installed', 'true'); } catch (e) {}
          document.documentElement.classList.add('pwa-installed');
          hideInstallUI();
          const confirmModal = document.getElementById('pwa-confirm-modal');
          if (confirmModal) confirmModal.style.display = 'none';
          showToast('ติดตั้งแอป "ฟิตจอย" เรียบร้อยแล้ว!');
        }
      } catch (err) {
        console.warn('[PWA] Install prompt failed:', err);
      }
      deferredPrompt = null;
      window.fitjoyDeferredPrompt = null;
      return;
    }

    if (isIOS) {
      alert("วิธีติดตั้งบน iOS (iPhone/iPad):\n1. แตะปุ่มแชร์ [Share] ที่แถบด้านล่างของ Safari\n2. เลื่อนลงแล้วแตะ 'เพิ่มไปยังหน้าจอโฮม' (Add to Home Screen)");
      const confirmModal = document.getElementById('pwa-confirm-modal');
      if (confirmModal) confirmModal.style.display = 'none';
      return;
    }

    // บน Desktop Chrome / Edge หากเบราว์เซอร์บังคับให้คลิกผ่าน URL bar
    alert("ระบบกำลังพร้อมติดตั้ง!\n👉 โปรดคลิกที่ไอคอน 'ติดตั้ง' (รูปหน้าจอคอม 💻 หรือ ⬇️) ที่อยู่ปลายขวาสุดของแถบ URL ด้านบนของ Google Chrome เพื่อเพิ่มลงหน้าจอ Desktop ได้ทันทีครับ");
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'pwa-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  window.fitjoyPWA = {
    openConfirm: openConfirmModal,
    promptInstall: handleExecuteInstall,
    hideInstallUI: hideInstallUI,
    showInstallUI: showInstallUI,
    isInstalled: isAppInstalled,
    onPromptReady: (e) => {
      deferredPrompt = e;
      if (!isAppInstalled()) {
        showInstallUI();
      }
    }
  };
})();
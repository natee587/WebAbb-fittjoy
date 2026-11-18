/**
 * FitJoy PWA Installation & Service Worker Manager
 * รองรับ Android, iOS (iPhone/iPad), และ Windows (PC / Mac)
 * มี Early Capture ดักจับ Event ทันทีตั้งแต่ใน Head
 */

(function () {
  let deferredPrompt = window.fitjoyDeferredPrompt || null;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

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

  // 2. ดักจับ Event พร้อมติดตั้ง (Android / Windows / Chrome / Edge)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.fitjoyDeferredPrompt = e;
    console.log('[PWA] beforeinstallprompt captured in script');
    showInstallUI();
  });

  // เมื่อผู้ใช้ทำการติดตั้งเสร็จสมบูรณ์
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] FitJoy was installed successfully');
    deferredPrompt = null;
    window.fitjoyDeferredPrompt = null;
    hideInstallUI();
    closeAllModals();
    showToast('เพิ่มแอป "ฟิตจอย" ลงหน้าจอโฮมเรียบร้อยแล้ว!');
  });

  document.addEventListener('DOMContentLoaded', () => {
    initInstallUI();
  });

  function initInstallUI() {
    const btnInstall = document.getElementById('btn-pwa-install');
    const btnHeaderInstall = document.getElementById('btn-header-pwa-install');
    const btnOnboardingInstall = document.getElementById('btn-onboarding-pwa-install');
    const btnCloseBanner = document.getElementById('btn-pwa-banner-close');

    // Confirm Modal Elements
    const confirmModal = document.getElementById('pwa-confirm-modal');
    const btnConfirmCancel = document.getElementById('btn-pwa-confirm-cancel');
    const btnConfirmInstall = document.getElementById('btn-pwa-confirm-install');

    // Guide Modals
    const iosModal = document.getElementById('pwa-ios-modal');
    const btnCloseIosModal = document.getElementById('btn-close-ios-modal');
    const desktopModal = document.getElementById('pwa-desktop-modal');
    const btnCloseDesktopModal = document.getElementById('btn-close-desktop-modal');

    // ถ้าเปิดอยู่ในโหมดแอปแล้ว ให้ซ่อนปุ่มติดตั้ง
    if (isStandalone) {
      hideInstallUI();
      return;
    }

    // แสดงปุ่มและแบนเนอร์ติดตั้งเสมอ
    showInstallUI();

    // เมื่อกดปุ่มติดตั้ง -> เปิดหน้าต่างถามยืนยันก่อนเสมอ!
    if (btnInstall) {
      btnInstall.addEventListener('click', openConfirmModal);
    }
    if (btnHeaderInstall) {
      btnHeaderInstall.addEventListener('click', openConfirmModal);
    }
    if (btnOnboardingInstall) {
      btnOnboardingInstall.addEventListener('click', openConfirmModal);
    }

    // กดยกเลิกในหน้าต่างถาม
    if (btnConfirmCancel && confirmModal) {
      btnConfirmCancel.addEventListener('click', () => {
        confirmModal.style.display = 'none';
      });
    }

    // กด "เพิ่มลงหน้าจอโฮม" ในหน้าต่างถาม
    if (btnConfirmInstall) {
      btnConfirmInstall.addEventListener('click', executeAddToHomeScreen);
    }

    // ปิดแบนเนอร์
    if (btnCloseBanner) {
      btnCloseBanner.addEventListener('click', () => {
        const installBanner = document.getElementById('pwa-install-banner');
        if (installBanner) installBanner.style.display = 'none';
        sessionStorage.setItem('fitjoy_dismiss_install', 'true');
      });
    }

    // ปิด Modal ไกด์ iOS
    if (btnCloseIosModal && iosModal) {
      btnCloseIosModal.addEventListener('click', () => {
        iosModal.style.display = 'none';
      });
    }
    if (iosModal) {
      iosModal.addEventListener('click', (e) => {
        if (e.target === iosModal) iosModal.style.display = 'none';
      });
    }

    // ปิด Modal ไกด์ Desktop
    if (btnCloseDesktopModal && desktopModal) {
      btnCloseDesktopModal.addEventListener('click', () => {
        desktopModal.style.display = 'none';
      });
    }
    if (desktopModal) {
      desktopModal.addEventListener('click', (e) => {
        if (e.target === desktopModal) desktopModal.style.display = 'none';
      });
    }

    // ปิด Confirm Modal เมื่อคลิกพื้นหลังสีดำ
    if (confirmModal) {
      confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) confirmModal.style.display = 'none';
      });
    }
  }

  function showInstallUI() {
    if (isStandalone) return;

    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner && sessionStorage.getItem('fitjoy_dismiss_install') !== 'true') {
      installBanner.style.display = 'flex';
    }

    const headerBtn = document.getElementById('btn-header-pwa-install');
    if (headerBtn) {
      headerBtn.style.display = 'inline-flex';
    }
  }

  function hideInstallUI() {
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) installBanner.style.display = 'none';

    const headerBtn = document.getElementById('btn-header-pwa-install');
    if (headerBtn) headerBtn.style.display = 'none';
  }

  // 1. เปิดหน้าต่างถามยืนยันก่อน
  function openConfirmModal() {
    // ซิงค์ prompt จาก window เสมอ
    if (!deferredPrompt && window.fitjoyDeferredPrompt) {
      deferredPrompt = window.fitjoyDeferredPrompt;
    }

    const confirmModal = document.getElementById('pwa-confirm-modal');
    if (confirmModal) {
      confirmModal.style.display = 'flex';
    } else {
      executeAddToHomeScreen();
    }
  }

  // 2. เมื่อผู้ใช้กดยืนยัน "เพิ่มลงหน้าจอโฮม"
  async function executeAddToHomeScreen() {
    const confirmModal = document.getElementById('pwa-confirm-modal');
    if (confirmModal) {
      confirmModal.style.display = 'none';
    }

    const promptObj = deferredPrompt || window.fitjoyDeferredPrompt;

    // กรณีที่ 1: ถ้าเบราว์เซอร์พร้อมยิง prompt ติดตั้งทันที (Android / Chrome / Edge)
    if (promptObj) {
      console.log('[PWA] Prompting install to user...');
      try {
        promptObj.prompt();
        const choiceResult = await promptObj.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted install prompt');
          hideInstallUI();
        } else {
          console.log('[PWA] User dismissed install prompt');
        }
      } catch (err) {
        console.warn('[PWA] Prompt error:', err);
      }
      deferredPrompt = null;
      window.fitjoyDeferredPrompt = null;
      return;
    }

    // กรณีที่ 2: ถ้าเป็น iOS (iPhone / iPad)
    if (isIOS) {
      const iosModal = document.getElementById('pwa-ios-modal');
      if (iosModal) {
        iosModal.style.display = 'flex';
      }
      return;
    }

    // กรณีที่ 3: คอมพิวเตอร์ (Windows PC / Mac)
    const desktopModal = document.getElementById('pwa-desktop-modal');
    if (desktopModal) {
      desktopModal.style.display = 'flex';
    }
  }

  function closeAllModals() {
    const confirmModal = document.getElementById('pwa-confirm-modal');
    const iosModal = document.getElementById('pwa-ios-modal');
    const desktopModal = document.getElementById('pwa-desktop-modal');
    if (confirmModal) confirmModal.style.display = 'none';
    if (iosModal) iosModal.style.display = 'none';
    if (desktopModal) desktopModal.style.display = 'none';
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
    promptInstall: executeAddToHomeScreen,
    onPromptReady: (e) => {
      deferredPrompt = e;
      showInstallUI();
    }
  };
})();

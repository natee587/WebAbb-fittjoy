/**
 * FitJoy PWA Installation & Service Worker Manager
 * รองรับ Android, iOS (iPhone/iPad), และ Windows (PC / Mac)
 */

(function () {
  let deferredPrompt = null;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  // 1. ลงทะเบียน Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // 2. ดักจับ Event ติดตั้งบน Android / Windows / Chrome / Edge
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt event captured');
    showInstallUI();
  });

  // เมื่อผู้ใช้ทำการติดตั้งเสร็จสิ้น
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] FitJoy was installed successfully');
    deferredPrompt = null;
    hideInstallUI();
    showToast('ติดตั้งแอป "ฟิตจอย" เรียบร้อยแล้ว!');
  });

  document.addEventListener('DOMContentLoaded', () => {
    initInstallUI();
  });

  function initInstallUI() {
    const btnInstall = document.getElementById('btn-pwa-install');
    const btnHeaderInstall = document.getElementById('btn-header-pwa-install');
    const btnCloseBanner = document.getElementById('btn-pwa-banner-close');
    const iosModal = document.getElementById('pwa-ios-modal');
    const btnCloseIosModal = document.getElementById('btn-close-ios-modal');
    const desktopModal = document.getElementById('pwa-desktop-modal');
    const btnCloseDesktopModal = document.getElementById('btn-close-desktop-modal');

    // ถ้าเปิดใช้งานอยู่ในโหมดแอปแล้ว (Standalone) ซ่อนปุ่มทั้งหมด
    if (isStandalone) {
      hideInstallUI();
      return;
    }

    // แสดงปุ่มและแบนเนอร์ติดตั้งเสมอ (ทั้งบนมือถือและคอมพิวเตอร์ / Live Server)
    showInstallUI();

    // ปุ่มกดติดตั้งในแบนเนอร์
    if (btnInstall) {
      btnInstall.addEventListener('click', handleInstallClick);
    }

    // ปุ่มกดติดตั้งบน Header
    if (btnHeaderInstall) {
      btnHeaderInstall.addEventListener('click', handleInstallClick);
    }

    // ปุ่มปิดแถบแบนเนอร์
    if (btnCloseBanner) {
      btnCloseBanner.addEventListener('click', () => {
        const installBanner = document.getElementById('pwa-install-banner');
        if (installBanner) installBanner.style.display = 'none';
        sessionStorage.setItem('fitjoy_dismiss_install', 'true');
      });
    }

    // ปุ่มปิด Modal iOS
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

    // ปุ่มปิด Modal Desktop
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
  }

  function showInstallUI() {
    if (isStandalone) return;
    
    // แบนเนอร์บนหน้าแรก
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner && sessionStorage.getItem('fitjoy_dismiss_install') !== 'true') {
      installBanner.style.display = 'flex';
    }

    // ปุ่มบน Header
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

  async function handleInstallClick() {
    // 1. ถ้ามี Event พร้อมติดตั้งทันที (Chrome / Edge / Android)
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted installation prompt');
        hideInstallUI();
      }
      deferredPrompt = null;
      return;
    }

    // 2. ถ้าเป็น iOS (iPhone / iPad)
    if (isIOS) {
      const iosModal = document.getElementById('pwa-ios-modal');
      if (iosModal) {
        iosModal.style.display = 'flex';
      }
      return;
    }

    // 3. ถ้าเป็นคอมพิวเตอร์ (Windows PC / Mac)
    const desktopModal = document.getElementById('pwa-desktop-modal');
    if (desktopModal) {
      desktopModal.style.display = 'flex';
    } else {
      alert("วิธีติดตั้งลงคอมพิวเตอร์:\nคลิกที่ไอคอน 'ติดตั้งแอป' (Install App) หรือเครื่องหมาย ⊕ / ⬇️ ที่แถบ URL ด้านบนขวาของ Google Chrome หรือ Microsoft Edge");
    }
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
    promptInstall: handleInstallClick
  };
})();

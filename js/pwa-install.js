/**
 * FitJoy PWA Installation & Service Worker Manager
 * รองรับ Android, iOS (iPhone/iPad), และ Windows (PC)
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

  // 2. จัดการ Event ติดตั้งบน Android / Windows (Chrome, Edge, Samsung Internet)
  window.addEventListener('beforeinstallprompt', (e) => {
    // ป้องกัน Browser ขึ้นแถบ mini-infobar อัตโนมัติ เพื่อให้ใช้ปุ่มของเราเอง
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt event captured');

    // แสดงปุ่มติดตั้งบนหน้าเว็บ
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
    const installBanner = document.getElementById('pwa-install-banner');
    const btnInstall = document.getElementById('btn-pwa-install');
    const btnCloseBanner = document.getElementById('btn-pwa-banner-close');
    const iosModal = document.getElementById('pwa-ios-modal');
    const btnCloseIosModal = document.getElementById('btn-close-ios-modal');

    // ถ้าเปิดใช้งานอยู่ในโหมดแอปแล้ว (Standalone) ไม่ต้องแสดงปุ่ม
    if (isStandalone) {
      if (installBanner) installBanner.style.display = 'none';
      return;
    }

    // ถ้าเป็น iOS Safari แสดงปุ่มติดตั้งเสมอ เพราะ iOS ไม่มี beforeinstallprompt
    if (isIOS) {
      showInstallUI();
    }

    // ปุ่มกดติดตั้ง
    if (btnInstall) {
      btnInstall.addEventListener('click', handleInstallClick);
    }

    // ปุ่มปิดแถบแบนเนอร์ (ถ้าผู้ใช้ไม่ต้องการติดตั้งตอนนี้)
    if (btnCloseBanner) {
      btnCloseBanner.addEventListener('click', () => {
        if (installBanner) installBanner.style.display = 'none';
        sessionStorage.setItem('fitjoy_dismiss_install', 'true');
      });
    }

    // ปุ่มปิด Modal แนะนำสำหรับ iOS
    if (btnCloseIosModal && iosModal) {
      btnCloseIosModal.addEventListener('click', () => {
        iosModal.style.display = 'none';
      });
    }

    if (iosModal) {
      iosModal.addEventListener('click', (e) => {
        if (e.target === iosModal) {
          iosModal.style.display = 'none';
        }
      });
    }
  }

  function showInstallUI() {
    if (isStandalone) return;
    if (sessionStorage.getItem('fitjoy_dismiss_install') === 'true') return;

    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) {
      installBanner.style.display = 'flex';
    }
  }

  function hideInstallUI() {
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) {
      installBanner.style.display = 'none';
    }
  }

  async function handleInstallClick() {
    // กรณีที่ 1: Android หรือ Windows (มี beforeinstallprompt)
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted installation prompt');
        hideInstallUI();
      } else {
        console.log('[PWA] User dismissed installation prompt');
      }
      deferredPrompt = null;
      return;
    }

    // กรณีที่ 2: iOS (iPhone / iPad Safari)
    if (isIOS) {
      const iosModal = document.getElementById('pwa-ios-modal');
      if (iosModal) {
        iosModal.style.display = 'flex';
      } else {
        alert("วิธีติดตั้งบน iOS / iPhone:\n1. แตะปุ่มแชร์ (Share) ด้านล่างของ Safari\n2. เลื่อนลงแล้วแตะ 'เพิ่มไปยังหน้าจอโฮม' (Add to Home Screen)");
      }
      return;
    }

    // กรณีที่ 3: Browser อื่นๆ บนคอม/มือถือ ที่ไม่มี prompt โดยตรง
    alert("คำแนะนำการติดตั้ง:\n- สำหรับคอมพิวเตอร์: คลิกที่ไอคอน 'ติดตั้ง' (Install App) บนแถบ URL ด้านบนขวาของเบราว์เซอร์\n- สำหรับมือถือ: แตะที่เมนู (3 จุด) แล้วเลือก 'ติดตั้งแอป' หรือ 'เพิ่มลงในหน้าจอหลัก'");
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'pwa-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 50);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ส่งออกไปที่ window เผื่อเรียกจากภายนอก
  window.fitjoyPWA = {
    promptInstall: handleInstallClick
  };
})();

# สคริปต์บีบอัดวิดีโอและจัดการสื่อสำหรับโปรเจกต์ออกกำลังกาย
# ความละเอียด: 720p (1280x720) Bitrate ~1.2-1.5 Mbps (H.264 / AAC)
# ประหยัดพื้นที่ได้ 80-90%

param (
    [string]$TargetFolder = ""
)

# ค้นหา ffmpeg
$ffmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue
if (-not $ffmpegCmd) {
    # ลองหาใน LocalAppData (WinGet) / Program Files
    $possiblePaths = @(
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg*\bin\ffmpeg.exe",
        "$env:ProgramFiles\FFmpeg\bin\ffmpeg.exe"
    )
    foreach ($p in $possiblePaths) {
        $found = Get-Item $p -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $ffmpegCmd = $found.FullName
            break
        }
    }
}

if (-not $ffmpegCmd) {
    Write-Error "ไม่พบ ffmpeg ในระบบ กรุณารอติดตั้งให้เสร็จสมบูรณ์"
    exit 1
}

$root = $PSScriptRoot + "\.."
if ($TargetFolder -ne "") {
    $folders = @(Get-Item "$root\$TargetFolder" -ErrorAction SilentlyContinue)
} else {
    # ค้นหาโฟลเดอร์ท่าทั้งหมดในโปรเจกต์ (ยกเว้น css, js, assets, scripts)
    $folders = Get-ChildItem -Path $root -Directory | Where-Object { 
        $_.Name -notin @("css", "js", "assets", "scripts", ".git", ".gemini", "node_modules")
    }
}

Write-Host "=== เริ่มการตรวจสอบและบีบอัดสื่อสำหรับโปรเจกต์ออกกำลังกาย ===" -ForegroundColor Cyan

foreach ($dir in $folders) {
    Write-Host "`n📁 ตรวจสอบโฟลเดอร์: $($dir.Name)" -ForegroundColor Yellow

    # จัดการรูปภาพหน้าปก -> ตั้งชื่อมาตรฐาน cover.jpg
    $images = Get-ChildItem -Path $dir.FullName -File | Where-Object { $_.Extension -match "\.(jpg|jpeg|png|webp)$" }
    $cover = $images | Where-Object { $_.Name -eq "cover.jpg" } | Select-Object -First 1
    if (-not $cover -and $images.Count -gt 0) {
        $firstImg = $images[0]
        Copy-Item -Path $firstImg.FullName -Destination "$($dir.FullName)\cover.jpg" -Force
        Write-Host "   📸 สร้างไฟล์หน้าปกมาตรฐาน: cover.jpg (จาก $($firstImg.Name))" -ForegroundColor Green
    }

    # จัดการไฟล์วิดีโอ
    $videos = Get-ChildItem -Path $dir.FullName -File | Where-Object { $_.Extension -match "\.(mp4|mov|avi|mkv)$" }
    foreach ($vid in $videos) {
        # หากมีไฟล์วิดีโอใหม่ที่ยังไม่ได้แปลงเป็น video.mp4 หรือไฟล์ video.mp4 ใหญ่เกิน 35 MB
        $sizeMB = [math]::Round($vid.Length / 1MB, 2)
        if ($vid.Name -ne "video.mp4" -or $sizeMB -gt 35) {
            Write-Host "   🎬 กำลังบีบอัดวิดีโอ: $($vid.Name) (ขนาดเดิม: $sizeMB MB)..." -ForegroundColor Magenta
            $tempOutput = "$($dir.FullName)\video_optimized.mp4"

            # สูตรบีบอัด HD สมดุล (CRF 26): ภาพคมชัด หน้าและท่าทางชัดเจน ไม่แตกมัว
            # ขนาดไฟล์: ~15–20 MB สำหรับคลิปยาว 3–4 นาที (หรือ ~5–7 MB สำหรับคลิปสั้น 1 นาที)
            $args = @(
                "-y",
                "-i", $vid.FullName,
                "-vf", "scale=-2:720",
                "-c:v", "libx264",
                "-crf", "26",
                "-preset", "medium",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                $tempOutput
            )

            & $ffmpegCmd $args 2>&1 | Out-Null

            if (Test-Path $tempOutput) {
                $newSizeMB = [math]::Round((Get-Item $tempOutput).Length / 1MB, 2)
                $percent = [math]::Round((1 - ($newSizeMB / $sizeMB)) * 100, 1)

                # ย้ายและแทนที่ไฟล์เดิม
                Remove-Item -Path $vid.FullName -Force
                Move-Item -Path $tempOutput -Destination "$($dir.FullName)\video.mp4" -Force

                Write-Host "   ✅ บีบอัดสำเร็จเป็น video.mp4: ขนาดใหม่ $newSizeMB MB (ลดลง $percent% 🎉)" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️ การบีบอัดไม่สำเร็จ ไฟล์ยังคงเดิม" -ForegroundColor Red
            }
        } else {
            Write-Host "   ✨ วิดีโอ $($vid.Name) มีขนาดเหมาะสมแล้ว ($sizeMB MB)" -ForegroundColor Gray
        }
    }
}

Write-Host "`n=== การประมวลผลเสร็จสิ้น ===" -ForegroundColor Cyan

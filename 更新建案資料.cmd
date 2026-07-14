@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 居鑑資料安全更新開始...
call npm.cmd run data:update
if errorlevel 1 (
  echo.
  echo 更新未完成，原有網站資料不會自動刪除。請把畫面內容交給 Codex 檢查。
) else (
  echo.
  echo 更新完成。請查看 data\processed\update-report.json，確認後再請 Codex 發布網站。
)
pause

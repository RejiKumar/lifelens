@echo off
setlocal
set ANDROID_HOME=
cd /d "D:\RARK\AI Native\Projects\lifelens\mobile"
npx expo start --port 8081 > expo2.log 2>&1
endlocal
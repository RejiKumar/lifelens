param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [string]$Image = "backend\_e2e\lifelens_home_small.png",
    [string]$GuestSession = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$tmp = Join-Path $env:TEMP "lifelens_smoke"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

if (-not $GuestSession) {
    $GuestSession = [guid]::NewGuid().ToString("N")
}

function Invoke-Curl {
    param([string[]]$Arguments)
    & curl.exe $Arguments 2>$null
}

function Assert-True {
    param([bool]$Condition, [string]$Name)
    if ($Condition) {
        Write-Host "  PASS: $Name"
    } else {
        Write-Error "FAIL: $Name"
    }
}

Write-Host "== LifeLens Ask LifeLens stub smoke =="
Write-Host "Guest session: $GuestSession"

Write-Host "1. Scan upload + analyze"
$idem = [guid]::NewGuid().ToString("N")
$scanBody = Join-Path $tmp "scan.json"
Invoke-Curl -Arguments @("-s", "-X", "POST", "$BaseUrl/scan/analyze",
    "-H", "x-guest-session: $GuestSession",
    "-F", "image=@$Image",
    "-F", "idempotency_key=$idem",
    "-F", "source=camera",
    "-o", $scanBody) | Out-Null
$scan = Get-Content $scanBody -Raw | ConvertFrom-Json
if (-not $scan.analysis.id) { throw "No analysis id in scan response: $scanBody" }
$analysisId = $scan.analysis.id
Assert-True ($null -ne $scan.analysis.id -and $null -ne $scan.analysis.scan_id) "analysis id + scan_id present"
Assert-True ($scan.quota.used -ge 1) "quota used after scan (used=$($scan.quota.used))"

Write-Host "2. Follow-ups until quota blocks"
$lastQuota = $scan.quota
$httpCode = 0
$round = 0
for ($i = 1; $i -le 6; $i++) {
$bodyFile = Join-Path $tmp "turn$i.json"
    $body = @{ question = "Tell me more about what I am looking at (turn $i). How should I handle it?" } | ConvertTo-Json
    Set-Content -Path $bodyFile -Value $body -Encoding utf8
    Invoke-Curl -Arguments @("-s", "-X", "POST", "$BaseUrl/analysis/$analysisId/follow-up",
        "-H", "x-guest-session: $GuestSession",
        "-H", "Content-Type: application/json",
        "-d", "@$bodyFile",
        "-o", $bodyFile,
        "-w", "%{http_code}") | Out-String | ForEach-Object { $httpCode = $_.Trim() }
    $round = $i
if ($httpCode -eq 200) {
        $follow = Get-Content $bodyFile -Raw | ConvertFrom-Json
        Assert-True ($null -ne $follow.message.content -and $follow.message.content.Trim().Length -gt 0) "turn $i grounded answer non-empty"
        Assert-True ($null -ne $follow.quota) "turn $i quota present (used=$($follow.quota.used))"
        $lastQuota = $follow.quota
    } elseif ($httpCode -eq 429) {
        $err = Get-Content $bodyFile -Raw | ConvertFrom-Json
        Write-Host "  turn $i -> HTTP 429 ($($err.error.code))"
        break
    } else {
        Write-Error "turn $i unexpected HTTP $httpCode"
    }
}
Assert-True ($httpCode -eq 429) "quota exceeded blocks at 429 after guest daily limit"
Assert-True ($lastQuota.used -ge 5) "quota reflected on last success (used=$($lastQuota.used))"

Write-Host "3. Chat-history restore"
$hist = Join-Path $tmp "history.json"
Invoke-Curl -Arguments @("-s", "$BaseUrl/analysis/$analysisId/chat-history",
    "-H", "x-guest-session: $GuestSession",
    "-o", $hist) | Out-Null
$history = Get-Content $hist -Raw | ConvertFrom-Json
$turnCount = $round - 1
Assert-True ($history.messages.Count -eq ($turnCount * 2)) "chat-history restores $($turnCount*2) messages ($($history.messages.Count))"
Assert-True ($null -ne $history.quota) "chat-history quota present"
Write-Host "  remaining_capacity=$($history.remaining_capacity)"

Write-Host "SMOKE COMPLETE"

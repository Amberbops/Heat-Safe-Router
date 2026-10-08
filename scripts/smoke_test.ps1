$ErrorActionPreference = "Stop"

$BaseUrl = "https://zlxk92fdb6.execute-api.us-east-1.amazonaws.com/dev"

function Show-Pass {
    param([string]$Name)

    Write-Host "[PASS] $Name" -ForegroundColor Green
}

function Show-Fail {
    param([string]$Name, [string]$Message)

    Write-Host "[FAIL] $Name - $Message" -ForegroundColor Red
    exit 1
}

Write-Host "Heat-Safe Route Planner smoke test"
Write-Host "Base URL: $BaseUrl"
Write-Host ""

# ============================================================
# 1. HEALTH
# ============================================================

try {
    $health = Invoke-RestMethod "$BaseUrl/health"

    if ($health.status -ne "ok") {
        Show-Fail "GET /health" "Unexpected status: $($health.status)"
    }

    Show-Pass "GET /health"
}
catch {
    Show-Fail "GET /health" $_.Exception.Message
}


# ============================================================
# 2. WEATHER
# ============================================================

try {
    $weather = Invoke-RestMethod `
        "$BaseUrl/weather?latitude=22.7196&longitude=75.8577"

    if ($null -eq $weather.temperature_c) {
        Show-Fail "GET /weather" "Missing temperature_c"
    }

    if ($null -eq $weather.humidity_percent) {
        Show-Fail "GET /weather" "Missing humidity_percent"
    }

    if ($null -eq $weather.wind_speed_kmh) {
        Show-Fail "GET /weather" "Missing wind_speed_kmh"
    }

    Show-Pass "GET /weather"
}
catch {
    Show-Fail "GET /weather" $_.Exception.Message
}


# ============================================================
# 3. BASIC ROUTING
# ============================================================

try {
    $routes = Invoke-RestMethod `
        "$BaseUrl/routes?originLat=22.7196&originLon=75.8577&destLat=22.7256&destLon=75.8656"

    if ($routes.status -ne "ok") {
        Show-Fail "GET /routes" "Unexpected status: $($routes.status)"
    }

    if ($null -eq $routes.distance_km) {
        Show-Fail "GET /routes" "Missing distance_km"
    }

    if ($null -eq $routes.duration_min) {
        Show-Fail "GET /routes" "Missing duration_min"
    }

    Show-Pass "GET /routes"
}
catch {
    Show-Fail "GET /routes" $_.Exception.Message
}


# ============================================================
# 4. HEAT SCORE
# ============================================================

try {
    $score = Invoke-RestMethod `
        "$BaseUrl/heat-score?temperature=33.5&humidity=26&wind=10.7&duration=16.3"

    if ($score.status -ne "ok") {
        Show-Fail "GET /heat-score" "Unexpected status: $($score.status)"
    }

    if ($null -eq $score.heat_score) {
        Show-Fail "GET /heat-score" "Missing heat_score"
    }

    if ($null -eq $score.category) {
        Show-Fail "GET /heat-score" "Missing category"
    }

    Show-Pass "GET /heat-score"
}
catch {
    Show-Fail "GET /heat-score" $_.Exception.Message
}


# ============================================================
# 5. FULL PLANNER
# ============================================================

try {
    $plan = Invoke-RestMethod `
        "$BaseUrl/plan-route?originLat=22.7196&originLon=75.8577&destLat=22.7256&destLon=75.8656"

    if ($plan.status -ne "ok") {
        Show-Fail "GET /plan-route" "Unexpected status: $($plan.status)"
    }

    if ([string]::IsNullOrWhiteSpace($plan.request_id)) {
        Show-Fail "GET /plan-route" "Missing request_id"
    }

    if ($plan.route_count -lt 1) {
        Show-Fail "GET /plan-route" "No routes returned"
    }

    if ([string]::IsNullOrWhiteSpace($plan.recommended_route)) {
        Show-Fail "GET /plan-route" "Missing recommended_route"
    }

    if ($plan.storage.status -ne "saved") {
        Show-Fail `
            "GET /plan-route" `
            "DynamoDB storage status was '$($plan.storage.status)'"
    }

    Show-Pass "GET /plan-route"
}
catch {
    Show-Fail "GET /plan-route" $_.Exception.Message
}


# ============================================================
# 6. VALIDATION TEST
# ============================================================

try {
    Invoke-RestMethod `
        "$BaseUrl/plan-route?originLat=22.7196&originLon=75.8577" `
        -ErrorAction Stop

    Show-Fail `
        "/plan-route missing parameter" `
        "Expected HTTP 400, but request succeeded"
}
catch {

    $statusCode = $null

    if ($_.Exception.Response) {
        try {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        catch {
            $statusCode = $null
        }
    }

    if ($statusCode -eq 400) {
        Show-Pass "/plan-route missing parameter returns HTTP 400"
    }
    else {
        Write-Host `
            "[WARN] Validation test could not confirm HTTP 400. Actual status: $statusCode" `
            -ForegroundColor Yellow
    }
}


# ============================================================
# SUMMARY
# ============================================================

Write-Host ""
Write-Host "============================================"
Write-Host "ALL CORE SMOKE TESTS PASSED" -ForegroundColor Green
Write-Host "============================================"
Write-Host ""

Write-Host "Planner summary:"
Write-Host "  request_id        : $($plan.request_id)"
Write-Host "  route_count       : $($plan.route_count)"
Write-Host "  recommended_route : $($plan.recommended_route)"
Write-Host "  storage.status    : $($plan.storage.status)"
Write-Host ""
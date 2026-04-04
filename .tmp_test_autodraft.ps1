$envPath = "c:\Users\MateuszDudek\Documents\AI APP\blog-gedeon\.env"
$envContent = Get-Content $envPath
$secretLine = $envContent | Where-Object { $_ -match "^CRON_SECRET=" } | Select-Object -First 1
$secret = ($secretLine -split "=", 2)[1].Trim()

Write-Host "=== Test autoDraft=true (3 drafts from Gemini) ==="
$headers = @{ Authorization = "Bearer $secret" }
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/b2b/sync?autoDraft=true" -Headers $headers -UseBasicParsing -TimeoutSec 60
    $sw.Stop()
    Write-Host ("Time: {0:F1}s | Status: {1}" -f $sw.Elapsed.TotalSeconds, $resp.StatusCode)
    $json = $resp.Content | ConvertFrom-Json
    Write-Host ("fetched={0} newProducts={1} topicsCreated={2} draftsCreated={3}" -f $json.fetched, $json.newProducts, $json.topicsCreated, $json.draftsCreated)
    Write-Host "message: $($json.message)"
    if ($json.errors -and $json.errors.Count -gt 0) {
        Write-Host "Errors:"
        $json.errors | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" }
    }
} catch {
    $sw.Stop()
    Write-Host ("Time: {0:F1}s | Error: {1}" -f $sw.Elapsed.TotalSeconds, $_.Exception.Message)
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

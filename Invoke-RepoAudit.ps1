param(
  [ValidateSet('delete','archive','all')]
  [string]$Action = 'all',
  [switch]$WhatIf
)

$csv = Import-Csv "$PSScriptRoot\repo-audit.csv"
$owner = (gh api user --jq '.login') 2>$null
if (-not $owner) { Write-Error "Not authenticated with gh"; exit 1 }

$decisions = @{}
$csv | ForEach-Object { $decisions[$_.name] = $_.decision }

$ops = @()
switch ($Action) {
  'delete' { $ops = $csv | Where-Object { $_.decision -eq 'd' } }
  'archive' { $ops = $csv | Where-Object { $_.decision -eq 'a' } }
  'all' { $ops = $csv | Where-Object { $_.decision -in @('d','a') } }
}

$total = $ops.Count
if ($total -eq 0) { Write-Host "Nothing to do."; return }

Write-Host "=== Repo Audit: $Action ===" -ForegroundColor Cyan
Write-Host "Found $total repos to process.`n" -ForegroundColor Yellow

$ops | Format-Table @{L='Action';E={if ($_.decision -eq 'd') {'DELETE '} else {'ARCHIVE'}}},
  @{L='Repo';E={$_.name}},
  @{L='Disk';E={$_.diskMB}},
  @{L='Stars';E={$_.stars}},
  @{L='Pushed';E={$_.pushed}},
  @{L='Notes';E={$_.notes}} -AutoSize

if (-not $WhatIf) {
  Write-Host "`nProceeding in 5 seconds... Ctrl+C to abort." -ForegroundColor Red
  Start-Sleep 5
}

$ok = $err = 0
foreach ($op in $ops) {
  $repo = "$owner/$($op.name)"
  $isDelete = $op.decision -eq 'd'

  if ($WhatIf) {
    if ($isDelete) { Write-Host "[WHATIF] gh repo delete $repo --yes" -ForegroundColor DarkRed }
    else { Write-Host "[WHATIF] gh repo archive $repo --yes" -ForegroundColor DarkYellow }
    continue
  }

  try {
    if ($isDelete) {
      gh repo delete $repo --yes 2>$null
      Write-Host "[OK] Deleted $repo" -ForegroundColor Green
    } else {
      # GraphQL mutation for archive — plain REST endpoint
      gh api -X PATCH "/repos/$repo" -f archived=true 2>$null
      Write-Host "[OK] Archived $repo" -ForegroundColor Yellow
    }
    $ok++
  } catch {
    Write-Host "[ERR] Failed on $repo : $_" -ForegroundColor Red
    $err++
  }
  # be polite to the API
  Start-Sleep -Milliseconds 250
}

if (-not $WhatIf) {
  Write-Host "`n=== Done: $ok succeeded, $err failed ===" -ForegroundColor Cyan
} else {
  Write-Host "`n=== Dry-run complete ($total ops) ===" -ForegroundColor Cyan
  Write-Host "Run without -WhatIf to execute." -ForegroundColor Yellow
}

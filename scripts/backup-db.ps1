<#
Backs up the Supabase Postgres DB (DATABASE_URL from .env.local) to
D:\Luka\JKNM\rewrite-backups\jknm_<timestamp>.dump via pg_dump custom
format (-Fc), matching the format of the existing dumps already in that
directory (confirmed via PGDMP magic bytes).

Usage: pwsh scripts/backup-db.ps1
#>

$ErrorActionPreference = "Stop"

$repo_root = Split-Path -Parent $PSScriptRoot
$env_file = Join-Path $repo_root ".env.local"
$backup_dir = "D:\Luka\JKNM\rewrite-backups"

$line = Get-Content $env_file | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $line) { throw "DATABASE_URL not found in $env_file" }
$db_url = ($line -replace '^DATABASE_URL=', '').Trim('"')

if (-not (Test-Path $backup_dir)) {
    New-Item -ItemType Directory -Path $backup_dir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$out_file = Join-Path $backup_dir "jknm_$timestamp.dump"

Write-Host "Backing up to $out_file"
& pg_dump $db_url -Fc -f $out_file
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE"
}

$size_mb = [math]::Round((Get-Item $out_file).Length / 1MB, 1)
Write-Host "Backup complete: $out_file ($size_mb MB)"

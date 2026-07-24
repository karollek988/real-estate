<#
  Runs every pending DeepSeek task, one at a time, pausing between each for review.

  Usage (from anywhere):
    powershell -ExecutionPolicy Bypass -File "C:\Users\Karol\Documents\Claude\projects\real-estate\deepseek-tasks\run-tasks.ps1"

  After each task finishes you'll see a summary of what files changed (git diff --stat)
  and get asked to press Enter to continue to the next task, or Ctrl+C to stop.
  Nothing gets committed automatically — that's a manual/Claude-reviewed step afterward.
#>

$ErrorActionPreference = "Stop"
$projectDir = "C:\Users\Karol\Documents\Claude\projects\real-estate"
$pendingDir = Join-Path $projectDir "deepseek-tasks\pending"
$completedDir = Join-Path $projectDir "deepseek-tasks\completed"

$tasks = Get-ChildItem -Path $pendingDir -Filter "*.md" | Sort-Object Name

if ($tasks.Count -eq 0) {
    Write-Host "No pending tasks found in $pendingDir." -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($tasks.Count) pending task(s):" -ForegroundColor Cyan
$tasks | ForEach-Object { Write-Host "  - $($_.Name)" }
Write-Host ""

foreach ($task in $tasks) {
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host "Running task: $($task.Name)" -ForegroundColor Cyan
    Write-Host "=====================================================" -ForegroundColor Cyan

    $prompt = "Read deepseek-tasks/GROUND_RULES.md, then complete the task described in the attached file. Follow both documents exactly."

    & opencode run $prompt -f $task.FullName --model deepseek/deepseek-chat --dir $projectDir

    Write-Host ""
    Write-Host "--- git diff --stat (what changed on disk) ---" -ForegroundColor Green
    Push-Location $projectDir
    git diff --stat
    git status --short
    Pop-Location

    $completedPath = Join-Path $completedDir $task.Name
    Move-Item -Path $task.FullName -Destination $completedPath -Force
    Write-Host ""
    Write-Host "Task file moved to completed/$($task.Name)" -ForegroundColor DarkGray

    if ($task -ne $tasks[-1]) {
        Write-Host ""
        Read-Host "Press Enter to continue to the next task (or Ctrl+C to stop here)"
    }
}

Write-Host ""
Write-Host "All tasks done. Tell Claude to review the changes." -ForegroundColor Green

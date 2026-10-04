$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$frontendRoot = Join-Path $projectRoot "frontend"

if (-not (Test-Path (Join-Path $frontendRoot "package.json"))) {
    throw "Could not find frontend/package.json next to this script."
}

foreach ($commandName in @("node", "npm", "supabase", "docker")) {
    if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
        throw "Required command '$commandName' was not found on PATH. Install Node.js, the Supabase CLI, and Docker Desktop, then try again."
    }
}

Push-Location $projectRoot
try {
    Write-Host "Starting the local Supabase services..."
    & supabase start
    if ($LASTEXITCODE -ne 0) {
        throw "Supabase failed to start. Check that Docker Desktop is running."
    }

    $supabaseStatus = & supabase status --output env
    if ($LASTEXITCODE -ne 0) {
        throw "Could not read local Supabase credentials."
    }

    $supabaseEnvironment = @{}
    foreach ($line in $supabaseStatus) {
        if ($line -match '^([A-Z0-9_]+)=(.*)$') {
            $supabaseEnvironment[$Matches[1]] = $Matches[2].Trim('"')
        }
    }

    foreach ($requiredVariable in @("API_URL", "ANON_KEY", "SERVICE_ROLE_KEY")) {
        if (-not $supabaseEnvironment.ContainsKey($requiredVariable)) {
            throw "Supabase did not provide $requiredVariable. Check the output of 'supabase status --output env'."
        }
    }

    $env:NEXT_PUBLIC_SUPABASE_URL = $supabaseEnvironment["API_URL"]
    $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $supabaseEnvironment["ANON_KEY"]
    $env:SUPABASE_SERVICE_ROLE_KEY = $supabaseEnvironment["SERVICE_ROLE_KEY"]

    if (-not (Test-Path (Join-Path $frontendRoot "node_modules"))) {
        Write-Host "Installing frontend dependencies..."
        Push-Location $frontendRoot
        try {
            & npm ci
            if ($LASTEXITCODE -ne 0) {
                throw "Frontend dependency installation failed."
            }
        }
        finally {
            Pop-Location
        }
    }

    Write-Host "Starting the app at http://localhost:3001"
    Write-Host "Press Ctrl+C to stop the app. Run 'supabase stop' separately to stop Supabase."
    Push-Location $frontendRoot
    try {
        & npm run dev
        if ($LASTEXITCODE -ne 0) {
            throw "The frontend development server exited with an error."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}

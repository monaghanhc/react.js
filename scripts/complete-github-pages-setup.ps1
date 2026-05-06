# One-time: grants GitHub CLI the scopes needed to push workflow files, registers
# this machine's SSH key on your account, then commits and pushes the workflow.
# Run from repo root:  powershell -ExecutionPolicy Bypass -File scripts/complete-github-pages-setup.ps1
$ErrorActionPreference = "Stop"
# ssh-key add may fail if key is already on your account (422); that's OK for HTTPS pushes.
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

Write-Host @"

=== GitHub Pages / workflow setup ===
This will:
  1) Open GitHub device login to add required OAuth scopes to 'gh' (workflow, admin:public_key)
  2) Add this PC's SSH public key to your GitHub account (if not already)
  3) Commit and push .github/workflows/github-pages.yml to master

When a code appears, open https://github.com/login/device and authorize the GitHub CLI app.

"@
$pub = Join-Path $env:USERPROFILE ".ssh\id_ed25519_react_js.pub"
if (-not (Test-Path $pub)) {
  Write-Error "Missing SSH public key: $pub"
}
gh auth refresh -h github.com -s workflow -s admin:public_key
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$title = "react.js workflow push (this machine)"
gh ssh-key add $pub --title $title 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host "SSH key API step skipped or failed (duplicate key is OK). Using HTTPS + gh for push." -ForegroundColor DarkYellow
}

git remote set-url origin "https://github.com/monaghanhc/react.js.git"
gh auth setup-git | Out-Null
git add .github/workflows/github-pages.yml 2>$null
if ((git status --porcelain) -match "github-pages\.yml") {
  git commit -m "Add Actions workflow to build and deploy to gh-pages"
}
git push origin master
Write-Host "Done. Check Actions: https://github.com/monaghanhc/react.js/actions" -ForegroundColor Green

# Re-vendor the superpowers skills from upstream and re-apply DSH adaptations.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/sync-upstream.ps1 [-Branch main]

param(
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$PluginRoot = Split-Path -Parent $PSScriptRoot
$SkillsDir = Join-Path $PluginRoot "skills"
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("superpowers-sync-" + [guid]::NewGuid().ToString("N"))
$CloneDir = Join-Path $TempRoot "upstream"

try {
    Write-Host "Cloning https://github.com/obra/superpowers ($Branch) ..."
    git clone --depth 1 --branch $Branch https://github.com/obra/superpowers $CloneDir | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "git clone failed" }

    $Commit = git -C $CloneDir rev-parse HEAD
    Write-Host "Upstream commit: $Commit"

    $UpstreamSkills = Join-Path $CloneDir "skills"
    if (-not (Test-Path $UpstreamSkills)) { throw "upstream skills directory missing" }

    # Replace the vendored skills tree wholesale.
    if (Test-Path $SkillsDir) { Remove-Item $SkillsDir -Recurse -Force }
    Copy-Item $UpstreamSkills $SkillsDir -Recurse

    # Adaptation 1: add the DSH line to using-superpowers' Platform Adaptation list.
    $UsingSuperpowers = Join-Path $SkillsDir "using-superpowers\SKILL.md"
    $Content = Get-Content $UsingSuperpowers -Raw
    $Anchor = "- Hermes Agent: ``references/hermes-tools.md``"
    $DshLine = "- DeepSeek Harness (DSH): ``references/dsh-tools.md``"
    if ($Content -notmatch [regex]::Escape("- DeepSeek Harness (DSH):")) {
        if ($Content -notmatch [regex]::Escape($Anchor)) {
            throw "using-superpowers Platform Adaptation anchor not found; upstream layout may have changed"
        }
        $Content = $Content.Replace($Anchor, "$Anchor`r`n$DshLine")
        Set-Content -Path $UsingSuperpowers -Value $Content -Encoding utf8NoBOM
        Write-Host "Adaptation applied: using-superpowers DSH reference line"
    }

    # Adaptation 2: ensure references/dsh-tools.md exists (kept in adaptations/).
    $RefsDir = Join-Path $SkillsDir "using-superpowers\references"
    $SourceRef = Join-Path $PluginRoot "adaptations\dsh-tools.md"
    if (-not (Test-Path $SourceRef)) { throw "adaptations/dsh-tools.md missing" }
    New-Item -ItemType Directory -Path $RefsDir -Force | Out-Null
    Copy-Item $SourceRef (Join-Path $RefsDir "dsh-tools.md") -Force
    Write-Host "Adaptation applied: references/dsh-tools.md"

    # Record the new provenance.
    $UpstreamDoc = @"
# Upstream provenance

The ``skills/`` directory under this package is vendored from the
[obra/superpowers](https://github.com/obra/superpowers) repository.

| Field | Value |
|---|---|
| Repository | https://github.com/obra/superpowers |
| Vendored commit | ``$Commit`` |
| License | MIT — see ``LICENSE`` (Copyright (c) 2025 Jesse Vincent) |

## Local adaptations

Two small, deliberate divergences from the vendored tree; this script re-applies
both after every re-sync:

1. ``skills/using-superpowers/SKILL.md`` — the "Platform Adaptation" list gains
   one entry: ``DeepSeek Harness (DSH): references/dsh-tools.md``.
2. ``skills/using-superpowers/references/dsh-tools.md`` — written for this
   adapter; maps DSH's tool surface onto the platform-agnostic conventions the
   upstream skills assume. The authoritative copy lives in
   ``adaptations/dsh-tools.md``.

Everything else is byte-identical to upstream. References between skills that
upstream spells ``superpowers:<name>`` are rewritten to the plain kebab-case
name at load time (``normalizeSkillReferences`` in ``index.js``) because DSH
skill names carry no marketplace prefix; the vendored files stay pristine.

## Re-syncing upstream

``powershell -ExecutionPolicy Bypass -File scripts/sync-upstream.ps1``

Then update ``version`` and the ``upstream`` fields in ``package.json`` and run
``npm test``.
"@
    Set-Content -Path (Join-Path $PluginRoot "UPSTREAM.md") -Value $UpstreamDoc -Encoding utf8NoBOM

    Write-Host ""
    Write-Host "Done. Vendored skills updated to $Commit."
    Write-Host "Review the diff, update version/upstream in package.json, then run: npm test"
} finally {
    if (Test-Path $TempRoot) { Remove-Item $TempRoot -Recurse -Force }
}

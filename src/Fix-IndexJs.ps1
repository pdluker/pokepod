# Fix-IndexJs.ps1
# Run from inside C:\Users\pdluk\pokepod\src\ (or pass -Path explicitly).
# Backs up index.js, then fixes:
#   1. The unclosed `nextFlavor` object literal (missing doubleKOTaglines,
#      missing closing brace, missing the RECENT_FLAVOR_KEY R2 write).
#   2. Removes the dead habitat/behavior/trait/power/etc. WINDOWS entries.
#
# Usage:  .\Fix-IndexJs.ps1
#     or: .\Fix-IndexJs.ps1 -Path "C:\Users\pdluk\pokepod\src\index.js"

param(
    [string]$Path = ".\index.js"
)

if (-not (Test-Path $Path)) {
    Write-Error "Could not find $Path - run this from the src folder, or pass -Path."
    exit 1
}

# Backup first - never edit in place without a fallback.
$resolvedPath = (Resolve-Path $Path).Path
$backupPath = "$resolvedPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $resolvedPath $backupPath
Write-Host "Backed up original to $backupPath"

$content = [System.IO.File]::ReadAllText($resolvedPath, [System.Text.Encoding]::UTF8)

# --- Fix 1: replace the broken/unclosed nextFlavor block -----------------
$oldNextFlavorPattern = [regex]::new(
    'const nextFlavor = \{.*?recentCreatureNames: pushWindow\(\s*recentFlavor\.recentCreatureNames,\s*creatureA\.name,\s*20[^\)]*\),\s*',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$newNextFlavorBlock = @'
const nextFlavor = {
    arenaNames: pushWindow(recentFlavor.arenaNames, arena.name, WINDOWS.arenaNames),
    trainerBackgrounds: pushWindow(recentFlavor.trainerBackgrounds, trainerA.background, WINDOWS.trainerBackgrounds),
    trainerStyles: pushWindow(recentFlavor.trainerStyles, trainerA.style, WINDOWS.trainerStyles),
    trainerQuirks: pushWindow(recentFlavor.trainerQuirks, trainerA.quirk, WINDOWS.trainerQuirks),
    trainerHometowns: pushWindow(recentFlavor.trainerHometowns, trainerA.hometown, WINDOWS.trainerHometowns),
    coldOpens: pushWindow(recentFlavor.coldOpens, usedIndices.coldOpens, WINDOWS.coldOpens),
    victoryLines: pushWindow(recentFlavor.victoryLines, usedIndices.victoryLines, WINDOWS.victoryLines),
    victoryColorNotes: pushWindow(recentFlavor.victoryColorNotes, usedIndices.victoryColorNotes, WINDOWS.victoryColorNotes),
    signoffAsides: pushWindow(recentFlavor.signoffAsides, usedIndices.signoffAsides, WINDOWS.signoffAsides),
    finalSignoffs: pushWindow(recentFlavor.finalSignoffs, usedIndices.finalSignoffs, WINDOWS.finalSignoffs),
    statInsightPhrases: usedIndices.statInsightPhrases != null
      ? pushWindow(recentFlavor.statInsightPhrases, usedIndices.statInsightPhrases, WINDOWS.statInsightPhrases)
      : (recentFlavor.statInsightPhrases || []),
    fightHypeTaglines: usedIndices.fightHypeTaglines != null
      ? pushWindow(recentFlavor.fightHypeTaglines, usedIndices.fightHypeTaglines, WINDOWS.fightHypeTaglines)
      : (recentFlavor.fightHypeTaglines || []),
    doubleKOTaglines: usedIndices.doubleKOTaglines != null
      ? pushWindow(recentFlavor.doubleKOTaglines, usedIndices.doubleKOTaglines, WINDOWS.doubleKOTaglines)
      : (recentFlavor.doubleKOTaglines || []),
    recentCreatureNames: pushWindow(recentFlavor.recentCreatureNames, creatureA.name, 20)
  };
  await env.PODCAST_BUCKET.put(RECENT_FLAVOR_KEY, JSON.stringify(nextFlavor, null, 2), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' }
  });

'@

$match = $oldNextFlavorPattern.Match($content)
if (-not $match.Success) {
    Write-Error "Pattern for the broken nextFlavor block was not found. Nothing was changed. Restore from $backupPath if needed, or paste index.js back to Claude for a fresh diff against your current file."
    exit 1
}
$content = $content.Remove($match.Index, $match.Length).Insert($match.Index, $newNextFlavorBlock)
Write-Host "Fixed the nextFlavor block (closed the object, restored doubleKOTaglines, restored the R2 write)."

# --- Fix 2: strip the dead flavor-field entries from WINDOWS -------------
$oldWindows = "const WINDOWS = {`n  habitats: 8, behaviors: 6, traits: 6, powers: 6, renownLevels: 4,`n  bodyTypes: 6, facialFeatures: 6, distinctiveFeatures: 6, colorPatterns: 6,`n  arenaNames: 10,"
$newWindows = "const WINDOWS = {`n  arenaNames: 10,"

if ($content.Contains($oldWindows)) {
    $content = $content.Replace($oldWindows, $newWindows)
    Write-Host "Removed dead flavor-field entries from WINDOWS."
} else {
    Write-Warning "WINDOWS block text didn't match exactly (may already be cleaned up, or formatting differs slightly) - left untouched. Not fatal, just cosmetic cleanup skipped."
}

# Write back without BOM (avoids the encoding-corruption class of bug seen
# elsewhere in this account's PowerShell 5.1 deploy path).
[System.IO.File]::WriteAllText($resolvedPath, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "index.js updated." -ForegroundColor Green

# --- Validate: confirm it actually parses now -----------------------------
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    node --check $resolvedPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Syntax check passed (node --check)." -ForegroundColor Green
    } else {
        Write-Warning "node --check reported a syntax error - review $resolvedPath (backup is at $backupPath)."
    }
} else {
    Write-Warning "node not found on PATH - skipping syntax validation. Recommend running 'node --check .\index.js' manually before deploying."
}

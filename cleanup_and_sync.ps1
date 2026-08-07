# Run from C:\Users\pdluk\pokepod\ (repo root)

# 1. Delete the stray local backup files - debugging leftovers, not
#    needed now that everything is verified working.
Remove-Item src\*.bak, src\*.bak2, src\*.bak3, src\index.js.bak-* -ErrorAction SilentlyContinue

# 2. Untrack any of those that may have been committed BEFORE .gitignore
#    picked up the *.bak* pattern (safe no-op if none were ever tracked -
#    --ignore-unmatch prevents an error either way).
git rm -r --cached --ignore-unmatch "src/*.bak" "src/*.bak2" "src/*.bak3" "src/*.bak-*"

# 3. Stage everything else - the real fixes (creatures.js, moves.js,
#    megaEvolution.js, index.js, pokemon-pool-final.json) plus the
#    .bak removals from step 2.
git add -A

# 4. Confirm what's about to be committed before committing - look for
#    anything under .wrangler/ or a .env line; stop here if you see one.
git status

# 5. Commit and push
git commit -m "Real-Pokemon creatures/moves/megaEvolution, fix index.js bug, remove stray .bak files"
git push origin main

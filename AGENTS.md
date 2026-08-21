# Git and deployment workflow

- Work only in your dedicated worktree and `codex/<task-name>` branch.
- Keep `origin` on SSH. If GitHub access is blocked by the sandbox, request elevated approval for the exact Git command; do not switch to HTTPS.
- Before handing off a completed change, run `npm run lint`, `npm run typecheck`, and `npm run build`. Run the repository test command too when tests are added.
- Commit completed work and push only the feature branch.
- Do not update `main` or Vercel Production without explicit authorization.
- Once authorized, fetch and integrate current `origin/main`, stop on any conflict, rerun the full validation gate, and push the validated commit to `main` exactly once.
- After that single authorized push, use `npx --yes vercel@latest` to identify the exact new immutable Production deployment and verify it has `target: production` and reaches `Ready`. Stop and report any conflict, validation failure, push failure, or deployment failure.
- The Vercel project is `eg-digital1/m2-mec`; Production is deployed from `main` through Vercel's Git integration. Do not commit `.vercel` project metadata or secret values.

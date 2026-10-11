# Agent collaboration contract

Read PRODUCT.md, DESIGN.md and the relevant docs before editing. Ask the human for missing style preferences and project addresses; do not invent them.

- Source ownership: src/ is the shell; independent projects live elsewhere. Never copy a user's private project, database, sessions or config into this repo.
- Integration is explicit configuration plus optional postMessage protocol. Do not add a hidden reverse proxy, model API, process launcher or automatic messaging.
- Style changes belong in src/themes/<theme>.css; layout changes belong in src/styles/layout.css. Preserve readable body text, keyboard focus, theme states and reduced motion.
- New themes must define every token in docs/THEMING.md. Keep the default theme unless the human requests a replacement.
- Configuration changes go to ignored config.local.json for a real user's projects; public config.example.json contains only synthetic examples.
- Personal state cannot modify project/source content. Do not overwrite an unreadable or stale browser record. Import requires validation, preview, and explicit confirmation.
- Only trust postMessage from registered iframe windows and the configured origin. Do not transmit notes, backups, credentials, or chat content.
- Run npm test, npm run build, npm run check:public. Inspect real desktop/mobile interaction after UI changes. A green test is not an accessibility or performance certification.
- Publication requires inspection of the exact allowlisted/staged files. Do not publish .runtime, config.local.json, databases, credentials or local screenshots containing private content.

Suggested task: “Design a theme for my taste, connect the following independently running projects, explain the changed files, and prove the existing workflows still work.”

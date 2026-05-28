## Summary

<!-- One or two sentences describing what this PR does and why. -->

## Related issue

<!-- Link the issue this PR closes, e.g. "Closes #123". Or "N/A" if none. -->

## Changes

<!-- Bullet list of the substantive changes. -->

-
-

## Testing

<!-- How did you verify this works? Include the commands you ran. -->

- [ ] `cargo fmt --check`
- [ ] `cargo clippy -- -D warnings`
- [ ] `cargo test`
- [ ] `npm run build`
- [ ] Manual smoke test (describe below)

<!-- Manual smoke test notes -->

## Screenshots

<!-- For UI changes, include before/after screenshots. Otherwise delete this section. -->

## Checklist

- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).
- [ ] No API keys, audio, or transcript contents are logged or committed.
- [ ] `src-tauri/capabilities/default.json` is updated if any new commands or
      plugins were added.
- [ ] `.sisyphus/plans/ello-dictation.md` is updated if scope changed.
- [ ] Relevant docs (`README.md`, `CONTRIBUTING.md`, `PRIVACY.md`,
      `CHANGELOG.md`) are updated.

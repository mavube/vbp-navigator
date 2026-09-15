// The vision doc calls for a visible version number in the app's own UI,
// not just internal docs. This is that badge — fixed, unobtrusive,
// present on every page via the root layout.

export function VersionBadge() {
  return <span className="v2-version-badge">VBP Navigator OS · v2.0</span>;
}

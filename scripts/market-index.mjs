// Pure helpers for scripts/check-market-index.mjs.
//
// Kept in a separate module so the duplicate-version rule can be tested
// without installing the Harness parser. The failure that prompted it: a
// market update for a version already in the index produced
// `$.plugins[2].versions[49].version duplicates 0.14.0` from the parser, which
// is correct but does not say the version is immutable and the new record
// should be removed.

export function findDuplicateVersions(index) {
  const duplicates = [];
  if (!index || !Array.isArray(index.plugins)) return duplicates;

  for (const plugin of index.plugins) {
    if (!plugin || !Array.isArray(plugin.versions)) continue;

    const firstIndexByVersion = new Map();
    plugin.versions.forEach((entry, versionIndex) => {
      const version = entry?.version;
      if (typeof version !== 'string' || version === '') return;

      if (firstIndexByVersion.has(version)) {
        duplicates.push({
          plugin: typeof plugin.name === 'string' ? plugin.name : '(unnamed plugin)',
          version,
          firstIndex: firstIndexByVersion.get(version),
          duplicateIndex: versionIndex,
        });
      } else {
        firstIndexByVersion.set(version, versionIndex);
      }
    });
  }

  return duplicates;
}

export function describeDuplicateVersions(duplicates) {
  return duplicates.map(({ plugin, version, firstIndex, duplicateIndex }) => (
    `${plugin} lists version ${version} twice (versions[${firstIndex}] and `
    + `versions[${duplicateIndex}]). npm versions are immutable, so remove the `
    + 'added record instead of listing the same version again.'
  )).join('\n');
}

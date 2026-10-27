import { scanRepository } from 'ai-context-doctor';

/**
 * Values a user can override in cordis.patch.yml.
 * Kept as plain defaults so the plugin needs no schema dependency.
 */
const DEFAULTS = {
  // Inject only when the workspace is worse than this.
  healthThreshold: 80,
  // Scanning is a synchronous directory walk: cap it so opening a huge
  // monorepo cannot stall the Host.
  maxFiles: 20000,
  maxBytes: 256 * 1024 * 1024
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Render the note the agent reads. Short on purpose: it competes with the
 * user's own instructions for the model's attention.
 *
 * @param {ReturnType<typeof scanRepository>} report
 * @returns {string}
 */
export function formatNotice(report) {
  const lines = [
    `[ai-context-doctor] This workspace scores ${report.healthScore}/100 for context health: ${report.noisePercent}% of ${formatBytes(report.scannedBytes)} in ${report.scannedFiles} files is likely noise.`
  ];

  const top = report.topNoise.slice(0, 3);
  if (top.length > 0) {
    const detail = top.map((item) => `${item.path} (${formatBytes(item.bytes)}, ${item.reason})`).join(', ');
    lines.push(`Biggest offenders: ${detail}.`);
  }

  if (report.suggestedAiignore.length > 0) {
    lines.push(`Suggested .aiignore: ${report.suggestedAiignore.join(', ')}.`);
  }

  lines.push('Do not read those files unless the task needs them; ask before opening large generated files.');
  return lines.join('\n');
}

/**
 * Host half of the bundle. Fires once per workspace when a session starts an
 * agent, so the warning arrives before the agent reads anything.
 *
 * @param {any} ctx Plugin context.
 * @param {{ healthThreshold?: number, maxFiles?: number, maxBytes?: number }} [config]
 */
export function apply(ctx, config = {}) {
  const options = { ...DEFAULTS, ...config };
  const inspected = new Set();

  ctx.on('agent/created', (payload) => {
    try {
      const agent = payload && payload.agent ? payload.agent : payload;
      const cwd = agent && agent.session && agent.session.meta && agent.session.meta.cwd;
      if (typeof cwd !== 'string' || cwd.length === 0) return;
      if (inspected.has(cwd)) return;

      const report = scanRepository(cwd, {
        maxFiles: options.maxFiles,
        maxBytes: options.maxBytes
      });

      inspected.add(cwd);

      if (report.healthScore >= options.healthThreshold) return;
      if (typeof agent.inject !== 'function') return;

      agent.inject({
        content: [{ type: 'text', text: formatNotice(report) }],
        source: { kind: 'ai-context-doctor' }
      });
    } catch {
      // A plugin must never break the session it observes.
    }
  });
}

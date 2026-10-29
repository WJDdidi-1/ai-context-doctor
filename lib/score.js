'use strict';

const { scoreNoise, noiseCategory } = require('./rules');

/**
 * One score out of five numbers that each mean something on their own.
 *
 * The old score was a single noise ratio with a hard ceiling per category. It
 * had two failure modes we kept running into:
 *
 *   1. it read 100 for any repository whose noise the default strength already
 *      blocked, because noise was the only thing it measured; and
 *   2. one 39 MB binary could drag it to 2 by owning the byte total.
 *
 * So the score is now five capped losses, and the panel shows each one. Two of
 * them (noise) can be moved by writing rules; three of them (volume,
 * concentration, binaries) describe the folder itself and no rule will change
 * them — which is exactly why "clean, but still expensive" is now a state the
 * number can express.
 */
const DIMENSIONS = [
  { id: 'noise', label: 'context noise', weight: 30, hint: 'generated output, lockfiles, logs and oversized files' },
  { id: 'volume', label: 'context volume', weight: 25, hint: 'how many bytes the agent would have to read at all' },
  { id: 'concentration', label: 'one file dominating', weight: 20, hint: 'the largest file as a share of the whole folder' },
  { id: 'sprawl', label: 'file sprawl', weight: 15, hint: 'how many files the agent has to open to find anything' },
  { id: 'binary', label: 'binary payloads', weight: 10, hint: 'bytes an LLM cannot read as text' }
];

// Volume is scored on a log scale between these two sizes: at or below the
// first there is nothing to pay, at or above the second it is a full loss.
const VOLUME_FLOOR_BYTES = 256 * 1024;
const VOLUME_CEILING_BYTES = 4 * 1024 * 1024;

// Concentration only starts costing once one file owns more than a tenth of the
// folder, and is a full loss at three fifths.
const CONCENTRATION_FLOOR_SHARE = 0.1;
const CONCENTRATION_CEILING_SHARE = 0.6;

const SPRAWL_FLOOR_FILES = 300;
const SPRAWL_CEILING_FILES = 3000;

// Half the bytes being binary already costs the whole dimension: past that the
// folder is not a codebase an agent can read, it is an archive.
const BINARY_FULL_SHARE = 0.5;

// Concentration and binaries describe a real folder, not a three-file fixture:
// a single file is 100% of a one-file repository, and calling that "dominating"
// would punish every small project for being small.
const STRUCTURE_FLOOR_BYTES = 256 * 1024;

// How much of the folder being this kind of noise actually costs. A byte of a
// lockfile and a byte of generated output are both waste, but a lockfile is at
// least an artifact someone may genuinely want to read once.
const SEVERITY = { build: 1, large: 0.9, lockfile: 0.8, log: 0.8 };

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tif', 'tiff', 'psd', 'ai',
  'pdf', 'zip', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'tar',
  'dmg', 'pkg', 'exe', 'msi', 'dll', 'so', 'dylib', 'bin', 'wasm', 'class', 'jar',
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'mp4', 'mov', 'avi', 'mkv', 'webm',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  'sqlite', 'db', 'realm', 'parquet', 'avro',
  'stl', 'obj', 'fbx', 'blend'
]);

/**
 * Whether an extension marks a file as binary rather than text.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
function isBinaryPath(filePath) {
  const name = String(filePath).toLowerCase();
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return false;
  return BINARY_EXTENSIONS.has(name.slice(dot + 1));
}

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Score one body of context — a folder, or the reads of one conversation.
 *
 * @param {object} input
 * @param {number} input.files How many files are in play.
 * @param {number} input.bytes How many bytes they hold.
 * @param {number} [input.largestBytes] Biggest single file.
 * @param {number} [input.binaryBytes] Bytes in binary files.
 * @param {Array<{ bytes: number, reason: string }>} [input.noise] Noise entries to weigh.
 * @returns {{ score: number, lost: number, breakdown: Array<object> }}
 */
function contextScore(input = {}) {
  const files = Number.isFinite(input.files) ? input.files : 0;
  const bytes = Number.isFinite(input.bytes) ? input.bytes : 0;
  const largestBytes = Number.isFinite(input.largestBytes) ? input.largestBytes : 0;
  const binaryBytes = Number.isFinite(input.binaryBytes) ? input.binaryBytes : 0;
  const noise = Array.isArray(input.noise) ? input.noise : [];

  const noiseScore = scoreNoise(noise, bytes);
  // Share of the folder that is noise, weighted by how bad that noise is. Using
  // the raw byte share keeps the number honest for a folder that is 99% lockfile
  // instead of letting a category ceiling soften it.
  const noiseByCategory = new Map();
  for (const item of noise) {
    const id = noiseCategory(item.reason);
    noiseByCategory.set(id, (noiseByCategory.get(id) || 0) + item.bytes);
  }
  let noisePoints = 0;
  for (const [id, itemBytes] of noiseByCategory) {
    const share = bytes > 0 ? itemBytes / bytes : 0;
    noisePoints += share * (SEVERITY[id] === undefined ? 0.8 : SEVERITY[id]);
  }
  noisePoints = clamp01(noisePoints);

  const volumeRatio = bytes <= VOLUME_FLOOR_BYTES
    ? 0
    : Math.log(bytes / VOLUME_FLOOR_BYTES) / Math.log(VOLUME_CEILING_BYTES / VOLUME_FLOOR_BYTES);
  const volumeShare = clamp01(volumeRatio);

  const structural = bytes >= STRUCTURE_FLOOR_BYTES;
  const concentrationShare = bytes <= 0 ? 0 : largestBytes / bytes;
  const concentrationRatio = (concentrationShare - CONCENTRATION_FLOOR_SHARE) / (CONCENTRATION_CEILING_SHARE - CONCENTRATION_FLOOR_SHARE);
  const concentrationPoints = structural ? clamp01(concentrationRatio) : 0;

  const sprawlRatio = (files - SPRAWL_FLOOR_FILES) / (SPRAWL_CEILING_FILES - SPRAWL_FLOOR_FILES);
  const sprawlPoints = clamp01(sprawlRatio);

  const binaryShare = bytes <= 0 ? 0 : binaryBytes / bytes;
  const binaryPoints = structural ? clamp01(binaryShare / BINARY_FULL_SHARE) : 0;

  const measures = {
    noise: { points: noisePoints, detail: noiseScore.breakdown, bytes: noise.reduce((sum, item) => sum + item.bytes, 0) },
    volume: { points: volumeShare, detail: null, bytes },
    concentration: { points: concentrationPoints, detail: null, bytes: largestBytes },
    sprawl: { points: sprawlPoints, detail: null, bytes: files },
    binary: { points: binaryPoints, detail: null, bytes: binaryBytes }
  };

  const breakdown = DIMENSIONS.map((dimension) => {
    const measure = measures[dimension.id];
    const lost = round1(dimension.weight * measure.points);
    return {
      id: dimension.id,
      label: dimension.label,
      hint: dimension.hint,
      weight: dimension.weight,
      lost,
      points: Math.round(measure.points * 1000) / 10,
      bytes: measure.bytes,
      detail: measure.detail
    };
  });

  const lost = round1(breakdown.reduce((sum, item) => sum + item.lost, 0));
  return {
    score: Math.max(0, Math.min(100, Math.round(100 - lost))),
    lost,
    breakdown
  };
}

module.exports = { contextScore, DIMENSIONS, isBinaryPath };

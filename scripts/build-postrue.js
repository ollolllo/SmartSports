const fs = require('fs/promises');
const path = require('path');
const esbuild = require('esbuild');

const projectRoot = path.resolve(__dirname, '..');
const inputFile = path.resolve(projectRoot, process.argv[2] || 'common/mediapipe_action_manager.js');
const outputFile = path.resolve(projectRoot, process.argv[3] || 'common/postrue.js');

async function buildPostrue() {
  const source = await fs.readFile(inputFile, 'utf8');
  const result = await esbuild.transform(source, {
    loader: 'js',
    minify: true,
    legalComments: 'none',
    target: 'es2018',
  });

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, result.code, 'utf8');

  const inputSize = Buffer.byteLength(source, 'utf8');
  const outputSize = Buffer.byteLength(result.code, 'utf8');
  const saved = inputSize === 0 ? 0 : ((1 - outputSize / inputSize) * 100).toFixed(2);

  console.log(`Built ${path.relative(projectRoot, outputFile)}`);
  console.log(`Input:  ${formatBytes(inputSize)} (${path.relative(projectRoot, inputFile)})`);
  console.log(`Output: ${formatBytes(outputSize)} (${saved}% smaller)`);
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(2)} KB`;
}

buildPostrue().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const INPUT_MD = path.join(ROOT, 'chat-models.md');
const OUTPUT_TS = path.join(ROOT, 'src', 'configs', 'models.ts');

const imageKeywords = [
  'image',
  'vision',
  'vl',
  'diffusion',
  'flux',
  'sora',
  'veo',
  'mochi',
  'video',
  'animatediff',
  'svd',
  'recraft',
  'sana',
  'hidream',
  'wan',
  'seedream',
  'photon',
  'dreamshaper',
  'imagen',
  'ideogram',
];

const isBlackboxModel = (name) => name.toLowerCase().startsWith('blackboxai:');

const isImageLikeModel = (id, name) => {
  const s = `${id} ${name}`.toLowerCase();
  return imageKeywords.some((kw) => s.includes(kw));
};

const parseModelsData = (mdContent) => {
  const match = mdContent.match(/export const MODELS_DATA = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('MODELS_DATA が見つかりませんでした。');
  }
  return JSON.parse(match[1]);
};

const toProvider = (name) => name.split(':')[0].trim().toLowerCase();

const generateModelConfigObject = (models) => {
  const entries = [];

  for (const model of models) {
    const id = String(model.id ?? '').trim();
    const name = String(model.name ?? '').trim();
    if (!id || !name) continue;
    if (isBlackboxModel(name)) continue;
    if (isImageLikeModel(id, name)) continue;

    const provider = toProvider(name);
    const key = `${provider}/${id}`;

    entries.push(`  '${key}': {\n    name: '${key}',\n    mode: true,\n  },`);
  }

  return entries.join('\n');
};

const makeModelsTs = (entries) => {
  return `export interface ModelConfig {
  id?: string;
  name: string;
  mode: boolean;
}

export const MODEL_CONFIG: Record<string, ModelConfig> = {
${entries}
};
`;
};

const main = () => {
  if (!fs.existsSync(INPUT_MD)) {
    throw new Error(`入力ファイルが存在しません: ${INPUT_MD}`);
  }

  const md = fs.readFileSync(INPUT_MD, 'utf-8');
  const models = parseModelsData(md);
  const entries = generateModelConfigObject(models);
  const content = makeModelsTs(entries);

  fs.writeFileSync(OUTPUT_TS, content, 'utf-8');
  console.log(`Updated: ${OUTPUT_TS}`);
};

main();

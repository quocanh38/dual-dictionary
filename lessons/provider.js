export const HACKATHON_PROVIDER = Object.freeze({
  id: 'baseten-muse-spark-hackathon',
  label: 'Baseten Muse Spark Open · Hackathon',
  baseUrl: 'https://inference.baseten.co/v1',
  model: 'meta-models/muse-spark-open-1026',
  maxOutputTokens: 65536,
  keychainService: 'BASETEN_API_KEY',
  keychainAccount: 'DD-lesson-studio',
});

export const META_MODEL_API_PROVIDER = Object.freeze({
  id: 'meta-model-api',
  label: 'Meta Model API',
  baseUrl: 'https://api.meta.ai/v1',
  model: 'muse-spark-1.3',
  models: Object.freeze([
    'muse-spark-1.3',
    'muse-spark-1.3-contributor',
    'muse-spark-1.2',
    'muse-spark-1.2-contributor',
    'muse-spark-1.1',
    'muse-wonder-1.0',
  ]),
  maxOutputTokens: 65536,
  keyEnvironment: 'DD_META_KEY',
  keychainService: 'DD_META_KEY',
  keychainAccount: 'DD-lesson-studio',
});

export const LESSON_PROVIDERS = Object.freeze({
  [HACKATHON_PROVIDER.id]: HACKATHON_PROVIDER,
  [META_MODEL_API_PROVIDER.id]: META_MODEL_API_PROVIDER,
});

export function providerForPurpose(purpose) {
  if (purpose === 'repair-exercises' || purpose === 'photo-extract') return META_MODEL_API_PROVIDER;
  return HACKATHON_PROVIDER;
}

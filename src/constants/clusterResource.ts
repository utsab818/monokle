export const CLUSTER_RESOURCE_IGNORED_PATHS = [
  '...creationTimestamp',
  'metadata#annotations#kubectl.kubernetes.io/last-applied-configuration',
  'metadata#annotations#deployment.kubernetes.io/revision',
  'metadata#resourceVersion',
  'metadata#uid',
  'metadata#generation',
  'status',
];

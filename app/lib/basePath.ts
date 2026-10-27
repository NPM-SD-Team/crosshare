let basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
if (process.env.NODE_ENV === 'production') {
  basePath = '/crosswords';
}
export function withBasePath(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`Expected a root-relative path, got "${path}"`);
  }
  return `${basePath}${path}`;
}

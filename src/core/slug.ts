/**
 * Series names become the `seriesId` tag stamped on every frame, so the slug has
 * to be stable and safe to use in a folder name.
 */
export function toSeriesId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

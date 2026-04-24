export const PAGE_SIZES = [50, 100, 200, 500];

export const PAGE_SIZE_OPTIONS = PAGE_SIZES.map(size => ({
  value: String(size),
  label: String(size),
}));

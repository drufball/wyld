type Look = 'diorama' | 'flat';
const lookFromQuery = (search: string): Look => {
  const value = new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get('look');
  return value === 'flat' ? 'flat' : 'diorama';
};
export { lookFromQuery };
export type { Look };

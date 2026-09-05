const small = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function countInWords(value: number): string {
  const count = Math.max(0, Math.floor(value));
  if (count < 20) return small[count]!;
  if (count < 100)
    return `${tens[Math.floor(count / 10)]}${count % 10 ? `-${small[count % 10]}` : ''}`;
  return String(count);
}

export function relativeTime(iso: string, now: Date): string {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'just now';
  if (elapsedSeconds < 60 * 60) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 24 * 60 * 60) return `${Math.floor(elapsedSeconds / (60 * 60))}h ago`;
  return `${Math.floor(elapsedSeconds / (24 * 60 * 60))}d ago`;
}

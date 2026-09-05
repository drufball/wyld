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

export function sentenceCount(value: number): string {
  const words = countInWords(value);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

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
  if (count < 1000)
    return `${small[Math.floor(count / 100)]} hundred${count % 100 ? ` ${countInWords(count % 100)}` : ''}`;
  if (count < 1_000_000)
    return `${countInWords(Math.floor(count / 1000))} thousand${count % 1000 ? ` ${countInWords(count % 1000)}` : ''}`;
  return 'many';
}

export function sentenceCount(value: number): string {
  const words = countInWords(value);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

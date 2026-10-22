export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

export function countChars(text: string): number {
  return text.length;
}

const nf = new Intl.NumberFormat("es");

export const formatCount = (n: number): string => nf.format(n);

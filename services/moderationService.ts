
// Multi-language bad words and threats (Simulated expanded list)
const BAD_WORDS = {
  uz: ['yomon', 'haqorat', 'so\'kish', 'iflos', 'jinni'],
  ru: ['плохой', 'мат', 'дурак', 'оскорбление'],
  en: ['badword', 'idiot', 'stupid', 'curse']
};

const THREATS = ['o\'ldiraman', 'portlataman', 'kill you', 'убью', 'взорву', 'terror'];

const SCAM_WORDS = ['scam', 'fake click', 'karta raqami', 'winner', 'pul yutdingiz'];

export type OffenseLevel = 'none' | 'warning_12h' | 'severe_24h' | 'critical_perm';

export const checkContent = (text: string): { level: OffenseLevel; reason: string } => {
  const lowerText = text.toLowerCase();
  
  // 1. Permanent Ban for threats or terrorism
  if (THREATS.some(word => lowerText.includes(word))) {
    return { level: 'critical_perm', reason: 'Xavfli tahdid yoki terrorizm alomatlari.' };
  }
  
  // 2. 24h Block for Scam/Fraud
  if (SCAM_WORDS.some(word => lowerText.includes(word))) {
    return { level: 'severe_24h', reason: 'Firibgarlik harakati aniqlandi.' };
  }
  
  // 3. 12h Block for Bad Words
  const allBadWords = [...BAD_WORDS.uz, ...BAD_WORDS.ru, ...BAD_WORDS.en];
  if (allBadWords.some(word => lowerText.includes(word))) {
    return { level: 'warning_12h', reason: 'Nomaqbul so\'zlar ishlatildi.' };
  }
  
  return { level: 'none', reason: '' };
};

export const getBlockedUntil = (level: OffenseLevel): number | undefined => {
  const now = Date.now();
  if (level === 'warning_12h') return now + 12 * 60 * 60 * 1000;
  if (level === 'severe_24h') return now + 24 * 60 * 60 * 1000;
  return undefined; // Permanent
};

export const getBlockedMessage = (reason: string, level: OffenseLevel) => {
  if (level === 'critical_perm') return `Sizning hisobingiz "${reason}" sababli BUTUNLAY bloklandi.`;
  if (level === 'severe_24h') return `Sizning hisobingiz "${reason}" sababli 24 soatga bloklandi.`;
  return `Sizning hisobingiz "${reason}" sababli 12 soatga bloklandi.`;
};

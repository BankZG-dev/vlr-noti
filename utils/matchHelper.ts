import axios from 'axios';

/**
 * Get current time in UTC+7 timezone (Bangkok/Indochina time)
 */
function getNowUTC7(): Date {
  const now = new Date();
  // JavaScript Date is always in UTC internally, offset by 7 hours
  const utc7Ms = now.getTime() + (7 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000);
  return new Date(utc7Ms);
}

/**
 * Parse a VLR time string (e.g. "10:00 PM") to minutes until that time
 * Uses UTC+7 timezone for match time comparison
 * Returns null if parsing fails
 */
export function minutesUntilMatchTime(timeStr: string): number | null {
  try {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/);
    if (!timeMatch) return null;

    let [, hourStr, minStr, ampm] = timeMatch;
    let hour = parseInt(hourStr, 10);
    const min = parseInt(minStr, 10);

    // Convert to 24-hour format
    if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;

    // Create a match time for today in UTC+7
    const now = getNowUTC7();
    const matchTime = new Date(now);
    matchTime.setHours(hour, min, 0, 0);

    const diffMs = matchTime.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);

    return diffMin;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch Twitch channel links for a match
 * Searches for team names and tournament on Twitch
 */
export async function fetchTwitchLinks(
  team1: string,
  team2: string,
  event: string
): Promise<Record<string, string>> {
  const links: Record<string, string> = {};

  try {
    // Map event names to Twitch channels
    const eventChannelMap: Record<string, Record<string, string>> = {
      'VCT 2026': {
        pacific: 'valorantesports_', // VCT Pacific
        na: 'valorantesports_', // VCT NA
        eu: 'valorantesports_', // VCT EU
        cn: 'valorantesports_', // VCT CN/VALORANT Champions
        champions: 'valorantesports_'
      },
      'champions': {
        champions: 'valorantesports_'
      }
    };

    // Detect regions from event name
    if (event.toLowerCase().includes('pacific')) {
      links.pacific = 'https://twitch.tv/valorantesports_';
    }
    if (event.toLowerCase().includes('na ') || event.toLowerCase().includes('north america')) {
      links.na = 'https://twitch.tv/valorantesports_';
    }
    if (event.toLowerCase().includes('eu ') || event.toLowerCase().includes('europe')) {
      links.eu = 'https://twitch.tv/valorantesports_';
    }
    if (event.toLowerCase().includes('cn ') || event.toLowerCase().includes('china')) {
      links.cn = 'https://twitch.tv/valorantesports_';
    }
    if (event.toLowerCase().includes('champions')) {
      links.champions = 'https://twitch.tv/valorantesports_';
    }

    // If no region-specific channels found, default to main VCT channel
    if (Object.keys(links).length === 0) {
      links.main = 'https://twitch.tv/valorantesports_';
    }

  } catch (err) {
    console.error('[twitch] Error fetching Twitch links:', err);
  }

  return links;
}

/**
 * Check if a match should get a 10-minute warning
 * Returns true if we're within 10-12 minutes of match time
 */
export function shouldSend10MinWarning(timeStr: string): boolean {
  const minutesUntil = minutesUntilMatchTime(timeStr);
  if (minutesUntil === null) return false;
  return minutesUntil > 0 && minutesUntil <= 12;
}

/**
 * Get readable time remaining for a match
 */
export function getTimeRemaining(timeStr: string): string {
  const minutesUntil = minutesUntilMatchTime(timeStr);
  if (minutesUntil === null) return timeStr;
  if (minutesUntil < 0) return 'Starting soon...';
  if (minutesUntil === 0) return 'Now!';
  if (minutesUntil === 1) return '1 minute';
  return `${minutesUntil} minutes`;
}

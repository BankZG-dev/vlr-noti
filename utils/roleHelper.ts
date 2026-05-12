import { Guild, Role } from 'discord.js';
import { prisma } from '../src/db';

// Role name format: "VLR: Sentinels" / "VLR: TenZ" / "VLR: NA" / "VLR: Champions 2025"
export function buildRoleName(type: string, name: string): string {
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  const display = name
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return `VLR ${label}: ${display}`;
}

// Finds or creates the Discord role + stores it in DB
export async function getOrCreateRole(
  guild: Guild,
  type: string,
  name: string
): Promise<Role> {
  const normalized = name.toLowerCase();
  const roleName = buildRoleName(type, name);

  // Check DB first
  const existing = await (prisma as any).managedRole.findUnique({
    where: { guildId_type_name: { guildId: guild.id, type, name: normalized } },
  });

  if (existing) {
    // Make sure the role still exists in Discord
    const discordRole = guild.roles.cache.get(existing.roleId);
    if (discordRole) return discordRole;
    // Role was deleted manually — recreate below and update DB
  }

  // Create the role
  const role = await guild.roles.create({
    name: roleName,
    mentionable: true,
    reason: `VLR bot subscription: ${type} ${name}`,
  });

  await (prisma as any).managedRole.upsert({
    where: { guildId_type_name: { guildId: guild.id, type, name: normalized } },
    update: { roleId: role.id },
    create: { guildId: guild.id, type, name: normalized, roleId: role.id },
  });

  return role;
}

// Returns the role if it exists, null otherwise
export async function findRole(
  guild: Guild,
  type: string,
  name: string
): Promise<Role | null> {
  const normalized = name.toLowerCase();
  const record = await (prisma as any).managedRole.findUnique({
    where: { guildId_type_name: { guildId: guild.id, type, name: normalized } },
  });
  if (!record) return null;
  return guild.roles.cache.get(record.roleId) ?? null;
}
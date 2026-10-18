import { db } from '@/lib/db'

export async function logActivity(userId: string, action: string, detail?: string): Promise<void> {
  try {
    await db.activity.create({ data: { userId, action, detail: detail ?? null } })
    // keep feed bounded
    const total = await db.activity.count({ where: { userId } })
    if (total > 200) {
      const old = await db.activity.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 150,
        take: 100,
        select: { id: true },
      })
      if (old.length) {
        await db.activity.deleteMany({ where: { id: { in: old.map((a) => a.id) } } })
      }
    }
  } catch {
    // activity logging must never break the main flow
  }
}

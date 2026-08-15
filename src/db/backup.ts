import { db, type BadgeRecord, type Visit, type Wish } from './db'

/**
 * The only way records leave this device. Everything lives in IndexedDB, so a
 * file the reader keeps themselves is the whole backup story.
 */

const FORMAT = 1

export type Backup = {
  app: 'maplog'
  version: number
  exportedAt: string
  visits: Omit<Visit, 'id'>[]
  wishes: Omit<Wish, 'id'>[]
  badges: BadgeRecord[]
}

export async function readBackup(): Promise<Backup> {
  const [visits, wishes, badges] = await Promise.all([
    db.visits.toArray(),
    db.wishes.toArray(),
    db.badges.toArray(),
  ])
  return {
    app: 'maplog',
    version: FORMAT,
    exportedAt: new Date().toISOString(),
    // Keys are reassigned on restore, so they are not worth carrying.
    visits: visits.map(({ id: _id, ...rest }) => rest),
    wishes: wishes.map(({ id: _id, ...rest }) => rest),
    badges,
  }
}

export function downloadBackup(backup: Backup) {
  const stamp = backup.exportedAt.slice(0, 10)
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `maplog-${stamp}.json`
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the save before dropping the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail('JSON 파일이 아닙니다.')
  }
  if (!data || typeof data !== 'object') return fail('파일 내용을 읽을 수 없습니다.')
  const backup = data as Partial<Backup>
  if (backup.app !== 'maplog') return fail('MapLog에서 내보낸 파일이 아닙니다.')
  if (typeof backup.version !== 'number' || backup.version > FORMAT) {
    return fail('더 새로운 버전에서 내보낸 파일입니다.')
  }
  if (!Array.isArray(backup.visits)) return fail('방문 기록이 들어 있지 않습니다.')
  return {
    app: 'maplog',
    version: backup.version,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : '',
    visits: backup.visits,
    wishes: Array.isArray(backup.wishes) ? backup.wishes : [],
    badges: Array.isArray(backup.badges) ? backup.badges : [],
  }
}

function fail(message: string): never {
  throw new Error(message)
}

/** Replaces everything — restoring is "this file is now my record", not a merge. */
export async function restoreBackup(backup: Backup) {
  await db.transaction('rw', db.visits, db.wishes, db.badges, async () => {
    await Promise.all([db.visits.clear(), db.wishes.clear(), db.badges.clear()])
    if (backup.visits.length) await db.visits.bulkAdd(backup.visits as Visit[])
    if (backup.wishes.length) await db.wishes.bulkAdd(backup.wishes as Wish[])
    if (backup.badges.length) await db.badges.bulkAdd(backup.badges)
  })
}

export async function clearAll() {
  await db.transaction('rw', db.visits, db.wishes, db.badges, async () => {
    await Promise.all([db.visits.clear(), db.wishes.clear(), db.badges.clear()])
  })
}

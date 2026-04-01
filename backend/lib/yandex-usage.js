import path from 'node:path';
import { readJson, writeJson } from './file-cache.js';

const usageFile = path.resolve('backend/cache/yandex-usage.json');
let usageWriteQueue = Promise.resolve();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function readUsage() {
  const data = (await readJson(usageFile)) || { date: todayKey(), count: 0 };

  if (data.date !== todayKey()) {
    return {
      date: todayKey(),
      count: 0,
    };
  }

  return data;
}

export async function reserveUsage(limit) {
  const task = usageWriteQueue.then(async () => {
    const usage = await readUsage();

    if (usage.count >= limit) {
      throw new Error(
        'Дневной лимит запросов к API Яндекс Расписаний почти исчерпан. Приложение временно использует только кэшированные данные.',
      );
    }

    const nextUsage = {
      date: usage.date,
      count: usage.count + 1,
    };

    await writeJson(usageFile, nextUsage);
    return nextUsage;
  });

  usageWriteQueue = task.catch(() => {});
  return task;
}

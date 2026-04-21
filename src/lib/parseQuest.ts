export type QuestSection = { heading: string; body: string };

export function parseQuest(md: string): QuestSection[] {
  const lines = md.split('\n');
  const sections: QuestSection[] = [];
  let current: QuestSection | null = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { heading: line.slice(3).trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections.map(s => ({ ...s, body: s.body.trim() }));
}

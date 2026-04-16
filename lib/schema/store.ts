import fs from 'fs';
import path from 'path';
import type { DataSource, SourceLink, StoredConnection, Skill } from './types';

// ── Sources ──────────────────────────────────────────────────────────────────

const SOURCES_PATH = path.join(process.cwd(), 'data', 'sources.json');

function readSources(): DataSource[] {
  try {
    return JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf-8')) as DataSource[];
  } catch {
    return [];
  }
}

function writeSources(sources: DataSource[]): void {
  fs.mkdirSync(path.dirname(SOURCES_PATH), { recursive: true });
  fs.writeFileSync(SOURCES_PATH, JSON.stringify(sources, null, 2), 'utf-8');
}

export function loadDynamicSources(): DataSource[] {
  return readSources();
}

export function saveDynamicSource(source: DataSource): void {
  const sources = readSources();
  const idx = sources.findIndex(s => s.id === source.id);
  if (idx >= 0) { sources[idx] = source; } else { sources.push(source); }
  writeSources(sources);
}

export function deleteDynamicSource(id: string): void {
  writeSources(readSources().filter(s => s.id !== id));
}

// ── Connections ──────────────────────────────────────────────────────────────

const CONNECTIONS_PATH = path.join(process.cwd(), 'data', 'connections.json');

function readConnections(): StoredConnection[] {
  try {
    return JSON.parse(fs.readFileSync(CONNECTIONS_PATH, 'utf-8')) as StoredConnection[];
  } catch {
    return [];
  }
}

function writeConnections(conns: StoredConnection[]): void {
  fs.mkdirSync(path.dirname(CONNECTIONS_PATH), { recursive: true });
  fs.writeFileSync(CONNECTIONS_PATH, JSON.stringify(conns, null, 2), 'utf-8');
}

export function loadConnections(): StoredConnection[] {
  return readConnections();
}

export function getConnection(id: string): StoredConnection | undefined {
  return readConnections().find(c => c.id === id);
}

export function saveConnection(conn: StoredConnection): void {
  const conns = readConnections();
  const idx = conns.findIndex(c => c.id === conn.id);
  if (idx >= 0) { conns[idx] = conn; } else { conns.push(conn); }
  writeConnections(conns);
}

export function deleteConnection(id: string): void {
  writeConnections(readConnections().filter(c => c.id !== id));
}

// ── Source links ─────────────────────────────────────────────────────────────

const SOURCE_LINKS_PATH = path.join(process.cwd(), 'data', 'source-links.json');

function readSourceLinks(): SourceLink[] {
  try {
    return JSON.parse(fs.readFileSync(SOURCE_LINKS_PATH, 'utf-8')) as SourceLink[];
  } catch {
    return [];
  }
}

function writeSourceLinks(links: SourceLink[]): void {
  fs.mkdirSync(path.dirname(SOURCE_LINKS_PATH), { recursive: true });
  fs.writeFileSync(SOURCE_LINKS_PATH, JSON.stringify(links, null, 2), 'utf-8');
}

export function loadSourceLinks(): SourceLink[] {
  return readSourceLinks();
}

export function saveSourceLink(link: SourceLink): void {
  const links = readSourceLinks();
  const idx = links.findIndex(item => item.id === link.id);
  if (idx >= 0) {
    links[idx] = link;
  } else {
    links.push(link);
  }
  writeSourceLinks(links);
}

export function deleteSourceLink(id: string): void {
  writeSourceLinks(readSourceLinks().filter(link => link.id !== id));
}

// ── Skills ───────────────────────────────────────────────────────────────────

const SKILLS_PATH = path.join(process.cwd(), 'data', 'skills.json');

function readSkills(): Skill[] {
  try {
    return JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf-8')) as Skill[];
  } catch {
    return [];
  }
}

function writeSkills(skills: Skill[]): void {
  fs.mkdirSync(path.dirname(SKILLS_PATH), { recursive: true });
  fs.writeFileSync(SKILLS_PATH, JSON.stringify(skills, null, 2), 'utf-8');
}

export function loadSkills(): Skill[] {
  return readSkills();
}

export function saveSkill(skill: Skill): void {
  const skills = readSkills();
  const idx = skills.findIndex(s => s.id === skill.id);
  if (idx >= 0) { skills[idx] = skill; } else { skills.push(skill); }
  writeSkills(skills);
}

export function deleteSkill(id: string): void {
  writeSkills(readSkills().filter(s => s.id !== id));
}

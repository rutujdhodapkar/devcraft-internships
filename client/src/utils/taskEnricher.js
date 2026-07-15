const DEFAULT_TIME = '15 mins';
const DEFAULT_XP = 100;

export function enrichProject(project, index) {
  if (!project || typeof project !== 'object') {
    return {
      title: project || '',
      description: '',
      timeToFinish: DEFAULT_TIME,
      xp: DEFAULT_XP,
      type: 'text',
    };
  }
  return {
    ...project,
    timeToFinish: project.timeToFinish || DEFAULT_TIME,
    xp: project.xp || DEFAULT_XP,
  };
}

export function enrichProjects(projects) {
  if (!Array.isArray(projects)) return [];
  return projects.map((p, i) => enrichProject(p, i));
}

export function getTotalXp(projects) {
  if (!Array.isArray(projects)) return 0;
  return projects.reduce((sum, p) => sum + (p.xp || DEFAULT_XP), 0);
}

/**
 * Participant roles and the value that flows between them.
 * Every flow label is taken from the role descriptions in the public programme (p3).
 */
export const ROLES = [
  { id: 'founders', short: 'Founders', name: 'Founders & startups' },
  { id: 'investors', short: 'Investors', name: 'Investors & finance' },
  { id: 'corporates', short: 'Corporates', name: 'Corporates' },
  { id: 'capability', short: 'Capability', name: 'Capability providers' },
  { id: 'academia', short: 'Accelerators', name: 'Accelerators & universities' },
  { id: 'institutions', short: 'Institutions', name: 'Institutions' },
];

/** [from, to, what]: "from" provides "what" to "to". */
export const FLOWS = [
  ['investors', 'founders', 'Capital'],
  ['capability', 'founders', 'Capabilities'],
  ['corporates', 'founders', 'Market access and pilots'],
  ['founders', 'investors', 'Better-prepared opportunities'],
  ['academia', 'investors', 'Pipelines of founders'],
  ['academia', 'founders', 'Mentors and research'],
  ['capability', 'corporates', 'Digital, AI/data, legal and IP expertise'],
  ['institutions', 'founders', 'Enterprise development'],
  ['institutions', 'academia', 'Innovation support'],
  ['institutions', 'investors', 'Responsible finance'],
];

export const OPEN_ROLE_NOTE = 'Not locked into one role. A company may need one capability while providing another.';

/** Flows for one role, split into what it provides and what it draws on. */
export function flowsFor(id) {
  const name = (rid) => ROLES.find((r) => r.id === rid)?.name ?? rid;
  const give = FLOWS.filter((f) => f[0] === id).map(([, to, what]) => ({ peer: to, peerName: name(to), what }));
  const draw = FLOWS.filter((f) => f[1] === id).map(([from, , what]) => ({ peer: from, peerName: name(from), what }));
  return { give, draw };
}

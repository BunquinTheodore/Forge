/**
 * Participant roles and an ILLUSTRATIVE map of the value that flows between them.
 * Each flow paraphrases a role description in the public programme (p3); pairings that the
 * programme states for the whole ecosystem use the ALL target instead of a single peer.
 */
export const ROLES = [
  { id: 'founders', short: 'Founders', name: 'Founders & startups' },
  { id: 'investors', short: 'Investors', name: 'Investors & finance' },
  { id: 'corporates', short: 'Corporates', name: 'Corporates' },
  { id: 'capability', short: 'Capability', name: 'Capability providers' },
  { id: 'academia', short: 'Accelerators', name: 'Accelerators & universities' },
  { id: 'institutions', short: 'Institutions', name: 'Institutions' },
];

/** Flow target meaning "every other participant". */
export const ALL = '*';
const ALL_NAME = 'All participants';

/** [from, to, what]: "from" provides "what" to "to". */
export const FLOWS = [
  ['investors', 'founders', 'Capital'],
  ['founders', 'investors', 'Better-prepared opportunities'],
  ['corporates', 'founders', 'Market access, technology, distribution, pilots and procurement'],
  ['capability', ALL, 'Digital, AI/data, legal, IP, finance, talent, marketing and business-development expertise'],
  ['academia', 'founders', 'Mentors and research'],
  ['academia', 'investors', 'Pipelines of founders and incubated ventures'],
  ['institutions', ALL, 'Support for innovation, enterprise development and responsible finance'],
];

export const OPEN_ROLE_NOTE = 'Not locked into one role. A company may need one capability while providing another.';

const nameOf = (rid) => (rid === ALL ? ALL_NAME : ROLES.find((r) => r.id === rid)?.name ?? rid);

/** Ids of the roles a flow target covers, excluding the giver. */
export function targetsOf(from, to) {
  return to === ALL ? ROLES.map((r) => r.id).filter((id) => id !== from) : [to];
}

/** Flows for one role, split into what it provides and what it draws on. */
export function flowsFor(id) {
  const give = FLOWS.filter((f) => f[0] === id)
    .map(([, to, what]) => ({ peer: to, peers: targetsOf(id, to), peerName: nameOf(to), what }));
  const draw = FLOWS.filter(([from, to]) => from !== id && targetsOf(from, to).includes(id))
    .map(([from, , what]) => ({ peer: from, peers: [from], peerName: nameOf(from), what }));
  return { give, draw };
}

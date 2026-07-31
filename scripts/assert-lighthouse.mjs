import report from '../lighthouse-report.json' with {type: 'json'};
const score = report.categories.accessibility.score;
if (score !== 1) throw new Error(`Lighthouse accessibility budget failed: ${score}.`);
const failed = report.categories.accessibility.auditRefs.filter(({id}) => report.audits[id]?.score === 0);
if (failed.length) throw new Error(`Lighthouse has failed accessibility audits: ${failed.map(item => item.id).join(', ')}`);
console.log('Lighthouse accessibility passed: score 1 with zero failed audits.');

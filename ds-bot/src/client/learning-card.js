import { createElement as h, useId, useRef, useState } from 'react'
import { useTurnFacts } from './btw.js'
import { proposalPlacement } from './learning-card-model.js'
import { currentPart } from './text.js'
import { t } from './i18n.js'
import { CheckIcon, MemoryIcon, PencilIcon } from './icons.js'

const failedAnswers = new Map()

function ProposalCard({ proposal, initialError = '', onFailure, onResolved, actions }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  const busyRef = useRef(false)
  const titleId = useId()
  const answer = approve => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    void Promise.resolve().then(() => actions.learningAnswer(proposal.id, approve))
      .then(() => onResolved(proposal.id), failure => {
        const message = failure?.message ?? String(failure)
        setError(message)
        onFailure(proposal, message)
      })
      .finally(() => {
        busyRef.current = false
        setBusy(false)
      })
  }
  const agents = proposal.kind === 'agents'
  const BadgeIcon = agents ? PencilIcon : MemoryIcon
  return h('section', { className: 'bt-q bt-learning-card', role: 'group', 'aria-labelledby': titleId, 'aria-busy': busy },
    h('div', { className: 'bt-q-head' },
      h('span', { className: 'bt-learning-badge', 'aria-hidden': true }, h(BadgeIcon)),
      h('div', { className: 'bt-q-text' },
        h('span', { className: 'bt-learning-eyebrow' }, t('Learned from recent work')),
        h('p', { className: 'bt-q-title', id: titleId }, t(agents ? 'AGENTS.md update' : proposal.action === 'update' ? 'Skill update' : 'New skill')),
        h('div', { className: 'bt-q-detail' }, h('code', { className: 'bt-learning-tag' }, agents ? proposal.folder : proposal.name)))),
    h('div', { className: 'bt-learning-body' },
      agents ? proposal.edits.map((edit, index) => h('div', { className: 'bt-learning-edit', key: `${proposal.id}-${index}` },
        h('div', { className: 'bt-learning-diffbox' },
          edit.old ? edit.old.split('\n').map((line, lineIndex) => h('div', {
            className: 'bt-learning-line bt-learning-removed',
            key: `${proposal.id}-${index}-old-${lineIndex}`,
          }, h('span', { className: 'bt-learning-sign' }, '−'), h('span', null, line))) : null,
          edit.text ? edit.text.split('\n').map((line, lineIndex) => h('div', {
            className: 'bt-learning-line bt-learning-added',
            key: `${proposal.id}-${index}-new-${lineIndex}`,
          }, h('span', { className: 'bt-learning-sign' }, '+'), h('span', null, line))) : null),
        edit.why ? h('p', { className: 'bt-learning-why' }, edit.why) : null)) : h('p', { className: 'bt-learning-description' }, proposal.description),
      !agents && proposal.why ? h('p', { className: 'bt-learning-why' }, proposal.why) : null,
      !agents ? h('details', { className: 'bt-learning-preview' },
        h('summary', null, t('Preview')),
        h('pre', null, proposal.content)) : null),
    error ? h('div', { className: 'bt-learning-error', role: 'alert' }, error) : null,
    h('div', { className: 'bt-q-foot bt-learning-foot' },
      h('span', { className: 'bt-learning-hint' }, t('Nothing is saved until you approve.')),
      h('button', { type: 'button', className: 'bt-learning-btn bt-learning-decline', disabled: busy, onClick: () => answer(false) }, t('Decline')),
      h('button', { type: 'button', className: 'bt-learning-btn bt-learning-approve', disabled: busy, onClick: () => answer(true) },
        h(CheckIcon), t('Approve'))))
}

function LearningProposals({ turn, dock, sessionId, useRoster, actions }) {
  const roster = useRoster(value => value)
  const facts = useTurnFacts(sessionId, actions)
  const [failed, setFailed] = useState({})
  const bot = roster.byId?.[sessionId]
  if (!bot || currentPart(bot) !== sessionId) return null
  const proposals = roster.learning?.[bot.id] ?? []
  const visible = [...proposals]
  for (const entry of Object.values(failed)) {
    if (entry.proposal.botId === bot.id && !proposals.some(proposal => proposal.id === entry.proposal.id)) visible.push(entry.proposal)
  }
  for (const entry of failedAnswers.values()) {
    if (entry.proposal.botId === bot.id && !proposals.some(proposal => proposal.id === entry.proposal.id)
      && !visible.some(proposal => proposal.id === entry.proposal.id)) visible.push(entry.proposal)
  }
  const cards = visible.filter(proposal => {
    const placement = proposalPlacement(proposal, facts?.turns)
    return dock ? placement.kind === 'dock' : placement.kind === 'turn' && placement.turn === turn?.turn
  })
  if (cards.length === 0) return null
  const onFailure = (proposal, error) => {
    failedAnswers.set(proposal.id, { proposal, error })
    setFailed(current => ({ ...current, [proposal.id]: { proposal, error } }))
  }
  const onResolved = id => setFailed(current => {
    failedAnswers.delete(id)
    if (!(id in current)) return current
    const next = { ...current }
    delete next[id]
    return next
  })
  return h('div', { className: 'bt-learning-stack' }, cards.map(proposal => h('div', { className: 'bt-q-inline', key: proposal.id },
    h(ProposalCard, {
      proposal,
      initialError: failed[proposal.id]?.error ?? failedAnswers.get(proposal.id)?.error,
      onFailure,
      onResolved,
      actions,
    }))))
}

export function LearningTurnTail(props) {
  return h(LearningProposals, { ...props, dock: false })
}

export function LearningDock(props) {
  return h(LearningProposals, { ...props, dock: true })
}

export const LEARNING_CSS = `
.bt-learning-stack{display:flex;flex-direction:column;gap:4px}
.bt-learning-card .bt-q-head{align-items:center;gap:12px}
.bt-learning-badge{flex:none;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:color-mix(in srgb,var(--bt-accent) 12%,transparent);color:var(--bt-accent)}
.bt-learning-badge svg{width:18px;height:18px}
.bt-learning-eyebrow{font-size:11px;line-height:14px;font-weight:500;letter-spacing:.02em;color:var(--bt-ink-3)}
.bt-learning-tag{display:inline-block;margin-top:2px;padding:1px 6px;border-radius:6px;background:var(--bt-tag-bg);color:var(--bt-tag-ink);font-family:ui-monospace,monospace;font-size:12px;line-height:18px;overflow-wrap:anywhere}
.bt-learning-body{display:flex;flex-direction:column;gap:8px}
.bt-learning-description{margin:0;font-size:13px;line-height:18px;color:var(--bt-ink)}
.bt-learning-why{margin:0;padding:8px 10px;border-radius:10px;background:var(--bt-hover);font-size:12px;line-height:17px;color:var(--bt-ink-2)}
.bt-learning-preview{font-size:12px;line-height:16px;color:var(--bt-ink-2)}
.bt-learning-preview summary{width:fit-content;cursor:pointer}
.bt-learning-preview pre{max-height:220px;overflow:auto;margin:6px 0 0;padding:8px;border:1px solid var(--bt-line);border-radius:8px;background:var(--bt-card);color:var(--bt-ink);font-family:ui-monospace,monospace;font-size:12px;line-height:16px;white-space:pre-wrap;overflow-wrap:anywhere}
.bt-learning-edit{display:grid;gap:4px}
.bt-learning-diffbox{border:1px solid var(--bt-line);border-radius:10px;overflow:hidden;font-family:ui-monospace,monospace;font-size:12px;line-height:18px}
.bt-learning-line{display:flex;gap:8px;padding:3px 10px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--bt-ink)}
.bt-learning-removed{background:color-mix(in srgb,var(--bt-danger) 8%,transparent)}
.bt-learning-added{background:color-mix(in srgb,var(--bt-green) 10%,transparent)}
.bt-learning-sign{flex:none;width:10px;font-weight:600}
.bt-learning-removed .bt-learning-sign{color:var(--bt-danger)}
.bt-learning-added .bt-learning-sign{color:var(--bt-green)}
.bt-learning-foot{align-items:center;padding-top:12px;border-top:1px solid var(--bt-q-rule)}
.bt-learning-hint{flex:1;min-width:0;font-size:12px;line-height:16px;color:var(--bt-ink-3)}
.bt-learning-btn{flex:none;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:10px;font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background-color .12s ease,opacity .12s ease,scale .12s ease}
.bt-learning-btn svg{width:14px;height:14px}
.bt-learning-decline{background:transparent;border:1px solid var(--bt-line-2);color:var(--bt-ink)}
.bt-learning-decline:hover:not(:disabled){background:var(--bt-hover)}
.bt-learning-approve{border:1px solid transparent;background:var(--bt-ink);color:var(--bt-card)}
.bt-learning-approve:hover:not(:disabled){opacity:.88}
.bt-learning-btn:disabled{opacity:.45;cursor:default}
.bt-learning-btn:active:not(:disabled){scale:.97}
.bt-learning-btn:focus-visible{outline:2px solid var(--bt-accent);outline-offset:2px}
.bt-learning-error{font-size:12px;line-height:16px;color:var(--bt-danger)}
`

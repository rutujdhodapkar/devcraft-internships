import { rtdbGet, rtdbSet, rtdbPush } from './db.js';
import { emit, EVENTS } from './eventBus.js';
import { enqueue, cancelPending } from './queueManager.js';
import { now, daysSince, addDays, isBefore } from './utils.js';
import { STATUS } from './config.js';
import { requestApproval } from './aiAgent.js';

export async function evaluateRules() {
  console.log('[RulesEngine] Evaluating active rules');
  const rules = await rtdbGet('rules') || {};
  let triggered = 0;

  for (const [ruleId, rule] of Object.entries(rules)) {
    if (rule.active === false) continue;
    try {
      const result = await evaluateRule(ruleId, rule);
      if (result) triggered++;
    } catch (err) {
      console.error(`[RulesEngine] Error evaluating ${ruleId}:`, err.message);
    }
  }

  console.log(`[RulesEngine] ${triggered} rules triggered`);
  return triggered;
}

async function evaluateRule(ruleId, rule) {
  const apps = await rtdbGet('email_queue_applications') || {};
  let matched = 0;

  for (const [appId, app] of Object.entries(apps)) {
    try {
      if (await matchesCondition(app, rule.conditions)) {
        await executeAction(ruleId, rule, app);
        matched++;
      }
    } catch (err) {
      console.error(`[RulesEngine] App ${appId} match error:`, err.message);
    }
  }

  return matched;
}

async function matchesCondition(app, conditions) {
  if (!conditions || conditions.length === 0) return true;

  for (const cond of conditions) {
    const field = app[cond.field];
    let match = false;

    switch (cond.operator) {
      case 'equals':
        match = field === cond.value;
        break;
      case 'not_equals':
        match = field !== cond.value;
        break;
      case 'contains':
        match = String(field || '').toLowerCase().includes(String(cond.value).toLowerCase());
        break;
      case 'greater_than':
        match = parseFloat(field || 0) > parseFloat(cond.value);
        break;
      case 'less_than':
        match = parseFloat(field || 0) < parseFloat(cond.value);
        break;
      case 'days_since':
        match = field ? daysSince(field) >= parseInt(cond.value) : false;
        break;
      case 'is_paid':
        match = app.paymentStatus === 'success' || app.paymentStatus === 'completed';
        break;
      case 'is_not_paid':
        match = app.paymentStatus !== 'success' && app.paymentStatus !== 'completed';
        break;
      case 'deadline_passed':
        match = app.internshipEndDate ? isBefore(app.internshipEndDate) : false;
        break;
      case 'deadline_not_passed':
        match = app.internshipEndDate ? !isBefore(app.internshipEndDate) : true;
        break;
      case 'in_state':
        match = app.currentState === cond.value;
        break;
      default:
        match = false;
    }

    if (cond.boolean === 'OR' && match) return true;
    if (cond.boolean === 'AND' && !match) return false;
    if (!cond.boolean && !match) return false;
  }

  return true;
}

async function executeAction(ruleId, rule, app) {
  const action = rule.action;
  if (!action) return;

  switch (action.type) {
    case 'send_email':
      await enqueue({
        applicationId: app.applicationId || app.id,
        internshipId: app.internshipId || '',
        userId: app.userId || '',
        email: app.email,
        fullName: app.fullName || 'Student',
        internshipDomain: app.internshipDomain || '',
        internshipTitle: app.internshipTitle || '',
        eventType: action.template || 'custom',
        template: action.template || 'promo',
        priority: action.priority || 'normal',
        category: action.category || rule.category || 'custom',
        currentState: app.currentState,
        status: STATUS.PENDING,
        payload: action.payload || {},
      });
      break;

    case 'send_email_with_approval':
      await requestApproval(
        action.template || 'promo',
        { ...app, recipientCount: 1, segment: 'rule_match' },
        `rule_${ruleId}`
      );
      break;

    case 'change_state':
      app.currentState = action.targetState;
      await rtdbSet(`email_queue_applications/${sanitize(app.applicationId || app.id)}`, app);
      break;

    case 'cancel_pending':
      await cancelPending(app.applicationId || app.id, app.email);
      break;

    case 'schedule_campaign':
      if (action.campaignId) {
        await rtdbSet(`campaigns/${action.campaignId}/matched_applications/${sanitize(app.applicationId || app.id)}`, {
          appId: app.applicationId || app.id,
          email: app.email,
          matchedAt: now(),
        });
      }
      break;

    case 'wait':
      console.log(`[RulesEngine] Wait action for ${app.email} — ${action.duration || 'no duration'}`);
      break;
  }

  await emit(EVENTS.RULE_TRIGGERED, {
    ruleId,
    applicationId: app.applicationId || app.id,
    email: app.email,
    action: action.type,
    template: action.template || '',
  });
}

export async function createRule(rule) {
  const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const fullRule = {
    ...rule,
    ruleId,
    createdAt: now(),
    updatedAt: now(),
    active: true,
    triggerCount: 0,
  };
  await rtdbSet(`rules/${ruleId}`, fullRule);
  return ruleId;
}

export async function getActiveRules() {
  const rules = await rtdbGet('rules') || {};
  return Object.entries(rules)
    .filter(([, r]) => r.active !== false)
    .map(([id, r]) => ({ id, ...r }));
}

function sanitize(s) {
  return (s || '').replace(/[.#$\[\]\/]/g, '_');
}

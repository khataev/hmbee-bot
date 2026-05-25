import jsonLogic from 'json-logic-js';
import type { AccountRegistry } from 'src/config.js';

/**
 * Interface for evaluating preview rules using JSON Logic.
 *
 * This module provides a project-local boundary around the third-party
 * json-logic-js library, focused specifically on boolean preview decisions.
 */

export interface RuleEvaluationContext {
  record: unknown;
  /**
   * Registry for checking owned accounts.
   */
  accountRegistry: AccountRegistry;
}

/**
 * Custom JSON logic operations
 */
jsonLogic.add_operation('is_owned', (account: string, bic: string | undefined, registry: AccountRegistry) => {
  return registry?.isOwned(account, bic);
});

jsonLogic.add_operation('is_deposit', (account: string, bic: string | undefined) => {
  return bic === '044525104' && account.startsWith('421');
});

/**
 * Evaluates a JSON Logic expression against a given context and returns a boolean result.
 *
 * @param rule The JSON Logic expression to evaluate.
 * @param context The context containing the record to evaluate against.
 * @returns true if the rule matches, false otherwise.
 */
export function evaluateRule(rule: unknown, context: RuleEvaluationContext): boolean {
  if (!rule || (typeof rule === 'object' && Object.keys(rule).length === 0)) {
    return false;
  }

  try {
    const result = jsonLogic.apply(rule as jsonLogic.RulesLogic, context);
    return !!result;
  } catch (_error) {
    return false;
  }
}

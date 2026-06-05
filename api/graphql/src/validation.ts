import {
  GraphQLError,
  Kind,
  NoSchemaIntrospectionCustomRule,
  type ASTVisitor,
  type RuleFunction,
  type SelectionSetNode,
  specifiedRules,
  type ValidationContext,
} from "graphql";

export const MAX_SEARCH_QUERY_LENGTH = 256;
export const MAX_ENTITY_ID_LENGTH = 512;
export const MAX_GRAPHQL_QUERY_CHARS = 16_384;
export const MAX_GRAPHQL_BODY_BYTES = 65_536;
export const MAX_GRAPHQL_DEPTH = 10;

export function validationRules(): readonly RuleFunction[] {
  const rules: RuleFunction[] = [...specifiedRules, depthLimitRule(MAX_GRAPHQL_DEPTH)];
  if (process.env.NODE_ENV === "production") {
    rules.push(NoSchemaIntrospectionCustomRule);
  }
  return rules;
}

function depthLimitRule(maxDepth: number): RuleFunction {
  return function depthLimit(context: ValidationContext): ASTVisitor {
    return {
      Document(node) {
        for (const definition of node.definitions) {
          if (definition.kind !== Kind.OPERATION_DEFINITION || !definition.selectionSet) {
            continue;
          }
          const depth = measureDepth(definition.selectionSet, 1);
          if (depth > maxDepth) {
            context.reportError(
              new GraphQLError(`Query exceeds maximum depth of ${maxDepth}`, {
                nodes: [definition],
              }),
            );
          }
        }
      },
    };
  };
}

function measureDepth(selectionSet: SelectionSetNode, current: number): number {
  let max = current;
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD && selection.selectionSet) {
      max = Math.max(max, measureDepth(selection.selectionSet, current + 1));
    }
    if (selection.kind === Kind.INLINE_FRAGMENT && selection.selectionSet) {
      max = Math.max(max, measureDepth(selection.selectionSet, current + 1));
    }
  }
  return max;
}

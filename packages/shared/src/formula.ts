/**
 * Safe formula evaluation engine (no eval)
 * Supports: numbers, arithmetic operators (+ - * /), parentheses, field references
 * Examples: 'quantity * unit_price', '(price - discount) * quantity'
 */

// ===== Tokenizer =====

type TokenType = 'number' | 'field' | 'op' | 'lparen' | 'rparen';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number (including decimals)
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < formula.length && /[0-9.]/.test(formula[i])) {
        num += formula[i++];
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Operator
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }

    // Field name (letters and underscores; cannot start with a digit)
    if (/[a-zA-Z_]/.test(ch)) {
      let field = '';
      while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) {
        field += formula[i++];
      }
      tokens.push({ type: 'field', value: field });
      continue;
    }

    throw new Error(`Unrecognized character in formula: '${ch}' (position ${i})`);
  }

  return tokens;
}

// ===== Parser (recursive descent) =====
// Grammar:
//   expr   → term (('+' | '-') term)*
//   term   → factor (('*' | '/') factor)*
//   factor → NUMBER | FIELD | '(' expr ')'

type ASTNode =
  | { type: 'number'; value: number }
  | { type: 'field'; name: string }
  | { type: 'binop'; op: string; left: ASTNode; right: ASTNode };

function parse(tokens: Token[]): ASTNode {
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token {
    return tokens[pos++];
  }

  function parseExpr(): ASTNode {
    let left = parseTerm();
    while (peek()?.type === 'op' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      left = { type: 'binop', op, left, right };
    }
    return left;
  }

  function parseTerm(): ASTNode {
    let left = parseFactor();
    while (peek()?.type === 'op' && (peek()!.value === '*' || peek()!.value === '/')) {
      const op = consume().value;
      const right = parseFactor();
      left = { type: 'binop', op, left, right };
    }
    return left;
  }

  function parseFactor(): ASTNode {
    const token = peek();
    if (!token) throw new Error('Incomplete formula');

    if (token.type === 'number') {
      consume();
      return { type: 'number', value: parseFloat(token.value) };
    }

    if (token.type === 'field') {
      consume();
      return { type: 'field', name: token.value };
    }

    if (token.type === 'lparen') {
      consume(); // skip '('
      const node = parseExpr();
      const rparen = consume();
      if (!rparen || rparen.type !== 'rparen') {
        throw new Error('Formula is missing a closing parenthesis');
      }
      return node;
    }

    throw new Error(`Unexpected token in formula: '${token.value}'`);
  }

  const ast = parseExpr();
  if (pos < tokens.length) {
    throw new Error(`Unexpected content after position ${pos} in formula: '${tokens[pos].value}'`);
  }
  return ast;
}

// ===== Evaluator =====

function evaluate(node: ASTNode, values: Record<string, number>): number {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'field': {
      const val = values[node.name];
      if (val === undefined) {
        throw new Error(`Formula references a non-existent field: '${node.name}'`);
      }
      return val;
    }
    case 'binop': {
      const left = evaluate(node.left, values);
      const right = evaluate(node.right, values);
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/':
          if (right === 0) return 0; // Division by zero returns 0 instead of throwing
          return left / right;
        default:
          throw new Error(`Unsupported operator: '${node.op}'`);
      }
    }
  }
}

// ===== Public API =====

/**
 * Evaluate a formula expression
 * @param formula Formula string, e.g. 'quantity * unit_price'
 * @param values  Field value map, e.g. { quantity: 5, unit_price: 100 }
 * @returns Computed result
 */
export function evaluateFormula(formula: string, values: Record<string, number>): number {
  const tokens = tokenize(formula);
  const ast = parse(tokens);
  return evaluate(ast, values);
}

/**
 * Validate whether a formula is legal
 * @param formula         Formula string
 * @param availableFields List of available field names
 */
export function validateFormula(
  formula: string,
  availableFields: string[]
): { valid: boolean; error?: string } {
  try {
    const tokens = tokenize(formula);
    const ast = parse(tokens);

    // Check that all referenced fields exist
    const used = extractDependenciesFromAST(ast);
    for (const field of used) {
      if (!availableFields.includes(field)) {
        return { valid: false, error: `Field '${field}' does not exist` };
      }
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

/**
 * Extract all field names referenced in a formula
 */
export function extractDependencies(formula: string): string[] {
  const tokens = tokenize(formula);
  const ast = parse(tokens);
  return extractDependenciesFromAST(ast);
}

function extractDependenciesFromAST(node: ASTNode): string[] {
  switch (node.type) {
    case 'number':
      return [];
    case 'field':
      return [node.name];
    case 'binop':
      return [
        ...extractDependenciesFromAST(node.left),
        ...extractDependenciesFromAST(node.right),
      ].filter((v, i, a) => a.indexOf(v) === i); // dedupe
  }
}

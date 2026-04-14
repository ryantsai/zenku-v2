/**
 * 安全的公式計算引擎（不使用 eval）
 * 支援：數字、四則運算 (+ - * /)、括號、欄位引用
 * 範例：'quantity * unit_price'、'(price - discount) * quantity'
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

    // 空白跳過
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // 數字（含小數）
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < formula.length && /[0-9.]/.test(formula[i])) {
        num += formula[i++];
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // 運算子
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // 括號
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

    // 欄位名（字母、底線、數字開頭不可）
    if (/[a-zA-Z_]/.test(ch)) {
      let field = '';
      while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) {
        field += formula[i++];
      }
      tokens.push({ type: 'field', value: field });
      continue;
    }

    throw new Error(`公式中有無法識別的字元：'${ch}'（位置 ${i}）`);
  }

  return tokens;
}

// ===== Parser (recursive descent) =====
// 文法：
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
    if (!token) throw new Error('公式不完整');

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
        throw new Error('公式缺少右括號');
      }
      return node;
    }

    throw new Error(`公式中有非預期的 token：'${token.value}'`);
  }

  const ast = parseExpr();
  if (pos < tokens.length) {
    throw new Error(`公式在位置 ${pos} 之後有多餘的內容：'${tokens[pos].value}'`);
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
        throw new Error(`公式引用了不存在的欄位：'${node.name}'`);
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
          if (right === 0) return 0; // 除以零回傳 0，不拋錯
          return left / right;
        default:
          throw new Error(`不支援的運算子：'${node.op}'`);
      }
    }
  }
}

// ===== 公開 API =====

/**
 * 計算公式的值
 * @param formula 公式字串，如 'quantity * unit_price'
 * @param values 欄位值對照表，如 { quantity: 5, unit_price: 100 }
 * @returns 計算結果
 */
export function evaluateFormula(formula: string, values: Record<string, number>): number {
  const tokens = tokenize(formula);
  const ast = parse(tokens);
  return evaluate(ast, values);
}

/**
 * 驗證公式是否合法
 * @param formula 公式字串
 * @param availableFields 可用的欄位名列表
 */
export function validateFormula(
  formula: string,
  availableFields: string[]
): { valid: boolean; error?: string } {
  try {
    const tokens = tokenize(formula);
    const ast = parse(tokens);

    // 檢查所有引用的欄位是否存在
    const used = extractDependenciesFromAST(ast);
    for (const field of used) {
      if (!availableFields.includes(field)) {
        return { valid: false, error: `欄位 '${field}' 不存在` };
      }
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

/**
 * 從公式中提取所有依賴的欄位名
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

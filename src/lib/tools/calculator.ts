import { tool } from "ai";
import { z } from "zod";

const allowedCharacters = /^[\d\s+\-*/().]+$/;

export const calculatorInputSchema = z.object({
  expression: z
    .string()
    .min(1)
    .max(120)
    .describe("A basic arithmetic expression using numbers, parentheses, +, -, *, and /."),
});

type CalculatorToken = number | "(" | ")" | "+" | "-" | "*" | "/";

export const calculator = tool({
  description:
    "Evaluate a safe arithmetic expression for budgeting, scoring, or quick deterministic calculations.",
  inputSchema: calculatorInputSchema,
  execute: async ({ expression }) => {
    const normalizedExpression = expression.replace(/\s+/g, " ").trim();
    const startedAt = Date.now();

    try {
      const value = evaluateExpression(normalizedExpression);

      return {
        ok: true,
        tool: "calculator" as const,
        expression: normalizedExpression,
        result: value,
        latencyMs: deterministicLatency(normalizedExpression, 18),
      };
    } catch (error) {
      return {
        ok: false,
        tool: "calculator" as const,
        expression: normalizedExpression,
        error: error instanceof Error ? error.message : "Calculation failed.",
        latencyMs: deterministicLatency(normalizedExpression, Date.now() - startedAt + 18),
      };
    }
  },
});

export function evaluateExpression(expression: string): number {
  if (!allowedCharacters.test(expression)) {
    throw new Error("Unsafe expression. Only numbers, spaces, parentheses, and + - * / are allowed.");
  }

  if (expression.includes("**") || expression.includes("//")) {
    throw new Error("Unsupported operator. Use only +, -, *, and /.");
  }

  const tokens = tokenize(expression);
  const rpn = toReversePolishNotation(tokens);
  return evaluateReversePolishNotation(rpn);
}

function tokenize(expression: string): CalculatorToken[] {
  const tokens: CalculatorToken[] = [];
  let currentNumber = "";

  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];

    if (character === " ") {
      continue;
    }

    if (/\d|\./.test(character)) {
      currentNumber += character;
      continue;
    }

    if (currentNumber) {
      const parsed = Number(currentNumber);

      if (!Number.isFinite(parsed)) {
        throw new Error("Invalid number in expression.");
      }

      tokens.push(parsed);
      currentNumber = "";
    }

    if (!isOperator(character) && character !== "(" && character !== ")") {
      throw new Error(`Unsupported token "${character}".`);
    }

    const previous = tokens.at(-1);
    const unaryMinus =
      character === "-" &&
      (previous === undefined || previous === "(" || isOperator(previous));

    if (unaryMinus) {
      currentNumber = "-";
      continue;
    }

    tokens.push(character);
  }

  if (currentNumber) {
    const parsed = Number(currentNumber);

    if (!Number.isFinite(parsed)) {
      throw new Error("Invalid trailing number in expression.");
    }

    tokens.push(parsed);
  }

  return tokens;
}

function toReversePolishNotation(tokens: CalculatorToken[]) {
  const output: CalculatorToken[] = [];
  const operators: CalculatorToken[] = [];

  for (const token of tokens) {
    if (typeof token === "number") {
      output.push(token);
      continue;
    }

    if (token === "(") {
      operators.push(token);
      continue;
    }

    if (token === ")") {
      while (operators.length > 0 && operators.at(-1) !== "(") {
        output.push(operators.pop() as CalculatorToken);
      }

      if (operators.pop() !== "(") {
        throw new Error("Mismatched parentheses.");
      }

      continue;
    }

    while (
      operators.length > 0 &&
      isOperator(operators.at(-1) as CalculatorToken) &&
      precedence(operators.at(-1) as CalculatorToken) >= precedence(token)
    ) {
      output.push(operators.pop() as CalculatorToken);
    }

    operators.push(token);
  }

  while (operators.length > 0) {
    const operator = operators.pop() as CalculatorToken;

    if (operator === "(" || operator === ")") {
      throw new Error("Mismatched parentheses.");
    }

    output.push(operator);
  }

  return output;
}

function evaluateReversePolishNotation(tokens: CalculatorToken[]) {
  const stack: number[] = [];

  for (const token of tokens) {
    if (typeof token === "number") {
      stack.push(token);
      continue;
    }

    const right = stack.pop();
    const left = stack.pop();

    if (left === undefined || right === undefined) {
      throw new Error("Invalid expression.");
    }

    switch (token) {
      case "+":
        stack.push(left + right);
        break;
      case "-":
        stack.push(left - right);
        break;
      case "*":
        stack.push(left * right);
        break;
      case "/":
        if (right === 0) {
          throw new Error("Division by zero is not allowed.");
        }

        stack.push(left / right);
        break;
      default:
        throw new Error("Unsupported operator.");
    }
  }

  if (stack.length !== 1) {
    throw new Error("Invalid expression.");
  }

  const result = stack[0];

  return Number(result.toFixed(6));
}

function isOperator(token: CalculatorToken | string): token is "+" | "-" | "*" | "/" {
  return token === "+" || token === "-" || token === "*" || token === "/";
}

function precedence(token: CalculatorToken) {
  return token === "+" || token === "-" ? 1 : 2;
}

function deterministicLatency(seed: string, minimum: number) {
  let checksum = 0;

  for (const character of seed) {
    checksum += character.charCodeAt(0);
  }

  return minimum + (checksum % 7);
}

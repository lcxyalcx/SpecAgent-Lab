export { calculator, calculatorInputSchema, evaluateExpression } from "./calculator";
export { calendar, calendarInputSchema } from "./calendar";
export { mockSearch, mockSearchInputSchema } from "./mock-search";
export { productDb, productDbInputSchema } from "./product-db";

import { calculator } from "./calculator";
import { calendar } from "./calendar";
import { mockSearch } from "./mock-search";
import { productDb } from "./product-db";

export const specAgentTools = {
  calculator,
  mockSearch,
  productDb,
  calendar,
};

import { balances, type Movement } from "./accounting";

// Period totals exclude openings, transfers and cancelled entries; account balances
// remain all-time so filters cannot make the available money misleading.
export function accountingReport(items: Movement[], year: string) {
  const active = items.filter((item) => !item.cancelled);
  const period = active.filter((item) => item.date.startsWith(year + "-"));
  const monthly = Array.from({ length: 12 }, (_, month) => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const total = balances(
      period.filter((item) => item.date.startsWith(prefix)),
    );
    return { month, income: total.income, expense: total.expense };
  });
  const byCategory = new Map<string, number>();
  for (const item of period) {
    if (item.kind === "expense")
      byCategory.set(
        item.category,
        (byCategory.get(item.category) ?? 0) + item.amount_cents,
      );
  }
  const expenses = [...byCategory]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  return {
    totals: balances(active),
    period: balances(period),
    monthly,
    expenses,
    count: period.length,
    recent: [...active]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .slice(0, 5),
  };
}

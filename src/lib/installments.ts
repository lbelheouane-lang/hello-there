/** Helpers for the installment payment system. */

export type SaleType = "full" | "installment";

export type PaymentStatus = "paid" | "partial" | "overdue" | "unpaid";

export interface SaleLike {
  total_amount: number;
  amount_paid: number;
  sale_type?: string | null;
  due_date?: string | null;
}

/** Remaining balance for a sale (never negative). */
export function balanceOf(sale: SaleLike): number {
  return Math.max(Number(sale.total_amount) - Number(sale.amount_paid), 0);
}

/** Percentage paid (0–100). */
export function percentPaid(sale: SaleLike): number {
  const total = Number(sale.total_amount);
  if (!total) return 0;
  return Math.min(Math.round((Number(sale.amount_paid) / total) * 100), 100);
}

/** Compute the payment status of a sale. */
export function statusOf(sale: SaleLike): PaymentStatus {
  const balance = balanceOf(sale);
  if (balance <= 0) return "paid";
  const overdue =
    sale.due_date != null && new Date(sale.due_date) < new Date(new Date().toDateString());
  if (overdue) return "overdue";
  if (Number(sale.amount_paid) > 0) return "partial";
  return "unpaid";
}

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  paid: { label: "Soldé", variant: "default" },
  partial: { label: "Partiellement payé", variant: "secondary" },
  overdue: { label: "En retard", variant: "destructive" },
  unpaid: { label: "Impayé", variant: "outline" },
};

/** Is this sale an installment plan with an outstanding balance? */
export function isActiveInstallment(sale: SaleLike): boolean {
  return sale.sale_type === "installment" && balanceOf(sale) > 0;
}

/** Generate a human-friendly receipt number. */
export function makeReceiptNumber(): string {
  return `REC-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

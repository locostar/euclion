export const paymentMethodLabels = {
  card: "카드", cash: "현금", pay: "간편결제", transfer: "계좌이체", other: "기타",
} as const;
export type PaymentMethod = keyof typeof paymentMethodLabels;

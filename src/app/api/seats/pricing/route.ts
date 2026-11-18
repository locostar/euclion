import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { parseJson, seatPricingInput } from "@/lib/request-validation";

type SeatPriceRow = {
  room_number: number;
  seat_number: number;
  monthly_fee: number;
};

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;

  const prices = await result.context.env.DB.prepare(
    `SELECT room_number, seat_number, monthly_fee
     FROM seat_pricing
     WHERE organization_id = ?
     ORDER BY room_number, seat_number`,
  )
    .bind(result.context.organizationId)
    .all<SeatPriceRow>();

  return apiJson(prices.results);
}

export async function PUT(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, seatPricingInput);
  if ("response" in parsed) return parsed.response;
  const { roomNumber, seatNumber, monthlyFee } = parsed.data;
  if (seatNumber > (roomNumber <= 4 ? 10 : 6)) {
    return apiError(400, "INVALID_SEAT", "해당 방의 좌석 번호를 확인해 주세요.");
  }

  await result.context.env.DB.batch([
    result.context.env.DB.prepare(
      `INSERT INTO seat_pricing
        (organization_id, room_number, seat_number, monthly_fee)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(organization_id, room_number, seat_number)
       DO UPDATE SET monthly_fee = excluded.monthly_fee, updated_at = ?`,
    ).bind(
      result.context.organizationId,
      roomNumber,
      seatNumber,
      monthlyFee,
      Date.now(),
    ),
    result.context.env.DB.prepare(
      `UPDATE seat_occupancy
       SET monthly_fee = ?
       WHERE organization_id = ? AND room_number = ? AND seat_number = ?
         AND is_demo = 0`,
    ).bind(
      monthlyFee,
      result.context.organizationId,
      roomNumber,
      seatNumber,
    ),
  ]);

  return apiJson({ saved: true });
}

import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { isSameDateInTimeZone } from "@/lib/date-utils";
import {
  parseJson,
  seatAssignmentInput,
  seatMoveInput,
} from "@/lib/request-validation";

type SeatRow = {
  id: string;
  room_number: number;
  seat_number: number;
  student_id: string | null;
  student_name: string;
  school: string | null;
  grade: string | null;
  gender: "male" | "female" | null;
  status: "present" | "absent" | "exited";
  entered_at: number;
  total_duration_ms: number;
  is_demo: number;
};

const demoStudents: {
  name: string;
  gender: "male" | "female";
  school: string;
  grade: string;
  minutesAgo: number;
}[] = [
  { name: "김민준", gender: "male", school: "인천해송고등학교", grade: "고3", minutesAgo: 48 },
  { name: "이서연", gender: "female", school: "인천포스코고등학교", grade: "재수", minutesAgo: 133 },
  { name: "박도윤", gender: "male", school: "인천포스코고등학교", grade: "고3", minutesAgo: 205 },
  { name: "최하은", gender: "female", school: "송도고등학교", grade: "삼수", minutesAgo: 317 },
  { name: "정우진", gender: "male", school: "인천해송고등학교", grade: "고2", minutesAgo: 27 },
  { name: "한지우", gender: "female", school: "인천해송고등학교", grade: "N수", minutesAgo: 92 },
  { name: "윤서준", gender: "male", school: "인천포스코고등학교", grade: "고3", minutesAgo: 181 },
  { name: "강예린", gender: "female", school: "인천포스코고등학교", grade: "재수", minutesAgo: 246 },
  { name: "오지호", gender: "male", school: "송도고등학교", grade: "고2", minutesAgo: 59 },
  { name: "임수아", gender: "female", school: "인천해송고등학교", grade: "삼수", minutesAgo: 154 },
  { name: "서현우", gender: "male", school: "인천해송고등학교", grade: "고3", minutesAgo: 276 },
  { name: "조유나", gender: "female", school: "인천포스코고등학교", grade: "재수", minutesAgo: 362 },
];

function roomCapacity(roomNumber: number) {
  return roomNumber <= 4 ? 10 : 6;
}

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;

  const rows = await result.context.env.DB.prepare(
    `SELECT so.id, so.room_number, so.seat_number, so.student_id,
            CASE WHEN so.student_id IS NOT NULL THEN s.name ELSE so.student_name END AS student_name,
            CASE WHEN so.student_id IS NOT NULL THEN s.school ELSE so.school END AS school,
            CASE WHEN so.student_id IS NOT NULL THEN s.grade ELSE so.grade END AS grade,
            s.gender, so.status, so.entered_at, so.total_duration_ms, so.is_demo
     FROM seat_occupancy so
     LEFT JOIN students s
       ON s.id = so.student_id AND s.organization_id = so.organization_id
     WHERE so.organization_id = ?
     ORDER BY so.room_number, so.seat_number`,
  )
    .bind(result.context.organizationId)
    .all<SeatRow>();

  const now = Date.now();
  return apiJson(rows.results.map((row) => {
    const sameDay = isSameDateInTimeZone(row.entered_at, now, "Asia/Seoul");
    return {
      ...row,
      status: sameDay ? row.status : "absent",
      total_duration_ms: sameDay ? row.total_duration_ms : 0,
      is_demo: Boolean(row.is_demo),
    };
  }));
}

export async function POST(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, seatAssignmentInput);
  if ("response" in parsed) return parsed.response;
  const { roomNumber, seatNumber, studentId } = parsed.data;
  if (seatNumber > roomCapacity(roomNumber)) {
    return apiError(400, "INVALID_SEAT", "해당 방의 좌석 번호를 확인해 주세요.");
  }

  const student = await result.context.env.DB.prepare(
    `SELECT id, name, school, grade, gender
     FROM students
     WHERE id = ? AND organization_id = ? AND status = 'active'
     LIMIT 1`,
  )
    .bind(studentId, result.context.organizationId)
    .first<{
      id: string;
      name: string;
      school: string | null;
      grade: string | null;
      gender: "male" | "female" | null;
    }>();
  if (!student) {
    return apiError(404, "STUDENT_NOT_FOUND", "재원 중인 학생을 찾을 수 없습니다.");
  }
  if (!student.gender || (roomNumber % 2 === 1 ? "male" : "female") !== student.gender) {
    return apiError(
      400,
      "ROOM_GENDER_MISMATCH",
      "홀수 방은 남학생, 짝수 방은 여학생만 배정할 수 있습니다.",
    );
  }

  const inserted = await result.context.env.DB.prepare(
    `INSERT INTO seat_occupancy
      (id, organization_id, room_number, seat_number, student_id,
      student_name, school, grade, status, entered_at, total_duration_ms, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'absent', ?, 0, 0)
     ON CONFLICT DO NOTHING`,
  )
    .bind(
      crypto.randomUUID(),
      result.context.organizationId,
      roomNumber,
      seatNumber,
      student.id,
      student.name,
      student.school,
      student.grade,
      Date.now(),
    )
    .run();

  if (inserted.meta.changes === 0) {
    return apiError(409, "SEAT_UNAVAILABLE", "좌석이 이미 사용 중이거나 학생이 다른 좌석에 있습니다.");
  }

  return apiJson({ assigned: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, seatMoveInput);
  if ("response" in parsed) return parsed.response;
  const { roomNumber, seatNumber, studentId } = parsed.data;
  if (seatNumber > roomCapacity(roomNumber)) {
    return apiError(400, "INVALID_SEAT", "해당 방의 좌석 번호를 확인해 주세요.");
  }

  const student = await result.context.env.DB.prepare(
    `SELECT gender FROM students
     WHERE id = ? AND organization_id = ? AND status = 'active' LIMIT 1`,
  )
    .bind(studentId, result.context.organizationId)
    .first<{ gender: "male" | "female" | null }>();
  if (!student) {
    return apiError(404, "STUDENT_NOT_FOUND", "재원 중인 학생을 찾을 수 없습니다.");
  }
  if (!student.gender || (roomNumber % 2 === 1 ? "male" : "female") !== student.gender) {
    return apiError(400, "ROOM_GENDER_MISMATCH", "홀수 방은 남학생, 짝수 방은 여학생만 배정할 수 있습니다.");
  }

  const moved = await result.context.env.DB.prepare(
    `UPDATE seat_occupancy
     SET room_number = ?, seat_number = ?
     WHERE organization_id = ? AND student_id = ? AND is_demo = 0
       AND NOT EXISTS (
         SELECT 1 FROM seat_occupancy target
         WHERE target.organization_id = ? AND target.room_number = ?
           AND target.seat_number = ? AND target.student_id IS NOT NULL
           AND target.student_id != ?
       )`,
  )
    .bind(
      roomNumber,
      seatNumber,
      result.context.organizationId,
      studentId,
      result.context.organizationId,
      roomNumber,
      seatNumber,
      studentId,
    )
    .run();

  if (!moved.meta.changes) {
    const assigned = await result.context.env.DB.prepare(
      "SELECT id FROM seat_occupancy WHERE organization_id = ? AND student_id = ? LIMIT 1",
    )
      .bind(result.context.organizationId, studentId)
      .first<{ id: string }>();
    if (!assigned) {
      return apiError(404, "ASSIGNED_SEAT_NOT_FOUND", "이동할 학생의 좌석을 찾을 수 없습니다.");
    }
    return apiError(409, "SEAT_UNAVAILABLE", "이동할 좌석이 이미 사용 중입니다.");
  }

  return apiJson({ moved: true });
}

export async function DELETE(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const query = new URL(request.url).searchParams;
  if (query.get("demo") === "true") {
    const deleted = await result.context.env.DB.prepare(
      "DELETE FROM seat_occupancy WHERE organization_id = ? AND is_demo = 1",
    )
      .bind(result.context.organizationId)
      .run();
    return apiJson({ deleted: deleted.meta.changes });
  }

  return apiError(400, "DEMO_FLAG_REQUIRED", "좌석은 학생 퇴원 시 자동으로 비워집니다.");
}

export async function PUT(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const demoCount = await result.context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM seat_occupancy WHERE organization_id = ? AND is_demo = 1",
  )
    .bind(result.context.organizationId)
    .first<{ count: number }>();
  if (demoCount?.count) {
    return apiError(409, "DEMO_SEATS_EXIST", "더미 좌석 데이터가 이미 있습니다. 먼저 삭제한 뒤 다시 추가해 주세요.");
  }

  const occupiedRows = await result.context.env.DB.prepare(
    "SELECT room_number, seat_number FROM seat_occupancy WHERE organization_id = ?",
  )
    .bind(result.context.organizationId)
    .all<{ room_number: number; seat_number: number }>();
  const occupied = new Set(
    occupiedRows.results.map((seat) => `${seat.room_number}:${seat.seat_number}`),
  );
  const freeSeats = Array.from({ length: 8 }, (_, index) => {
    const roomNumber = index + 1;
    return Array.from({ length: roomCapacity(roomNumber) }, (_, seatIndex) => ({
      roomNumber,
      seatNumber: seatIndex + 1,
    })).filter((seat) => !occupied.has(`${seat.roomNumber}:${seat.seatNumber}`));
  }).flat();

  const genderCounts = {
    male: demoStudents.filter((student) => student.gender === "male").length,
    female: demoStudents.filter((student) => student.gender === "female").length,
  };
  const availableByGender = {
    male: freeSeats.filter((seat) => seat.roomNumber % 2 === 1),
    female: freeSeats.filter((seat) => seat.roomNumber % 2 === 0),
  };
  if (
    availableByGender.male.length < genderCounts.male ||
    availableByGender.female.length < genderCounts.female
  ) {
    return apiError(409, "NOT_ENOUGH_SEATS", "더미 데이터를 넣을 빈 좌석이 부족합니다.");
  }

  const now = Date.now();
  await result.context.env.DB.batch(
    demoStudents.map((student, index) => {
      const seats = availableByGender[student.gender];
      const genderIndex = demoStudents
        .slice(0, index)
        .filter((previous) => previous.gender === student.gender).length;
      const seat = seats[genderIndex];
      return result.context.env.DB.prepare(
        `INSERT INTO seat_occupancy
          (id, organization_id, room_number, seat_number, student_id,
           student_name, school, grade, status, entered_at, total_duration_ms, is_demo)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'present', ?, 0, 1)`,
      ).bind(
        crypto.randomUUID(),
        result.context.organizationId,
        seat.roomNumber,
        seat.seatNumber,
        student.name,
        student.school,
        student.grade,
        now - student.minutesAgo * 60_000,
      );
    }),
  );

  return apiJson({ created: demoStudents.length }, { status: 201 });
}

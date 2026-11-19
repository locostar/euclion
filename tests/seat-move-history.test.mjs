import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

test("seat moves are recorded atomically and retained after withdrawal", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE organization (id TEXT PRIMARY KEY);
      CREATE TABLE students (id TEXT, organization_id TEXT, UNIQUE (id, organization_id));
      CREATE TABLE seat_occupancy (
        id TEXT PRIMARY KEY, organization_id TEXT, student_id TEXT,
        room_number INTEGER, seat_number INTEGER, is_demo INTEGER,
        UNIQUE (organization_id, room_number, seat_number)
      );
      INSERT INTO organization VALUES ('academy');
      INSERT INTO students VALUES ('student', 'academy'), ('other', 'academy');
      INSERT INTO seat_occupancy VALUES
        ('first', 'academy', 'student', 1, 1, 0),
        ('second', 'academy', 'other', 1, 2, 0);
    `);
    db.exec(readFileSync(new URL("../migrations/0012_seat_move_history.sql", import.meta.url), "utf8"));
    assert.throws(() => db.exec("UPDATE seat_occupancy SET seat_number = 2 WHERE id = 'first'"));
    db.exec(`
      UPDATE seat_occupancy SET seat_number = 1 WHERE id = 'first';
      UPDATE seat_occupancy SET room_number = 3, seat_number = 4 WHERE id = 'first';
      UPDATE seat_occupancy SET seat_number = 5 WHERE id = 'first';
      DELETE FROM seat_occupancy WHERE id = 'first';
    `);
    const records = db.prepare(
      "SELECT from_room, from_seat, to_room, to_seat FROM seat_move_history WHERE student_id = ? ORDER BY rowid",
    ).all("student");
    assert.deepEqual(records.map((record) => Object.values(record)), [[1, 1, 3, 4], [3, 4, 3, 5]]);
  } finally {
    db.close();
  }
});

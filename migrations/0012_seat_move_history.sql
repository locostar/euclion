CREATE TABLE `seat_move_history` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `student_id` text NOT NULL,
  `from_room` integer NOT NULL,
  `from_seat` integer NOT NULL,
  `to_room` integer NOT NULL,
  `to_seat` integer NOT NULL,
  `moved_at` integer NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade,
  FOREIGN KEY (`student_id`, `organization_id`) REFERENCES `students`(`id`, `organization_id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `seat_move_history_student_idx` ON `seat_move_history` (`organization_id`, `student_id`, `moved_at`);
--> statement-breakpoint
CREATE TRIGGER `record_seat_move` AFTER UPDATE OF `room_number`, `seat_number` ON `seat_occupancy`
WHEN OLD.student_id IS NOT NULL AND NEW.student_id = OLD.student_id
  AND OLD.is_demo = 0 AND NEW.is_demo = 0
  AND (OLD.room_number != NEW.room_number OR OLD.seat_number != NEW.seat_number)
BEGIN
  INSERT INTO seat_move_history
    (id, organization_id, student_id, from_room, from_seat, to_room, to_seat, moved_at)
  VALUES
    (lower(hex(randomblob(16))), NEW.organization_id, NEW.student_id,
     OLD.room_number, OLD.seat_number, NEW.room_number, NEW.seat_number,
     cast(unixepoch('subsecond') * 1000 as integer));
END;
